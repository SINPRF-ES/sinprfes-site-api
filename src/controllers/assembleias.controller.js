// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
const socket = require("../websocket/assembleia.socket");
const { uploadFileBuffer } = require("../services/cloudinary.service");
const log = require("../utils/log");
const Textos = require("../utils/textos");

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

async function criar(req, res) {
  const start = Date.now();
  try {
    const {
      tipo,
      titulo,
      pauta,
      edital_url,
      data_evento,
      hora_primeira_chamada,
      hora_segunda_chamada
    } = req.body;

    // 1. Validação de campos obrigatórios
    if (!tipo || !titulo || !data_evento || !hora_primeira_chamada || !hora_segunda_chamada) {
      return res.status(422).json({ error: "Título, tipo, data e horários de chamada são obrigatórios." });
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
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "ABERTA" });

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
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "EM_CURSO" });

    log.info("AssembleiaIniciarExecucaoSucesso", { requestId: req.requestId, assembleiaId: req.params.id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaIniciarExecucaoErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 422;
    res.status(status).json({ error: err.message });
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

async function gerarTokenQuorum(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { tipo_chamada, observacao } = req.body;

    // Validar se é recontagem e se quem pede é o Presidente
    if (tipo_chamada === 'RECONTAGEM') {
       const mesa = await service.buscarMesa(id);
       if (!mesa || mesa.presidente_user_id !== req.user.id) {
          return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
       }
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const quorum = await service.gerarQuorum({
      assembleia_id: id,
      token,
      gerado_por_user_id: req.user.id,
      tipo_chamada: tipo_chamada || 'PRIMEIRA',
      observacao
    });

    const eventName = tipo_chamada === 'RECONTAGEM' ? "assembleia:recontagem" : "assembleia:token_gerado";
    socket.emitEvent(id, eventName, { id: quorum.id, token, tipo_chamada });

    log.info("AssembleiaGerarTokenSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, tipo_chamada, elapsedMs: Date.now() - start });
    res.json({ token, quorum_id: quorum.id });
  } catch (err) {
    log.error("AssembleiaGerarTokenQuorumErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: "Erro ao gerar token de quórum" });
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

    // Bloqueia perfis que não votam nem contam quórum (ADMIN, COMUNICADOR)
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (perfil === 'ADMIN' || perfil === 'COMUNICADOR') {
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
      filiado_id: req.user.id,
      origem: 'TOKEN',
      assembleia_id: id
    });

    // Broadcast do quórum atualizado
    const estado = await service.buscarEstadoCompleto(id);
    if (estado) {
      socket.emitEvent(id, "assembleia:checkin_updated", {
        presentes_total: estado.quorumVigente?.total || 0,
        quorum_total_ativos: estado.quorumVigente?.quorum_total_ativos || 0,
        quorum_necessario: estado.quorumVigente?.quorum_necessario || 0,
        quorum_atingido: (estado.quorumVigente?.total || 0) >= (estado.quorumVigente?.quorum_necessario || 0),
        tipo_chamada: estado.quorumVigente?.tipo_chamada
      });
    }

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
    const { presidente_user_id, secretario_user_id } = req.body;

    if (!presidente_user_id || !secretario_user_id) {
      return res.status(400).json({ error: "Presidente e Secretário são obrigatórios" });
    }

    const mesa = await service.definirMesa({
      assembleia_id: id,
      presidente_user_id,
      secretario_user_id,
      definida_por_user_id: req.user.id
    });

    socket.emitEvent(id, "assembleia:mesa_definida", mesa);

    log.info("AssembleiaDefinirMesaSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, elapsedMs: Date.now() - start });
    res.json(mesa);
  } catch (err) {
    log.error("AssembleiaDefinirMesaErro", { requestId: req.requestId, assembleiaId: req.params.id, error: err.message });
    res.status(500).json({ error: "Erro ao definir mesa" });
  }
}

async function iniciarVotacao(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { titulo, descricao, duracao_segundos } = req.body;

    // Apenas o Presidente da Mesa pode iniciar votação
    const mesa = await service.buscarMesa(id);
    if (!mesa || mesa.presidente_user_id !== req.user.id) {
       return res.status(403).json({ error: Textos.ASSEMBLEIA.APENAS_PRESIDENTE });
    }

    const quorum = await service.buscarUltimoQuorum(id);
    if (!quorum) return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO });

    const votacao = await service.criarVotacao({
      assembleia_id: id,
      quorum_snapshot_id: quorum.id,
      titulo,
      descricao,
      duracao_segundos: duracao_segundos || 60,
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
        log.warn("AssembleiaVotoRejeitado", { requestId: req.requestId, userId: req.user.id, assembleiaId: id, votacaoId: vid, motivo: "Usuário Inelegível" });
        return res.status(403).json({ error: Textos.ASSEMBLEIA.NAO_ELEGIVEL });
    }

    await service.registrarVoto(vid, req.user.id, voto, id);

    const [contagem, votos] = await Promise.all([
      service.contarVotos(vid),
      service.listarVotosNominais(vid)
    ]);

    socket.emitEvent(id, "voto:updated", { contagem, votos });

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

    // Apenas Presidente
    const mesa = await service.buscarMesa(id);
    if (!mesa || mesa.presidente_user_id !== req.user.id) {
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
    res.status(500).json({ error: "Erro ao pedir palavra" });
  }
}

async function criarProposta(req, res) {
  try {
    const { id } = req.params;
    const { titulo, pauta } = req.body;

    const proposta = await service.criarProposta({
      assembleia_id: id,
      autor_id: req.user.id,
      titulo,
      pauta
    });

    socket.emitEvent(id, "new_proposal", { ...proposta, autor_nome: req.user.nome });
    res.status(201).json(proposta);
  } catch (err) {
    log.error("AssembleiaCriarPropostaErro", err);
    res.status(500).json({ error: "Erro ao criar proposta" });
  }
}

async function gerarRelatorio(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;

    // Stub: Apenas registra o pedido e loga
    await service.registrarAuditoria(id, req.user.id, "RELATORIO_SOLICITADO", { solicitado_por: req.user.nome });

    const request_id = Math.random().toString(36).substring(7).toUpperCase();
    const auth_code = Math.random().toString(36).substring(7).toUpperCase();

    log.info("AssembleiaGerarRelatorioSucesso", { requestId: req.requestId, assembleiaId: id, userId: req.user.id, requestIdRelatorio: request_id, elapsedMs: Date.now() - start });
    res.json({
      success: true,
      message: "Pedido de relatório registrado. O documento será enviado por e-mail em breve (Stub).",
      request_id,
      auth_code
    });
  } catch (err) {
    log.error("AssembleiaGerarRelatorioErro", { requestId: req.requestId, assembleiaId: id, error: err.message });
    res.status(500).json({ error: "Erro ao solicitar relatório" });
  }
}

async function uploadEdital(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    // PDFs devem ser enviados como 'raw' para garantir delivery direto e evitar 401/path issues no Cloudinary
    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname?.toLowerCase().endsWith('.pdf');

    const result = await uploadFileBuffer(req.file.buffer, {
      folder: "sinprfes/editais",
      public_id: `edital_${Date.now()}`,
      resource_type: isPdf ? "raw" : "auto",
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    log.error("AssembleiaUploadEditalErro", err);
    res.status(500).json({ error: "Erro ao realizar upload do edital" });
  }
}

module.exports = {
  listar,
  detalhe,
  estadoCompleto,
  criar,
  abrir,
  iniciarExecucao,
  encerrarAssembleia,
  gerarTokenQuorum,
  checkin,
  definirMesa,
  iniciarVotacao,
  votar,
  encerrarVotacao,
  pedirPalavra,
  criarProposta,
  diagnostico,
  gerarRelatorio,
  uploadEdital
};
