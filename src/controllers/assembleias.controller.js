// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
const socket = require("../websocket/assembleia.socket");
const { uploadFileBuffer } = require("../services/cloudinary.service");
const log = require("../utils/log");
const Textos = require("../utils/textos");

async function listar(req, res) {
  try {
    const assembleias = await service.listar(req.user.perfil_acesso);
    res.json(assembleias);
  } catch (err) {
    log.error("AssembleiaListarErro", err);
    res.status(500).json({ error: "Erro ao listar assembleias" });
  }
}

async function detalhe(req, res) {
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });
    res.json(assembleia);
  } catch (err) {
    log.error("AssembleiaDetalheErro", err);
    res.status(500).json({ error: "Erro ao buscar detalhe da assembleia" });
  }
}

async function estadoCompleto(req, res) {
  try {
     const estado = await service.buscarEstadoCompleto(req.params.id, req.user.id);
    if (!estado) return res.status(404).json({ error: Textos.ASSEMBLEIA.NAO_ENCONTRADA });

     // Auditoria de entrada
     await service.registrarAuditoria(req.params.id, req.user.id, "ENTRADA_SESSAO", { platform: 'mobile' });

    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoCompletoErro", err);
    res.status(500).json({ error: "Erro ao buscar estado da assembleia" });
  }
}

async function criar(req, res) {
  try {
    const { tipo, titulo, pauta, data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada } = req.body;
    if (!tipo || !titulo) return res.status(400).json({ error: "Tipo e título são obrigatórios" });

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

    res.status(201).json(nova);
  } catch (err) {
    log.error("AssembleiaCriarErro", err);
    res.status(500).json({ error: "Erro ao criar assembleia" });
  }
}

async function abrir(req, res) {
  try {
    const atualizada = await service.abrir(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "ABERTA" });

    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaAbrirErro", err);
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
}

async function iniciarExecucao(req, res) {
  try {
    const atualizada = await service.iniciarExecucao(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "EM_CURSO" });

    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaIniciarExecucaoErro", err);
    const isTransitionError = err.message.includes(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    const status = isTransitionError ? 409 : 422;
    res.status(status).json({ error: err.message });
  }
}

async function encerrar(req, res) {
  try {
    const atualizada = await service.encerrar(req.params.id, req.user.id);
    socket.emitEvent(req.params.id, "assembleia:status_changed", { estado: "ENCERRADA" });
    socket.emitEvent(req.params.id, "assembleia:encerrada", {});

    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaEncerrarErro", err);
    res.status(500).json({ error: err.message });
  }
}

async function gerarTokenQuorum(req, res) {
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

    res.json({ token, quorum_id: quorum.id });
  } catch (err) {
    log.error("AssembleiaGerarTokenQuorumErro", err);
    res.status(500).json({ error: "Erro ao gerar token de quórum" });
  }
}

async function checkin(req, res) {
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) return res.status(400).json({ error: "Token é obrigatório" });

    const quorum = await service.buscarQuorumPorToken(id, token);
    if (!quorum) return res.status(400).json({ error: Textos.ASSEMBLEIA.TOKEN_INVALIDO });

    await service.realizarCheckin({
      assembleia_quorum_id: quorum.id,
      filiado_id: req.user.id,
      origem: 'TOKEN',
      assembleia_id: id
    });

    // Broadcast do total atualizado
    const estado = await service.buscarEstadoCompleto(id);
    socket.emitEvent(id, "assembleia:checkin_updated", { total: estado.quorumVigente?.total || 0 });

    res.json({ success: true, message: "Check-in realizado com sucesso" });
  } catch (err) {
    log.error("AssembleiaCheckinErro", err);
    res.status(500).json({ error: "Erro ao realizar check-in" });
  }
}

async function definirMesa(req, res) {
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

    res.json(mesa);
  } catch (err) {
    log.error("AssembleiaDefinirMesaErro", err);
    res.status(500).json({ error: "Erro ao definir mesa" });
  }
}

async function iniciarVotacao(req, res) {
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

    res.status(201).json(votacao);
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoErro", err);
    res.status(500).json({ error: "Erro ao iniciar votação" });
  }
}

async function votar(req, res) {
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
    if (!elegivel) return res.status(403).json({ error: Textos.ASSEMBLEIA.NAO_ELEGIVEL });

    await service.registrarVoto(vid, req.user.id, voto, id);

    const [contagem, votos] = await Promise.all([
      service.contarVotos(vid),
      service.listarVotosNominais(vid)
    ]);

    socket.emitEvent(id, "voto:updated", { contagem, votos });

    res.json({ success: true });
  } catch (err) {
    log.error("AssembleiaVotarErro", err);
    res.status(500).json({ error: "Erro ao registrar voto" });
  }
}

async function encerrarVotacao(req, res) {
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

    res.json(finalizada);
  } catch (err) {
    log.error("AssembleiaEncerrarVotacaoErro", err);
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
  try {
    const { id } = req.params;

    // Stub: Apenas registra o pedido e loga
    await service.registrarAuditoria(id, req.user.id, "RELATORIO_SOLICITADO", { solicitado_por: req.user.nome });

    const request_id = Math.random().toString(36).substring(7).toUpperCase();
    const auth_code = Math.random().toString(36).substring(7).toUpperCase();

    res.json({
      success: true,
      message: "Pedido de relatório registrado. O documento será enviado por e-mail em breve (Stub).",
      request_id,
      auth_code
    });
  } catch (err) {
    log.error("AssembleiaGerarRelatorioErro", err);
    res.status(500).json({ error: "Erro ao solicitar relatório" });
  }
}

async function uploadEdital(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const result = await uploadFileBuffer(req.file.buffer, {
      folder: "sinprfes/editais",
      public_id: `edital_${Date.now()}`,
      resource_type: "auto",
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
  encerrar,
  gerarTokenQuorum,
  checkin,
  definirMesa,
  iniciarVotacao,
  votar,
  encerrarVotacao,
  pedirPalavra,
  criarProposta,
  gerarRelatorio,
  uploadEdital
};
