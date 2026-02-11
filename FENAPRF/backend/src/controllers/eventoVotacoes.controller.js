// src/controllers/eventoVotacoes.controller.js
const service = require("../services/eventoVotacoes.service");
const { parseUuid } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

exports.criarSimNao = async (req, res) => {
  const requestId = req.requestId;
  try {
    const eventoId = parseUuid(req.params.id);
    if (!eventoId) return res.status(400).json({ error: "Evento inválido (UUID esperado).", requestId });

    const { titulo, duracao_min } = req.body || {};
    if (!titulo) return res.status(400).json({ error: "titulo é obrigatório.", requestId });

    const v = await service.criarVotacaoSimNao({
      eventoId,
      titulo,
      duracaoMin: duracao_min ?? 2,
      criadoPor: req.user.id,
    });

    return res.status(201).json(v);
  } catch (e) {
    log.error("EventoVotacaoCriarErro", { error: e.message, stack: e.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CRIAR, requestId });
  }
};

exports.listar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const eventoId = parseUuid(req.params.id);
    if (!eventoId) return res.status(400).json({ error: "Evento inválido (UUID esperado).", requestId });

    const rows = await service.listarVotacoesEvento({ eventoId, userId: req.user.id });
    return res.json(rows);
  } catch (e) {
    log.error("EventoVotacaoListarErro", { error: e.message, stack: e.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId });
  }
};

exports.detalhe = async (req, res) => {
  const requestId = req.requestId;
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos.", requestId });

    const v = await service.detalheVotacao({ eventoId, votacaoId, userId: req.user.id });
    if (!v) return res.status(404).json({ error: "Votação não encontrada.", requestId });

    return res.json(v);
  } catch (e) {
    log.error("EventoVotacaoDetalheErro", { error: e.message, stack: e.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId });
  }
};

exports.abrir = async (req, res) => {
  const requestId = req.requestId;
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos.", requestId });

    const r = await service.abrirVotacao({ eventoId, votacaoId, abertoPor: req.user.id });
    return res.json(r);
  } catch (e) {
    log.error("EventoVotacaoAbrirErro", { error: e.message, stack: e.stack, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId });
  }
};

exports.votar = async (req, res) => {
  const requestId = req.requestId;
  try {
    const eventoId = parseUuid(req.params.id);
    const votacaoId = parseUuid(req.params.votacaoId);
    if (!eventoId || !votacaoId) return res.status(400).json({ error: "Parâmetros inválidos.", requestId });

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
    const msg = e.message || "";
    // Se for erro de negócio conhecido, podemos retornar 400 com a mensagem
    const isBusinessError = msg.includes("já votou") || msg.includes("encerrada") || msg.includes("não está aberta");

    log.error("EventoVotacaoVotarErro", { error: e.message, stack: e.stack, requestId });

    if (isBusinessError) {
        return res.status(400).json({ error: msg, requestId });
    }

    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId });
  }
};
