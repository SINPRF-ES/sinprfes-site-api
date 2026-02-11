// src/controllers/diagnostico.controller.js
const log = require("../utils/log");

async function limparLogs(req, res) {
  const start = Date.now();
  const requestId = req.requestId;
  try {
    const { recordsDeleted } = req.body;

    // Auditoria via log estruturado conforme diretriz
    log.info("DIAGNOSTICO_LOGS_LIMPOS_GLOBAL", {
      requestId,
      userId: req.user?.id,
      perfil: req.user?.perfil_acesso,
      action: "diagnostico.logs.clear",
      recordsDeleted: recordsDeleted || 0,
      platform: 'mobile',
      durationMs: Date.now() - start
    });

    res.json({
      success: true,
      message: "Limpeza de logs auditada com sucesso.",
      cleared: recordsDeleted || 0,
      requestId
    });
  } catch (err) {
    log.error("DiagnosticoLimparLogsErro", {
      requestId,
      userId: req.user?.id,
      errorMessage: err.message,
      stack: err.stack,
      durationMs: Date.now() - start
    });
    res.status(500).json({
      success: false,
      message: "Erro ao registrar auditoria de limpeza de logs",
      error: "Erro ao registrar auditoria de limpeza de logs",
      code: "INTERNAL_SERVER_ERROR",
      requestId
    });
  }
}

async function registrarLog(req, res) {
  const start = Date.now();
  const requestId = req.requestId;
  try {
    const { source, event, meta } = req.body;

    // Log estruturado no backend
    log.info(`MOBILE_DIAGNOSTICO_${(event || 'UNKNOWN').toUpperCase()}`, {
      requestId,
      userId: req.user?.id,
      profile: req.user?.perfil_acesso,
      source: source || 'mobile',
      event: event,
      meta: meta,
      durationMs: Date.now() - start
    });

    res.json({ success: true, requestId });
  } catch (err) {
    log.error("DiagnosticoRegistrarLogErro", {
      requestId,
      userId: req.user?.id,
      errorMessage: err.message,
      stack: err.stack,
      durationMs: Date.now() - start
    });
    res.status(500).json({
      success: false,
      message: "Erro ao registrar log de diagnóstico",
      error: "Erro ao registrar log de diagnóstico",
      code: "INTERNAL_SERVER_ERROR",
      requestId
    });
  }
}

module.exports = {
  limparLogs,
  registrarLog
};
