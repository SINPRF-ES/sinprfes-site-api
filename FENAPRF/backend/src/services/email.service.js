// src/services/email.service.js
let resend = null;

/**
 * Resend pode ser ESM-only em Node 20+.
 * Evita ERR_REQUIRE_ESM usando import() dinâmico e lazy-init.
 */
async function getResendClient() {
  if (resend) return resend;

  const apiKey = process.env.RESEND_API_KEY;

  // Se não tem chave, desabilita provider (mantém comportamento seguro)
  if (!apiKey) {
    return null;
  }

  try {
    const mod = await import("resend");
    const ResendCtor = mod?.Resend || mod?.default?.Resend;

    if (!ResendCtor) {
      console.warn("[EMAIL] Resend module loaded but constructor not found.");
      return null;
    }

    resend = new ResendCtor(apiKey);
    return resend;
  } catch (e) {
    // Loga o motivo real (ex: ERR_REQUIRE_ESM, module not found, etc.)
    console.warn("[EMAIL] Resend init failed detail:", {
      code: e?.code,
      message: e?.message,
      stack: e?.stack
    });
    return null;
  }
}

/**
 * Função de envio base
 */
async function enviarEmailBase(to, subject, text, cc = undefined) {
  const client = await getResendClient();
  if (!client) {
    console.warn("⚠️ [EMAIL] Resend não disponível. Abortando envio.");
    return null;
  }

  const { MAIL_FROM } = process.env;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("❌ RESEND_API_KEY não configurada.");
  }
  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const payload = { from: MAIL_FROM, to, subject, text };
  if (cc) payload.cc = cc;

  const { data, error } = await client.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail Resend enviado. Id:", data.id);
  return data;
}

/**
 * E-mail de boas-vindas para novo user.
 */
async function enviarEmailBoasVindasUser(dados) {
  const { MAIL_FROM } = process.env;

  // ✅ corrige bug: antes era dados.email || dados.email
  // ✅ mantém compatibilidade caso ainda exista algum fluxo com email1
  const emailDestino = dados.email || dados.email1;

  if (!MAIL_FROM || !emailDestino) {
    console.log("⚠️ E-mail de boas-vindas não enviado por falta de MAIL_FROM ou e-mail do user.");
    return;
  }

  const primeiroNome = (dados.nome || "").split(" ")[0] || "Colega";
  const subject = `Bem-vindo à FENAPRF – acesso à Área Restrita`;

  const corpo = `
Olá, ${primeiroNome}!

Seja muito bem-vindo(a) à FENAPRF. É uma honra tê-lo(a) conosco.

Seu cadastro foi realizado com sucesso em nosso sistema.
Você já pode acessar a Área Restrita para atualizar seus dados, consultar informações e utilizar nossos serviços.

Para o primeiro acesso:
1. Acesse o app da FENAPRF.
2. Solicite a recuperação de senha ("Esqueci minha senha").

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
Diretoria FENAPRF
`;

  await enviarEmailBase(emailDestino, subject, corpo);
}

// --------------------------
// Logística (confirmação / cancelamento)
// --------------------------

async function enviarEmailConfirmacaoInscricaoLogistica(payload) {
  const user = payload?.user || payload || {};
  const inscricao = payload?.inscricao || payload || {};
  const evento = payload?.evento || {};

  const emailDestino = extrairEmailDestino(user);
  if (!emailDestino) return;

  const primeiroNome = (user.nome || "").split(" ")[0] || "Colega";
  const subject = `Confirmação de Inscrição - ${evento.titulo || 'Evento Logístico'}`;

  const corpo = `
Olá, ${primeiroNome}!

Sua inscrição para o evento "${evento.titulo || 'Logística'}" foi registrada com sucesso.

Resumo da Inscrição:
- Data/Hora de Chegada: ${inscricao.data_chegada ? new Date(inscricao.data_chegada).toLocaleString('pt-BR') : "-"}
- Data/Hora de Saída: ${inscricao.data_saida ? new Date(inscricao.data_saida).toLocaleString('pt-BR') : "-"}
- Observações: ${inscricao.observacoes || "-"}

Este e-mail foi gerado automaticamente.

Atenciosamente,
FENAPRF
`;

  await enviarEmailBase(emailDestino, subject, corpo);
}

async function enviarEmailCancelamentoInscricaoLogistica(payload) {
  const user = payload?.user || payload || {};
  const inscricao = payload?.inscricao || payload || {};
  const evento = payload?.evento || {};

  const emailDestino = extrairEmailDestino(user);
  if (!emailDestino) return;

  const primeiroNome = (user.nome || "").split(" ")[0] || "Colega";
  const subject = `Cancelamento de Inscrição - ${evento.titulo || 'Evento Logístico'}`;

  const corpo = `
Olá, ${primeiroNome}!

Sua inscrição para o evento "${evento.titulo || 'Logística'}" foi cancelada.

(Dados da inscrição cancelada):
- Data/Hora de Chegada: ${inscricao.data_chegada ? new Date(inscricao.data_chegada).toLocaleString('pt-BR') : "-"}
- Data/Hora de Saída: ${inscricao.data_saida ? new Date(inscricao.data_saida).toLocaleString('pt-BR') : "-"}

Este e-mail foi gerado automaticamente.

Atenciosamente,
FENAPRF
`;

  await enviarEmailBase(emailDestino, subject, corpo);
}

function extrairEmailDestino(obj = {}) {
  // BOLT/Sentinel: Garantindo cast explícito para String em todos os campos para evitar erros de tipo no provider
  return (
    (obj.email_destino && String(obj.email_destino).trim()) ||
    (obj.email && String(obj.email).trim()) ||
    (obj.email2 && String(obj.email2).trim()) ||
    (obj.email1 && String(obj.email1).trim()) ||
    ""
  );
}

/**
 * Envia e-mail para a FENAPRF com o relatório de aniversariantes do dia.
 */
async function enviarRelatorioAniversariantes({ dateStr, aniversariantes }) {
  const { MAIL_FROM, BIRTHDAY_REPORT_TO } = process.env;
  const to = BIRTHDAY_REPORT_TO || "marcelo.mfb@gmail.com";

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

      if (p.tipo === "MEMBRO") {
        corpo += `${index + 1}. ${p.nome} (Membro - Nasc: ${dataNascStr})\n`;
      } else {
        corpo += `${index + 1}. ${p.nome} (Dependente de ${p.nome_user_vinculo} - Nasc: ${dataNascStr})\n`;
      }
    });
  }

  corpo += `\nAtenciosamente,\nSistema FENAPRF`;

  await enviarEmailBase(to, subject, corpo);
  console.log(`📧 Relatório de aniversariantes enviado para ${to}.`);
}

async function enviarEmailRelatorioAssembleia(user, assembleia, pdfBuffer, dados = {}) {
  const { MAIL_FROM, REPORT_NOTIFY_EMAIL } = process.env;
  const notificacaoEmail = REPORT_NOTIFY_EMAIL || "marcelo.mfb@gmail.com";

  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const emailDestino = extrairEmailDestino(user);
  if (!emailDestino) {
    console.warn("⚠️ RelatorioAssembleiaSemEmail", JSON.stringify({ userId: user.id }));
  }

  const subject = `Relatório de Assembleia - ${assembleia.titulo}`;
  const corpo = `
Prezado(a) ${user.nome || "user(a)"},

Segue em anexo o relatório consolidado da assembleia "${assembleia.titulo}", conforme solicitado via plataforma FENAPRF.

Este documento contém o registro da mesa diretora, quórum de presença e o resultado das votações realizadas.

Atenciosamente,
FENAPRF
`;

  // 1. Envio para o User
  if (emailDestino) {
    try {
      const payloadUser = {
        from: MAIL_FROM,
        to: emailDestino,
        subject,
        text: corpo,
        attachments: [{ filename: `relatorio_assembleia_${assembleia.id.slice(0, 8)}.pdf`, content: pdfBuffer.toString("base64") }],
      };

      const client = await getResendClient();
      const resUser = client ? await client.emails.send(payloadUser) : { error: "Resend not available" };
      if (resUser.error) throw resUser.error;

      console.log("📧 [emailRelatorioUserOk]", resUser.data.id);
    } catch (err) {
      console.error("💥 [emailRelatorioUserErro]", err);
      throw new Error(`Falha ao enviar e-mail para o user: ${err.message}`);
    }
  }

  // 2. Notificação à FENAPRF
  try {
    const agora = dados.solicitante?.data_geracao || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const maskedCpf = user.cpf ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") : "CPF não informado";

    // Busca resumo do quórum mais recente se disponível
    const ultimoQuorum = (dados.quorums || []).slice(-1)[0];
    const resumoQuorum = ultimoQuorum ?
        `Tipo: ${ultimoQuorum.tipo_chamada} | Presentes: ${ultimoQuorum.presentes?.length || 0} | Mínimo: ${ultimoQuorum.quorum_necessario || '0'}` :
        'Nenhum quórum registrado';

    const payloadNotificacao = {
      from: MAIL_FROM,
      to: notificacaoEmail,
      subject: `[Notificação] Relatório de Assembleia Gerado - ${assembleia.titulo}`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
            <p>Um novo relatório de assembleia foi gerado via plataforma.</p>
            <hr />
            <p><strong>Assembleia:</strong> ${assembleia.titulo} (ID: ${assembleia.id})</p>
            <p><strong>Tipo:</strong> ${assembleia.tipo} | <strong>Status:</strong> ${assembleia.estado}</p>
            <p><strong>Solicitante:</strong> ${user.nome} (CPF: ${maskedCpf} | Perfil: ${dados.solicitante?.perfil || 'N/A'})</p>
            <p><strong>Data/Hora da Solicitação:</strong> ${agora}</p>
            <p><strong>Resumo do Quórum:</strong> ${resumoQuorum}</p>
            <hr />
            <p style="font-size: 0.9rem; color: #666;">O documento PDF foi enviado diretamente para o e-mail do solicitante.</p>
        </div>
      `,
    };

    const client = await getResendClient();
    if (client) {
      await client.emails.send(payloadNotificacao);
      console.log("📧 [emailRelatorioNotificacaoOk]");
    }
  } catch (err) {
    console.error("💥 [emailRelatorioNotificacaoErro]", err.message);
    // Falha na notificação não derruba o fluxo principal
  }
}

/**
 * Envia e-mail de relatório genérico (Individual, UF, Setor, Situação)
 */
async function enviarEmailRelatorio(user, reportTitle, pdfBuffer, filename) {
  const { MAIL_FROM, REPORTS_COPY_EMAIL } = process.env;
  const notificacaoEmail = REPORTS_COPY_EMAIL || "marcelo.mfb@gmail.com";

  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const emailDestino = extrairEmailDestino(user);
  const subject = `Relatório Gerado - ${reportTitle}`;
  const corpo = `
Prezado(a) ${user.nome || "solicitante"},

Segue em anexo o relatório "${reportTitle}" solicitado via plataforma FENAPRF.

Atenciosamente,
FENAPRF
`;

  const attachments = [{ filename, content: pdfBuffer.toString("base64") }];

  const client = await getResendClient();

  if (emailDestino) {
    try {
      const payload = {
        from: MAIL_FROM,
        to: emailDestino,
        bcc: notificacaoEmail,
        subject,
        text: corpo,
        attachments
      };

      const res = client ? await client.emails.send(payload) : { error: "Resend not available" };
      if (res.error) throw res.error;

      console.log("📧 [emailRelatorioOk] enviado para", emailDestino, "com BCC para", notificacaoEmail);
    } catch (err) {
      console.error("💥 [emailRelatorioErro]", err);
      throw new Error(`Falha ao enviar e-mail do relatório: ${err.message}`);
    }
  } else if (client) {
    // Se o solicitante não tem e-mail, envia apenas para a notificação da entidade
    try {
      await client.emails.send({
        from: MAIL_FROM,
        to: notificacaoEmail,
        subject: `[SOLICITANTE SEM EMAIL] ${subject}`,
        text: `O membro ${user.nome} solicitou o relatório em anexo, mas não possui e-mail cadastrado.\n\n${corpo}`,
        attachments
      });
      console.log("📧 [emailRelatorioNotificacaoOnlyOk] enviado para", notificacaoEmail);
    } catch (err) {
      console.error("💥 [emailRelatorioErroNotificacaoOnly]", err);
    }
  }
}

module.exports = {
  enviarEmailBase,
  enviarEmailBoasVindasUser,
  enviarEmailConfirmacaoInscricaoLogistica,
  enviarEmailCancelamentoInscricaoLogistica,
  enviarRelatorioAniversariantes,
  enviarEmailRelatorioAssembleia,
  enviarEmailRelatorio,
};
