// src/controllers/diagnostico.controller.js
const log = require("../utils/log");

async function limparLogs(req, res) {
  const start = Date.now();
  try {
    const { recordsDeleted } = req.body;

    // Auditoria via log estruturado conforme diretriz
    log.info("DIAGNOSTICO_LOGS_LIMPOS_GLOBAL", {
      requestId: req.requestId,
      userId: req.user.id,
      perfil: req.user.perfil_acesso,
      action: "diagnostico.logs.clear",
      recordsDeleted: recordsDeleted || 0,
      platform: 'mobile',
      elapsedMs: Date.now() - start
    });

    res.json({
      success: true,
      message: "Limpeza de logs auditada com sucesso.",
      cleared: recordsDeleted || 0
    });
  } catch (err) {
    log.error("DiagnosticoLimparLogsErro", {
      requestId: req.requestId,
      userId: req.user.id,
      error: err.message
    });
    res.status(500).json({ error: "Erro ao registrar auditoria de limpeza de logs" });
  }
}

module.exports = {
  limparLogs
};
