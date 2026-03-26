const pool = require('../config/db');
const { ehPerfilGestao } = require('../shared/canon');
const { syncCloudflareEdge, getCloudflareEdgeConfig } = require('../services/cloudflareEdge.service');

function toNullableString(value, maxLen = 300) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function extractIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).split(',')[0].trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();

  return req.socket?.remoteAddress || null;
}

function getTimezone() {
  return process.env.ANALYTICS_TIMEZONE || 'America/Sao_Paulo';
}

function assertGestao(req, res) {
  const requestId = req.requestId || 'n/d';
  const perfil = String(req.user?.perfil_acesso || '').toUpperCase();

  if (!ehPerfilGestao(perfil)) {
    res.status(403).json({ success: false, error: 'Acesso restrito à gestão.', requestId });
    return false;
  }

  return true;
}

async function registrarAcesso(req, res) {
  const requestId = req.requestId || 'n/d';
  const body = req.body || {};

  const path = toNullableString(body.path || req.path, 200);
  const origemTipo = toNullableString(body.origem_tipo, 50) || 'desconhecida';
  const origemValor = toNullableString(body.origem_valor, 500);
  const referrerHost = toNullableString(body.referrer_host, 200);
  const utmSource = toNullableString(body.utm_source, 120);
  const utmMedium = toNullableString(body.utm_medium, 120);
  const utmCampaign = toNullableString(body.utm_campaign, 120);
  const ip = toNullableString(extractIp(req), 80);
  const userAgent = toNullableString(req.headers['user-agent'], 400);

  try {
    await pool.query(
      `INSERT INTO site_access_logs
       (path, origem_tipo, origem_valor, referrer_host, utm_source, utm_medium, utm_campaign, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [path, origemTipo, origemValor, referrerHost, utmSource, utmMedium, utmCampaign, ip, userAgent]
    );

    return res.status(202).json({ success: true, requestId });
  } catch (error) {
    console.error('[analytics] falha ao registrar acesso', { requestId, error: error?.message });
    return res.status(202).json({ success: false, requestId });
  }
}

async function obterResumo(req, res) {
  const requestId = req.requestId || 'n/d';
  if (!assertGestao(req, res)) return;

  const timezone = getTimezone();

  try {
    const [totaisRes, origensRes, paginasRes] = await Promise.all([
      pool.query(
        `WITH tz AS (
          SELECT
            (NOW() AT TIME ZONE $1)::date AS hoje_local,
            date_trunc('month', NOW() AT TIME ZONE $1)::date AS mes_inicio_local
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE (accessed_at AT TIME ZONE $1)::date = tz.hoje_local
          )::int AS diario,
          COUNT(*) FILTER (
            WHERE (accessed_at AT TIME ZONE $1)::date >= tz.mes_inicio_local
          )::int AS mensal
        FROM site_access_logs, tz`,
        [timezone]
      ),
      pool.query(
        `SELECT origem_tipo, COALESCE(origem_valor, '(não informado)') AS origem_valor, COUNT(*)::int AS acessos
         FROM site_access_logs
         GROUP BY origem_tipo, COALESCE(origem_valor, '(não informado)')
         ORDER BY acessos DESC
         LIMIT 15`
      ),
      pool.query(
        `SELECT COALESCE(path, '(sem rota)') AS path, COUNT(*)::int AS acessos
         FROM site_access_logs
         GROUP BY COALESCE(path, '(sem rota)')
         ORDER BY acessos DESC
         LIMIT 15`
      )
    ]);

    let cloudflare = {
      enabled: getCloudflareEdgeConfig().enabled,
      available: false,
      timezone,
      metricas: { total: 0, diario: 0, mensal: 0, cache_hit_ratio: 0, ameacas_total: 0, page_views_total: 0 },
      recorte: { inicio: null, fim: null, dias: 0 },
    };

    try {
      const cfRes = await pool.query(
        `WITH tz AS (
          SELECT
            (NOW() AT TIME ZONE $1)::date AS hoje_local,
            date_trunc('month', NOW() AT TIME ZONE $1)::date AS mes_inicio_local
        ),
        span AS (
          SELECT MIN(metric_date) AS inicio, MAX(metric_date) AS fim, COUNT(*)::int AS dias
          FROM cloudflare_edge_daily
        )
        SELECT
          COALESCE(SUM(requests_total), 0)::bigint AS total,
          COALESCE(SUM(requests_total) FILTER (WHERE metric_date = tz.hoje_local), 0)::bigint AS diario,
          COALESCE(SUM(requests_total) FILTER (WHERE metric_date >= tz.mes_inicio_local), 0)::bigint AS mensal,
          COALESCE(SUM(cached_requests), 0)::bigint AS cached_total,
          COALESCE(SUM(threats_total), 0)::bigint AS ameacas_total,
          COALESCE(SUM(page_views), 0)::bigint AS page_views_total,
          span.inicio,
          span.fim,
          span.dias
        FROM cloudflare_edge_daily, tz, span
        GROUP BY span.inicio, span.fim, span.dias`,
        [timezone]
      );

      const row = cfRes.rows[0] || {};
      const total = Number(row.total || 0);
      const cachedTotal = Number(row.cached_total || 0);
      const cacheHitRatio = total > 0 ? Number(((cachedTotal / total) * 100).toFixed(2)) : 0;

      cloudflare = {
        enabled: getCloudflareEdgeConfig().enabled,
        available: true,
        timezone,
        metricas: {
          total,
          diario: Number(row.diario || 0),
          mensal: Number(row.mensal || 0),
          cache_hit_ratio: cacheHitRatio,
          ameacas_total: Number(row.ameacas_total || 0),
          page_views_total: Number(row.page_views_total || 0),
        },
        recorte: {
          inicio: row.inicio || null,
          fim: row.fim || null,
          dias: Number(row.dias || 0),
        },
      };
    } catch (cfError) {
      if (cfError?.code !== '42P01') {
        console.error('[analytics] falha ao consultar cloudflare_edge_daily', { requestId, error: cfError?.message });
      }
    }

    return res.json({
      success: true,
      requestId,
      timezone,
      metricas: totaisRes.rows[0] || { total: 0, diario: 0, mensal: 0 },
      origens: origensRes.rows,
      paginas: paginasRes.rows,
      janela_origens_dias: 'all',
      cloudflare,
    });
  } catch (error) {
    console.error('[analytics] falha ao consultar resumo', { requestId, error: error?.message });
    return res.status(500).json({ success: false, error: 'Erro ao consultar estatísticas.', requestId });
  }
}

async function sincronizarCloudflare(req, res) {
  const requestId = req.requestId || 'n/d';
  if (!assertGestao(req, res)) return;

  const result = await syncCloudflareEdge('manual_api');
  if (!result.ok) {
    return res.status(500).json({ success: false, requestId, ...result });
  }

  return res.json({ success: true, requestId, ...result });
}

module.exports = {
  registrarAcesso,
  obterResumo,
  sincronizarCloudflare,
};
