// src/controllers/votacoes.controller.js
const service = require("../services/votacoes.service");
const { parseUuid } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

function parseId(req) {
  return parseUuid(req.params.id);
}

exports.listar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const status = (req.query.status || "").toString().toUpperCase().trim(); // opcional
    const lista = await service.listarVotacoes({ userId: req.user.id, status });
    return res.json(lista);
  } catch (err) {
    log.error("VotacoesListarErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId });
  }
};

exports.detalhe = async (req, res) => {
  const requestId = req.requestId;
  try {
    const votacaoId = parseId(req);
    if (!votacaoId) return res.status(400).json({ error: "ID inválido.", requestId });

    const v = await service.obterVotacao({ votacaoId, userId: req.user.id });
    if (!v) return res.status(404).json({ error: "Votação não encontrada.", requestId });

    return res.json(v);
  } catch (err) {
    log.error("VotacoesDetalheErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId });
  }
};

exports.criar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const { titulo, descricao, abre_em, encerra_em, opcoes } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ error: "Informe o título.", requestId });
    }
    if (!Array.isArray(opcoes) || opcoes.length < 2) {
      return res.status(400).json({ error: "Informe pelo menos 2 opções.", requestId });
    }

    const result = await service.criarVotacao({
      criadoPor: req.user.id,
      titulo: titulo.trim(),
      descricao: (descricao || "").toString(),
      abreEm: abre_em || null,
      encerraEm: encerra_em || null,
      opcoes,
    });

    return res.status(201).json(result);
  } catch (err) {
    log.error("VotacoesCriarErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CRIAR, requestId });
  }
};

exports.abrir = async (req, res) => {
  const requestId = req.requestId;
  try {
    const votacaoId = parseId(req);
    if (!votacaoId) return res.status(400).json({ error: "ID inválido.", requestId });

    const ok = await service.abrirVotacao({ votacaoId });
    if (!ok) return res.status(404).json({ error: "Votação não encontrada.", requestId });

    return res.json({ message: "Votação aberta." });
  } catch (err) {
    log.error("VotacoesAbrirErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId });
  }
};

exports.encerrar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const votacaoId = parseId(req);
    if (!votacaoId) return res.status(400).json({ error: "ID inválido.", requestId });

    const ok = await service.encerrarVotacao({ votacaoId });
    if (!ok) return res.status(404).json({ error: "Votação não encontrada.", requestId });

    return res.json({ message: "Votação encerrada." });
  } catch (err) {
    log.error("VotacoesEncerrarErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId });
  }
};

exports.votar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const votacaoId = parseId(req);
    if (!votacaoId) return res.status(400).json({ error: "ID inválido.", requestId });

    const body = req.body || {};

    // Aceita snake_case (Thunder/legacy) e camelCase (app)
    const opcaoId =
      body.opcao_id ??
      body.opcaoId ??
      body.opcao ??
      body.opcaoID;

    const deviceId = body.device_id ?? body.deviceId ?? null;
    const biometriaConfirmada =
      body.biometria_confirmada ?? body.biometriaConfirmada ?? false;

    if (!opcaoId || !parseUuid(opcaoId)) {
      return res.status(400).json({
        error: "Opção inválida (UUID esperado).",
        debug: {
          recebido: opcaoId,
          esperado: "opcao_id (uuid) ou opcaoId (uuid)",
        },
        requestId
      });
    }

    const result = await service.registrarVoto({
      votacaoId: votacaoId,
      opcaoId,
      userId: req.user.id,
      deviceId: deviceId ? String(deviceId) : null,
      biometriaConfirmada: Boolean(biometriaConfirmada),
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(201).json(result);
  } catch (err) {
    const msg = err?.message || "";
    const isBusinessError =
      msg.includes("já votou") ||
      msg.includes("encerrada") ||
      msg.includes("não está aberta") ||
      msg.toLowerCase().includes("opção inválida");

    log.error("VotacoesVotarErro", { error: err.message, stack: err.stack, requestId });

    if (isBusinessError) {
        return res.status(400).json({ error: msg, requestId });
    }

    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId });
  }
};

exports.resultado = async (req, res) => {
  const requestId = req.requestId;
  try {
    const votacaoId = parseId(req);
    if (!votacaoId) return res.status(400).json({ error: "ID inválido.", requestId });

    const r = await service.obterResultado({ votacaoId: votacaoId });
    if (!r) return res.status(404).json({ error: "Votação não encontrada.", requestId });

    return res.json(r);
  } catch (err) {
    log.error("VotacoesResultadoErro", { error: err.message, stack: err.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId });
  }
};
