const PDFDocument = require("pdfkit");

/**
 * Gera a ficha de filiação em PDF a partir dos dados enviados no formulário.
 * Retorna um Buffer pronto para anexar no e-mail.
 */
function gerarPdfFichaFiliacao(dados) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // ----------- Cabeçalho -----------
      doc.fontSize(20).text("SINPRF-ES", { align: "center" });
      doc.moveDown();
      doc.fontSize(14).text("Ficha de Solicitação de Filiação", { align: "center" });
      doc.moveDown(2);

      // ----------- Dados enviados -----------
      doc.fontSize(12);

      for (const [campo, valor] of Object.entries(dados)) {
        doc.text(`${campo}: ${valor !== "" ? valor : "-"}`);
      }

      doc.moveDown(2);
      doc.text("Documento gerado automaticamente pelo sistema SINPRF-ES.");

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarPdfFichaFiliacao };
