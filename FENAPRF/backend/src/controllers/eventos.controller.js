// src/controllers/eventos.controller.js
const service = require("../services/eventos.service");
const { parseUuid } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

function parseId(req) {
  return parseUuid(req.params.id);
}

function badRequest(res, msg, req) {
  return res.status(400).json({ error: msg, requestId: req?.requestId });
}

function notFound(res, req, msg = "Recurso não encontrado.") {
  return res.status(404).json({ error: msg, requestId: req?.requestId });
}

function serverError(res, e, fallbackMsg, req, atorId) {
  log.error(fallbackMsg.replace(/:$/, ""), { error: e.message, stack: e.stack, requestId: req?.requestId, userId: atorId });
  return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_PROCESSAR, requestId: req?.requestId });
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
  const atorId = req.user?.id;
  try {
    if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

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
      return badRequest(res, "tipo é obrigatório (AGE/AGO/INFORMATIVA/OUTROS).", req);
    }
    if (!tituloNorm) {
      return badRequest(res, "titulo é obrigatório.", req);
    }

    const durMin = numOrNull(duracao_prevista_min);
    if (duracao_prevista_min != null && durMin == null) {
      return badRequest(res, "duracao_prevista_min deve ser número.", req);
    }
    if (durMin != null && durMin <= 0) {
      return badRequest(res, "duracao_prevista_min deve ser maior que zero.", req);
    }

    const created = await service.criarEvento({
      tipo: tipoNorm.trim(),
      titulo: tituloNorm.trim(),
      pautaResumida: strOrNull(pauta_resumida),
      dataHoraInicioPrevista: strOrNull(data_hora_inicio_prevista),
      duracaoPrevistaMin: durMin,
      editalPdfUrl: strOrNull(edital_pdf_url),
      status: strOrNull(status)?.toUpperCase().trim() || "RASCUNHO",
      createdBy: req.user?.id ?? null,
    });

    return res.status(201).json(created);
  } catch (e) {
    return serverError(res, e, "EventoCriarErro:", req, atorId);
  }
};

/**
 * POST /api/eventos/:id/agendar
 * Transiciona RASCUNHO -> AGENDADO
 */
exports.agendar = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const updated = await service.agendarEvento({
      eventoId,
      agendadoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        eventoId,
        "Transição inválida: evento deve estar em RASCUNHO para ser AGENDADO."
      );
    }

    return res.json(updated);
  } catch (e) {
    return serverError(res, e, "EventoAgendarErro:", req);
  }
};

/**
 * POST /api/eventos/:id/cancelar
 * Cancela o evento (ex.: AGENDADO/ABERTO -> CANCELADO)
 */
exports.cancelar = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const updated = await service.cancelarEvento({
      eventoId,
      canceladoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        eventoId,
        "Transição inválida: evento não pode ser cancelado no status atual."
      );
    }

    return res.json(updated);
  } catch (e) {
    return serverError(res, e, "EventoCancelarErro:", req);
  }
};

/**
 * GET /api/eventos/:id
 * Detalhe do evento
 */
exports.detalhe = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const evento = await service.obterEvento({ eventoId });
    if (!evento) return notFound(res, req, "Evento não encontrado.");

    return res.json(evento);
  } catch (e) {
    log.error("EventoDetalheErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId: req.requestId });
  }
};

/**
 * GET /api/eventos/proximo
 * Próximo evento (para Home do app)
 */
exports.proximo = async (req, res) => {
  try {
    const evento = await service.obterProximoEvento();
    return res.json({ evento: evento || null });
  } catch (e) {
    log.error("EventoProximoErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId: req.requestId });
  }
};

/**
 * POST /api/eventos/:id/abrir
 * Transiciona AGENDADO -> ABERTO
 */
exports.abrir = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const updated = await service.abrirEvento({
      eventoId,
      abertoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        eventoId,
        "Transição inválida: evento deve estar AGENDADO para ser ABERTO."
      );
    }

    return res.json(updated);
  } catch (e) {
    log.error("EventoAbrirErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(400).json({ error: e.message || "Erro ao abrir evento.", requestId: req.requestId });
  }
};

/**
 * POST /api/eventos/:id/encerrar
 * Transiciona ABERTO -> ENCERRADO
 */
exports.encerrar = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const updated = await service.encerrarEvento({
      eventoId,
      encerradoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        eventoId,
        "Transição inválida: evento deve estar ABERTO para ser ENCERRADO."
      );
    }

    return res.json(updated);
  } catch (e) {
    log.error("EventoEncerrarErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(400).json({ error: e.message || "Erro ao encerrar evento.", requestId: req.requestId });
  }
};

/**
 * POST /api/eventos/:id/entrar
 * Marca presença (quórum)
 * body: { deviceId?: string }
 */
exports.entrar = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const { deviceId } = req.body || {};
    const presenca = await service.entrarNoEvento({
      eventoId,
      userId: req.user?.id,
      deviceId: deviceId ? String(deviceId) : null,
    });

    return res.json(presenca);
  } catch (e) {
    log.error("EventoEntrarErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(400).json({ error: e.message || "Erro ao entrar no evento.", requestId: req.requestId });
  }
};

/**
 * POST /api/eventos/:id/sair
 * Sai da presença ativa
 */
exports.sair = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const ok = await service.sairDoEvento({
      eventoId,
      userId: req.user?.id,
    });

    return res.json({ ok: !!ok });
  } catch (e) {
    log.error("EventoSairErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(400).json({ error: e.message || "Erro ao sair do evento.", requestId: req.requestId });
  }
};

/**
 * GET /api/eventos/:id/presencas
 * Lista presenças (apenas diretoria/admin)
 */
exports.presencas = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const rows = await service.listarPresencas({ eventoId });
    return res.json(rows);
  } catch (e) {
    log.error("EventoPresencasErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.FALHA_AO_CARREGAR, requestId: req.requestId });
  }
};

/**
 * POST /api/eventos/:id/recontar-quorum
 * Derruba todos os presentes e incrementa o epoch do quórum
 */
exports.recontarQuorum = async (req, res) => {
  try {
    const eventoId = parseId(req);
    if (!eventoId) return badRequest(res, "ID inválido.", req);

    const r = await service.recontarQuorum({ eventoId });
    return res.json(r);
  } catch (e) {
    log.error("EventoRecontarQuorumErro", { error: e.message, stack: e.stack, requestId: req.requestId });
    return res.status(400).json({ error: e.message || "Erro ao recontar quórum.", requestId: req.requestId });
  }
};
