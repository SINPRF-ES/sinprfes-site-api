// src/controllers/repasse.controller.js
const repasseService = require("../services/repasse.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

async function getRepasseAno(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await repasseService.getRepasseAno(year);

    log.info("RepasseGetAnoSucesso", { requestId, atorId, year });

    res.json({ success: true, ...data, requestId });
  } catch (err) {
    log.error("RepasseGetAnoErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function getResumo(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const ano = parseInt(req.query.ano || req.query.year) || new Date().getFullYear();
    const data = await repasseService.getRepasseResumo(ano);
    log.info("RepasseGetResumoSucesso", { requestId, atorId, ano });
    res.json({ success: true, ...data, requestId });
  } catch (err) {
    log.error("RepasseGetResumoErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function updateRepasseMes(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const { year, month, perCapita, localidades } = req.body;

    if (!year || !month || perCapita === undefined || !Array.isArray(localidades)) {
      return res.status(400).json({ success: false, message: "Dados incompletos.", requestId });
    }

    await repasseService.updateRepasseMes(year, month, perCapita, localidades);

    log.info("RepasseUpdateMesSucesso", { requestId, atorId, year, month });

    res.json({ success: true, message: "Dados atualizados com sucesso.", requestId });
  } catch (err) {
    log.error("RepasseUpdateMesErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function updateConfig(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const ano = parseInt(req.query.ano || req.query.year) || parseInt(req.body.ano_ref);
    const { perCapitaGlobalAnual, perCapitaApoioOperacionalAnual } = req.body;

    if (!ano || perCapitaGlobalAnual === undefined || perCapitaApoioOperacionalAnual === undefined) {
      return res.status(400).json({ success: false, message: "Dados incompletos.", requestId });
    }

    const config = await repasseService.updateRepasseConfig(
      ano,
      Number(perCapitaGlobalAnual),
      Number(perCapitaApoioOperacionalAnual)
    );

    log.info("RepasseUpdateConfigSucesso", { requestId, atorId, ano });
    res.json({ success: true, config, requestId });
  } catch (err) {
    log.error("RepasseUpdateConfigErro", { requestId, atorId, error: err.message });
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function listarEventos(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const ano = parseInt(req.query.ano || req.query.year) || new Date().getFullYear();
    const eventos = await repasseService.listarEventos(ano, req.query.status);
    res.json({ success: true, eventos, requestId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function criarEvento(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const evento = await repasseService.criarEvento(req.body, atorId);
    res.status(201).json({ success: true, evento, requestId });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function atualizarEvento(req, res) {
  const requestId = req.requestId || uuidv4();
  try {
    const evento = await repasseService.atualizarEvento(Number(req.params.id), req.body);
    res.json({ success: true, evento, requestId });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function abrirEvento(req, res) {
  const requestId = req.requestId || uuidv4();
  try {
    const evento = await repasseService.alterarStatusEvento(Number(req.params.id), "ABERTO");
    res.json({ success: true, evento, requestId });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function encerrarEvento(req, res) {
  const requestId = req.requestId || uuidv4();
  try {
    const evento = await repasseService.alterarStatusEvento(Number(req.params.id), "ENCERRADO");
    res.json({ success: true, evento, requestId });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function alocarMeuRecurso(req, res) {
  const requestId = req.requestId || uuidv4();
  try {
    const alocacao = await repasseService.alocarEmEvento(Number(req.params.id), req.user.id);
    res.json({ success: true, alocacao, requestId });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, requestId });
  }
}

async function listarResponsaveis(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const { lotacao, q } = req.query;
    const shouldUseBusca = q !== undefined;
    const responsaveis = shouldUseBusca
      ? await repasseService.listarResponsaveisComBusca(q)
      : await repasseService.listarResponsaveis(lotacao);

    log.info("RepasseListarResponsaveisSucesso", { requestId, atorId, lotacao, q });

    res.json({ success: true, responsaveis, requestId });
  } catch (err) {
    log.error("RepasseListarResponsaveisErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

module.exports = {
  getRepasseAno,
  getResumo,
  updateRepasseMes,
  updateConfig,
  listarEventos,
  criarEvento,
  atualizarEvento,
  abrirEvento,
  encerrarEvento,
  alocarMeuRecurso,
  listarResponsaveis
};
