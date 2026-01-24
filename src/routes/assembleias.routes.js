// src/routes/assembleias.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/assembleias.controller");
const { assemblyCommandLimiter, checkinLimiter, stateLimiter } = require("../middlewares/assembleiaRateLimit");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Todos autenticados podem listar e ver detalhes
router.get("/", auth, controller.listar);
router.get("/:id", auth, controller.detalhe);
router.get("/:id/estado", auth, stateLimiter, controller.estadoCompleto);

// Gestão podem criar, abrir, iniciar execução e encerrar
router.post("/", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.criar);
router.post("/upload-edital", auth, requirePermission("VOTACAO_GERENCIAR"), upload.single("edital"), controller.uploadEdital);
router.post("/:id/abrir", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.abrir);
router.post("/:id/iniciar-execucao", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.iniciarExecucao);
router.post("/:id/encerrar", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.encerrarAssembleia);

// Presença e Quórum
router.post("/:id/token", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.gerarTokenQuorum);
router.post("/:id/checkin", auth, checkinLimiter, controller.checkin);

// Mesa
router.post("/:id/mesa", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.definirMesa);

// Votações (Itens)
router.post("/:id/votacoes", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.iniciarVotacao);
router.post("/:id/votacoes/:vid/voto", auth, assemblyCommandLimiter, controller.votar);
router.post("/:id/votacoes/:vid/encerrar", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.encerrarVotacao);

// Interação
router.post("/:id/pedir-palavra", auth, controller.pedirPalavra);
router.post("/:id/propostas", auth, controller.criarProposta);

// Relatório
router.post("/:id/relatorio", auth, requirePermission("VOTACAO_GERENCIAR"), controller.gerarRelatorio);

// Diagnóstico (Admin)
router.get("/:id/diagnostico", auth, (req, res, next) => {
    if (req.user.perfil_acesso === 'ADMIN') return next();
    res.status(403).json({ error: "Acesso restrito a administradores" });
}, controller.diagnostico);

module.exports = router;
