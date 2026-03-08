const { v4: uuidv4 } = require("uuid");
const service = require("../services/polls.service");
const { handleDbError } = require("../utils/dbError");

function parsePollId(req, res, requestId) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "ID inválido.", requestId });
    return null;
  }
  return id;
}

exports.create = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const poll = await service.createPoll({ userId: req.user.id, payload: req.body || {} });
    return res.status(201).json({ success: true, poll, requestId });
  } catch (error) {
    if (error.message) return res.status(400).json({ success: false, error: error.message, requestId });
    return handleDbError(error, res, requestId, "Erro ao criar enquete.");
  }
};

exports.update = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const pollId = parsePollId(req, res, requestId);
  if (!pollId) return;

  try {
    const poll = await service.updatePoll({ pollId, payload: req.body || {} });
    if (!poll) return res.status(404).json({ success: false, error: "Enquete não encontrada.", requestId });
    return res.json({ success: true, poll, requestId });
  } catch (error) {
    if (error.message) return res.status(400).json({ success: false, error: error.message, requestId });
    return handleDbError(error, res, requestId, "Erro ao atualizar enquete.");
  }
};

exports.publish = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const pollId = parsePollId(req, res, requestId);
  if (!pollId) return;

  try {
    const poll = await service.publishPoll(pollId);
    if (!poll) return res.status(404).json({ success: false, error: "Enquete não encontrada.", requestId });
    return res.json({ success: true, poll, requestId });
  } catch (error) {
    return handleDbError(error, res, requestId, "Erro ao publicar enquete.");
  }
};

exports.list = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const polls = await service.listPolls(req.query.status);
    return res.json({ success: true, polls, requestId });
  } catch (error) {
    return handleDbError(error, res, requestId, "Erro ao listar enquetes.");
  }
};

exports.getById = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const pollId = parsePollId(req, res, requestId);
  if (!pollId) return;

  try {
    const poll = await service.getPollById({ pollId, userId: req.user.id });
    if (!poll) return res.status(404).json({ success: false, error: "Enquete não encontrada.", requestId });
    return res.json({ success: true, poll, requestId });
  } catch (error) {
    return handleDbError(error, res, requestId, "Erro ao obter enquete.");
  }
};

exports.vote = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const pollId = parsePollId(req, res, requestId);
  if (!pollId) return;

  try {
    await service.vote({ pollId, userId: req.user.id, payload: req.body || {} });
    return res.status(201).json({ success: true, message: "Voto registrado com sucesso.", requestId });
  } catch (error) {
    if (error.message) return res.status(400).json({ success: false, error: error.message, requestId });
    return handleDbError(error, res, requestId, "Erro ao votar na enquete.");
  }
};

exports.results = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const pollId = parsePollId(req, res, requestId);
  if (!pollId) return;

  try {
    const poll = await service.getResults(pollId);
    if (!poll) return res.status(404).json({ success: false, error: "Enquete não encontrada.", requestId });
    return res.json({ success: true, poll, requestId });
  } catch (error) {
    return handleDbError(error, res, requestId, "Erro ao carregar resultados.");
  }
};
