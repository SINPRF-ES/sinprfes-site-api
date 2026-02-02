// src/controllers/reports.controller.js
const reportsService = require("../services/reports.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const filiadosService = require("../services/filiados.service");
const log = require("../utils/log");
const { formatarCPF } = require("../utils/format");
const { slugify } = require("../../shared/canon");

/**
 * Gera um slug amigável para nome de arquivo.
 */
function gerarSlugNome(nome) {
  if (!nome) return "";
  return slugify(nome)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 60);
}

/**
 * Busca o melhor e-mail disponível para o solicitante.
 */
async function getRequesterData(user) {
  // 1. Tenta do e-mail na sessão (JWT)
  if (user.email1 || user.email) {
    return {
        nome: user.nome,
        email: user.email1 || user.email
    };
  }

  // 2. Busca no banco de dados pelo ID
  try {
    const filiado = await filiadosService.buscarPorId(user.id);
    if (filiado) {
      return {
          nome: filiado.nome,
          email: filiado.email1 || filiado.email2 || null
      };
    }
  } catch (err) {
    log.error("ErroAoBuscarEmailSolicitante", { userId: user.id, error: err.message });
  }

  return { nome: user.nome, email: null };
}

/**
 * POST /api/reports/generate
 */
exports.generateReport = async (req, res) => {
  const { type, params } = req.body;
  const requesterSession = req.user;

  // Validação do contrato da API
  if (!type || typeof params !== 'object' || params === null) {
    return res.status(400).json({ success: false, message: "Tipo e parâmetros são obrigatórios." });
  }

  try {
    let pdfBuffer;
    let filename;
    let reportTitle;

    // Garante dados completos do solicitante (nome e e-mail)
    const requester = await getRequesterData(requesterSession);

    if (type === "INDIVIDUAL") {
      // Contrato: INDIVIDUAL => { filiadoId }
      const { filiadoId } = params;
      if (!filiadoId) return res.status(400).json({ success: false, message: "ID do filiado é obrigatório para relatório individual." });

      const dados = await reportsService.buscarDadosDossie(filiadoId);
      if (!dados) return res.status(404).json({ success: false, message: "Filiado não encontrado." });

      // Resolver nome para exibição no histórico (A1)
      params.filiadoNome = dados.nome;

      reportTitle = `Dossiê do Filiado - ${dados.nome}`;

      const slug = gerarSlugNome(dados.nome);
      filename = slug ? `dossie_${slug}.pdf` : `dossie_filiado_${dados.id}.pdf`;

      // Regra de permissão para CPF no PDF
      const podeVerCpf = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requesterSession.perfil_acesso || "").toUpperCase());
      pdfBuffer = await pdfService.gerarPdfDossieFiliado(dados, { podeVerCpf });

    } else if (["LOTACAO", "SITUACAO"].includes(type)) {
      // Contrato: LOTACAO/SITUACAO => { value }
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório para este tipo de relatório." });

      const dados = await reportsService.buscarDadosAgregados(type, value);

      const titulos = {
        LOTACAO: `Relatório por Lotação: ${value}`,
        SITUACAO: `Relatório por Situação Funcional: ${value}`
      };

      reportTitle = titulos[type];
      filename = `relatorio_${type.toLowerCase()}_${value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdfBuffer = await pdfService.gerarPdfRelatorioAgregado(dados, reportTitle);

    } else if (type === "GLOBAL") {
      // Contrato: GLOBAL => {}
      const dados = await reportsService.buscarDadosGlobal();
      reportTitle = "Relatório Global (Completo)";
      filename = `relatorio_global_${new Date().toISOString().split('T')[0]}.pdf`;
      pdfBuffer = await pdfService.gerarPdfRelatorioGlobal(dados);

    } else {
      return res.status(400).json({ message: "Tipo de relatório inválido." });
    }

    // Registrar Job/Auditoria
    await reportsService.registrarJob(type, params, requesterSession);

    // Enviar por E-mail (passando objeto com nome e email correto)
    await emailService.enviarEmailRelatorio(requester, reportTitle, pdfBuffer, filename);

    log.info("RelatorioGerado", { type, requesterId: requesterSession.id, requestId: req.requestId });

    return res.json({
      success: true,
      message: `O relatório "${reportTitle}" foi gerado e enviado para seu e-mail (${requester.email || "não cadastrado"}).`
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
