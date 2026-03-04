// src/controllers/votacoes.controller.js
const service = require("../services/votacoes.service");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");
const log = require("../utils/log");

function parseId(req, res, requestId) {
  const raw = String(req.params.id || "").trim();
  if (!/^\d+$/.test(raw)) {
    if (res) res.status(400).json({ success: false, error: "ID inválido.", requestId });
    return null;
  }
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    if (res) res.status(400).json({ success: false, error: "ID inválido.", requestId });
    return null;
  }
  return id;
}

exports.listar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const status = (req.query.status || "").toString().toUpperCase().trim(); // opcional
    const lista = await service.listarVotacoes({ userId: atorId, status });
    return res.json({
      success: true,
      lista,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao listar votações.");
  }
};

exports.detalhe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const v = await service.obterVotacao({ votacaoId: id, userId: atorId });
    if (!v) return res.status(404).json({ success: false, error: "Votação não encontrada.", requestId });

    return res.json({
      ...v,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao carregar votação.");
  }
};

exports.criar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const { titulo, descricao, abre_em, encerra_em, opcoes } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ success: false, error: "Informe o título.", requestId });
    }
    if (!Array.isArray(opcoes) || opcoes.length < 2) {
      return res.status(400).json({ success: false, error: "Informe pelo menos 2 opções.", requestId });
    }

    const result = await service.criarVotacao({
      criadoPor: atorId,
      titulo: titulo.trim(),
      descricao: (descricao || "").toString(),
      abreEm: abre_em || null,
      encerraEm: encerra_em || null,
      opcoes,
    });

    log.info("VotacaoCriada", { requestId, atorId, votacaoId: result.id });

    return res.status(201).json({
      ...result,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao criar votação.");
  }
};

exports.abrir = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const ok = await service.abrirVotacao({ votacaoId: id });
    if (!ok) return res.status(404).json({ success: false, error: "Votação não encontrada.", requestId });

    log.info("VotacaoAberta", { requestId, atorId, votacaoId: id });

    return res.json({ success: true, message: "Votação aberta.", requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao abrir votação.");
  }
};

exports.encerrar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const ok = await service.encerrarVotacao({ votacaoId: id });
    if (!ok) return res.status(404).json({ success: false, error: "Votação não encontrada.", requestId });

    log.info("VotacaoEncerrada", { requestId, atorId, votacaoId: id });

    return res.json({ success: true, message: "Votação encerrada.", requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao encerrar votação.");
  }
};

exports.votar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const body = req.body || {};

    // Aceita snake_case (Thunder/legacy) e camelCase (app)
    const rawOpcaoId =
      body.opcao_id ??
      body.opcaoId ??
      body.opcao ??
      body.opcaoID;

    const opcaoId = Number(rawOpcaoId);

    const deviceId = body.device_id ?? body.deviceId ?? null;
    const biometriaConfirmada =
      body.biometria_confirmada ?? body.biometriaConfirmada ?? false;

    if (!Number.isFinite(opcaoId) || opcaoId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Opção inválida.",
        debug: {
          recebido: rawOpcaoId,
          esperado: "opcao_id (number) ou opcaoId (number)",
        },
        requestId
      });
    }

    const result = await service.registrarVoto({
      votacaoId: id,
      opcaoId,
      userId: atorId,
      deviceId: deviceId ? String(deviceId) : null,
      biometriaConfirmada: Boolean(biometriaConfirmada),
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    log.info("VotoRegistrado", { requestId, atorId, votacaoId: id, opcaoId });

    return res.status(201).json({
      ...result,
      requestId
    });
  } catch (err) {
    const msg = err?.message || "Erro ao registrar voto.";
    const isClientError =
      msg.includes("já votou") ||
      msg.includes("encerrada") ||
      msg.includes("não está aberta") ||
      msg.toLowerCase().includes("opção inválida");

    if (isClientError) {
        return res.status(400).json({ success: false, error: msg, requestId });
    }

    return handleDbError(err, res, requestId, "Erro ao registrar voto.");
  }
};

exports.resultado = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const r = await service.obterResultado({ votacaoId: id });
    if (!r) return res.status(404).json({ success: false, error: "Votação não encontrada.", requestId });

    return res.json({
      ...r,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao carregar resultado.");
  }
};
