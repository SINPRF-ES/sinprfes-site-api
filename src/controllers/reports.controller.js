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
      params.paramDisplay = dados.nome; // Campo redundante para robustez

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
      const { filiadoId } = params;
      if (!filiadoId) return res.status(400).json({ success: false, message: "ID do filiado é obrigatório." });
      data = await reportsService.buscarDadosDossie(filiadoId);
      if (!data) return res.status(404).json({ success: false, message: "Filiado não encontrado." });
    } else if (["LOTACAO", "SITUACAO"].includes(type)) {
      const { value } = params;
      if (!value) return res.status(400).json({ success: false, message: "Valor do filtro é obrigatório." });
      data = await reportsService.buscarDadosAgregados(type, value);
      if (data.repasse && data.repasse.competencia) {
        baseCompetencia = `${String(data.repasse.competencia.month).padStart(2, '0')}/${data.repasse.competencia.year}`;
      }
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
          { label: "CPF", value: data.cpf ? (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((requesterSession.perfil_acesso || "").toUpperCase()) ? formatarCPF(data.cpf) : formatarCPF(data.cpf).replace(/\d/g, (match, offset) => (offset > 3 && offset < 11 ? "*" : match))) : "-" },
          { label: "Matrícula (SIAPE)", value: data.siape || "-" },
          { label: "Sexo", value: data.sexo === 'M' ? '♂️ Masculino' : (data.sexo === 'F' ? '♀️ Feminino' : '-') },
          { label: "Lotação", value: data.lotacao || "-" },
          { label: "Situação", value: data.situacao || "-" }
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
    } else if (type === "LOTACAO") {
      sections.push({
        kind: "kv",
        title: "Resumo da Unidade",
        items: [
          { label: "Total de Filiados (Ativos)", value: data.total },
          { label: "Homens", value: `${data.masc} (${((data.masc / data.total) * 100).toFixed(1)}%)` },
          { label: "Mulheres", value: `${data.fem} (${((data.fem / data.total) * 100).toFixed(1)}%)` }
        ]
      });

      if (data.repasse) {
        sections.push({
          kind: "kv",
          title: "Dados do Repasse",
          items: [
            { label: "PRF Total (Efetivo)", value: data.repasse.prfTotal || "Não informado" },
            { label: "Percentual de Filiação", value: data.repasse.percentual ? `${data.repasse.percentual.toFixed(1)}%` : "N/A" }
          ]
        });
      }

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

      if (params.value === "ATIVO" && data.repasseBreakdown) {
        sections.push({
          kind: "table",
          title: "Distribuição por Lotação",
          columns: ["Lotação", "Filiados", "Efetivo (PRF)", "%"],
          rows: data.repasseBreakdown.map(b => [
            b.lotacao,
            b.filiadosAtivos,
            b.prfTotal || "-",
            b.percentual ? `${b.percentual.toFixed(1)}%` : "-"
          ])
        });
      }
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
        if (!p.filiadoNome && p.filiadoId) {
          try {
            const filiado = await filiadosService.buscarPorId(p.filiadoId);
            if (filiado) {
              p.filiadoNome = filiado.nome;
              item.params = p; // Atualiza o objeto para a resposta
            }
          } catch (e) {
            log.error("ErroAoResolverNomeNoHistorico", { id: p.filiadoId });
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
