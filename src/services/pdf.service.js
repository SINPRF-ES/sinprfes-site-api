// src/services/pdf.service.js
const PDFDocument = require("pdfkit");

/**
 * Gera um PDF simples de ficha de filiação com os dados enviados.
 * Retorna um Buffer.
 */
function gerarPdfFichaFiliacao(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cabeçalho
    doc
      .fontSize(18)
      .text("FICHA DE FILIAÇÃO", { align: "center" })
      .moveDown(0.3);

    doc
      .fontSize(14)
      .text(
        "SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo",
        { align: "center" }
      )
      .moveDown(1);

    doc
      .fontSize(10)
      .text(
        `Data da solicitação: ${new Date(
          dados.data_solicitacao
        ).toLocaleString("pt-BR")}`
      )
      .moveDown(1);

    const linha = (label, v) => {
      doc.font("Helvetica-Bold").text(label, { continued: true });
      doc.font("Helvetica").text(` ${v || ""}`);
    };

    doc.fontSize(12).text("DADOS PESSOAIS", { underline: true }).moveDown(0.5);

    linha("Nome completo:", dados.nome);
    linha("CPF:", dados.cpf);
    linha("Data de nascimento:", dados.data_nascimento);
    linha("Telefone principal:", dados.telefone1);
    linha("Telefone adicional:", dados.telefone2 || "-");
    linha("E-mail pessoal:", dados.email_pessoal || "-");
    linha("E-mail funcional:", dados.email_funcional || "-");

    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").text("Endereço residencial:");
    doc
      .font("Helvetica")
      .text(
        `${dados.endereco} ${
          dados.complemento ? " - " + dados.complemento : ""
        }`
      );
    doc
      .text(`${dados.bairro} - ${dados.cidade}/${dados.uf} - CEP ${dados.cep}`)
      .moveDown(1);

    if (dados.conjuge_nome) {
      doc.font("Helvetica-Bold").text("Cônjuge:");
      doc
        .font("Helvetica")
        .text(
          `${dados.conjuge_nome} (${dados.conjuge_nascimento || "data não informada"})`
        )
        .moveDown(0.5);
    }

    // Dependentes (apenas se tiver)
    const deps = [];
    if (dados.dependente1_nome) {
      deps.push(
        `1) ${dados.dependente1_nome} (${
          dados.dependente1_nascimento || "sem data"
        })`
      );
    }
    if (dados.dependente2_nome) {
      deps.push(
        `2) ${dados.dependente2_nome} (${
          dados.dependente2_nascimento || "sem data"
        })`
      );
    }
    if (dados.dependente3_nome) {
      deps.push(
        `3) ${dados.dependente3_nome} (${
          dados.dependente3_nascimento || "sem data"
        })`
      );
    }

    if (deps.length) {
      doc.font("Helvetica-Bold").text("Dependentes:");
      deps.forEach((linhaDep) => {
        doc.font("Helvetica").text(linhaDep);
      });
      doc.moveDown(1);
    }

    doc.font("Helvetica-Bold").text("Declarações:").moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        "O interessado declara que as informações são verdadeiras, que aceita o Estatuto do SINPRF-ES " +
          "e autoriza o tratamento de seus dados pessoais para fins sindicais, nos termos da LGPD.",
        { align: "justify" }
      )
      .moveDown(2);

    doc
      .font("Helvetica")
      .fontSize(11)
      .text("Assinatura do filiado (via meio eletrônico):")
      .moveDown(3);

    doc
      .fontSize(8)
      .fillColor("#888")
      .text(
        `IP de origem: ${dados.ip} | User-Agent: ${dados.userAgent} | CPF: ${dados.cpf}`
      );

    doc.end();
  });
}

module.exports = {
  gerarPdfFichaFiliacao,
};
