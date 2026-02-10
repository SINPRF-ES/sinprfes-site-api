// src/routes/assembleias.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/assembleias.controller");
const { assemblyCommandLimiter, checkinLimiter, stateLimiter, diagnosticLimiter } = require("../middlewares/assembleiaRateLimit");

// Verificação defensiva de boot: garante que todos os handlers existem no controller
const required = [
  "listar","detalhe","estadoCompleto","estadoMini","proxyEdital",
  "criar","uploadEdital","abrir","iniciarExecucao","encerrarAssembleia",
  "gerarTokenQuorum","atualizarQuorum","checkin","definirMesa","substituirMesa",
  "iniciarVotacao","votar","encerrarVotacao",
  "pedirPalavra","concederPalavra","criarProposta","iniciarVotacaoProposta",
  "gerarRelatorio","diagnostico","limparLogsAuditoria"
];
const missing = required.filter(k => typeof controller?.[k] !== "function");
if (missing.length) {
  throw new Error(`assembleias.controller missing handlers: ${missing.join(", ")}`);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Todos autenticados podem listar e ver detalhes
router.get("/", auth, controller.listar);
router.get("/:id", auth, controller.detalhe);
router.get("/:id/estado", auth, stateLimiter, controller.estadoCompleto);
router.get("/:id/estado/mini", auth, stateLimiter, controller.estadoMini);
router.get("/:id/edital", auth, controller.proxyEdital);

// Gestão podem criar, abrir, iniciar execução e encerrar
router.post("/", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.criar);
router.post("/upload-edital", auth, requirePermission("VOTACAO_GERENCIAR"), upload.single("edital"), controller.uploadEdital);
router.post("/:id/abrir", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.abrir);
router.post("/:id/iniciar-execucao", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.iniciarExecucao);
router.post("/:id/suspender", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.suspender);
router.post("/:id/retomar", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.retomar);
router.post("/:id/encerrar", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.encerrarAssembleia);

// Presença e Quórum
router.post("/:id/token", auth, assemblyCommandLimiter, controller.gerarTokenQuorum);
router.post("/:id/quorum/atualizar", auth, assemblyCommandLimiter, controller.atualizarQuorum);
router.post("/:id/checkin", auth, checkinLimiter, controller.checkin);

// Mesa
router.post("/:id/mesa", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.definirMesa);
router.post("/:id/mesa/substituir", auth, requirePermission("VOTACAO_GERENCIAR"), assemblyCommandLimiter, controller.substituirMesa);

// Votações (Itens)
router.post("/:id/votacoes", auth, assemblyCommandLimiter, controller.iniciarVotacao);
router.post("/:id/votacoes/:vid/voto", auth, assemblyCommandLimiter, controller.votar);
router.post("/:id/votacoes/:vid/encerrar", auth, assemblyCommandLimiter, controller.encerrarVotacao);

// Interação
router.post("/:id/pedir-palavra", auth, controller.pedirPalavra);
router.post("/:id/pedidos/:pid/conceder", auth, assemblyCommandLimiter, controller.concederPalavra);
router.post("/:id/propostas", auth, controller.criarProposta);
router.post("/:id/propostas/:prid/votar", auth, assemblyCommandLimiter, controller.iniciarVotacaoProposta);

// Relatório (Governança interna no controller: todos exceto COMUNICADOR podem gerar se encerrada)
router.post("/:id/relatorio", auth, controller.gerarRelatorio);

// Diagnóstico (Admin e Diretoria)
router.get("/:id/diagnostico", auth, (req, res, next) => {
    if (req.user.perfil_acesso === 'ADMIN' || req.user.perfil_acesso === 'DIRETORIA') return next();
    res.status(403).json({ error: "Acesso restrito a administradores ou diretoria" });
}, controller.diagnostico);

router.post("/:id/diagnostico/limpar-logs", auth, (req, res, next) => {
    if (req.user.perfil_acesso === 'ADMIN' || req.user.perfil_acesso === 'DIRETORIA') return next();
    res.status(403).json({ error: "Acesso restrito a administradores ou diretoria" });
}, diagnosticLimiter, controller.limparLogsAuditoria);

module.exports = router;
