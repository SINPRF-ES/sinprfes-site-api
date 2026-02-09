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
  if (user.email || user.email1) {
    return {
        nome: user.nome,
        email: user.email || user.email1
    };
  }

  // 2. Busca no banco de dados pelo ID
  try {
    const dbUser = await usersService.buscarPorId(user.id);
    if (dbUser) {
      return {
          nome: dbUser.nome,
          email: dbUser.email || dbUser.email1 || dbUser.email2 || null
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
      if (!userId) return res.status(400).json({ success: false, message: "ID do user é obrigatório para relatório individual." });

      const dados = await reportsService.buscarDadosDossie(userId);
      if (!dados) return res.status(404).json({ success: false, message: "User não encontrado." });

      // Resolver nome para exibição no histórico (A1)
      params.userNome = dados.nome;
      params.paramDisplay = dados.nome; // Campo redundante para robustez

      reportTitle = `Dossiê do User - ${dados.nome}`;

      const slug = gerarSlugNome(dados.nome);
      filename = slug ? `dossie_${slug}.pdf` : `dossie_user_${dados.id}.pdf`;

      // Regra de permissão para CPF no PDF
      const podeVerCpf = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requesterSession.perfil_acesso || "").toUpperCase());
      pdfBuffer = await pdfService.gerarPdfDossieUser(dados, { podeVerCpf });

    } else if (["UF", "SITUACAO"].includes(type)) {
      // Contrato: UF/SITUACAO => { value }
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório para este tipo de relatório." });

      const dados = await reportsService.buscarDadosAgregados(type, value);

      const titulos = {
        UF: `Relatório por UF: ${value}`,
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
      if (!userId) return res.status(400).json({ success: false, message: "ID do user é obrigatório." });
      data = await reportsService.buscarDadosDossie(userId);
      if (!data) return res.status(404).json({ success: false, message: "User não encontrado." });
    } else if (["UF", "SITUACAO"].includes(type)) {
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório." });
      data = await reportsService.buscarDadosAgregados(type, value);
    } else if (type === "GLOBAL") {
      data = await reportsService.buscarDadosGlobal();
      if (data.ativo && data.ativo.repasse && data.ativo.repasse.competencia) {
        baseCompetencia = `${String(data.ativo.repasse.competencia.month).padStart(2, '0')}/${data.ativo.repasse.competencia.year}`;
      }
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
          { label: "CPF", value: data.cpf ? (["ADMIN", "DIRETORIA", "COLABORADOR"].includes((requesterSession.perfil_acesso || "").toUpperCase()) ? formatarCPF(data.cpf) : formatarCPF(data.cpf).replace(/\d/g, (match, offset) => (offset > 3 && offset < 11 ? "*" : match))) : "-" },
          { label: "Sexo", value: data.sexo === 'M' ? '♂️ Masculino' : (data.sexo === 'F' ? '♀️ Feminino' : '-') },
          { label: "UF", value: data.uf || "-" },
          { label: "Situação", value: data.situacao || "-" }
        ]
      });
      if (data.email || data.email1 || data.telefone1) {
        sections.push({
          kind: "kv",
          title: "Contato",
          items: [
            { label: "E-mail Principal", value: data.email || data.email1 || "-" },
            { label: "Telefone Principal", value: data.telefone1 || "-" }
          ]
        });
      }
    } else if (type === "UF") {
      sections.push({
        kind: "kv",
        title: "Resumo da Unidade (UF)",
        items: [
          { label: "Total de Users", value: data.total },
          { label: "Homens", value: `${data.masc} (${((data.masc / data.total) * 100).toFixed(1)}%)` },
          { label: "Mulheres", value: `${data.fem} (${((data.fem / data.total) * 100).toFixed(1)}%)` }
        ]
      });

      sections.push({
        kind: "table",
        title: "Distribuição por Idade",
        columns: ["Faixa Etária", "Quantidade"],
        rows: [
          ["20-29 anos", data.range_20_29],
          ["30-39 anos", data.range_30_39],
          ["40-49 anos", data.range_40_49],
          ["50-59 anos", data.range_50_59],
          ["60+ anos", data.range_60_plus],
          ["Não informada", data.idade_desconhecida]
        ]
      });
    } else if (type === "SITUACAO") {
      sections.push({
        kind: "kv",
        title: `Resumo: ${params.value}`,
        items: [
          { label: "Total", value: data.total },
          { label: "Masculino", value: data.masc },
          { label: "Feminino", value: data.fem }
        ]
      });
    } else if (type === "GLOBAL") {
      sections.push({
        kind: "kv",
        title: "Resumo Geral",
        items: [
          { label: "Ativos", value: data.ativo.total },
          { label: "Veteranos", value: data.veterano.total },
          { label: "Pensionistas", value: data.pensionista.total },
          { label: "Total Geral", value: data.ativo.total + data.veterano.total + data.pensionista.total }
        ]
      });

      sections.push({
        kind: "table",
        title: "Distribuição por Sexo",
        columns: ["Categoria", "Masculino", "Feminino"],
        rows: [
          ["Ativos", data.ativo.masc, data.ativo.fem],
          ["Veteranos", data.veterano.masc, data.veterano.fem],
          ["Pensionistas", data.pensionista.masc, data.pensionista.fem]
        ]
      });
    }

    return res.json({
      success: true,
      type,
      generatedAt: new Date().toISOString(),
      baseCompetencia,
      summary: type === "INDIVIDUAL" ? { nome: data.nome, cpf: data.cpf, situacao: data.situacao } : { total: data.total || (data.ativo ? data.ativo.total + data.veterano.total + data.pensionista.total : 0) },
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
