// src/controllers/reports.controller.js
const reportsService = require("../services/reports.service");
const pdfService = require("../services/pdf.service");
const emailService = require("../services/email.service");
const usersService = require("../services/users.service");
const log = require("../utils/log");
const { formatarCPF, parseUuid } = require("../utils/format");
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
  const atorId = req.user?.id;
  const requestId = req.requestId;
  const { type, params } = req.body;
  const requesterSession = req.user;

  try {
    if (!atorId) return res.status(401).json({ success: false, message: "Sessão inválida ou ator não identificado.", requestId });

    // Validação do contrato da API
    if (!type || typeof params !== 'object' || params === null) {
      return res.status(400).json({ success: false, message: "Tipo e parâmetros são obrigatórios.", requestId });
    }

    let pdfBuffer;
    let filename;
    let reportTitle;

    // Garante dados completos do solicitante (nome e e-mail)
    const requester = await getRequesterData(requesterSession);

    if (type === "INDIVIDUAL") {
      // Contrato: INDIVIDUAL => { userId }
      const userId = parseUuid(params?.userId);
      if (!userId) return res.status(400).json({ success: false, message: "ID do user é obrigatório (UUID esperado) para relatório individual.", requestId });

      const dados = await reportsService.buscarDadosDossie(userId);
      if (!dados) return res.status(404).json({ success: false, message: "User não encontrado.", requestId });

      // Resolver nome para exibição no histórico (A1)
      params.userNome = dados.nome;
      params.paramDisplay = dados.nome; // Campo redundante para robustez

      reportTitle = `Dossiê do User - ${dados.nome}`;

      const slug = gerarSlugNome(dados.nome);
      filename = slug ? `dossie_${slug}.pdf` : `dossie_user_${dados.id}.pdf`;

      // Regra de permissão para CPF no PDF (FENAPRF Canon)
      const podeVerCpf = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes((requesterSession.perfil_acesso || "").toUpperCase());
      pdfBuffer = await pdfService.gerarPdfDossieUser(dados, { podeVerCpf });

    } else if (["UF", "SITUACAO"].includes(type)) {
      // Contrato: UF/SITUACAO => { value }
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório para este tipo de relatório.", requestId });

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
      return res.status(400).json({ success: false, message: "Tipo de relatório inválido.", requestId });
    }

    // Registrar Job/Auditoria
    await reportsService.registrarJob(type, params, requesterSession);

    // Enviar por E-mail (passando objeto com nome e email correto)
    await emailService.enviarEmailRelatorio(requester, reportTitle, pdfBuffer, filename);

    log.info("RelatorioGerado", { type, userId: atorId, requestId });

    return res.json({
      success: true,
      message: `O relatório "${reportTitle}" foi gerado e enviado para seu e-mail (${requester.email || "não cadastrado"}).`,
      requestId
    });

  } catch (err) {
    log.error("ErroGerarRelatorio", { error: err.message, stack: err.stack, requestId, userId: atorId });
    return res.status(500).json({ success: false, message: "Erro ao gerar relatório. Tente novamente mais tarde.", requestId });
  }
};

/**
 * POST /api/reports/preview
 */
exports.previewReport = async (req, res) => {
  const atorId = req.user?.id;
  const requestId = req.requestId;
  const { type, params } = req.body;
  const requesterSession = req.user;

  try {
    if (!atorId) return res.status(401).json({ success: false, message: "Sessão inválida ou ator não identificado.", requestId });

    if (!type || typeof params !== 'object' || params === null) {
      return res.status(400).json({ success: false, message: "Tipo e parâmetros são obrigatórios.", requestId });
    }

    let data;
    let baseCompetencia = null;

    if (type === "INDIVIDUAL") {
      const userId = parseUuid(params?.userId);
      if (!userId) return res.status(400).json({ success: false, message: "ID do user é obrigatório (UUID esperado)." });
      data = await reportsService.buscarDadosDossie(userId);
      if (!data) return res.status(404).json({ success: false, message: "User não encontrado." });
    } else if (["UF", "SITUACAO"].includes(type)) {
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório." });
      data = await reportsService.buscarDadosAgregados(type, value);
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
          { label: "Total Geral de Membros", value: data.membros.total },
          { label: "Masculino", value: data.membros.masc },
          { label: "Feminino", value: data.membros.fem }
        ]
      });

      if (data.porSituacao && data.porSituacao.length > 0) {
        sections.push({
          kind: "table",
          title: "Distribuição por Situação Funcional",
          columns: ["Situação", "Total", "Masc.", "Fem."],
          rows: data.porSituacao.map(s => [
            s.situacao || "Não informada",
            s.total,
            s.masc,
            s.fem
          ])
        });
      }
    }

    log.info("RelatorioPreviewSucesso", { type, userId: atorId, requestId });

    return res.json({
      success: true,
      type,
      generatedAt: new Date().toISOString(),
      baseCompetencia,
      summary: type === "INDIVIDUAL" ? { nome: data.nome, cpf: data.cpf, situacao: data.situacao } : { total: data.total || (data.membros ? data.membros.total : 0) },
      sections,
      requestId
    });

  } catch (err) {
    log.error("ErroPreviewRelatorio", { error: err.message, stack: err.stack, requestId, userId: atorId });
    return res.status(500).json({ success: false, message: "Erro ao gerar preview. Tente novamente mais tarde.", requestId });
  }
};

/**
 * GET /api/reports/history
 */
exports.getHistory = async (req, res) => {
  const atorId = req.user?.id;
  const requestId = req.requestId;
  try {
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado.", requestId });

    log.info("RelatorioListarHistoricoIniciado", { userId: atorId, requestId });

    const requesterId = atorId;
    const perfil = (req.user.perfil_acesso || "").toUpperCase();

    // ADMIN vê tudo, outros vêem apenas o próprio histórico por padrão (ajustável conforme UX)
    const history = await reportsService.listarHistorico(perfil === "ADMIN" ? null : requesterId);

    // FENAPRF: Nomes já resolvidos via SQL JOIN no service. Mantemos compatibilidade de contrato.
    for (const item of history) {
      if (item.report_type === 'INDIVIDUAL') {
        const p = typeof item.params === 'string' ? JSON.parse(item.params) : item.params;
        if (!p.userNome && item.target_user_name) {
          p.userNome = item.target_user_name;
          item.params = p;
        }
      }
    }

    log.info("RelatorioListarHistoricoSucesso", { userId: atorId, requestId, count: history.length });
    return res.json(history);
  } catch (err) {
    log.error("ErroListarHistoricoRelatorios", { error: err.message, stack: err.stack, requestId, userId: atorId });
    return res.status(500).json({ message: "Erro ao carregar histórico.", requestId });
  }
};
