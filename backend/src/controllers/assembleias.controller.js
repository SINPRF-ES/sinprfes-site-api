// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
const filiadosService = require("../services/filiados.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const socket = require("../websocket/assembleia.socket");
const driveService = require("../services/drive.service");
const { uploadFileBuffer, getSignedUrl } = require("../services/cloudinary.service");
const log = require("../utils/log");
const Textos = require("../utils/textos");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { parseUuid } = require("../utils/parseUuid");

// Anti brute-force simples em memória para tokens
const failedCheckinAttempts = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutos
const MAX_FAILED_ATTEMPTS = 5;

async function listar(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const start = Date.now();
  try {
    const assembleias = await service.listar(req.user.perfil_acesso);
    log.info("AssembleiaListarSucesso", { requestId, atorId, elapsedMs: Date.now() - start });
    res.json(assembleias);
  } catch (err) {
    log.error("AssembleiaListarErro", { requestId, atorId, error: err });

    // Se for erro de coluna inexistente, indica migração pendente
    if (err.message.includes("column") && err.message.includes("does not exist")) {
        return res.status(500).json({
            error: "Erro de esquema no banco de dados. Verifique migrações.",
            details: err.message,
            requestId
        });
    }

    res.status(500).json({ error: "Erro ao listar assembleias", requestId });
  }
}

async function detalhe(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const assembleia = await service.buscarPorId(id);
    if (!assembleia) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA, requestId });
    log.info("AssembleiaDetalheSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json(assembleia);
  } catch (err) {
    log.error("AssembleiaDetalheErro", { requestId, assembleiaId: id, atorId, error: err });
    res.status(500).json({ error: "Erro ao buscar detalhe da assembleia", requestId });
  }
}

async function estadoCompleto(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
     const estado = await service.buscarEstadoCompleto(id, atorId);
    if (!estado) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA, requestId });

     // Auditoria de entrada
     await service.registrarAuditoria(id, atorId, "ENTRADA_SESSAO", { platform: 'mobile', requestId });

    log.info("AssembleiaEstadoCompletoSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoCompletoErro", { requestId, assembleiaId: id, atorId, error: err });
    res.status(500).json({ error: "Erro ao buscar estado da assembleia", requestId });
  }
}

async function estadoMini(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  try {
    const estado = await service.buscarEstadoResumido(id);
    if (!estado) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA, requestId });

    const mesa = await service.buscarMesa(id);
    const isPresidente = mesa && mesa.presidente_user_id === atorId;
    const isDiretoria = req.user.perfil_acesso === 'DIRETORIA' || req.user.perfil_acesso === 'ADMIN';

    const canSeeToken = estado.quorumVigente?.token && (isPresidente || isDiretoria || atorId === estado.quorumVigente.gerado_por_user_id);

    if (!canSeeToken && estado.quorumVigente) {
        delete estado.quorumVigente.token;
    }

    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoMiniErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao buscar estado resumido", requestId });
  }
}

async function diagnostico(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const data = await service.buscarDiagnostico(id);
    log.info("AssembleiaDiagnosticoAcessado", { requestId, assembleiaId: id, atorId });
    res.json(data);
  } catch (err) {
    log.error("AssembleiaDiagnosticoErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: err.message, requestId });
  }
}

async function limparLogsAuditoria(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { recordsDeleted } = req.body;

    // Registrar auditoria da ação de limpeza no backend (específico de assembleia)
    await service.registrarAuditoria(id, atorId, "DIAGNOSTICO_LOGS_LIMPOS", {
      who: { id: atorId, perfil: req.user.perfil_acesso },
      scope: "diagnostico.logs.clear",
      recordsDeleted: recordsDeleted || 0,
      platform: 'mobile',
      requestId
    });

    log.info("AssembleiaLogsLimpos", {
      requestId,
      assembleiaId: id,
      atorId,
      recordsDeleted
    });

    res.json({ success: true, message: "Ação de limpeza registrada com sucesso.", requestId });
  } catch (err) {
    log.error("AssembleiaLimparLogsErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao registrar limpeza de logs", requestId });
  }
}

async function criar(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const start = Date.now();
  try {
    // Log diagnóstico para identificar chaves enviadas pelo mobile (Issue A/B)
    log.info("AssembleiaCriarRequest", {
        requestId,
        atorId,
        bodyKeys: Object.keys(req.body || {}),
        edital_url: req.body.edital_url,
        editalUrl: req.body.editalUrl
    });

    const {
      tipo,
      titulo,
      pauta,
      data_evento,
      hora_primeira_chamada,
      hora_segunda_chamada
    } = req.body;

    // Mapeamento tolerante (aceita snake_case ou camelCase) e sanitização de empty strings
    const getVal = (k1, k2) => {
        const v = req.body[k1] ?? req.body[k2];
        return (typeof v === 'string' && v.trim() === '') ? null : (v || null);
    };

    const edital_url = getVal('edital_url', 'editalUrl');
    const edital_public_id = getVal('edital_public_id', 'editalPublicId');
    const edital_resource_type = getVal('edital_resource_type', 'editalResourceType');
    const edital_type = getVal('edital_type', 'editalType');
    const edital_format = getVal('edital_format', 'editalFormat');
    const edital_drive_file_id = getVal('edital_drive_file_id', 'editalDriveFileId');

    // 1. Validação de campos obrigatórios
    if (!tipo || !titulo || !data_evento || !hora_primeira_chamada || !hora_segunda_chamada) {
      return res.status(422).json({ error: "Título, tipo, data e horários de chamada são obrigatórios.", requestId });
    }

    if (!edital_drive_file_id) {
        return res.status(422).json({ error: "O edital (PDF da Biblioteca Digital) é obrigatório para novas assembleias.", requestId });
    }

    // 2. Validação do Tipo
    const tiposValidos = ['AGE', 'AGO', 'Assembleia Geral Ordinária', 'Assembleia Geral Extraordinária'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(422).json({ error: "Tipo de assembleia inválido.", requestId });
    }

    // 3. Validação Estrita de Data
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexData.test(data_evento)) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_INVALIDA, code: 'DATA_EVENTO_INVALIDA', requestId });
    }
    const [y, m, d] = data_evento.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_INVALIDA, code: 'DATA_EVENTO_INVALIDA', requestId });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dateObj < hoje) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_PASSADA, code: 'DATA_EVENTO_PASSADA', requestId });
    }

    const umAnoDepois = new Date();
    umAnoDepois.setFullYear(umAnoDepois.getFullYear() + 1);
    umAnoDepois.setHours(23, 59, 59, 999);
    if (dateObj > umAnoDepois) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_MUITO_DISTANTE, code: 'DATA_EVENTO_MUITO_DISTANTE', requestId });
    }

    // 4. Validação Estrita de Horas
    const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!regexHora.test(hora_primeira_chamada) || !regexHora.test(hora_segunda_chamada)) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.HORA_INVALIDA, code: 'HORA_INVALIDA', requestId });
    }

    if (hora_segunda_chamada < hora_primeira_chamada) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.HORA_ORDEM_INVALIDA, code: 'HORA_ORDEM_INVALIDA', requestId });
    }

    const data_hora_inicio = `${data_evento}T${hora_primeira_chamada}:00`;

    const nova = await service.criar({
      tipo,
      titulo,
      pauta,
      data_hora_inicio,
      edital_url,
      edital_public_id,
      edital_resource_type,
      edital_type,
      edital_format,
      edital_drive_file_id,
      data_evento,
      hora_primeira_chamada,
      hora_segunda_chamada,
      criado_por: atorId
    });

    log.info("AssembleiaCriarSucesso", { requestId, assembleiaId: nova.id, atorId, elapsedMs: Date.now() - start });
    res.status(201).json({ ...nova, requestId });
  } catch (err) {
    log.error("AssembleiaCriarErro", { requestId, atorId, error: err.message, stack: err.stack });

    if (err.message.includes("violates check constraint") || err.message.includes("invalid input syntax") || err.message.includes("type date") || err.message.includes("type time")) {
      return res.status(422).json({ error: "Dados inválidos fornecidos para criação da assembleia.", details: err.message, requestId });
    }

    if (err.message.includes("column") && err.message.includes("does not exist")) {
      return res.status(500).json({ error: "Erro de esquema no banco de dados. Migração incompleta.", requestId });
    }

    res.status(500).json({ error: "Erro inesperado ao criar assembleia", requestId });
  }
}

async function abrir(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const atualizada = await service.abrir(id, atorId);
    socket.emitEvent(id, "assembleia:status_changed", { estado: "ABERTA" });

    log.info("AssembleiaAbrirSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ ...atualizada, requestId });
  } catch (err) {
    log.error("AssembleiaAbrirErro", { requestId, assembleiaId: id, atorId, error: err.message });
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 500;
    res.status(status).json({ error: err.message, requestId });
  }
}

async function iniciarExecucao(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const atualizada = await service.iniciarExecucao(id, atorId);
    socket.emitEvent(id, "assembleia:status_changed", { estado: "EM_CURSO" });

    log.info("AssembleiaIniciarExecucaoSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ ...atualizada, requestId });
  } catch (err) {
    log.error("AssembleiaIniciarExecucaoErro", { requestId, assembleiaId: id, atorId, error: err.message });
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 422;
    res.status(status).json({ error: err.message, requestId });
  }
}

async function encerrarAssembleia(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const atualizada = await service.encerrar(id, atorId);
    socket.emitEvent(id, "assembleia:status_changed", { estado: "ENCERRADA" });

    log.info("AssembleiaEncerrarSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ ...atualizada, requestId });
  } catch (err) {
    log.error("AssembleiaEncerrarErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: err.message, requestId });
  }
}

// Helper para validar se o usuário é o Presidente da Mesa ou Diretoria
async function verificarAutoridadeMesa(assembleiaId, user) {
  const mesa = await service.buscarMesa(assembleiaId);
  const isDiretoria = user.perfil_acesso === 'DIRETORIA' || user.perfil_acesso === 'ADMIN';
  const isPresidente = mesa && mesa.presidente_user_id === user.id;
  return { mesa, autorizada: isDiretoria || isPresidente, isPresidente, isDiretoria };
}

async function gerarTokenQuorum(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { tipo_chamada, observacao } = req.body;

    // Validação de autoridade: Presidente ou Diretoria
    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
      return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });
    }

    const tiposValidos = ['PRIMEIRA', 'SEGUNDA', 'RECONTAGEM'];
    const tipoFinal = (tipo_chamada || 'PRIMEIRA').toUpperCase();

    if (!tiposValidos.includes(tipoFinal)) {
      return res.status(422).json({ error: "Tipo de chamada inválido. Use PRIMEIRA, SEGUNDA ou RECONTAGEM.", requestId });
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const quorum = await service.gerarQuorum({
      assembleia_id: id,
      token,
      gerado_por_user_id: atorId,
      tipo_chamada: tipoFinal,
      observacao
    });

    // Buscar estado consolidado para retorno rico (evita double fetch no app)
    const estado = await service.buscarEstadoCompleto(id, atorId);

    const eventName = tipoFinal === 'RECONTAGEM' ? "assembleia:recontagem" : "assembleia:token_gerado";
    socket.emitEvent(id, eventName, {
      id: quorum.id,
      token: quorum.token,
      tipo_chamada: tipoFinal,
      quorumVigente: estado?.quorumVigente
    });

    log.info("AssembleiaGerarTokenSucesso", { requestId, assembleiaId: id, atorId, tipo_chamada: tipoFinal, isNew: quorum.isNew, elapsedMs: Date.now() - start });

    res.json({
      token: quorum.token,
      tokenId: quorum.id,
      quorum_id: quorum.id,
      isNew: quorum.isNew,
      tipo_chamada: tipoFinal,
      quorumVigente: estado?.quorumVigente,
      presente: true,
      tokenAtivo: true,
      vigente: true,
      issuedAt: quorum.criado_em || new Date().toISOString(),
      expiresAt: quorum.valido_ate || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      requestId
    });
  } catch (err) {
    log.error("AssembleiaGerarTokenQuorumErro", { requestId, assembleiaId: id, atorId, error: err.message, stack: err.stack });

    if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) {
      return res.status(404).json({ error: err.message, requestId });
    }
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: "Não é possível gerar token para esta assembleia no estado atual.", requestId });
    }
    if (err.message === Textos.ASSEMBLEIA.APENAS_PRESIDENTE) {
      return res.status(403).json({ error: err.message, requestId });
    }

    // Erros de banco específicos (ex: deadlock, unique violation inesperada)
    if (err.code === '23505') {
       return res.status(409).json({ error: "Conflito ao gerar token. Tente novamente.", requestId });
    }

    res.status(500).json({ error: "Erro interno ao gerar token de quórum", requestId });
  }
}

async function atualizarQuorum(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });
    }

    const quorum = await service.atualizarQuorum(id, atorId);
    const estado = await service.buscarEstadoCompleto(id, atorId);

    socket.emitEvent(id, "assembleia:quorum_atualizado", {
      id: quorum.id,
      token: quorum.token,
      tipo_chamada: quorum.tipo_chamada,
      quorumVigente: estado?.quorumVigente
    });

    log.info("AssembleiaAtualizarQuorumSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });

    res.json({
      token: quorum.token,
      tokenId: quorum.id,
      quorum_id: quorum.id,
      tipo_chamada: quorum.tipo_chamada,
      quorumVigente: estado?.quorumVigente,
      presente: true,
      tokenAtivo: true,
      vigente: true,
      issuedAt: quorum.criado_em || new Date().toISOString(),
      expiresAt: quorum.valido_ate || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      requestId
    });
  } catch (err) {
     log.error("AssembleiaAtualizarQuorumErro", { requestId, assembleiaId: id, atorId, error: err.message });
     if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) return res.status(404).json({ error: err.message, requestId });
     if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) return res.status(409).json({ error: err.message, requestId });
     res.status(500).json({ error: "Erro ao atualizar quórum", requestId });
  }
}

async function checkin(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { token } = req.body;

    // Verificar cooldown
    const failureData = failedCheckinAttempts.get(atorId);
    if (failureData && failureData.count >= MAX_FAILED_ATTEMPTS && Date.now() - failureData.lastAttempt < COOLDOWN_TIME) {
        log.warn("AssembleiaCheckinBloqueado", { requestId, atorId, assembleiaId: id });
        return res.status(429).json({ error: "Muitas tentativas inválidas. Tente novamente em alguns minutos.", requestId });
    }

    if (!token) return res.status(400).json({ error: "Token é obrigatório", requestId });

    // Bloqueia perfis que não votam nem contam quórum (ADMIN, COMUNICADOR)
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (perfil === 'ADMIN' || perfil === 'COMUNICADOR') {
       return res.status(403).json({ error: "Seu perfil não possui permissão para realizar check-in em assembleias", requestId });
    }

    const quorum = await service.buscarQuorumPorToken(id, token);
    if (!quorum) {
        // Registrar falha
        const currentFailures = failureData ? failureData.count : 0;
        failedCheckinAttempts.set(atorId, { count: currentFailures + 1, lastAttempt: Date.now() });

        await service.registrarAuditoria(id, atorId, 'CHECKIN_FALHA_TOKEN', { token, requestId });
        log.warn("AssembleiaCheckinFalhou", { requestId, atorId, assembleiaId: id, token_tentado: token, motivo: "Token Inválido" });
        return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO, requestId });
    }

    // Sucesso: limpar falhas
    failedCheckinAttempts.delete(atorId);

    await service.realizarCheckin({
      assembleia_quorum_id: quorum.id,
      filiado_id: atorId,
      origem: 'TOKEN',
      assembleia_id: id
    });

    // Broadcast do quórum atualizado - OTIMIZAÇÃO BOLT ⚡
    const quorumVigente = await service.buscarUltimoQuorum(id);
    const totalPresentes = quorumVigente ? await service.contarPresentesNoQuorum(quorumVigente.id) : 0;

    socket.emitEvent(id, "assembleia:checkin_updated", {
      total: totalPresentes,
      presentes_total: totalPresentes,
      quorum_total_ativos: quorumVigente?.quorum_total_ativos || 0,
      quorum_necessario: quorumVigente?.quorum_necessario || 0,
      quorum_atingido: totalPresentes >= (quorumVigente?.quorum_necessario || 0),
      tipo_chamada: quorumVigente?.tipo_chamada
    });

    log.info("AssembleiaCheckinSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ success: true, message: "Check-in realizado com sucesso", requestId });
  } catch (err) {
    log.error("AssembleiaCheckinErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao realizar check-in", requestId });
  }
}

async function definirMesa(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { presidente_user_id, secretario_user_id } = req.body;

    if (!presidente_user_id || !secretario_user_id) {
      return res.status(400).json({ error: "Presidente e Secretário são obrigatórios", requestId });
    }

    if (presidente_user_id === secretario_user_id) {
      return res.status(400).json({ error: "Presidente e Secretário devem ser pessoas diferentes", requestId });
    }

    const mesa = await service.definirMesa({
      assembleia_id: id,
      presidente_user_id,
      secretario_user_id,
      definida_por_user_id: atorId
    });

    socket.emitEvent(id, "assembleia:mesa_definida", mesa);

    log.info("AssembleiaDefinirMesaSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ ...mesa, requestId });
  } catch (err) {
    log.error("AssembleiaDefinirMesaErro", { requestId, assembleiaId: id, atorId, error: err.message });
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: err.message, requestId });
    }
    res.status(500).json({ error: "Erro ao definir mesa", requestId });
  }
}

async function substituirMesa(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { presidente_user_id, secretario_user_id, justificativa } = req.body;

    // Apenas DIRETORIA pode substituir a mesa. Presidente (se não for DIRETORIA) não pode.
    if (req.user.perfil_acesso !== 'DIRETORIA' && req.user.perfil_acesso !== 'ADMIN') {
        return res.status(403).json({ error: "Apenas a Diretoria pode destituir ou alterar a mesa.", requestId });
    }

    if (!presidente_user_id || !secretario_user_id || !justificativa) {
      return res.status(400).json({ error: "Presidente, Secretário e Justificativa são obrigatórios", requestId });
    }

    if (presidente_user_id === secretario_user_id) {
      return res.status(400).json({ error: "Presidente e Secretário devem ser pessoas diferentes", requestId });
    }

    const mesa = await service.substituirMesa({
      assembleia_id: id,
      presidente_user_id,
      secretario_user_id,
      substituida_por_user_id: atorId,
      justificativa
    });

    socket.emitEvent(id, "assembleia:mesa_definida", mesa);
    await service.registrarAuditoria(id, atorId, "MESA_SUBSTITUICAO_REALIZADA", { requestId });

    log.info("AssembleiaSubstituirMesaSucesso", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({ ...mesa, requestId });
  } catch (err) {
    log.error("AssembleiaSubstituirMesaErro", { requestId, assembleiaId: id, atorId, error: err.message });
    if (err.message.includes("obrigatória") || err.message.includes("mínimo")) {
      return res.status(400).json({ error: err.message, requestId });
    }
    res.status(500).json({ error: "Erro ao substituir mesa", requestId });
  }
}

async function iniciarVotacao(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { titulo, descricao, duracao_segundos } = req.body;

    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
      return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });
    }

    const quorum = await service.buscarUltimoQuorum(id);
    if (!quorum) return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO, requestId });

    const votacao = await service.criarVotacao({
      assembleia_id: id,
      quorum_snapshot_id: quorum.id,
      titulo,
      descricao,
      duracao_segundos: duracao_segundos || 300,
      iniciada_por_user_id: atorId
    });

    socket.emitEvent(id, "votacao:iniciada", { ...votacao, contagem: { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 }, votos: [] });

    log.info("AssembleiaIniciarVotacaoSucesso", { requestId, assembleiaId: id, atorId, votacaoId: votacao.id, elapsedMs: Date.now() - start });
    res.status(201).json({ ...votacao, requestId });
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao iniciar votação", requestId });
  }
}

async function votar(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  const vid = parseUuid(req.params.vid);
  if (!id || !vid) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { voto } = req.body;

     const votacao = await service.buscarVotacaoAtiva(id);
     if (!votacao || votacao.id !== vid) {
        return res.status(400).json({ error: Textos.ASSEMBLEIA.VOTACAO_ENCERRADA, requestId });
     }

     if (new Date(votacao.encerra_em) < new Date()) {
        return res.status(400).json({ error: Textos.ASSEMBLEIA.TEMPO_EXPIRADO, requestId });
     }

    const elegivel = await service.verificarElegibilidade(vid, atorId);
    if (!elegivel) {
        log.warn("AssembleiaVotoRejeitado", { requestId, atorId, assembleiaId: id, votacaoId: vid, motivo: "Usuário Inelegível" });
        return res.status(403).json({ error: Textos.ASSEMBLEIA.NAO_ELEGIVEL, requestId });
    }

    await service.registrarVoto(vid, atorId, voto, id);

    // BOLT: Fetch nominal votes and calculate count in memory, saving 1 DB trip
    const votos = await service.listarVotosNominais(vid);
    const contagem = service.calcularContagemVotos(votos);

    // Auto-encerramento se todos os presentes votaram
    // BOLT: Use existing snapshot ID from votacao object to avoid redundant quorum lookup
    const quorumSnapshotId = votacao.quorum_snapshot_id;
    if (quorumSnapshotId) {
        const totalPresentes = await service.contarPresentesNoQuorum(quorumSnapshotId);
        if (contagem.total >= totalPresentes && totalPresentes > 0) {
            log.info("AssembleiaVotacaoAutoEncerramento", { requestId, assembleiaId: id, votacaoId: vid, votos: contagem.total, presentes: totalPresentes });
            const finalizada = await service.finalizarVotacao(vid);
            socket.emitEvent(id, "votacao:encerrada", { ...finalizada, contagem, votos });
        } else {
            socket.emitEvent(id, "voto:updated", { contagem, votos });
        }
    } else {
        socket.emitEvent(id, "voto:updated", { contagem, votos });
    }

    log.info("AssembleiaVotarSucesso", { requestId, assembleiaId: id, atorId, votacaoId: vid, elapsedMs: Date.now() - start });
    res.json({ success: true, requestId });
  } catch (err) {
    log.error("AssembleiaVotarErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao registrar voto", requestId });
  }
}

async function encerrarVotacao(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  const vid = parseUuid(req.params.vid);
  if (!id || !vid) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });
    }

    const finalizada = await service.finalizarVotacao(vid, atorId);

    // BOLT: Calculate count in memory after fetching nominal votes, saving 1 DB trip
    const votos = await service.listarVotosNominais(vid);
    const contagem = service.calcularContagemVotos(votos);

    socket.emitEvent(id, "votacao:encerrada", { ...finalizada, contagem, votos });

    log.info("AssembleiaEncerrarVotacaoSucesso", { requestId, assembleiaId: id, atorId, votacaoId: vid, elapsedMs: Date.now() - start });
    res.json({ ...finalizada, requestId });
  } catch (err) {
    log.error("AssembleiaEncerrarVotacaoErro", { requestId, assembleiaId: id, atorId, error: err.message });
    res.status(500).json({ error: "Erro ao encerrar votação", requestId });
  }
}

async function pedirPalavra(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  try {
    await service.pedirPalavra(id, atorId);

    const fila = await service.listarPedidosPalavra(id);
    socket.emitEvent(id, "word_queue_updated", fila);

    res.json({ success: true, requestId });
  } catch (err) {
    log.error("AssembleiaPedirPalavraErro", { requestId, atorId, error: err.message });
    if (err.message === "Assembleia encerrada") {
        return res.status(409).json({ error: err.message, requestId });
    }
    res.status(500).json({ error: "Erro ao pedir palavra", requestId });
  }
}

async function concederPalavra(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const { id, pid } = req.params;
  const aid = parseUuid(id);
  const upid = parseUuid(pid);
  if (!aid || !upid) return res.status(400).json({ error: "ID inválido", requestId });

  try {
    const { autorizada, mesa } = await verificarAutoridadeMesa(aid, req.user);

    log.info("AssembleiaConcederPalavraRequest", {
      requestId,
      assembleiaId: aid,
      pedidoId: upid,
      atorId,
      isPresidente: mesa?.presidente_user_id === atorId,
      isDiretoria: req.user.perfil_acesso === 'DIRETORIA'
    });

    if (!autorizada) return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });

    const pedido = await service.concederPalavra(aid, upid, atorId);
    if (!pedido) return res.status(404).json({ error: "Pedido de palavra não encontrado nesta assembleia.", requestId });

    const fila = await service.listarPedidosPalavra(aid);
    socket.emitEvent(aid, "word_queue_updated", fila);

    res.json({ success: true, status: pedido.status, requestId });
  } catch (err) {
    log.error("AssembleiaConcederPalavraErro", {
      requestId,
      assembleiaId: aid,
      pedidoId: upid,
      error: err.message,
      stack: err.stack
    });

    if (err.message.includes("check constraint")) {
      return res.status(409).json({ error: "Status inválido para o pedido de palavra no banco de dados.", details: err.message, requestId });
    }

    res.status(500).json({ error: "Erro ao conceder palavra", requestId });
  }
}

async function iniciarVotacaoProposta(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const { id, prid } = req.params;
  const aid = parseUuid(id);
  const uprid = parseUuid(prid);
  if (!aid || !uprid) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { autorizada } = await verificarAutoridadeMesa(aid, req.user);
    if (!autorizada) return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE, requestId });

    const result = await service.iniciarVotacaoProposta(aid, uprid, atorId);

    if (result.status === 'RETIRADA_AUTOR_AUSENTE') {
        const propostas = await service.listarPropostas(aid);
        socket.emitEvent(aid, "proposals_updated", propostas);
        log.info("AssembleiaPropostaRetiradaAutomatica", { requestId, assembleiaId: aid, propostaId: uprid });
        return res.json({
            success: false,
            status: 'RETIRADA_AUTOR_AUSENTE',
            message: 'Proposta retirada de pauta: autor ausente da votação.',
            requestId
        });
    }

    const votacao = result;
    socket.emitEvent(aid, "votacao:iniciada", { ...votacao, contagem: { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 }, votos: [] });

    // Atualiza lista de propostas para refletir status EM_VOTACAO
    const propostas = await service.listarPropostas(aid);
    socket.emitEvent(aid, "proposals_updated", propostas);

    log.info("AssembleiaIniciarVotacaoPropostaSucesso", { requestId, assembleiaId: aid, atorId, votacaoId: votacao.id, elapsedMs: Date.now() - start });
    res.status(201).json({ ...votacao, requestId });
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoPropostaErro", {
       requestId,
       assembleiaId: aid,
       propostaId: uprid,
       error: err.message,
       stack: err.stack
    });

    if (err.message.includes("check constraint")) {
      return res.status(409).json({ error: "Não foi possível transicionar a proposta para votação devido a restrição de status.", details: err.message, requestId });
    }

    if (err.message.includes("transição de estado inválida") || err.message.includes("já existe uma votação ativa")) {
       return res.status(409).json({ error: err.message, requestId });
    }

    res.status(500).json({ error: "Erro inesperado ao iniciar votação da proposta", details: err.message, requestId });
  }
}

async function criarProposta(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  try {
    const { titulo, pauta } = req.body;

    log.info("AssembleiaCriarPropostaRequest", {
      requestId,
      assembleiaId: id,
      atorId,
      profile: req.user.perfil_acesso,
      hasTitulo: !!titulo,
      hasPauta: !!pauta
    });

    const proposta = await service.criarProposta({
      assembleia_id: id,
      autor_id: atorId,
      titulo,
      pauta
    });

    socket.emitEvent(id, "new_proposal", { ...proposta, autor_nome: req.user.nome });

    log.info("AssembleiaCriarPropostaSucesso", {
      requestId,
      assembleiaId: id,
      atorId,
      propostaId: proposta.id,
      elapsedMs: Date.now() - start
    });

    res.status(201).json({ ...proposta, requestId });
  } catch (err) {
    log.error("AssembleiaCriarPropostaErro", {
      requestId,
      assembleiaId: id,
      atorId,
      error: err.message,
      stack: err.stack
    });

    if (err.message === "Assembleia encerrada") {
        return res.status(409).json({ error: err.message, requestId });
    }

    if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) {
      return res.status(404).json({ error: err.message, requestId });
    }
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: "Não é possível criar proposta nesta assembleia no estado atual.", requestId });
    }
    if (err.message.includes("obrigatório") || err.message.includes("inválido")) {
      return res.status(400).json({ error: err.message, requestId });
    }

    res.status(500).json({ error: "Erro ao criar proposta", requestId });
  }
}

async function gerarRelatorio(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const id = parseUuid(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido", requestId });

  const start = Date.now();
  log.info("REPORT_PDF_START", { requestId, assembleiaId: id, atorId });

  try {
    const assembleia = await service.buscarPorId(id);
    if (!assembleia) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA, requestId });

    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (perfil === 'COMUNICADOR') {
        log.warn("REPORT_PDF_FORBIDDEN", { requestId, assembleiaId: id, atorId, profile: perfil });
        return res.status(403).json({ success: false, code: "FORBIDDEN", error: "Seu perfil não possui permissão para gerar relatórios.", requestId });
    }


    const [dados, filiado] = await Promise.all([
      service.gerarDadosRelatorio(id),
      filiadosService.buscarPorId(atorId)
    ]);

    if (!filiado) {
        return res.status(404).json({ error: "Dados do solicitante não encontrados.", requestId });
    }

    // Adiciona metadados do solicitante para o PDF e e-mail
    dados.solicitante = {
        nome: filiado.nome,
        perfil: perfil,
        data_geracao: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };

    const pdfBuffer = await pdfService.gerarPdfRelatorioAssembleia(dados);
    log.info("REPORT_PDF_GENERATED", { requestId, assembleiaId: id, size: pdfBuffer.length });

    // Enviar PDF para o solicitante (O serviço também notifica o sindicato internamente)
    await emailService.enviarEmailRelatorioAssembleia(filiado, dados.assembleia, pdfBuffer, dados);
    log.info("REPORT_EMAIL_USER_SENT", { requestId, assembleiaId: id, atorId });

    const maskedEmail = filiado.email1 ? filiado.email1.replace(/^(..)(.*)(@.*)$/, "$1***$3") : "N/A";

    await service.registrarAuditoria(id, atorId, "RELATORIO_GERADO", {
      requestedBy: { id: atorId, nome: req.user.nome },
      delivery: "email",
      email: maskedEmail,
      requestId
    });

    log.info("REPORT_DONE", { requestId, assembleiaId: id, atorId, elapsedMs: Date.now() - start });
    res.json({
      success: true,
      message: "O relatório foi gerado e enviado para seu e-mail com sucesso.",
      requestId
    });
  } catch (err) {
    log.error("REPORT_PDF_ERROR", {
      requestId,
      assembleiaId: id,
      atorId,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, error: "Erro ao gerar ou enviar relatório.", requestId });
  }
}

async function proxyEdital(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  const { id } = req.params;
  const aid = parseUuid(id);
  if (!aid) return res.status(400).json({ error: "ID inválido", requestId });

  try {
    const assembleia = await service.buscarPorId(aid);
    if (!assembleia || (!assembleia.edital_url && !assembleia.edital_public_id && !assembleia.edital_drive_file_id)) {
      return res.status(404).json({ error: "Edital não encontrado.", requestId });
    }

    // 🟢 NOVA REGRA: Preferência absoluta para Google Drive (Canonização)
    if (assembleia.edital_drive_file_id) {
        log.info("AssembleiaProxyEditalAcessadoDrive", { requestId, assembleiaId: aid });
        try {
            const dados = await driveService.obterArquivoStream(assembleia.edital_drive_file_id);

            // Força Content-Type PDF se for do Drive (já que agora é obrigatório ser PDF)
            const contentType = dados.mimeType === 'application/octet-stream' ? 'application/pdf' : dados.mimeType;

            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Disposition", `inline; filename="edital_${aid}.pdf"`);
            return dados.stream.pipe(res);
        } catch (driveErr) {
            log.error("AssembleiaProxyEditalErroDrive", { requestId, error: driveErr.message });
            // Se falhar no Drive e NÃO houver fallback legada, retorna erro
            if (!assembleia.edital_url && !assembleia.edital_public_id) {
                return res.status(502).json({ error: "Falha ao recuperar edital da Biblioteca Digital.", requestId });
            }
        }
    }

    // Se tivermos public_id, geramos uma URL assinada fresca.
    // Caso contrário (retrocompatibilidade), usamos a URL salva.
    let targetUrl = assembleia.edital_url;
    if (assembleia.edital_public_id) {
        targetUrl = getSignedUrl(assembleia.edital_public_id, {
            resource_type: assembleia.edital_resource_type || 'raw',
            type: assembleia.edital_type || 'authenticated'
        });
    }

    log.info("AssembleiaProxyEditalAcessado", { requestId, assembleiaId: aid });

    // Função interna para realizar o stream
    const performStream = async (url) => {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        timeout: 20000,
        validateStatus: (status) => status === 200
      });

      const contentType = response.headers['content-type'] || (url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg');
      res.setHeader('Content-Type', contentType);
      const filename = assembleia.edital_public_id ? `edital_${assembleia.id}.${assembleia.edital_format || 'pdf'}` : `edital_${aid}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      response.data.pipe(res);
    };

    try {
      await performStream(targetUrl);
    } catch (streamErr) {
      // Fallback para URLs antigas mal formatadas (PDF em /image/)
      if ((streamErr.response?.status === 401 || streamErr.response?.status === 404) &&
          targetUrl.toLowerCase().includes('.pdf') &&
          targetUrl.includes('/image/upload/')) {

        const fallbackUrl = targetUrl.replace('/image/upload/', '/raw/upload/');
        log.info("AssembleiaProxyEditalFallback", { requestId, assembleiaId: aid });
        await performStream(fallbackUrl);
      } else {
        throw streamErr;
      }
    }

  } catch (err) {
    log.error("AssembleiaProxyEditalErro", {
      requestId,
      assembleiaId: id,
      error: err.message,
      status: err.response?.status
    });

    if (res.headersSent) return;

    if (err.response?.status === 404) {
      return res.status(404).json({ error: "Arquivo não encontrado no provedor.", requestId });
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(403).json({ error: "Acesso negado pelo provedor de arquivos.", requestId });
    }

    res.status(500).json({ error: "Erro ao processar visualização do edital.", requestId });
  }
}

async function uploadEdital(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Arquivo não enviado", requestId });
    }

    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname?.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        return res.status(400).json({
            error: "Upload direto de PDF desativado para assembleias.",
            message: "Por favor, utilize o seletor da Biblioteca Digital (Google Drive) para anexar o edital.",
            requestId
        });
    }

    const isImage = req.file.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(req.file.originalname || '');

    const resourceType = isImage ? "image" : "auto";

    const result = await uploadFileBuffer(req.file.buffer, {
      folder: "sinprfes/editais",
      public_id: `edital_${Date.now()}`,
      resource_type: resourceType,
      type: "authenticated"
    });

    // Se for PDF, salva também no Google Drive (Robustez contra 403 do Cloudinary raw)
    if (isPdf) {
      try {
        const driveFileId = await driveService.uploadFile(
          req.file.buffer,
          `edital_${Date.now()}.pdf`,
          'application/pdf'
        );
        result.edital_drive_file_id = driveFileId;
        log.info("AssembleiaUploadEditalDriveSucesso", { driveFileId, requestId });
      } catch (driveErr) {
        log.error("AssembleiaUploadEditalDriveErro", { error: driveErr.message, requestId });
        // Não falha o upload se o Cloudinary deu certo, mas logamos o erro.
      }
    }

    // Validação automática pós-upload (best-effort HEAD check)
    try {
      const check = await axios.head(result.secure_url, { timeout: 10000 });
      if (check.status !== 200 && check.status !== 302) {
         throw new Error(`Cloudinary returned status ${check.status}`);
      }
    } catch (headErr) {
       const isRecoverable = headErr.response && [404, 403, 401].includes(headErr.response.status);

       log[isRecoverable ? 'warn' : 'error']("AssembleiaUploadEditalValidacaoAlerta", {
           url: result.secure_url,
           error: headErr.message,
           status: headErr.response?.status,
           requestId
       });

       if (!isRecoverable) {
           return res.status(502).json({
               error: "Arquivo enviado, mas a validação de acesso falhou. Tente novamente.",
               requestId
           });
       }
    }

    log.info("AssembleiaUploadEditalSucesso", {
        filename: req.file.originalname,
        public_id: result.public_id,
        resource_type: result.resource_type,
        url: result.secure_url,
        requestId
    });

    res.json({
        url: "/api/assembleias/proxy-edital",
        secure_url: "/api/assembleias/proxy-edital",
        public_id: result.public_id,
        resource_type: result.resource_type,
        type: result.type,
        format: result.format || (isPdf ? "pdf" : null),
        edital_drive_file_id: result.edital_drive_file_id || null,
        requestId
    });
  } catch (err) {
    log.error("AssembleiaUploadEditalErro", { error: err.message, requestId });
    res.status(500).json({ error: "Erro ao realizar upload do edital", requestId });
  }
}

module.exports = {
  listar,
  detalhe,
  estadoCompleto,
  estadoMini,
  criar,
  abrir,
  iniciarExecucao,
  encerrarAssembleia,
  gerarTokenQuorum,
  atualizarQuorum,
  checkin,
  definirMesa,
  iniciarVotacao,
  votar,
  encerrarVotacao,
  pedirPalavra,
  criarProposta,
  substituirMesa,
  concederPalavra,
  iniciarVotacaoProposta,
  diagnostico,
  limparLogsAuditoria,
  gerarRelatorio,
  uploadEdital,
  proxyEdital
};
