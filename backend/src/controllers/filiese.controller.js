const { gerarPdfFichaFiliacao } = require("../services/pdf.service");
const { enviarEmailFichaFiliacao } = require("../services/email.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");

exports.enviarFichaFiliacao = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const ip = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.get("user-agent") || "";

    // Normalizador de e-mail (iguais ao ressarcimento)
    const normalizarEmail = (v) =>
      (v || "").toString().trim().toLowerCase();

    const dados = {
      ...req.body,
      ip,
      userAgent,
      criadoEm: new Date().toISOString(),
    };

    // 1. Validação de campos obrigatórios
    const obrigatorios = [
      "nome",
      "cpf",
      "data_nascimento",
      "telefone1",
      "email_pessoal",
      "cep",
      "logradouro",
      "bairro",
      "cidade",
      "uf",
    ];

    for (const campo of obrigatorios) {
      if (!dados[campo] || String(dados[campo]).trim() === "") {
        return res
          .status(400)
          .json({ message: `Campo obrigatório ausente: ${campo}` });
      }
    }

    // 2. Normalização de dados básicos
    const cpfNumerico = String(dados.cpf).replace(/\D/g, "");
    const cpfFormatado = cpfNumerico.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      "$1.$2.$3-$4"
    );

    // Normaliza e-mail pessoal
    const emailPessoal = normalizarEmail(dados.email_pessoal);

    // 3. Monta o payload que vai para o PDF e para o serviço de email
    const payloadPdfEmail = {
      nome: dados.nome,
      cpf: cpfFormatado,
      matricula: dados.siape || "",
      lotacao: dados.lotacao || "",

      // Contatos
      email_destino: emailPessoal,    // filiado (cc)
      email_pessoal: emailPessoal,    // redundante para segurança
      email_funcional: normalizarEmail(dados.email_funcional || ""),
      telefone1: dados.telefone1,
      telefone2: dados.telefone2 || "",

      // Endereço
      logradouro: dados.logradouro,
      numero: dados.numero,
      complemento: dados.complemento || "",
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf,
      cep: dados.cep,

      // Metadados
      ip,
      userAgent,
      criadoEm: dados.criadoEm,
    };

    // DEBUG crítico: garante que estamos enviando e-mail corretamente normalizado
    log.info("DEBUG_FILIACAO_EMAIL", {
      requestId,
      email_destino: payloadPdfEmail.email_destino,
      email_pessoal: payloadPdfEmail.email_pessoal,
      email_funcional: payloadPdfEmail.email_funcional,
    });

    // 4. Gera o PDF
    const pdfBuffer = await gerarPdfFichaFiliacao(payloadPdfEmail);

    // 5. Envia e-mail
    log.info("EnviandoFichaFiliacao", {
      requestId,
      nome: dados.nome,
      emailSindicato: process.env.MAIL_TO_FILIACAO,
      emailCopia: payloadPdfEmail.email_destino,
    });

    await enviarEmailFichaFiliacao(payloadPdfEmail, pdfBuffer);

    log.info("FilieseSolicitacaoCriada", {
      requestId,
      cpf: cpfNumerico,
      nome: dados.nome,
    });

    return res.status(201).json({
      success: true,
      message:
        "Sua ficha de filiação foi gerada e enviada para o seu e-mail. Por favor, verifique sua caixa de entrada (e spam), assine o documento e nos devolva.",
      requestId
    });
  } catch (err) {
    log.error("FilieseSolicitacaoErro", { error: err.message, requestId });
    return res
      .status(500)
      .json({ success: false, message: "Erro interno ao processar a solicitação.", requestId });
  }
};
