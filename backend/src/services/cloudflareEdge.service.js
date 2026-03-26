const pool = require('../config/db');
const log = require('../utils/log');

const API_URL = 'https://api.cloudflare.com/client/v4/graphql';

function getConfig() {
  return {
    enabled: String(process.env.CF_EDGE_INGEST_ENABLED || 'false').toLowerCase() === 'true',
    token: process.env.CLOUDFLARE_API_TOKEN || '',
    zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    daysBackfill: Math.max(1, Number(process.env.CF_EDGE_DAYS_BACKFILL || 365)),
  };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildDateWindow(daysBackfill) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - Math.max(0, daysBackfill - 1));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

async function fetchCloudflareDaily({ token, zoneId, start, end }) {
  const query = `
    query AnalyticsByDay($zoneTag: String!, $dateStart: Date!, $dateEnd: Date!, $limit: Int!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: $limit,
            filter: { date_geq: $dateStart, date_leq: $dateEnd }
          ) {
            dimensions { date }
            sum {
              requests
              cachedRequests
              threats
              pageViews
              visits
            }
          }
        }
      }
    }
  `;

  const variables = {
    zoneTag: zoneId,
    dateStart: start,
    dateEnd: end,
    limit: 5000,
  };

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    throw new Error(`Cloudflare GraphQL HTTP ${resp.status}`);
  }

  const payload = await resp.json();
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  if (errors.length > 0) {
    throw new Error(`Cloudflare GraphQL error: ${errors[0]?.message || 'unknown'}`);
  }

  const rows = payload?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  return rows.map((row) => ({
    metric_date: row?.dimensions?.date,
    requests_total: Number(row?.sum?.requests || 0),
    cached_requests: Number(row?.sum?.cachedRequests || 0),
    threats_total: Number(row?.sum?.threats || 0),
    page_views: Number(row?.sum?.pageViews || 0),
    visits_total: Number(row?.sum?.visits || 0),
  })).filter((row) => row.metric_date);
}

async function upsertDailyRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        `INSERT INTO cloudflare_edge_daily
          (metric_date, requests_total, cached_requests, threats_total, page_views, visits_total, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW())
         ON CONFLICT (metric_date) DO UPDATE SET
           requests_total = EXCLUDED.requests_total,
           cached_requests = EXCLUDED.cached_requests,
           threats_total = EXCLUDED.threats_total,
           page_views = EXCLUDED.page_views,
           visits_total = EXCLUDED.visits_total,
           synced_at = NOW()`,
        [
          row.metric_date,
          row.requests_total,
          row.cached_requests,
          row.threats_total,
          row.page_views,
          row.visits_total,
        ]
      );
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

let running = false;

async function syncCloudflareEdge(trigger = 'manual') {
  if (running) {
    return { ok: true, skipped: true, reason: 'sync_in_progress' };
  }

  const cfg = getConfig();
  if (!cfg.enabled) return { ok: true, skipped: true, reason: 'disabled' };
  if (!cfg.token || !cfg.zoneId) return { ok: false, skipped: true, reason: 'missing_credentials' };

  running = true;
  const startedAt = Date.now();
  try {
    const range = buildDateWindow(cfg.daysBackfill);
    const remoteRows = await fetchCloudflareDaily({
      token: cfg.token,
      zoneId: cfg.zoneId,
      start: range.start,
      end: range.end,
    });

    const upserted = await upsertDailyRows(remoteRows);

    log.info('CloudflareEdgeSyncSuccess', {
      trigger,
      zoneId: cfg.zoneId,
      accountId: cfg.accountId || null,
      daysBackfill: cfg.daysBackfill,
      recordsFetched: remoteRows.length,
      recordsUpserted: upserted,
      elapsedMs: Date.now() - startedAt,
    });

    return { ok: true, skipped: false, upserted, fetched: remoteRows.length, range };
  } catch (error) {
    log.warn('CloudflareEdgeSyncFailed', {
      trigger,
      message: error?.message,
    });
    return { ok: false, skipped: false, error: error?.message || 'sync_failed' };
  } finally {
    running = false;
  }
}

module.exports = {
  syncCloudflareEdge,
  getCloudflareEdgeConfig: getConfig,
};
