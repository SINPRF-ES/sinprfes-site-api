const pool = require('../config/db');
const { ehPerfilGestao } = require('../shared/canon');

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
  const perfil = String(req.user?.perfil_acesso || '').toUpperCase();

  if (!ehPerfilGestao(perfil)) {
    return res.status(403).json({ success: false, error: 'Acesso restrito à gestão.', requestId });
  }

  try {
    const [totaisRes, origensRes, paginasRes] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE accessed_at >= date_trunc('day', NOW()))::int AS diario,
          COUNT(*) FILTER (WHERE accessed_at >= date_trunc('month', NOW()))::int AS mensal
        FROM site_access_logs`
      ),
      pool.query(
        `SELECT origem_tipo, COALESCE(origem_valor, '(não informado)') AS origem_valor, COUNT(*)::int AS acessos
         FROM site_access_logs
         WHERE accessed_at >= NOW() - INTERVAL '30 days'
         GROUP BY origem_tipo, COALESCE(origem_valor, '(não informado)')
         ORDER BY acessos DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT COALESCE(path, '(sem rota)') AS path, COUNT(*)::int AS acessos
         FROM site_access_logs
         WHERE accessed_at >= NOW() - INTERVAL '30 days'
         GROUP BY COALESCE(path, '(sem rota)')
         ORDER BY acessos DESC
         LIMIT 10`
      )
    ]);

    return res.json({
      success: true,
      requestId,
      metricas: totaisRes.rows[0] || { total: 0, diario: 0, mensal: 0 },
      origens: origensRes.rows,
      paginas: paginasRes.rows,
      janela_origens_dias: 30,
    });
  } catch (error) {
    console.error('[analytics] falha ao consultar resumo', { requestId, error: error?.message });
    return res.status(500).json({ success: false, error: 'Erro ao consultar estatísticas.', requestId });
  }
}

module.exports = {
  registrarAcesso,
  obterResumo,
};
