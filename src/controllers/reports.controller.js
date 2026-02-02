// src/controllers/reports.controller.js
const reportsService = require("../services/reports.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const log = require("../utils/log");
const { formatarCPF } = require("../utils/format");

/**
 * POST /api/reports/generate
 */
exports.generateReport = async (req, res) => {
  const { type, params } = req.body;
  const requester = req.user;

  if (!type || !params) {
    return res.status(400).json({ success: false, message: "Tipo e parâmetros são obrigatórios." });
  }

  try {
    let pdfBuffer;
    let filename;
    let reportTitle;

    if (type === "INDIVIDUAL") {
      const { filiadoId } = params;
      if (!filiadoId) return res.status(400).json({ message: "ID do filiado é obrigatório." });

      const dados = await reportsService.buscarDadosDossie(filiadoId);
      if (!dados) return res.status(404).json({ message: "Filiado não encontrado." });

      reportTitle = `Dossiê do Filiado - ${dados.nome}`;
      filename = `dossie_${String(dados.cpf || filiadoId).slice(0, 11)}.pdf`;

      // Regra de permissão para CPF no PDF
      const podeVerCpf = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requester.perfil_acesso || "").toUpperCase());
      pdfBuffer = await pdfService.gerarPdfDossieFiliado(dados, { podeVerCpf });

    } else if (["LOTACAO", "SITUACAO"].includes(type)) {
      const { value } = params;
      if (!value) return res.status(400).json({ message: "Valor do filtro é obrigatório." });

      const dados = await reportsService.buscarDadosAgregados(type, value);

      const titulos = {
        LOTACAO: `Relatório por Lotação: ${value}`,
        SITUACAO: `Relatório por Situação Funcional: ${value}`
      };

      reportTitle = titulos[type];
      filename = `relatorio_${type.toLowerCase()}_${value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdfBuffer = await pdfService.gerarPdfRelatorioAgregado(dados, reportTitle);

    } else {
      return res.status(400).json({ message: "Tipo de relatório inválido." });
    }

    // Registrar Job/Auditoria
    await reportsService.registrarJob(type, params, requester);

    // Enviar por E-mail
    await emailService.enviarEmailRelatorio(requester, reportTitle, pdfBuffer, filename);

    log.info("RelatorioGerado", { type, requesterId: requester.id, requestId: req.requestId });

    return res.json({
      success: true,
      message: `O relatório "${reportTitle}" foi gerado e enviado para seu e-mail.`
    });

  } catch (err) {
    log.error("ErroGerarRelatorio", { error: err.message, stack: err.stack, requestId: req.requestId });
    return res.status(500).json({ success: false, message: "Erro ao gerar relatório. Tente novamente mais tarde." });
  }
};

/**
 * GET /api/reports/history
 */
exports.getHistory = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const perfil = (req.user.perfil_acesso || "").toUpperCase();

    // ADMIN vê tudo, outros vêem apenas o próprio histórico por padrão (ajustável conforme UX)
    const history = await reportsService.listarHistorico(perfil === "ADMIN" ? null : requesterId);

    return res.json(history);
  } catch (err) {
    log.error("ErroListarHistoricoRelatorios", { error: err.message, requestId: req.requestId });
    return res.status(500).json({ message: "Erro ao carregar histórico." });
  }
};
