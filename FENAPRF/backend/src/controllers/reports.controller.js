// src/controllers/reports.controller.js
const reportsService = require("../services/reports.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const usersService = require("../services/users.service");
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
    const user = await usersService.buscarPorId(user.id);
    if (user) {
      return {
          nome: user.nome,
          email: user.email1 || user.email2 || null
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
      // Contrato: INDIVIDUAL => { userId }
      const { userId } = params;
      if (!userId) return res.status(400).json({ success: false, message: "ID do membro é obrigatório para relatório individual." });

      const dados = await reportsService.buscarDadosDossie(userId);
      if (!dados) return res.status(404).json({ success: false, message: "Membro não encontrado." });

      // Resolver nome para exibição no histórico (A1)
      params.userNome = dados.nome;
      params.paramDisplay = dados.nome; // Campo redundante para robustez

      reportTitle = `Dossiê do Membro - ${dados.nome}`;

      const slug = gerarSlugNome(dados.nome);
      filename = slug ? `dossie_${slug}.pdf` : `dossie_membro_${dados.id}.pdf`;

      // Regra de permissão para CPF no PDF
      const podeVerCpf = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requesterSession.perfil_acesso || "").toUpperCase());
      pdfBuffer = await pdfService.gerarPdfDossieUser(dados, { podeVerCpf });

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
 * POST /api/reports/preview
 */
exports.previewReport = async (req, res) => {
  const { type, params } = req.body;
  const requesterSession = req.user;

  if (!type || typeof params !== 'object' || params === null) {
    return res.status(400).json({ success: false, message: "Tipo e parâmetros são obrigatórios." });
  }

  try {
    let data;
    let baseCompetencia = null;

    if (type === "INDIVIDUAL") {
      const { userId } = params;
      if (!userId) return res.status(400).json({ success: false, message: "ID do membro é obrigatório." });
      data = await reportsService.buscarDadosDossie(userId);
      if (!data) return res.status(404).json({ success: false, message: "Membro não encontrado." });
    } else if (type === "GLOBAL") {
      data = await reportsService.buscarDadosGlobal();
    } else {
      return res.status(400).json({ success: false, message: "Tipo de relatório inválido." });
    }

    const sections = [];

    if (type === "INDIVIDUAL") {
      sections.push({
        kind: "kv",
        title: "Dados Pessoais",
        items: [
          { label: "Nome", value: data.nome },
          { label: "CPF", value: data.cpf ? (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requesterSession.perfil_acesso || "").toUpperCase()) ? formatarCPF(data.cpf) : formatarCPF(data.cpf).replace(/\d/g, (match, offset) => (offset > 3 && offset < 11 ? "*" : match))) : "-" },
          { label: "Sexo", value: data.sexo === 'M' ? '♂️ Masculino' : (data.sexo === 'F' ? '♀️ Feminino' : '-') }
        ]
      });
      if (data.email1 || data.telefone1) {
        sections.push({
          kind: "kv",
          title: "Contato",
          items: [
            { label: "E-mail Principal", value: data.email1 || "-" },
            { label: "Telefone Principal", value: data.telefone1 || "-" }
          ]
        });
      }
    } else if (type === "GLOBAL") {
      sections.push({
        kind: "kv",
        title: "Resumo Geral",
        items: [
          { label: "Total Geral", value: (data.global && data.global.total) || 0 }
        ]
      });
    }

    return res.json({
      success: true,
      type,
      generatedAt: new Date().toISOString(),
      baseCompetencia,
      summary: type === "INDIVIDUAL" ? { nome: data.nome, cpf: data.cpf } : { total: (data.global && data.global.total) || 0 },
      sections
    });

  } catch (err) {
    log.error("ErroPreviewRelatorio", { error: err.message, stack: err.stack, requestId: req.requestId });
    return res.status(500).json({ success: false, message: "Erro ao gerar preview. Tente novamente mais tarde." });
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

    // Resolver nomes para relatórios individuais (A1 - Retrocompatibilidade e Robustez)
    for (const item of history) {
      if (item.report_type === 'INDIVIDUAL') {
        const p = typeof item.params === 'string' ? JSON.parse(item.params) : item.params;
        if (!p.userNome && p.userId) {
          try {
            const user = await usersService.buscarPorId(p.userId);
            if (user) {
              p.userNome = user.nome;
              item.params = p; // Atualiza o objeto para a resposta
            }
          } catch (e) {
            log.error("ErroAoResolverNomeNoHistorico", { id: p.userId });
          }
        }
      }
    }

    return res.json(history);
  } catch (err) {
    log.error("ErroListarHistoricoRelatorios", { error: err.message, requestId: req.requestId });
    return res.status(500).json({ message: "Erro ao carregar histórico." });
  }
};
