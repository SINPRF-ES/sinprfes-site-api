// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
const socket = require("../websocket/assembleia.socket");
const { uploadFileBuffer } = require("../services/cloudinary.service");
const log = require("../utils/log");

async function listar(req, res) {
  try {
    const assembleias = await service.listar(req.user.perfil_acesso);
    res.json(assembleias);
  } catch (err) {
    log.error("AssembleiaListarErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
        table: err.table,
        column: err.column,
        errors: err.errors
      }
    });
    res.status(500).json({ error: "Erro ao listar assembleias" });
  }
}

async function detalhe(req, res) {
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: "Assembleia não encontrada" });
    res.json(assembleia);
  } catch (err) {
    log.error("AssembleiaDetalheErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
      }
    });
    res.status(500).json({ error: "Erro ao buscar detalhe da assembleia" });
  }
}

async function estadoCompleto(req, res) {
  try {
     const estado = await service.buscarEstadoCompleto(req.params.id, req.user.id);
    if (!estado) return res.status(404).json({ error: "Assembleia não encontrada" });

     // Auditoria de entrada (apenas uma vez por sessão/filiado via app)
     await service.registrarAuditoria(req.params.id, req.user.id, "ENTRADA_SESSAO", { platform: 'mobile' });

    res.json(estado);
  } catch (err) {
    log.error("AssembleiaEstadoCompletoErro", err);
    res.status(500).json({ error: "Erro ao buscar estado da assembleia" });
  }
}

async function criar(req, res) {
  try {
    const { tipo, titulo, descricao, data_hora_inicio, edital_url } = req.body;
    if (!tipo || !titulo) return res.status(400).json({ error: "Tipo e título são obrigatórios" });

    const nova = await service.criar({
      tipo,
      titulo,
      descricao,
      data_hora_inicio,
      edital_url,
      criado_por: req.user.id
    });

    await service.registrarAuditoria(nova.id, req.user.id, "CRIACAO_ASSEMBLEIA", { tipo, titulo });

    res.status(201).json(nova);
  } catch (err) {
    log.error("AssembleiaCriarErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      payloadKeys: Object.keys(req.body || {}),
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
        table: err.table,
        column: err.column,
        errors: err.errors
      }
    });
    res.status(500).json({ error: "Erro ao criar assembleia" });
  }
}

async function abrir(req, res) {
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: "Assembleia não encontrada" });
    if (assembleia.estado !== "CRIADA") return res.status(400).json({ error: "Estado inválido para abertura" });

    const atualizada = await service.abrir(req.params.id);
    await service.registrarAuditoria(req.params.id, req.user.id, "ABERTURA_ASSEMBLEIA", {});
    socket.emitEvent(req.params.id, "session_state_changed", { estado: "ABERTA" });

    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaAbrirErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
      }
    });
    res.status(500).json({ error: "Erro ao abrir assembleia" });
  }
}

async function encerrar(req, res) {
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: "Assembleia não encontrada" });
    if (assembleia.estado !== "ABERTA") return res.status(400).json({ error: "Apenas assembleias abertas podem ser encerradas" });

    const atualizada = await service.encerrar(req.params.id);
    await service.registrarAuditoria(req.params.id, req.user.id, "ENCERRAMENTO_ASSEMBLEIA", {});
    socket.emitEvent(req.params.id, "session_state_changed", { estado: "ENCERRADA" });

    res.json(atualizada);
  } catch (err) {
    log.error("AssembleiaEncerrarErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
      }
    });
    res.status(500).json({ error: "Erro ao encerrar assembleia" });
  }
}

async function gerarTokenQuorum(req, res) {
  try {
    const { id } = req.params;
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const quorum = await service.gerarQuorum(id, token);
    await service.registrarAuditoria(id, req.user.id, "GERAR_TOKEN_QUORUM", { token });
    socket.emitEvent(id, "new_quorum_call", { id: quorum.id, valido_ate: quorum.valido_ate });

    res.json({ token, valido_ate: quorum.valido_ate });
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
    if (!quorum) return res.status(400).json({ error: "Token inválido ou expirado" });

    await service.realizarCheckin(quorum.id, req.user.id);
    await service.registrarAuditoria(id, req.user.id, "CHECKIN_ASSEMBLEIA", { quorum_id: quorum.id });

    // Busca total atualizado de presentes
    const estado = await service.buscarEstadoCompleto(id);
    socket.emitEvent(id, "quorum_count_updated", { total: estado.quorumVigente?.total || 0 });

    res.json({ success: true, message: "Check-in realizado com sucesso" });
  } catch (err) {
    log.error("AssembleiaCheckinErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      payloadKeys: Object.keys(req.body || {}),
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
      }
    });
    res.status(500).json({ error: "Erro ao realizar check-in" });
  }
}

async function iniciarVotacao(req, res) {
  try {
    const { id } = req.params;
    const { titulo, descricao, duracao_minutos, proposta_id } = req.body;

    const quorum = await service.buscarUltimoQuorum(id);
    if (!quorum) return res.status(400).json({ error: "Não há quórum ativo para iniciar votação" });

    // P1: Regra de retirada de proposta por ausência do autor
    if (proposta_id) {
       const propostas = await service.listarPropostas(id);
       const proposta = propostas.find(p => p.id === proposta_id);
       if (proposta) {
          const elegivel = await service.verificarElegibilidadePorQuorum(quorum.id, proposta.autor_id);
          if (!elegivel) {
             // Retira automaticamente
             await service.atualizarEstadoProposta(proposta_id, 'RETIRADA', 'Proposta retirada por ausência do autor');
             await service.registrarAuditoria(id, req.user.id, "PROPOSTA_RETIRADA_AUSENCIA_AUTOR", { proposta_id });

             const propostas = await service.listarPropostas(id);
             socket.emitEvent(id, "proposal_updated", propostas.find(p => p.id === proposta_id));

             return res.status(400).json({ error: "Proposta retirada por ausência do autor no quórum vigente" });
          }
       }
    }

    const votacao = await service.criarVotacao({
      assembleia_id: id,
      quorum_snapshot_id: quorum.id,
      titulo,
      descricao,
      duracao_minutos: duracao_minutos || 1
    });

    await service.registrarAuditoria(id, req.user.id, "INICIO_VOTACAO", { votacao_id: votacao.id, titulo });

    // Broadcast nominal (inicialmente vazio)
    socket.emitEvent(id, "voting_started", { ...votacao, contagem: { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 }, votos: [] });

    res.status(201).json(votacao);
  } catch (err) {
    log.error("AssembleiaIniciarVotacaoErro", {
      userId: req.user?.id,
      perfil_acesso: req.user?.perfil_acesso,
      route: req.originalUrl,
      method: req.method,
      payloadKeys: Object.keys(req.body || {}),
      errorMessage: err.message,
      stack: err.stack,
      dbError: {
        name: err.name,
        code: err.code || err.parent?.code,
        detail: err.detail || err.parent?.detail,
      }
    });
    res.status(500).json({ error: "Erro ao iniciar votação" });
  }
}

async function votar(req, res) {
  try {
    const { id, vid } = req.params;
    const { voto } = req.body;

     // Valida estado da votação e tempo
     const votacao = await service.buscarVotacaoAtiva(id);
     if (!votacao || votacao.id !== vid) {
        return res.status(400).json({ error: "Votação não está ativa ou já foi encerrada" });
     }

     if (new Date(votacao.encerra_em) < new Date()) {
        return res.status(400).json({ error: "O tempo para votação expirou" });
     }

    const elegivel = await service.verificarElegibilidade(vid, req.user.id);
    if (!elegivel) return res.status(403).json({ error: "Você não possui check-in no quórum deste item e não pode votar" });

    await service.registrarVoto(vid, req.user.id, voto);

    const [contagem, votos] = await Promise.all([
      service.contarVotos(vid),
      service.listarVotosNominais(vid)
    ]);

    // P1: Broadcast nominal em tempo real
    socket.emitEvent(id, "vote_cast", { contagem, votos });

    res.json({ success: true });
  } catch (err) {
    log.error("AssembleiaVotarErro", err);
    res.status(500).json({ error: "Erro ao registrar voto" });
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
    const { titulo, descricao } = req.body;

    const proposta = await service.criarProposta({
      assembleia_id: id,
      autor_id: req.user.id,
      titulo,
      descricao
    });

    socket.emitEvent(id, "new_proposal", { ...proposta, autor_nome: req.user.nome });
    res.status(201).json(proposta);
  } catch (err) {
    log.error("AssembleiaCriarPropostaErro", err);
    res.status(500).json({ error: "Erro ao criar proposta" });
  }
}

async function definirMesa(req, res) {
  try {
    const { id } = req.params;
    const { filiado_id, cargo } = req.body;

    await service.definirMesa(id, filiado_id, cargo);
    const mesa = await service.buscarMesa(id);
    socket.emitEvent(id, "mesa_updated", mesa);

    res.json({ success: true });
  } catch (err) {
    log.error("AssembleiaDefinirMesaErro", err);
    res.status(500).json({ error: "Erro ao definir mesa" });
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
    console.error("Erro no upload do edital:", err);
    res.status(500).json({ error: "Erro ao realizar upload do edital" });
  }
}

module.exports = {
  listar,
  detalhe,
  estadoCompleto,
  criar,
  abrir,
  encerrar,
  gerarTokenQuorum,
  checkin,
  iniciarVotacao,
  votar,
  pedirPalavra,
  criarProposta,
  definirMesa,
  uploadEdital
};
