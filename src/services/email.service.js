// src/services/email.service.js
const { Resend } = require("resend");

// 1. Inicializa o cliente Resend com a chave API
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Função de envio base
 */
async function enviarEmailBase(to, subject, text, cc = undefined) {
  const { MAIL_FROM } = process.env;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("❌ RESEND_API_KEY não configurada.");
  }
  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const payload = { from: MAIL_FROM, to, subject, text };
  if (cc) payload.cc = cc;

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail Resend enviado. Id:", data.id);
  return data;
}

/**
 * Envia o e-mail para o sindicato com a ficha de filiação em PDF anexa.
 */
async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const { MAIL_FROM, MAIL_TO_FILIACAO } = process.env;

  if (!MAIL_FROM || !MAIL_TO_FILIACAO) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_FILIACAO não configurados.");
  }

  const emailFiliado =
    (dados.email_destino && String(dados.email_destino).trim()) ||
    (dados.email_pessoal && String(dados.email_pessoal).trim()) ||
    (dados.email && String(dados.email).trim()) ||
    "";

  if (!emailFiliado) {
    console.warn("⚠️ Aviso: Ficha de filiação será enviada sem cópia para o solicitante (e-mail não identificado).");
  }

  const subject = `Ficha de Filiação - ${dados.nome || ""} (${dados.cpf || ""})`;

  const payload = {
    from: MAIL_FROM,
    to: MAIL_TO_FILIACAO,
    cc: emailFiliado || undefined,
    subject,
    text: `Prezado(a),\n\nSegue em anexo a ficha de filiação de ${dados.nome || ""}, CPF ${dados.cpf || ""}.\n\nPor favor, assine e devolva este documento.\n\nAtenciosamente,\nSINPRF-ES`,
    attachments: [{ filename: "ficha_filiacao.pdf", content: pdfBuffer.toString("base64") }],
  };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail de filiação com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 DEBUG_CC_FILIACAO:", { emailFiliado });
  console.log("📧 E-mail de filiação enviado. ID:", data.id, "Cópia para:", emailFiliado);
}

/**
 * Envia o e-mail de pedido de ressarcimento
 */
async function enviarEmailRessarcimento(dados, pdfBuffer) {
  const { MAIL_FROM, MAIL_TO_RESSARCIMENTO, MAIL_TO_FILIACAO } = process.env;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("❌ RESEND_API_KEY não configurada.");
  }

  const mailSindicato = MAIL_TO_RESSARCIMENTO || MAIL_TO_FILIACAO;

  if (!MAIL_FROM || !mailSindicato) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_RESSARCIMENTO não configurados.");
  }

  const emailFiliado =
    (dados.email_destino && String(dados.email_destino).trim()) ||
    (dados.email1 && String(dados.email1).trim()) ||
    (dados.email2 && String(dados.email2).trim()) ||
    "";

  if (!emailFiliado) {
    console.warn("⚠️ RessarcimentoSemEmailDestino", JSON.stringify({ filiadoId: dados.id_filiado || dados.id }));
  }

  const subject = `Pedido de Ressarcimento - ${dados.nome || ""} (${dados.cpf || ""})`;

  const corpoEmail = `
Prezado(a) ${dados.nome || "filiado(a)"},

Seu pedido de ressarcimento de despesas sindicais foi registrado na plataforma do SINPRF/ES.

Resumo do pedido:
- Período da atividade: ${dados.data_inicio || "-"} a ${dados.data_fim || "-"}
- Local / destino: ${dados.local || "-"}
- Valor total solicitado: R$ ${(dados.valor_total || 0).toFixed ? dados.valor_total.toFixed(2) : Number(dados.valor_total || 0).toFixed(2)}

Este e-mail foi gerado automaticamente. Em anexo, segue o PDF consolidado com os dados do pedido, para sua conferência.

Atenciosamente,
SINPRF-ES
`;

  // 1. Envio para o Sindicato
  try {
    const payloadSindicato = {
      from: MAIL_FROM,
      to: mailSindicato,
      subject,
      text: corpoEmail,
      attachments: [{ filename: "pedido_ressarcimento.pdf", content: pdfBuffer.toString("base64") }],
    };
    const resSindicato = await resend.emails.send(payloadSindicato);
    if (resSindicato.error) throw resSindicato.error;
    console.log("📧 [emailSindicatoOk]", resSindicato.data.id);
  } catch (err) {
    console.error("💥 [emailSindicatoErro]", err);
    // Não paramos aqui, tentamos enviar a cópia mesmo se o do sindicato falhar
  }

  // 2. Envio da Cópia para o Solicitante
  if (emailFiliado) {
    try {
      const payloadSolicitante = {
        from: MAIL_FROM,
        to: emailFiliado,
        subject: `CÓPIA: ${subject}`,
        text: corpoEmail,
        attachments: [{ filename: "pedido_ressarcimento.pdf", content: pdfBuffer.toString("base64") }],
      };
      const resSolicitante = await resend.emails.send(payloadSolicitante);
      if (resSolicitante.error) throw resSolicitante.error;
      console.log("📧 [emailSolicitanteOk]", resSolicitante.data.id);
    } catch (err) {
      console.error("💥 [emailSolicitanteErro]", err);
    }
  } else {
    console.warn("⚠️ [emailSolicitanteSkip] E-mail não identificado.");
  }
}

/**
 * E-mail de boas-vindas para novo filiado.
 */
async function enviarEmailBoasVindasFiliado(dados) {
  const { MAIL_FROM } = process.env;

  if (!MAIL_FROM || !dados.email1) {
    console.log("⚠️ E-mail de boas-vindas não enviado por falta de MAIL_FROM ou email1 do filiado.");
    return;
  }

  const primeiroNome = (dados.nome || "").split(" ")[0] || "Colega";
  const subject = `Bem-vindo ao SINPRF-ES – acesso à Área do Filiado`;

  const corpo = `
Olá, ${primeiroNome}!

Seja muito bem-vindo(a) ao SINPRF-ES. É uma honra tê-lo(a) conosco.

Seu cadastro foi realizado com sucesso em nosso sistema.
Você já pode acessar a Área do Filiado para atualizar seus dados, consultar informações e utilizar nossos serviços.

Para o primeiro acesso:
1. Acesse o site do sindicato (Área do Filiado).
2. Utilize seu CPF e a senha provisória ou solicite a recuperação de senha ("Esqueci minha senha").

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
Diretoria SINPRF-ES
`;

  await enviarEmailBase(dados.email1, subject, corpo);
}

// --------------------------
// Jogos (confirmação / cancelamento)
// --------------------------

const MAPPING_MODALIDADES_JOGOS_2026 = {
  atletismo_100m_masc: '100m Masculino',
  atletismo_100m_fem: '100m Feminino',
  atletismo_400m_masc: '400m Masculino',
  atletismo_400m_fem: '400m Feminino',
  atletismo_1500m_masc: '1500m Masculino',
  atletismo_1500m_fem: '1500m Feminino',
  atletismo_5000m_masc: '5000m Masculino',
  atletismo_5000m_fem: '5000m Feminino',
  beach_tenis_dupla_livre: 'Beach Tênis - Dupla Livre',
  beach_tenis_dupla_mista: 'Beach Tênis - Dupla Mista',
  canastra: 'Canastra',
  domino: 'Dominó',
  truco_duplas: 'Truco (Duplas)',
  xadrez: 'Xadrez',
  futebol_society_livre: 'Futebol Society (Livre)',
  futebol_society_master: 'Futebol Society (Master - Acima de 55 anos)',
  futsal_livre: 'Futsal (Livre)',
  futevolei: 'Futevôlei',
  voleibol_livre: 'Voleibol (Livre)',
  voleibol_praia_dupla_masc: 'Vôlei de Praia - Dupla Masculina',
  voleibol_praia_dupla_mista: 'Vôlei de Praia - Dupla Mista',
  jiu_jitsu: 'Jiu-Jitsu',
  natacao_50m_livre_masc: '50m Nado Livre (Masculino)',
  natacao_50m_livre_fem: '50m Nado Livre (Feminino)',
  natacao_50m_costas_masc: '50m Nado Costas (Masculino)',
  natacao_50m_costas_fem: '50m Nado Costas (Feminino)',
  natacao_50m_peito_masc: '50m Nado Peito (Masculino)',
  natacao_50m_peito_fem: '50m Nado Peito (Feminino)',
  natacao_50m_borboleta_masc: '50m Nado Borboleta (Masculino)',
  natacao_50m_borboleta_fem: '50m Nado Borboleta (Feminino)',
  natacao_revezamento_4x50m_livre: 'Revezamento 4x50m Livre',
  natacao_revezamento_2x50m_misto: 'Revezamento 2x50 Misto',
  sinuca_individual: 'Sinuca Individual',
  sinuca_duplas: 'Sinuca Duplas',
  tenis_quadra_individual_masc: 'Tênis de Quadra - Individual (Masculino)',
  tenis_quadra_duplas_livre: 'Tênis de Quadra - Duplas (Livre)',
  tenis_mesa_masc: 'Tênis de Mesa (Masculino)',
  tenis_mesa_fem: 'Tênis de Mesa (Feminino)',
  tenis_mesa_duplas: 'Tênis de Mesa (Duplas)',
  tiro_nra_masc: 'Tiro NRA (Masculino)',
  tiro_nra_fem: 'Tiro NRA (Feminino)',
  tiro_ispc_masc: 'Tiro ISPC (Masculino)',
  tiro_ispc_fem: 'Tiro ISPC (Feminino)',
  peteca: 'Peteca',
  damas: 'Damas',
  bocha: 'Bocha',
};

function formatarModalidadesJogos(modalidades) {
  if (!Array.isArray(modalidades)) return modalidades || "-";
  return modalidades
    .map((id) => MAPPING_MODALIDADES_JOGOS_2026[id] || id)
    .join(", ");
}

function extrairEmailDestino(obj = {}) {
  return (
    (obj.email_destino && String(obj.email_destino).trim()) ||
    (obj.email1 && String(obj.email1).trim()) ||
    (obj.email2 && String(obj.email2).trim()) ||
    ""
  );
}

async function enviarEmailConfirmacaoInscricaoJogos(payload) {
  const filiado = payload?.filiado || payload || {};
  const inscricao = payload?.inscricao || payload || {};

  const filiadoId = filiado.id || filiado.id_filiado || payload?.id || payload?.id_filiado;

  const emailDestino = extrairEmailDestino(filiado);
  if (!emailDestino) {
    console.warn("⚠️ EmailJogosConfirmacao: filiado sem email1/email2.", JSON.stringify({ filiadoId }));
    return;
  }

  const primeiroNome = (filiado.nome || "").split(" ")[0] || "Colega";
  const subject = `Confirmação de Pré-inscrição - Jogos`;

  const modalidadesTexto = formatarModalidadesJogos(inscricao.modalidades);

  const corpo = `
Olá, ${primeiroNome}!

Sua pré-inscrição para os Jogos foi registrada com sucesso.

Resumo:
- Modalidades: ${modalidadesTexto}
- Observações: ${inscricao.observacoes || "-"}
- Familiares: ${inscricao.familiares || "-"}
- Qtd. familiares: ${Number.isFinite(Number(inscricao.qtd_familiares)) ? Number(inscricao.qtd_familiares) : 0}
- Sexo: ${inscricao.sexo || "-"}

Este e-mail foi gerado automaticamente.

Atenciosamente,
SINPRF-ES
`;

  await enviarEmailBase(emailDestino, subject, corpo);
}

async function enviarEmailCancelamentoInscricaoJogos(payload) {
  const filiado = payload?.filiado || payload || {};
  const inscricao = payload?.inscricao || payload || {};

  const filiadoId = filiado.id || filiado.id_filiado || payload?.id || payload?.id_filiado;

  const emailDestino = extrairEmailDestino(filiado);
  if (!emailDestino) {
    console.warn("⚠️ EmailJogosCancelamento: filiado sem email1/email2.", JSON.stringify({ filiadoId }));
    return;
  }

  const primeiroNome = (filiado.nome || "").split(" ")[0] || "Colega";
  const subject = `Cancelamento de Pré-inscrição - Jogos`;

  const modalidadesTexto = formatarModalidadesJogos(inscricao.modalidades);

  const corpo = `
Olá, ${primeiroNome}!

Sua pré-inscrição para os Jogos foi cancelada com sucesso.

(Referência da inscrição anterior)
- Modalidades: ${modalidadesTexto}
- Observações: ${inscricao.observacoes || "-"}
- Familiares: ${inscricao.familiares || "-"}
- Qtd. familiares: ${Number.isFinite(Number(inscricao.qtd_familiares)) ? Number(inscricao.qtd_familiares) : 0}
- Sexo: ${inscricao.sexo || "-"}

Este e-mail foi gerado automaticamente.

Atenciosamente,
SINPRF-ES
`;

  await enviarEmailBase(emailDestino, subject, corpo);
}

/**
 * Envia e-mail para o sindicato com o relatório de aniversariantes do dia.
 */
async function enviarRelatorioAniversariantes({ dateStr, aniversariantes }) {
  const { MAIL_FROM, BIRTHDAY_REPORT_TO } = process.env;
  const to = BIRTHDAY_REPORT_TO || "sinprfes@sinprfes.org.br";

  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const subject = `Relatório diário de aniversariantes - ${dateStr}`;

  let corpo = `Olá,\n\nRelatório de aniversariantes do dia ${dateStr}:\n\n`;

  if (!aniversariantes || aniversariantes.length === 0) {
    corpo += `Nenhum aniversariante hoje.\n`;
  } else {
    aniversariantes.forEach((p, index) => {
      // Formata a data (PG DATE vem como objeto Date em UTC midnight)
      const dataNascStr = p.data_nascimento
        ? new Date(p.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "-";

      if (p.tipo === "FILIADO") {
        corpo += `${index + 1}. ${p.nome} (Filiado - Nasc: ${dataNascStr})\n`;
      } else {
        corpo += `${index + 1}. ${p.nome} (Dependente de ${p.nome_filiado_vinculo} - Nasc: ${dataNascStr})\n`;
      }
    });
  }

  corpo += `\nAtenciosamente,\nSistema SINPRF-ES`;

  await enviarEmailBase(to, subject, corpo);
  console.log(`📧 Relatório de aniversariantes enviado para ${to}.`);
}

async function enviarEmailRelatorioAssembleia(filiado, assembleia, pdfBuffer) {
  const { MAIL_FROM, REPORT_NOTIFY_EMAIL } = process.env;
  const unionEmail = REPORT_NOTIFY_EMAIL || "sinprfes@sinprfes.org.br";

  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const emailDestino = extrairEmailDestino(filiado);
  if (!emailDestino) {
    console.warn("⚠️ RelatorioAssembleiaSemEmail", JSON.stringify({ filiadoId: filiado.id }));
  }

  const subject = `Relatório de Assembleia - ${assembleia.titulo}`;
  const corpo = `
Prezado(a) ${filiado.nome || "filiado(a)"},

Segue em anexo o relatório consolidado da assembleia "${assembleia.titulo}", conforme solicitado via plataforma SINPRF-ES.

Este documento contém o registro da mesa diretora, quórum de presença e o resultado das votações realizadas.

Atenciosamente,
SINPRF-ES
`;

  // 1. Envio para o Filiado
  if (emailDestino) {
    try {
      const payloadFiliado = {
        from: MAIL_FROM,
        to: emailDestino,
        subject,
        text: corpo,
        attachments: [{ filename: `relatorio_assembleia_${assembleia.id.slice(0, 8)}.pdf`, content: pdfBuffer.toString("base64") }],
      };
      const resFiliado = await resend.emails.send(payloadFiliado);
      if (resFiliado.error) throw resFiliado.error;
      console.log("📧 [emailRelatorioFiliadoOk]", resFiliado.data.id);
    } catch (err) {
      console.error("💥 [emailRelatorioFiliadoErro]", err);
      throw new Error(`Falha ao enviar e-mail para o filiado: ${err.message}`);
    }
  }

  // 2. Notificação ao Sindicato
  try {
    const maskedCpf = filiado.cpf ? filiado.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") : "CPF não informado";
    const payloadSindicato = {
      from: MAIL_FROM,
      to: unionEmail,
      subject: `NOTIFICAÇÃO: Relatório gerado - ${assembleia.titulo}`,
      text: `O filiado ${filiado.nome} (CPF ${maskedCpf}) gerou o relatório da assembleia "${assembleia.titulo}" (ID: ${assembleia.id}) em ${new Date().toLocaleString('pt-BR')}.`,
    };
    await resend.emails.send(payloadSindicato);
  } catch (err) {
    console.error("💥 [emailRelatorioNotifSindicatoErro]", err);
  }
}

module.exports = {
  enviarEmailBase,
  enviarEmailFichaFiliacao,
  enviarEmailRessarcimento,
  enviarEmailBoasVindasFiliado,
  enviarEmailConfirmacaoInscricaoJogos,
  enviarEmailCancelamentoInscricaoJogos,
  enviarRelatorioAniversariantes,
  enviarEmailRelatorioAssembleia,
};
