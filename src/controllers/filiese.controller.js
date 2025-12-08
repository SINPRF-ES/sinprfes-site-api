// src/controllers/filiese.controller.js
const { gerarPdfFichaFiliacao } = require("../services/pdf.service");
const { enviarEmailFichaFiliacao } = require("../services/email.service");

exports.enviar = async (req, res) => {
  try {
    const body = req.body || {};
    console.log("📨 [filiese] body recebido:", body);

    const {
      nome,
      nacionalidade,
      estado_civil,
      data_nascimento,
      cpf,
      rg,
      siape,
      lotacao,
      grau_instrucao,

      telefone1,
      telefone2,
      email_funcional,
      email_pessoal,

      endereco,
      complemento,
      bairro,
      cidade,
      uf,
      cep,

      conjuge_nome,
      conjuge_nascimento,

      dependente1_nome,
      dependente1_nascimento,
      dependente2_nome,
      dependente2_nascimento,
      dependente3_nome,
      dependente3_nascimento,

      aceite_estatuto,
      aceite_lgpd,
    } = body;

    // Validações mínimas
    if (
      !nome ||
      !data_nascimento ||
      !cpf ||
      !siape ||
      !lotacao ||
      !telefone1 ||
      !email_pessoal ||
      !endereco ||
      !bairro ||
      !cidade ||
      !uf ||
      !cep
    ) {
      return res.status(400).json({
        error: "Preencha todos os campos obrigatórios marcados com *.",
      });
    }

    if (!aceite_estatuto || !aceite_lgpd) {
      return res.status(400).json({
        error:
          "É necessário declarar que leu o Estatuto e aceitar o tratamento de dados (LGPD).",
      });
    }

    const dados = {
      nome: String(nome).trim(),
      nacionalidade: (nacionalidade || "").toString().trim(),
      estado_civil: (estado_civil || "").toString().trim(),
      data_nascimento: String(data_nascimento).trim(),
      cpf: String(cpf).trim(),
      rg: (rg || "").toString().trim(),
      siape: String(siape).trim(),
      lotacao: String(lotacao).trim(),
      grau_instrucao: (grau_instrucao || "").toString().trim(),

      telefone1: String(telefone1).trim(),
      telefone2: (telefone2 || "").toString().trim(),
      email_funcional: (email_funcional || "").toString().trim(),
      email_pessoal: String(email_pessoal).trim(),

      endereco: String(endereco).trim(),
      complemento: (complemento || "").toString().trim(),
      bairro: String(bairro).trim(),
      cidade: String(cidade).trim(),
      uf: String(uf).trim().toUpperCase(),
      cep: String(cep).trim(),

      conjuge_nome: (conjuge_nome || "").toString().trim(),
      conjuge_nascimento: (conjuge_nascimento || "").toString().trim(),

      dependente1_nome: (dependente1_nome || "").toString().trim(),
      dependente1_nascimento: (dependente1_nascimento || "").toString().trim(),
      dependente2_nome: (dependente2_nome || "").toString().trim(),
      dependente2_nascimento: (dependente2_nascimento || "").toString().trim(),
      dependente3_nome: (dependente3_nome || "").toString().trim(),
      dependente3_nascimento: (dependente3_nascimento || "").toString().trim(),

      aceite_estatuto: !!aceite_estatuto,
      aceite_lgpd: !!aceite_lgpd,

      data_solicitacao: new Date().toISOString(),
      ip: (req.ip || "").toString(),
      userAgent: req.headers["user-agent"] || "",
    };

    console.log("📥 Nova solicitação de filiação:", {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email_pessoal,
    });

    // Gera o PDF
    const pdfBuffer = await gerarPdfFichaFiliacao(dados);

    // Envia o e-mail
    await enviarEmailFichaFiliacao(dados, pdfBuffer);

    return res.json({
      message:
        "Solicitação de filiação enviada com sucesso. Sua ficha será analisada pelo SINPRF-ES.",
    });
  } catch (err) {
    console.error("💥 Erro em /api/filiese:", err);
    return res.status(500).json({
      error: "Erro interno ao processar sua solicitação de filiação.",
    });
  }
};
