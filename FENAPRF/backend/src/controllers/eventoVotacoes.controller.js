// src/controllers/eventoVotacoes.controller.js
const service = require("../services/eventoVotacoes.service");
const { parseUuid } = require("../utils/format");

exports.criarSimNao = async (req, res) => {
  try {
    const eventoId = parseUuid(req.params.id);
    if (!eventoId) return res.status(400).json({ error: "Evento inválido (UUID esperado)." });

    const { titulo, duracao_min } = req.body || {};
    if (!titulo) return res.status(400).json({ error: "titulo é obrigatório." });

    const v = await service.criarVotacaoSimNao({
      eventoId,
      titulo,
      duracaoMin: duracao_min ?? 2,
      criadoPor: req.user.id,
    });

    return res.status(201).json(v);
  } catch (e) {
    console.error("EventoVotacaoCriarErro:", e);
    return res.status(500).json({ error: e.message || "Erro ao criar votação." });
  }
};

exports.listar = async (req, res) => {
  try {
    const eventoId = parseUuid(req.params.id);
    if (!eventoId) return res.status(400).json({ error: "Evento inválido (UUID esperado)." });

    const rows = await service.listarVotacoesEvento({ eventoId, userId: req.user.id });
    return res.json(rows);
  } catch (e) {
    console.error("EventoVotacaoListarErro:", e);
    return res.status(500).json({ error: "Erro ao listar votações." });
  }
};

exports.detalhe = async (req, res) => {
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos." });

    const v = await service.detalheVotacao({ eventoId, votacaoId, userId: req.user.id });
    if (!v) return res.status(404).json({ error: "Votação não encontrada." });

    return res.json(v);
  } catch (e) {
    console.error("EventoVotacaoDetalheErro:", e);
    return res.status(500).json({ error: "Erro ao obter votação." });
  }
};

exports.abrir = async (req, res) => {
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos." });

    const r = await service.abrirVotacao({ eventoId, votacaoId, abertoPor: req.user.id });
    return res.json(r);
  } catch (e) {
    console.error("EventoVotacaoAbrirErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao abrir votação." });
  }
};

exports.votar = async (req, res) => {
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos." });

    const { opcao_id, opcaoId } = req.body || {};
    const opcao = opcao_id ?? opcaoId;

    const r = await service.votar({
      eventoId,
      votacaoId,
      userId: req.user.id,
      opcaoId: opcao,
    });

    return res.status(201).json(r);
  } catch (e) {
    console.error("EventoVotacaoVotarErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao votar." });
  }
};
