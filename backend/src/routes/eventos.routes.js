// src/routes/eventos.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/eventos.controller");

// Ajuste fino das permissões:
// - Para “admin/diretoria” eu recomendo usar a permissão string que você já vem usando
//   nos outros pontos do módulo de eventos/votações: "EVENTOS_GERENCIAR".
const PERM_EVENTOS = "EVENTOS_GERENCIAR";

// Público (logado): próximo evento na home
router.get("/proximo", authMiddleware, controller.proximo);

// Público (logado): detalhe do evento
router.get("/:id", authMiddleware, controller.detalhe);

// Diretoria: criar evento (RASCUNHO ou AGENDADO)
router.post("/", authMiddleware, requirePermission(PERM_EVENTOS), controller.criar);

// Diretoria: agendar evento (RASCUNHO -> AGENDADO)
router.post("/:id/agendar", authMiddleware, requirePermission(PERM_EVENTOS), controller.agendar);

// Diretoria: abrir evento (AGENDADO -> ABERTO)
router.post("/:id/abrir", authMiddleware, requirePermission(PERM_EVENTOS), controller.abrir);

// Diretoria: encerrar evento (ABERTO -> ENCERRADO)
router.post("/:id/encerrar", authMiddleware, requirePermission(PERM_EVENTOS), controller.encerrar);

// Diretoria: cancelar evento (AGENDADO/ABERTO -> CANCELADO)
router.post("/:id/cancelar", authMiddleware, requirePermission(PERM_EVENTOS), controller.cancelar);

// Participante: entrar/sair (quórum)
router.post("/:id/entrar", authMiddleware, controller.entrar);
router.post("/:id/sair", authMiddleware, controller.sair);

// Diretoria: listar presenças (quórum)
router.get("/:id/presencas", authMiddleware, requirePermission(PERM_EVENTOS), controller.presencas);

// Diretoria: recontar quórum (derruba presenças ativas e incrementa versão)
router.post("/:id/recontar-quorum", authMiddleware, requirePermission(PERM_EVENTOS), controller.recontarQuorum);

module.exports = router;
