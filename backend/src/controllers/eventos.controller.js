// src/controllers/eventos.controller.js
const service = require("../services/eventos.service");
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

function badRequest(res, msg, requestId) {
  return res.status(400).json({ success: false, error: msg, requestId });
}

function notFound(res, requestId, msg = "Recurso não encontrado.") {
  return res.status(404).json({ success: false, error: msg, requestId });
}

function strOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Helper: quando o service retorna null em transições, distinguimos:
 * - 404 se o evento não existe
 * - 400 se existe mas status/transição não permite
 */
async function resolveNullTransition(res, eventoId, msgIfExists) {
  const evento = await service.obterEvento({ eventoId });
  if (!evento) return notFound(res, "Evento não encontrado.");
  return badRequest(res, msgIfExists);
}

/**
 * POST /api/eventos
 * Cria evento (RASCUNHO ou AGENDADO)
 */
exports.criar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const {
      tipo,
      titulo,
      pauta_resumida,
      data_hora_inicio_prevista,
      duracao_prevista_min,
      edital_pdf_url,
      status, // opcional: RASCUNHO ou AGENDADO
    } = req.body || {};

    const tipoNorm = strOrNull(tipo)?.toUpperCase();
    const tituloNorm = strOrNull(titulo);

    if (!tipoNorm) {
      return badRequest(res, "tipo é obrigatório (AGE/AGO/INFORMATIVA/OUTROS).");
    }
    if (!tituloNorm) {
      return badRequest(res, "titulo é obrigatório.");
    }

    const durMin = numOrNull(duracao_prevista_min);
    if (duracao_prevista_min != null && durMin == null) {
      return badRequest(res, "duracao_prevista_min deve ser número.");
    }
    if (durMin != null && durMin <= 0) {
      return badRequest(res, "duracao_prevista_min deve ser maior que zero.");
    }

    const created = await service.criarEvento({
      tipo: tipoNorm.trim(),
      titulo: tituloNorm.trim(),
      pautaResumida: strOrNull(pauta_resumida),
      dataHoraInicioPrevista: strOrNull(data_hora_inicio_prevista),
      duracaoPrevistaMin: durMin,
      editalPdfUrl: strOrNull(edital_pdf_url),
      status: strOrNull(status)?.toUpperCase().trim() || "RASCUNHO",
      createdBy: atorId ?? null,
    });

    log.info("EventoCriado", { requestId, atorId, eventoId: created.id });

    return res.status(201).json({
      ...created,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao criar evento.");
  }
};

/**
 * POST /api/eventos/:id/agendar
 * Transiciona RASCUNHO -> AGENDADO
 */
exports.agendar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const updated = await service.agendarEvento({
      eventoId: id,
      agendadoPor: atorId ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar em RASCUNHO para ser AGENDADO.",
        requestId
      );
    }

    log.info("EventoAgendado", { requestId, atorId, eventoId: id });

    return res.json({
      ...updated,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao agendar evento.");
  }
};

/**
 * POST /api/eventos/:id/cancelar
 * Cancela o evento (ex.: AGENDADO/ABERTO -> CANCELADO)
 */
exports.cancelar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const updated = await service.cancelarEvento({
      eventoId: id,
      canceladoPor: atorId ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento não pode ser cancelado no status atual.",
        requestId
      );
    }

    log.info("EventoCancelado", { requestId, atorId, eventoId: id });

    return res.json({
      ...updated,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao cancelar evento.");
  }
};

/**
 * GET /api/eventos/:id
 * Detalhe do evento
 */
exports.detalhe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const evento = await service.obterEvento({ eventoId: id });
    if (!evento) return notFound(res, requestId, "Evento não encontrado.");

    return res.json({
      ...evento,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao carregar evento.");
  }
};

/**
 * GET /api/eventos/proximo
 * Próximo evento (para Home do app)
 */
exports.proximo = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const evento = await service.obterProximoEvento();
    return res.json({
      success: true,
      evento: evento || null,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao carregar próximo evento.");
  }
};

/**
 * POST /api/eventos/:id/abrir
 * Transiciona AGENDADO -> ABERTO
 */
exports.abrir = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const updated = await service.abrirEvento({
      eventoId: id,
      abertoPor: atorId ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar AGENDADO para ser ABERTO.",
        requestId
      );
    }

    log.info("EventoAberto", { requestId, atorId, eventoId: id });

    return res.json({
      ...updated,
      requestId
    });
  } catch (err) {
    const msg = err.message || "Erro ao abrir evento.";
    if (msg.includes("inválida")) {
        return badRequest(res, msg, requestId);
    }
    return handleDbError(err, res, requestId, msg);
  }
};

/**
 * POST /api/eventos/:id/encerrar
 * Transiciona ABERTO -> ENCERRADO
 */
exports.encerrar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const updated = await service.encerrarEvento({
      eventoId: id,
      encerradoPor: atorId ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar ABERTO para ser ENCERRADO.",
        requestId
      );
    }

    log.info("EventoEncerrado", { requestId, atorId, eventoId: id });

    return res.json({
      ...updated,
      requestId
    });
  } catch (err) {
    const msg = err.message || "Erro ao encerrar evento.";
    if (msg.includes("inválida")) {
        return badRequest(res, msg, requestId);
    }
    return handleDbError(err, res, requestId, msg);
  }
};

/**
 * POST /api/eventos/:id/entrar
 * Marca presença (quórum)
 * body: { deviceId?: string }
 */
exports.entrar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const { deviceId } = req.body || {};
    const presenca = await service.entrarNoEvento({
      eventoId: id,
      userId: atorId,
      deviceId: deviceId ? String(deviceId) : null,
    });

    log.info("EventoEntrou", { requestId, atorId, eventoId: id });

    return res.json({
      ...presenca,
      requestId
    });
  } catch (err) {
    const msg = err.message || "Erro ao entrar no evento.";
    if (msg.includes("não está aberto") || msg.includes("encerrado")) {
        return badRequest(res, msg, requestId);
    }
    return handleDbError(err, res, requestId, msg);
  }
};

/**
 * POST /api/eventos/:id/sair
 * Sai da presença ativa
 */
exports.sair = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const ok = await service.sairDoEvento({
      eventoId: id,
      userId: atorId,
    });

    log.info("EventoSaiu", { requestId, atorId, eventoId: id });

    return res.json({ success: !!ok, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, err.message || "Erro ao sair do evento.");
  }
};

/**
 * GET /api/eventos/:id/presencas
 * Lista presenças (apenas diretoria/admin)
 */
exports.presencas = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const rows = await service.listarPresencas({ eventoId: id });
    return res.json({
      success: true,
      presencas: rows,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao listar presenças.");
  }
};

/**
 * POST /api/eventos/:id/recontar-quorum
 * Derruba todos os presentes e incrementa o epoch do quórum
 */
exports.recontarQuorum = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  try {
    const id = parseId(req, res, requestId);
    if (!id) return;

    const r = await service.recontarQuorum({ eventoId: id });

    log.info("EventoQuorumRecontado", { requestId, atorId, eventoId: id });

    return res.json({
      ...r,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, err.message || "Erro ao recontar quórum.");
  }
};
