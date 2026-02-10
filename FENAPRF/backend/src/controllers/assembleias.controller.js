// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
const usersService = require("../services/users.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const socket = require("../websocket/assembleia.socket");
const driveService = require("../services/drive.service");
const { uploadFileBuffer, getSignedUrl } = require("../services/cloudinary.service");
const log = require("../utils/log");
const Textos = require("../utils/textos");
const axios = require("axios");

// Anti brute-force simples em memória para tokens
const failedCheckinAttempts = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutos
const MAX_FAILED_ATTEMPTS = 5;

async function listar(req, res) {
  const start = Date.now();
  try {
    const assembleias = await service.listar(req.user.perfil_acesso);
    log.info("AssembleiaListarSucesso", { requestId: req.requestId, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(assembleias);
  } catch (err) {
    log.error("AssembleiaListarErro", { requestId: req.requestId, userId: req.user.id, error: err });

    // Se for erro de coluna inexistente, indica migração pendente
    if (err.message.includes("column") && err.message.includes("does not exist")) {
        return res.status(500).json({
            error: "Erro de esquema no banco de dados. Verifique migrações.",
            details: err.message,
            requestId: req.requestId
        });
    }

    res.status(500).json({ error: "Erro ao listar assembleias", requestId: req.requestId });
  }
}

async function detalhe(req, res) {
  const start = Date.now();
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });
    log.info("AssembleiaDetalheSucesso", { requestId: req.requestId, assembleiaId: req.params.id, elapsedMs: Date.now() - start });
    res.json(assembleia);
  } catch (err) {
    log.error("AssembleiaDetalheErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err });
    res.status(500).json({ error: "Erro ao buscar detalhe da assembleia", requestId: req.requestId });
  }
}

async function estadoCompleto(req, res) {
  const start = Date.now();
  try {
     const estado = await service.buscarEstadoCompleto(req.params.id, req.user.id);
    if (!estado) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });

     // Auditoria de entrada
     await service.registrarAuditoria(req.params.id, req.user.id, "ENTRADA_SESSAO", { platform: 'mobile', requestId: req.requestId });

    log.info("AssembleiaEstadoCompletoSucesso", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoCompletoErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err });
    res.status(500).json({ error: "Erro ao buscar estado da assembleia", requestId: req.requestId });
  }
}

async function estadoMini(req, res) {
  try {
    const estado = await service.buscarEstadoResumido(req.params.id);
    if (!estado) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });

    const mesa = await service.buscarMesa(req.params.id);
    const isPresidente = mesa && mesa.presidente_user_id === req.user.id;
    const isDiretoria = req.user.perfil_acesso === 'DIRETORIA' || req.user.perfil_acesso === 'ADMIN';

    const canSeeToken = estado.quorumVigente?.token && (isPresidente || isDiretoria || req.user.id === estado.quorumVigente.gerado_por_user_id);

    if (!canSeeToken && estado.quorumVigente) {
        delete estado.quorumVigente.token;
    }

    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoMiniErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: "Erro ao buscar estado resumido" });
  }
}

async function diagnostico(req, res) {
  const start = Date.now();
  try {
    const data = await service.buscarDiagnostico(req.params.id);
    log.info("AssembleiaDiagnosticoAcessado", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id });
    res.json(data);
  } catch (err) {
    log.error("AssembleiaDiagnosticoErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: err.message });
  }
}

async function limparLogsAuditoria(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { recordsDeleted } = req.body;

    // Registrar auditoria da ação de limpeza no backend (específico de assembleia)
    await service.registrarAuditoria(id, req.user.id, "DIAGNOSTICO_LOGS_LIMPOS", {
      who: { id: req.user.id, perfil: req.user.perfil_acesso },
      scope: "diagnostico.logs.clear",
      recordsDeleted: recordsDeleted || 0,
      platform: 'mobile',
      requestId: req.requestId
    });

    log.info("AssembleiaLogsLimpos", {
      requestId: req.requestId,
      assembleiaId: id,
      userId: req.user.id,
      recordsDeleted
    });

    res.json({ success: true, message: "Ação de limpeza registrada com sucesso." });
  } catch (err) {
    log.error("AssembleiaLimparLogsErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: "Erro ao registrar limpeza de logs" });
  }
}

async function criar(req, res) {
  const start = Date.now();
  try {
    // Log diagnóstico para identificar chaves enviadas pelo mobile (Issue A/B)
    log.info("AssembleiaCriarRequest", {
        requestId: req.requestId,
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
      return res.status(422).json({ error: "Título, tipo, data e horários de chamada são obrigatórios." });
    }

    if (!edital_drive_file_id) {
        return res.status(422).json({ error: "O edital (PDF da Biblioteca Digital) é obrigatório para novas assembleias." });
    }

    // 2. Validação do Tipo
    const tiposValidos = ['AGE', 'AGO', 'Assembleia Geral Ordinária', 'Assembleia Geral Extraordinária'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(422).json({ error: "Tipo de assembleia inválido." });
    }

    // 3. Validação Estrita de Data
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexData.test(data_evento)) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_INVALIDA, code: 'DATA_EVENTO_INVALIDA' });
    }
    const [y, m, d] = data_evento.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_INVALIDA, code: 'DATA_EVENTO_INVALIDA' });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dateObj < hoje) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_PASSADA, code: 'DATA_EVENTO_PASSADA' });
    }

    const umAnoDepois = new Date();
    umAnoDepois.setFullYear(umAnoDepois.getFullYear() + 1);
    umAnoDepois.setHours(23, 59, 59, 999);
    if (dateObj > umAnoDepois) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.DATA_EVENTO_MUITO_DISTANTE, code: 'DATA_EVENTO_MUITO_DISTANTE' });
    }

    // 4. Validação Estrita de Horas
    const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!regexHora.test(hora_primeira_chamada) || !regexHora.test(hora_segunda_chamada)) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.HORA_INVALIDA, code: 'HORA_INVALIDA' });
    }

    if (hora_segunda_chamada < hora_primeira_chamada) {
      return res.status(422).json({ error: Textos.ASSEMBLEIA.HORA_ORDEM_INVALIDA, code: 'HORA_ORDEM_INVALIDA' });
    }

    // 5. Normalização de data_hora_inicio (Opcional, mas mantido para retrocompatibilidade se o banco exigir)
    // Se o banco não usa mais, o service.criar vai ignorar o que não precisa.
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
      criado_por: req.user.id
    });

    log.info("AssembleiaCriarSucesso", { requestId: req.requestId, assembleiaId: nova.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.status(201).json(nova);
  } catch (err) {
    log.error("AssembleiaCriarErro", { requestId: req.requestId, userId: req.user.id, error: err.message, stack: err.stack });

    if (err.message.includes("violates check constraint") || err.message.includes("invalid input syntax") || err.message.includes("type date") || err.message.includes("type time")) {
      return res.status(422).json({ error: "Dados inválidos fornecidos para criação da assembleia.", details: err.message });
    }

    if (err.message.includes("column") && err.message.includes("does not exist")) {
      return res.status(500).json({ error: "Erro de esquema no banco de dados. Migração incompleta.", requestId: req.requestId });
    }

    res.status(500).json({ error: "Erro inesperado ao criar assembleia", requestId: req.requestId });
  }
}

async function abrir(req, res) {
  const start = Date.now();
  try {
    const atualizada = await service.abrir(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "EM_CREDENCIAMENTO" });

    log.info("AssembleiaAbrirSucesso", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaAbrirErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
}

async function iniciarExecucao(req, res) {
  const start = Date.now();
  try {
    const atualizada = await service.iniciarExecucao(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "INICIADO" });

    log.info("AssembleiaIniciarExecucaoSucesso", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaIniciarExecucaoErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 422;
    res.status(status).json({ error: err.message });
  }
}

async function suspender(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { motivo, data_hora_retorno } = req.body;
    if (!motivo) return res.status(400).json({ error: "O motivo da suspensão é obrigatório." });

    const atualizada = await service.suspender(id, req.user.id, motivo, data_hora_retorno);
    socket.emitEvent(id, "assembleia:status_changed", { estado: "SUSPENSA", suspensao_motivo: motivo, data_hora_retorno });

    log.info("AssembleiaSuspenderSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaSuspenderErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: err.message });
  }
}

async function retomar(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const atualizada = await service.retomar(id, req.user.id);
    socket.emitEvent(id, "assembleia:status_changed", { estado: "INICIADO" });

    log.info("AssembleiaRetomarSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaRetomarErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: err.message });
  }
}

async function encerrarAssembleia(req, res) {
  const start = Date.now();
  try {
    const atualizada = await service.encerrar(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "ENCERRADA" });

    log.info("AssembleiaEncerrarSucesso", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaEncerrarErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: err.message });
  }
}

// Helper para validar se o membro é o Presidente da Mesa ou Diretoria
async function verificarAutoridadeMesa(assembleiaId, user) {
  const mesa = await service.buscarMesa(assembleiaId);
  const isDiretoria = user.perfil_acesso === 'DIRETORIA' || user.perfil_acesso === 'ADMIN';
  const isPresidente = mesa && mesa.presidente_user_id === user.id;
  return { mesa, autorizada: isDiretoria || isPresidente, isPresidente, isDiretoria };
}

async function gerarTokenQuorum(req, res) {
  const start = Date.now();
  const { id } = req.params;
  try {
    const { tipo_chamada, observacao, is_global } = req.body;

    // Validação de autoridade: Presidente ou Diretoria
    // O QR Global só pode ser gerado pela Diretoria (Secretaria)
    const { autorizada, isDiretoria } = await verificarAutoridadeMesa(id, req.user);

    if (is_global && !isDiretoria) {
        return res.status(403).json({ error: "Apenas a Diretoria de Secretaria pode gerar o QR Code Global." });
    }

    if (!autorizada) {
      return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
    }

    // Validação de UUID para evitar 500 do Postgres
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      log.warn("AssembleiaGerarTokenIdInvalido", { requestId: req.requestId, assembleiaId: id });
      return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });
    }

    const tiposValidos = ['PRIMEIRA', 'SEGUNDA', 'RECONTAGEM', 'GLOBAL'];
    const tipoFinal = (tipo_chamada || 'PRIMEIRA').toUpperCase();

    if (!tiposValidos.includes(tipoFinal)) {
      return res.status(422).json({ error: "Tipo de chamada inválido. Use PRIMEIRA, SEGUNDA ou RECONTAGEM." });
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const quorum = await service.gerarQuorum({
      assembleia_id: id,
      token,
      gerado_por_user_id: req.user.id,
      tipo_chamada: tipoFinal,
      observacao,
      is_global: !!is_global || tipoFinal === 'GLOBAL'
    });

    // Buscar estado consolidado para retorno rico (evita double fetch no app)
    const estado = await service.buscarEstadoCompleto(id, req.user.id);

    const eventName = tipoFinal === 'RECONTAGEM' ? "assembleia:recontagem" : "assembleia:token_gerado";
    socket.emitEvent(id, eventName, {
      id: quorum.id,
      token: quorum.token,
      tipo_chamada: tipoFinal,
      quorumVigente: estado?.quorumVigente
    });

    log.info("AssembleiaGerarTokenSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, tipo_chamada: tipoFinal, isNew: quorum.isNew, elapsedMs: Date.now() - start });

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
      expiresAt: quorum.valido_ate || new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
  } catch (err) {
    log.error("AssembleiaGerarTokenQuorumErro", { requestId: req.requestId, assembleiaId: id, error: err.message, stack: err.stack });

    if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: "Não é possível gerar token para esta assembleia no estado atual." });
    }
    if (err.message === Textos.ASSEMBLEIA.APENAS_PRESIDENTE) {
      return res.status(403).json({ error: err.message });
    }

    // Erros de banco específicos (ex: deadlock, unique violation inesperada)
    if (err.code === '23505') {
       return res.status(409).json({ error: "Conflito ao gerar token. Tente novamente.", requestId: req.requestId });
    }

    res.status(500).json({ error: "Erro interno ao gerar token de quórum", requestId: req.requestId });
  }
}

async function atualizarQuorum(req, res) {
  const start = Date.now();
  const { id } = req.params;
  try {
    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
    }

    const quorum = await service.atualizarQuorum(id, req.user.id);
    const estado = await service.buscarEstadoCompleto(id, req.user.id);

    socket.emitEvent(id, "assembleia:quorum_atualizado", {
      id: quorum.id,
      token: quorum.token,
      tipo_chamada: quorum.tipo_chamada,
      quorumVigente: estado?.quorumVigente
    });

    log.info("AssembleiaAtualizarQuorumSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });

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
      expiresAt: quorum.valido_ate || new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
  } catch (err) {
     log.error("AssembleiaAtualizarQuorumErro", { requestId: req.requestId, assembleiaId: id, error: err.message });
     if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) return res.status(404).json({ error: err.message });
     if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) return res.status(409).json({ error: err.message });
     res.status(500).json({ error: "Erro ao atualizar quórum", requestId: req.requestId });
  }
}

async function checkin(req, res) {
  const start = Date.now();
  const userId = req.user.id;

  try {
    const { id } = req.params;
    const { token } = req.body;

    // Verificar cooldown
    const failureData = failedCheckinAttempts.get(userId);
    if (failureData && failureData.count >= MAX_FAILED_ATTEMPTS && Date.now() - failureData.lastAttempt < COOLDOWN_TIME) {
        log.warn("AssembleiaCheckinBloqueado", { requestId: req.requestId, userId, assembleiaId: id });
        return res.status(429).json({ error: "Muitas tentativas inválidas. Tente novamente em alguns minutos." });
    }

    if (!token) return res.status(400).json({ error: "Token é obrigatório" });

    // Bloqueia perfis que não votam nem contam quórum (ADMIN)
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (perfil === 'ADMIN') {
       return res.status(403).json({ error: "Seu perfil não possui permissão para realizar check-in em assembleias" });
    }

    const quorum = await service.buscarQuorumPorToken(id, token);
    if (!quorum) {
        // Registrar falha
        const currentFailures = failureData ? failureData.count : 0;
        failedCheckinAttempts.set(userId, { count: currentFailures + 1, lastAttempt: Date.now() });

        await service.registrarAuditoria(id, userId, 'CHECKIN_FALHA_TOKEN', { token, requestId: req.requestId });
        log.warn("AssembleiaCheckinFalhou", { requestId: req.requestId, userId, assembleiaId: id, token_tentado: token, motivo: "Token Inválido" });
        return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO });
    }

    // Sucesso: limpar falhas
    failedCheckinAttempts.delete(userId);

    await service.realizarCheckin({
      assembleia_quorum_id: quorum.id,
      user_id: req.user.id,
      origem: 'TOKEN',
      assembleia_id: id
    });

    // Broadcast do quórum atualizado - OTIMIZAÇÃO BOLT ⚡
    // Busca apenas o necessário para o contador de presença, evitando o peso do estado completo (propostas, oradores, etc)
    const quorumVigente = await service.buscarUltimoQuorum(id);
    const totalPresentes = quorumVigente ? await service.contarPresentesNoQuorum(quorumVigente.id) : 0;

    socket.emitEvent(id, "assembleia:checkin_updated", {
      total: totalPresentes, // Compatibilidade mobile
      presentes_total: totalPresentes,
      quorum_total_ativos: quorumVigente?.quorum_total_ativos || 0,
      quorum_necessario: quorumVigente?.quorum_necessario || 0,
      quorum_atingido: totalPresentes >= (quorumVigente?.quorum_necessario || 0),
      tipo_chamada: quorumVigente?.tipo_chamada
    });

    log.info("AssembleiaCheckinSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json({ success: true, message: "Check-in realizado com sucesso" });
  } catch (err) {
    log.error("AssembleiaCheckinErro", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, error: err.message });
    res.status(500).json({ error: "Erro ao realizar check-in" });
  }
}

async function definirMesa(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const {
        presidente_user_id,
        vice_presidente_user_id,
        secretario_user_id,
        secretario_2_user_id
    } = req.body;

    if (!presidente_user_id || !vice_presidente_user_id || !secretario_user_id || !secretario_2_user_id) {
      return res.status(400).json({ error: "Todos os 4 membros da mesa são obrigatórios" });
    }

    const ids = [presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id];
    if (new Set(ids).size !== 4) {
      return res.status(400).json({ error: "Os membros da mesa devem ser pessoas diferentes" });
    }

    const mesa = await service.definirMesa({
      assembleia_id: id,
      presidente_user_id,
      vice_presidente_user_id,
      secretario_user_id,
      secretario_2_user_id,
      definida_por_user_id: req.user.id
    });

    socket.emitEvent(id, "assembleia:mesa_definida", mesa);

    log.info("AssembleiaDefinirMesaSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(mesa);
  } catch (err) {
    log.error("AssembleiaDefinirMesaErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: "Erro ao definir mesa", requestId: req.requestId });
  }
}

async function substituirMesa(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const {
        presidente_user_id,
        vice_presidente_user_id,
        secretario_user_id,
        secretario_2_user_id,
        justificativa
    } = req.body;

    // Apenas DIRETORIA pode substituir a mesa. Presidente (se não for DIRETORIA) não pode.
    if (req.user.perfil_acesso !== 'DIRETORIA' && req.user.perfil_acesso !== 'ADMIN') {
        return res.status(403).json({ error: "Apenas a Diretoria pode destituir ou alterar a mesa." });
    }

    if (!presidente_user_id || !vice_presidente_user_id || !secretario_user_id || !secretario_2_user_id || !justificativa) {
      return res.status(400).json({ error: "Todos os membros e a Justificativa são obrigatórios" });
    }

    const ids = [presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id];
    if (new Set(ids).size !== 4) {
      return res.status(400).json({ error: "Os membros da mesa devem ser pessoas diferentes" });
    }

    const mesa = await service.substituirMesa({
      assembleia_id: id,
      presidente_user_id,
      vice_presidente_user_id,
      secretario_user_id,
      secretario_2_user_id,
      substituida_por_user_id: req.user.id,
      justificativa
    });

    socket.emitEvent(id, "assembleia:mesa_definida", mesa);
    await service.registrarAuditoria(id, req.user.id, "MESA_SUBSTITUICAO_REALIZADA", { requestId: req.requestId });

    log.info("AssembleiaSubstituirMesaSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(mesa);
  } catch (err) {
    log.error("AssembleiaSubstituirMesaErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    if (err.message.includes("obrigatória") || err.message.includes("mínimo")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Erro ao substituir mesa", requestId: req.requestId });
  }
}

async function iniciarVotacao(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { titulo, descricao, duracao_segundos } = req.body;

    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
    }

    const quorum = await service.buscarUltimoQuorum(id);
    if (!quorum) return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO });

    const votacao = await service.criarVotacao({
      assembleia_id: id,
      quorum_snapshot_id: quorum.id,
      titulo,
      descricao,
      duracao_segundos: duracao_segundos || 300,
      iniciada_por_user_id: req.user.id
    });

    socket.emitEvent(id, "votacao:iniciada", { ...votacao, contagem: { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 }, votos: [] });

    log.info("AssembleiaIniciarVotacaoSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, votacaoId: votacao.id, elapsedMs: Date.now() - start });
    res.status(201).json(votacao);
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: "Erro ao iniciar votação" });
  }
}

async function votar(req, res) {
  const start = Date.now();
  try {
    const { id, vid } = req.params;
    const { voto } = req.body;

     const votacao = await service.buscarVotacaoAtiva(id);
     if (!votacao || votacao.id !== vid) {
        return res.status(400).json({ error: Textos.ASSEMBLEIA.VOTACAO_ENCERRADA });
     }

     if (new Date(votacao.encerra_em) < new Date()) {
        return res.status(400).json({ error: Textos.ASSEMBLEIA.TEMPO_EXPIRADO });
     }

    const elegivel = await service.verificarElegibilidade(vid, req.user.id);
    if (!elegivel) {
        log.warn("AssembleiaVotoRejeitado", { requestId: req.requestId, userId: req.user.id, assembleiaId: id, votacaoId: vid, motivo: "Membro Inelegível" });
        return res.status(403).json({ error: Textos.ASSEMBLEIA.NAO_ELEGIVEL });
    }

    await service.registrarVoto(vid, req.user.id, voto, id);

    const [contagem, votos] = await Promise.all([
      service.contarVotos(vid),
      service.listarVotosNominais(vid)
    ]);

    // Auto-encerramento se todos os presentes votaram
    const quorumVigente = await service.buscarUltimoQuorum(id);
    if (quorumVigente) {
        const totalPresentes = await service.contarPresentesNoQuorum(quorumVigente.id);
        if (contagem.total >= totalPresentes && totalPresentes > 0) {
            log.info("AssembleiaVotacaoAutoEncerramento", { requestId: req.requestId, assembleiaId: id, votacaoId: vid, votos: contagem.total, presentes: totalPresentes });
            const finalizada = await service.finalizarVotacao(vid);
            socket.emitEvent(id, "votacao:encerrada", { ...finalizada, contagem, votos });
        } else {
            socket.emitEvent(id, "voto:updated", { contagem, votos });
        }
    } else {
        socket.emitEvent(id, "voto:updated", { contagem, votos });
    }

    log.info("AssembleiaVotarSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, votacaoId: vid, elapsedMs: Date.now() - start });
    res.json({ success: true });
  } catch (err) {
    log.error("AssembleiaVotarErro", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, error: err.message });
    res.status(500).json({ error: "Erro ao registrar voto" });
  }
}

async function encerrarVotacao(req, res) {
  const start = Date.now();
  try {
    const { id, vid } = req.params;

    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
    }

    const finalizada = await service.finalizarVotacao(vid, req.user.id);
    const [contagem, votos] = await Promise.all([
      service.contarVotos(vid),
      service.listarVotosNominais(vid)
    ]);

    socket.emitEvent(id, "votacao:encerrada", { ...finalizada, contagem, votos });

    log.info("AssembleiaEncerrarVotacaoSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, votacaoId: vid, elapsedMs: Date.now() - start });
    res.json(finalizada);
  } catch (err) {
    log.error("AssembleiaEncerrarVotacaoErro", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, error: err.message });
    res.status(500).json({ error: "Erro ao encerrar votação" });
  }
}

async function pedirPalavra(req, res) {
  try {
    const { id } = req.params;
    await service.pedirPalavra(id, req.user.id);

    const fila = await service.listarPedidosPalavra(id);
    socket.emitEvent(id, "word_queue_updated", fila);

    res.json({ success: true });
  } catch (err) {
    log.error("AssembleiaPedirPalavraErro", err);
    if (err.message === "Assembleia encerrada") {
        return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: "Erro ao pedir palavra" });
  }
}

async function concederPalavra(req, res) {
  const { id, pid } = req.params;
  try {
    const { autorizada, mesa } = await verificarAutoridadeMesa(id, req.user);

    log.info("AssembleiaConcederPalavraRequest", {
      requestId: req.requestId,
      assembleiaId: id,
      pedidoId: pid,
      userId: req.user.id,
      isPresidente: mesa?.presidente_user_id === req.user.id,
      isDiretoria: req.user.perfil_acesso === 'DIRETORIA'
    });

    if (!autorizada) return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });

    const pedido = await service.concederPalavra(id, pid, req.user.id);
    if (!pedido) return res.status(404).json({ error: "Pedido de palavra não encontrado nesta assembleia." });

    const fila = await service.listarPedidosPalavra(id);
    socket.emitEvent(id, "word_queue_updated", fila);

    res.json({ success: true, status: pedido.status });
  } catch (err) {
    log.error("AssembleiaConcederPalavraErro", {
      requestId: req.requestId,
      assembleiaId: id,
      pedidoId: pid,
      error: err.message,
      stack: err.stack
    });

    if (err.message.includes("check constraint")) {
      return res.status(409).json({ error: "Status inválido para o pedido de palavra no banco de dados.", details: err.message });
    }

    res.status(500).json({ error: "Erro ao conceder palavra", requestId: req.requestId });
  }
}

async function iniciarVotacaoProposta(req, res) {
  const start = Date.now();
  const { id, prid } = req.params;
  try {
    const { autorizada } = await verificarAutoridadeMesa(id, req.user);
    if (!autorizada) return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });

    const result = await service.iniciarVotacaoProposta(id, prid, req.user.id);

    if (result.status === 'RETIRADA_AUTOR_AUSENTE') {
        const propostas = await service.listarPropostas(id);
        socket.emitEvent(id, "proposals_updated", propostas);
        log.info("AssembleiaPropostaRetiradaAutomatica", { requestId: req.requestId, assembleiaId: id, propostaId: prid });
        return res.json({
            success: false,
            status: 'RETIRADA_AUTOR_AUSENTE',
            message: 'Proposta retirada de pauta: autor ausente da votação.'
        });
    }

    const votacao = result;
    socket.emitEvent(id, "votacao:iniciada", { ...votacao, contagem: { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 }, votos: [] });

    // Atualiza lista de propostas para refletir status EM_VOTACAO
    const propostas = await service.listarPropostas(id);
    socket.emitEvent(id, "proposals_updated", propostas);

    log.info("AssembleiaIniciarVotacaoPropostaSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, votacaoId: votacao.id, elapsedMs: Date.now() - start });
    res.status(201).json(votacao);
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoPropostaErro", {
       requestId: req.requestId,
       assembleiaId: id,
       propostaId: prid,
       error: err.message,
       stack: err.stack
    });

    if (err.message.includes("check constraint")) {
      return res.status(409).json({ error: "Não foi possível transicionar a proposta para votação devido a restrição de status.", details: err.message });
    }

    if (err.message.includes("transição de estado inválida") || err.message.includes("já existe uma votação ativa")) {
       return res.status(409).json({ error: err.message });
    }

    res.status(500).json({ error: "Erro inesperado ao iniciar votação da proposta", details: err.message, requestId: req.requestId });
  }
}

async function criarProposta(req, res) {
  const start = Date.now();
  const { id } = req.params;
  try {
    const { titulo, pauta } = req.body;

    log.info("AssembleiaCriarPropostaRequest", {
      requestId: req.requestId,
      assembleiaId: id,
      userId: req.user.id,
      profile: req.user.perfil_acesso,
      hasTitulo: !!titulo,
      hasPauta: !!pauta
    });

    const proposta = await service.criarProposta({
      assembleia_id: id,
      autor_id: req.user.id,
      titulo,
      pauta
    });

    socket.emitEvent(id, "new_proposal", { ...proposta, autor_nome: req.user.nome });

    log.info("AssembleiaCriarPropostaSucesso", {
      requestId: req.requestId,
      assembleiaId: id,
      userId: req.user.id,
      propostaId: proposta.id,
      elapsedMs: Date.now() - start
    });

    res.status(201).json(proposta);
  } catch (err) {
    log.error("AssembleiaCriarPropostaErro", {
      requestId: req.requestId,
      assembleiaId: id,
      userId: req.user.id,
      error: err.message,
      stack: err.stack
    });

    if (err.message === "Assembleia encerrada") {
        return res.status(409).json({ error: err.message });
    }

    if (err.message === Textos.ASSEMBLEIA.NAO_ENCONTRADA) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA)) {
      return res.status(409).json({ error: "Não é possível criar proposta nesta assembleia no estado atual." });
    }
    if (err.message.includes("obrigatório") || err.message.includes("inválido")) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Erro ao criar proposta", requestId: req.requestId });
  }
}

async function gerarRelatorio(req, res) {
  const start = Date.now();
  const { id } = req.params;
  log.info("REPORT_PDF_START", { requestId: req.requestId, assembleiaId: id, userId: req.user.id });

  try {
    const assembleia = await service.buscarPorId(id);
    if (!assembleia) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });

    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (perfil === 'COMUNICADOR') {
        log.warn("REPORT_PDF_FORBIDDEN", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, profile: perfil });
        return res.status(403).json({ success: false, code: "FORBIDDEN", error: "Seu perfil não possui permissão para gerar relatórios." });
    }


    const [dados, user] = await Promise.all([
      service.gerarDadosRelatorio(id),
      usersService.buscarPorId(req.user.id)
    ]);

    if (!user) {
        return res.status(404).json({ error: "Dados do solicitante não encontrados." });
    }

    // Adiciona metadados do solicitante para o PDF e e-mail
    dados.solicitante = {
        nome: user.nome,
        perfil: perfil,
        data_geracao: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };

    const pdfBuffer = await pdfService.gerarPdfRelatorioAssembleia(dados);
    log.info("REPORT_PDF_GENERATED", { requestId: req.requestId, assembleiaId: id, size: pdfBuffer.length });

    // Enviar PDF para o solicitante (O serviço também notifica o sindicato internamente)
    await emailService.enviarEmailRelatorioAssembleia(user, dados.assembleia, pdfBuffer, dados);
    log.info("REPORT_EMAIL_USER_SENT", { requestId: req.requestId, assembleiaId: id, userId: req.user.id });

    const userEmail = user.email || user.email1;
    const maskedEmail = userEmail ? userEmail.replace(/^(..)(.*)(@.*)$/, "$1***$3") : "N/A";

    await service.registrarAuditoria(id, req.user.id, "RELATORIO_GERADO", {
      requestedBy: { id: req.user.id, nome: req.user.nome },
      delivery: "email",
      email: maskedEmail,
      requestId: req.requestId
    });

    log.info("REPORT_DONE", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json({
      success: true,
      message: "O relatório foi gerado e enviado para seu e-mail com sucesso.",
      requestId: req.requestId
    });
  } catch (err) {
    log.error("REPORT_PDF_ERROR", {
      requestId: req.requestId,
      assembleiaId: id,
      userId: req.user.id,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ success: false, error: "Erro ao gerar ou enviar relatório.", requestId: req.requestId });
  }
}

async function proxyEdital(req, res) {
  const { id } = req.params;
  try {
    const assembleia = await service.buscarPorId(id);
    if (!assembleia || (!assembleia.edital_url && !assembleia.edital_public_id && !assembleia.edital_drive_file_id)) {
      return res.status(404).json({ error: "Edital não encontrado." });
    }

    // 🟢 NOVA REGRA: Preferência absoluta para Google Drive (Canonização)
    if (assembleia.edital_drive_file_id) {
        log.info("AssembleiaProxyEditalAcessadoDrive", { requestId: req.requestId, assembleiaId: id });
        try {
            const dados = await driveService.obterArquivoStream(assembleia.edital_drive_file_id);

            // Força Content-Type PDF se for do Drive (já que agora é obrigatório ser PDF)
            const contentType = dados.mimeType === 'application/octet-stream' ? 'application/pdf' : dados.mimeType;

            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Disposition", `inline; filename="edital_${id}.pdf"`);
            return dados.stream.pipe(res);
        } catch (driveErr) {
            log.error("AssembleiaProxyEditalErroDrive", { requestId: req.requestId, error: driveErr.message });
            // Se falhar no Drive e NÃO houver fallback legada, retorna erro
            if (!assembleia.edital_url && !assembleia.edital_public_id) {
                return res.status(502).json({ error: "Falha ao recuperar edital da Biblioteca Digital." });
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

    log.info("AssembleiaProxyEditalAcessado", { requestId: req.requestId, assembleiaId: id });

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
      const filename = assembleia.edital_public_id ? `edital_${assembleia.id}.${assembleia.edital_format || 'pdf'}` : `edital_${id}.pdf`;
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
        log.info("AssembleiaProxyEditalFallback", { requestId: req.requestId, assembleiaId: id });
        await performStream(fallbackUrl);
      } else {
        throw streamErr;
      }
    }

  } catch (err) {
    log.error("AssembleiaProxyEditalErro", {
      requestId: req.requestId,
      assembleiaId: id,
      error: err.message,
      status: err.response?.status
    });

    if (res.headersSent) return;

    if (err.response?.status === 404) {
      return res.status(404).json({ error: "Arquivo não encontrado no provedor." });
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(403).json({ error: "Acesso negado pelo provedor de arquivos." });
    }

    res.status(500).json({ error: "Erro ao processar visualização do edital.", requestId: req.requestId });
  }
}

async function uploadEdital(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname?.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        return res.status(400).json({
            error: "Upload direto de PDF desativado para assembleias.",
            message: "Por favor, utilize o seletor da Biblioteca Digital (Google Drive) para anexar o edital."
        });
    }

    const isImage = req.file.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(req.file.originalname || '');

    const resourceType = isImage ? "image" : "auto";

    const result = await uploadFileBuffer(req.file.buffer, {
      folder: "fenaprf/editais",
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
        log.info("AssembleiaUploadEditalDriveSucesso", { driveFileId, requestId: req.requestId });
      } catch (driveErr) {
        log.error("AssembleiaUploadEditalDriveErro", { error: driveErr.message, requestId: req.requestId });
        // Não falha o upload se o Cloudinary deu certo, mas logamos o erro.
      }
    }

    // Validação automática pós-upload (best-effort HEAD check)
    try {
      // Aumentado timeout para 10s e adicionado log detalhado para debug de 502/Bad Gateway
      const check = await axios.head(result.secure_url, { timeout: 10000 });
      if (check.status !== 200 && check.status !== 302) {
         throw new Error(`Cloudinary returned status ${check.status}`);
      }
    } catch (headErr) {
       // Se falhar com 404/403/401, pode ser apenas delay de propagação no Cloudinary.
       // Logamos como aviso mas permitimos prosseguir se tivermos a URL.
       const isRecoverable = headErr.response && [404, 403, 401].includes(headErr.response.status);

       log[isRecoverable ? 'warn' : 'error']("AssembleiaUploadEditalValidacaoAlerta", {
           url: result.secure_url,
           error: headErr.message,
           status: headErr.response?.status,
           requestId: req.requestId
       });

       if (!isRecoverable) {
           return res.status(502).json({
               error: "Arquivo enviado, mas a validação de acesso falhou. Tente novamente.",
               requestId: req.requestId
           });
       }
    }

    log.info("AssembleiaUploadEditalSucesso", {
        filename: req.file.originalname,
        public_id: result.public_id,
        resource_type: result.resource_type,
        url: result.secure_url,
        requestId: req.requestId
    });

    res.json({
        url: "/api/assembleias/proxy-edital", // URL fictícia para evitar exposição do Cloudinary
        secure_url: "/api/assembleias/proxy-edital",
        public_id: result.public_id,
        resource_type: result.resource_type,
        type: result.type,
        format: result.format || (isPdf ? "pdf" : null),
        edital_drive_file_id: result.edital_drive_file_id || null
    });
  } catch (err) {
    log.error("AssembleiaUploadEditalErro", { error: err.message, requestId: req.requestId });
    res.status(500).json({ error: "Erro ao realizar upload do edital", requestId: req.requestId });
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
  suspender,
  retomar,
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
