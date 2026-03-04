// src/controllers/eventoVotacoes.controller.js
const service = require("../services/eventoVotacoes.service");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");
const log = require("../utils/log");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

exports.criarSimNao = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const eventoId = num(req.params.id);
    if (!eventoId) return res.status(400).json({ success: false, error: "Evento inválido.", requestId });

    const { titulo, duracao_min } = req.body || {};
    if (!titulo) return res.status(400).json({ success: false, error: "titulo é obrigatório.", requestId });

    const v = await service.criarVotacaoSimNao({
      eventoId,
      titulo,
      duracaoMin: duracao_min ?? 2,
      criadoPor: atorId,
    });

    log.info("EventoVotacaoCriada", { requestId, atorId, eventoId, votacaoId: v.id });

    return res.status(201).json({
      ...v,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao criar votação.");
  }
};

exports.listar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const eventoId = num(req.params.id);
    if (!eventoId) return res.status(400).json({ success: false, error: "Evento inválido.", requestId });

    const rows = await service.listarVotacoesEvento({ eventoId, userId: atorId });
    return res.json({
      success: true,
      votacoes: rows,
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
    const eventoId = num(req.params.id);
    const votacaoId = num(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ success: false, error: "Parâmetros inválidos.", requestId });

    const v = await service.detalheVotacao({ eventoId, votacaoId, userId: atorId });
    if (!v) return res.status(404).json({ success: false, error: "Votação não encontrada.", requestId });

    return res.json({
      ...v,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao obter votação.");
  }
};

exports.abrir = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const eventoId = num(req.params.id);
    const votacaoId = num(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ success: false, error: "Parâmetros inválidos.", requestId });

    const r = await service.abrirVotacao({ eventoId, votacaoId, abertoPor: atorId });

    log.info("EventoVotacaoAberta", { requestId, atorId, eventoId, votacaoId });

    return res.json({
      ...r,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, err.message || "Erro ao abrir votação.");
  }
};

exports.votar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const eventoId = num(req.params.id);
    const votacaoId = num(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ success: false, error: "Parâmetros inválidos.", requestId });

    const { opcao_id, opcaoId } = req.body || {};
    const opcao = opcao_id ?? opcaoId;

    const r = await service.votar({
      eventoId,
      votacaoId,
      userId: atorId,
      opcaoId: opcao,
    });

    log.info("EventoVotoRegistrado", { requestId, atorId, eventoId, votacaoId, opcaoId: opcao });

    return res.status(201).json({
      ...r,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, err.message || "Erro ao votar.");
  }
};
