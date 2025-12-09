// src/controllers/filiese.controller.js
// Controlador do formulário de filiação

const { gerarPdfFichaFiliacao } = require("../services/pdf.service");
const { enviarEmailFichaFiliacao } = require("../services/email.service");

exports.enviarFichaFiliacao = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.get("user-agent") || "";

    const dados = {
      ...req.body,
      ip,
      userAgent,
      criadoEm: new Date().toISOString(),
    };

    // Validação mínima de campos obrigatórios
    const obrigatorios = [
      "nome",
      "cpf",
      "data_nascimento",
      "siape",
      "telefone1",
      "email_pessoal",
      "cep",
      "endereco",
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

    // Normaliza e monta alguns campos auxiliares
    const cpfNumerico = String(dados.cpf).replace(/\D/g, "");

    const enderecoCompleto = [
      dados.endereco || "",
      dados.complemento || "",
      `${dados.cidade || ""}/${(dados.uf || "").toUpperCase()}`,
      dados.cep ? `CEP ${dados.cep}` : "",
    ]
      .filter(Boolean)
      .join(" - ");

    const payloadPdfEmail = {
      // dados principais
      nome: dados.nome,
      cpf: cpfNumerico,
      matricula: dados.siape,
      lotacao: dados.lotacao || "",

      // contato
      email_pessoal: dados.email_pessoal,
      email_funcional: dados.email_funcional,
      telefone1: dados.telefone1,
      telefone2: dados.telefone2,

      // endereco
      enderecoCompleto,

      // info técnica
      ip,
      userAgent,
      criadoEm: dados.criadoEm,
    };

    // 1) Gera PDF da ficha de filiação
    const pdfBuffer = await gerarPdfFichaFiliacao(payloadPdfEmail);

    // 2) Envia e-mail para sindicato + cópia para o filiado
    await enviarEmailFichaFiliacao(payloadPdfEmail, pdfBuffer);

    return res.status(201).json({
      message:
        "Solicitação de filiação registrada. Verifique o PDF enviado por e-mail, assine via Gov.br e encaminhe para sinprfes@sinprfes.org.br.",
    });
  } catch (err) {
    console.error("❌ Erro ao processar ficha de filiação:", err);
    return res
      .status(500)
      .json({ message: "Erro ao processar a solicitação de filiação." });
  }
};
