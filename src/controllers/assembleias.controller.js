// src/controllers/assembleias.controller.js
const service = require("../services/assembleias.service");
 const socket = require("../websocket/assembleia.socket");

async function listar(req, res) {
  try {
    const assembleias = await service.listar(req.user.perfil_acesso);
    res.json(assembleias);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar assembleias" });
  }
}

async function detalhe(req, res) {
  try {
    const assembleia = await service.buscarPorId(req.params.id);
    if (!assembleia) return res.status(404).json({ error: "Assembleia não encontrada" });
    res.json(assembleia);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar detalhe da assembleia" });
  }
}

async function criar(req, res) {
  try {
    const { tipo, titulo, descricao } = req.body;
    if (!tipo || !titulo) return res.status(400).json({ error: "Tipo e título são obrigatórios" });

    const nova = await service.criar({
      tipo,
      titulo,
      descricao,
      criado_por: req.user.id
    });

    await service.registrarAuditoria(nova.id, req.user.id, "CRIACAO_ASSEMBLEIA", { tipo, titulo });

    res.status(201).json(nova);
  } catch (err) {
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
    res.status(500).json({ error: "Erro ao encerrar assembleia" });
  }
}

 async function gerarTokenQuorum(req, res) {
   try {
     const { id } = req.params;
     // Gera token de 6 dígitos aleatórios
     const token = Math.floor(100000 + Math.random() * 900000).toString();

     const quorum = await service.gerarQuorum(id, token);
     await service.registrarAuditoria(id, req.user.id, "GERAR_TOKEN_QUORUM", { token });
     socket.emitEvent(id, "new_quorum_call", { valido_ate: quorum.valido_ate });

     res.json({ token, valido_ate: quorum.valido_ate });
   } catch (err) {
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
     socket.emitEvent(id, "checkin_completed", { filiado_id: req.user.id });

     res.json({ success: true, message: "Check-in realizado com sucesso" });
   } catch (err) {
     res.status(500).json({ error: "Erro ao realizar check-in" });
   }
 }

module.exports = {
  listar,
  detalhe,
  criar,
  abrir,
   encerrar,
   gerarTokenQuorum,
   checkin
};
