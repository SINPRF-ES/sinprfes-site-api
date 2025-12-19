// src/controllers/eventos.controller.js
const service = require("../services/eventos.service");

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

function notFound(res, msg = "Recurso não encontrado.") {
  return res.status(404).json({ error: msg });
}

function serverError(res, e, fallbackMsg) {
  console.error(fallbackMsg, e);
  return res.status(500).json({ error: e.message || fallbackMsg });
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
      createdBy: req.user?.id ?? null,
    });

    return res.status(201).json(created);
  } catch (e) {
    return serverError(res, e, "EventoCriarErro:");
  }
};

/**
 * POST /api/eventos/:id/agendar
 * Transiciona RASCUNHO -> AGENDADO
 */
exports.agendar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const updated = await service.agendarEvento({
      eventoId: id,
      agendadoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar em RASCUNHO para ser AGENDADO."
      );
    }

    return res.json(updated);
  } catch (e) {
    return serverError(res, e, "EventoAgendarErro:");
  }
};

/**
 * POST /api/eventos/:id/cancelar
 * Cancela o evento (ex.: AGENDADO/ABERTO -> CANCELADO)
 */
exports.cancelar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const updated = await service.cancelarEvento({
      eventoId: id,
      canceladoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento não pode ser cancelado no status atual."
      );
    }

    return res.json(updated);
  } catch (e) {
    return serverError(res, e, "EventoCancelarErro:");
  }
};

/**
 * GET /api/eventos/:id
 * Detalhe do evento
 */
exports.detalhe = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const evento = await service.obterEvento({ eventoId: id });
    if (!evento) return notFound(res, "Evento não encontrado.");

    return res.json(evento);
  } catch (e) {
    console.error("EventoDetalheErro:", e);
    return res.status(500).json({ error: "Erro ao carregar evento." });
  }
};

/**
 * GET /api/eventos/proximo
 * Próximo evento (para Home do app)
 */
exports.proximo = async (_req, res) => {
  try {
    const evento = await service.obterProximoEvento();
    return res.json({ evento: evento || null });
  } catch (e) {
    console.error("EventoProximoErro:", e);
    return res.status(500).json({ error: "Erro ao carregar próximo evento." });
  }
};

/**
 * POST /api/eventos/:id/abrir
 * Transiciona AGENDADO -> ABERTO
 */
exports.abrir = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const updated = await service.abrirEvento({
      eventoId: id,
      abertoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar AGENDADO para ser ABERTO."
      );
    }

    return res.json(updated);
  } catch (e) {
    console.error("EventoAbrirErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao abrir evento." });
  }
};

/**
 * POST /api/eventos/:id/encerrar
 * Transiciona ABERTO -> ENCERRADO
 */
exports.encerrar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const updated = await service.encerrarEvento({
      eventoId: id,
      encerradoPor: req.user?.id ?? null,
    });

    if (!updated) {
      return await resolveNullTransition(
        res,
        id,
        "Transição inválida: evento deve estar ABERTO para ser ENCERRADO."
      );
    }

    return res.json(updated);
  } catch (e) {
    console.error("EventoEncerrarErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao encerrar evento." });
  }
};

/**
 * POST /api/eventos/:id/entrar
 * Marca presença (quórum)
 * body: { deviceId?: string }
 */
exports.entrar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const { deviceId } = req.body || {};
    const presenca = await service.entrarNoEvento({
      eventoId: id,
      userId: req.user?.id,
      deviceId: deviceId ? String(deviceId) : null,
    });

    return res.json(presenca);
  } catch (e) {
    console.error("EventoEntrarErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao entrar no evento." });
  }
};

/**
 * POST /api/eventos/:id/sair
 * Sai da presença ativa
 */
exports.sair = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const ok = await service.sairDoEvento({
      eventoId: id,
      userId: req.user?.id,
    });

    return res.json({ ok: !!ok });
  } catch (e) {
    console.error("EventoSairErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao sair do evento." });
  }
};

/**
 * GET /api/eventos/:id/presencas
 * Lista presenças (apenas diretoria/admin)
 */
exports.presencas = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const rows = await service.listarPresencas({ eventoId: id });
    return res.json(rows);
  } catch (e) {
    console.error("EventoPresencasErro:", e);
    return res.status(500).json({ error: "Erro ao listar presenças." });
  }
};

/**
 * POST /api/eventos/:id/recontar-quorum
 * Derruba todos os presentes e incrementa o epoch do quórum
 */
exports.recontarQuorum = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return badRequest(res, "ID inválido.");

    const r = await service.recontarQuorum({ eventoId: id });
    return res.json(r);
  } catch (e) {
    console.error("EventoRecontarQuorumErro:", e);
    return res.status(400).json({ error: e.message || "Erro ao recontar quórum." });
  }
};
