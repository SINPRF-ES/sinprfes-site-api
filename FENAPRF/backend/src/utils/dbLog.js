// src/utils/dbLog.js
function getDbSafeInfo(databaseUrl) {
  try {
    if (!databaseUrl) return { ok: false, reason: "DATABASE_URL ausente" };

    // Aceita formatos tipo postgres://... ou postgresql://...
    const url = new URL(databaseUrl);

    const host = url.hostname || null;
    const port = url.port || null;
    const dbname = (url.pathname || "").replace(/^\//, "") || null;
    const sslmode = url.searchParams.get("sslmode") || null;

    return { ok: true, host, port, dbname, sslmode };
  } catch {
    // Fallback para strings que não sejam URL válida
    // Ex.: "host=... dbname=... user=..."
    const host = /host=([^\s]+)/i.exec(databaseUrl)?.[1] ?? null;
    const dbname = /dbname=([^\s]+)/i.exec(databaseUrl)?.[1] ?? null;
    return { ok: true, host, port: null, dbname, sslmode: null };
  }
}

function logDbSafeInfo(prefix = "DB") {
  const info = getDbSafeInfo(process.env.DATABASE_URL);
  if (!info.ok) {
    console.log(`[${prefix}]`, info.reason);
    return;
  }
  console.log(
    `[${prefix}] host=${info.host ?? "?"} port=${info.port ?? "?"} db=${info.dbname ?? "?"} sslmode=${info.sslmode ?? "-"}`
  );
}

module.exports = { logDbSafeInfo };
