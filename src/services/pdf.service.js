// src/services/pdf.service.js
// Serviço de geração de PDFs para Filiação e Ressarcimento
// com layout institucional do SINPRF-ES.

const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");
const { PDFDocument: PDFLibDocument } = require("pdf-lib");
const QRCode = require("qrcode");
const crypto = require("crypto");

// Caminho do logo (brasão) - ajuste se necessário no seu projeto
const LOGO_PATH = path.join(__dirname, "../assets/Logo_ES_semfundo.png");

// URL base para verificação de documentos via QR Code
const QR_BASE_URL =
  process.env.QR_VERIFICATION_URL || "https://sinprfes.org.br/verificar";

// ------------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------------

function linha(doc) {
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#cccccc")
    .stroke()
    .moveDown(0.5);
}

// Sanitiza texto para evitar caracteres que o pdf-lib não consegue codificar
function sanitizeForPdf(text) {
  if (!text) return "";
  let s = String(text);

  const replacements = {
    "\u2013": "-", // –  EN DASH
    "\u2014": "-", // —  EM DASH
    "\u2018": "'", // ‘
    "\u2019": "'", // ’
    "\u201c": '"', // “
    "\u201d": '"', // ” 
    "\u2022": "-", // •
    "\u00a0": " ", // NBSP (espaço não quebrável)
  };

  s = s.replace(
    /[\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u00a0]/g,
    (ch) => replacements[ch] || " "
  );

  // Mantém:
  //  - \n e \r
  //  - caracteres visíveis ASCII (32–126)
  //  - acentos comuns em Latin-1 (160–255)
  // Remove faixa 127–159 (onde está o 0x83) e demais estranhos.
  s = s
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 10 || code === 13) return true; // \n \r
      if (code >= 32 && code <= 126) return true;  // ASCII básico
      if (code >= 160 && code <= 255) return true; // Latin-1 acentuado
      return false;
    })
    .join("");

  return s;
}

function gerarCodigoVerificacao(dados, tipo) {
  if (dados.codigoVerificacao) return dados.codigoVerificacao;

  const base = [
    tipo || "DOC",
    dados.id_filiado || "",
    dados.cpf || "",
    dados.criadoEm || new Date().toISOString(),
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
}

async function carregarLogoBuffer() {
  try {
    const buf = await fs.readFile(LOGO_PATH);
    return buf;
  } catch (err) {
    console.warn("⚠ Não foi possível carregar o logo em", LOGO_PATH);
    return null;
  }
}

async function gerarQrBuffer(url) {
  try {
    const buf = await QRCode.toBuffer(url, {
      type: "png",
      width: 120,
      margin: 1,
    });
    return buf;
  } catch (err) {
    console.warn("⚠ Não foi possível gerar QRCode:", err.message);
    return null;
  }
}

// Aplica cabeçalho, marca d'água, numeração, carimbo e QR code
async function aplicarLayoutInstitucional(pdfBuffer, options = {}) {
  const { codigoVerificacao, tipoDocumento } = options;

  const docPdf = await PDFLibDocument.load(pdfBuffer);
  const pages = docPdf.getPages();
  const total = pages.length;

  const logoBuffer = await carregarLogoBuffer();
  const urlBase = QR_BASE_URL.replace(/\/$/, "");
  const verUrl = `${urlBase}/${codigoVerificacao}`;
  const qrBuffer = await gerarQrBuffer(verUrl);

  let logoImage = null;
  let qrImage = null;

  if (logoBuffer) {
    logoImage = await docPdf.embedPng(logoBuffer);
  }
  if (qrBuffer) {
    qrImage = await docPdf.embedPng(qrBuffer);
  }

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const margin = 40;

    // Marca d'água (brasão grande e translúcido)
    if (logoImage) {
      const wmScale = Math.min(
        (width * 0.4) / logoImage.width,
        (height * 0.4) / logoImage.height
      );
      const wmWidth = logoImage.width * wmScale;
      const wmHeight = logoImage.height * wmScale;

      page.drawImage(logoImage, {
        x: (width - wmWidth) / 2,
        y: (height - wmHeight) / 2,
        width: wmWidth,
        height: wmHeight,
        opacity: 0.07,
      });
    }

    // Linha de topo de cabecalho (mesmo nivel para logo e QR)
    let headerTopY = height - margin;

    // Cabecalho com brasao pequeno no topo esquerdo
    let logoHeight = 0;
    if (logoImage) {
      const logoWidth = 50;
      logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      const logoY = headerTopY - logoHeight; // topo do logo = headerTopY

      page.drawImage(logoImage, {
        x: margin,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    }

    // Titulo institucional (apenas 1a pagina)
    if (idx === 0) {
      const title1 = "Sindicato dos Policiais Rodoviarios Federais";
      const title2 = "no Estado do Espirito Santo";
      const subtitle = "Fundado em 28 de marco de 1992";
      const cnpj = "CNPJ nº 39.387.378/0001-25";

      const baseY = height - margin - 20;

      page.drawText(sanitizeForPdf(title1), {
        x: margin + 60,
        y: baseY,
        size: 10,
      });
      page.drawText(sanitizeForPdf(title2), {
        x: margin + 60,
        y: baseY - 12,
        size: 10,
      });
      page.drawText(sanitizeForPdf(subtitle), {
        x: margin + 60,
        y: baseY - 26,
        size: 9,
      });
      page.drawText(sanitizeForPdf(cnpj), {
        x: margin + 60,
        y: baseY - 40,
        size: 9,
      });
    }

    // Rodapé com informações de contato (sem travessão unicode)
    const footerLines = [
      "Sede: Av. Nair de Azevedo Silva, 450, salas 14/20, Ed. Shopping Center Vitoria, Mario Cypreste, Vitoria/ES - CEP: 29.020-170",
      "Sitio eletronico: www.sinprfes.org.br    |    Email: sinprfes@sinprfes.org.br    |    Telefones: (27) 99607-3073 / 99691-9312",
    ];
    const footerY = margin + 18;

    footerLines.forEach((line, i) => {
      page.drawText(sanitizeForPdf(line), {
        x: margin,
        y: footerY + i * 10,
        size: 7,
      });
    });

    // Numeração de páginas
    const pageNumText = sanitizeForPdf(`Pagina ${idx + 1} de ${total}`);
    page.drawText(pageNumText, {
      x: width / 2 - pageNumText.length * 3,
      y: margin - 4,
      size: 8,
    });

    // Carimbo institucional
    const carimbo = "Processado via SINPRF-ES";
    page.drawText(sanitizeForPdf(carimbo), {
      x: width - margin - 130,
      y: margin - 4,
      size: 8,
    });

    // QR code e codigo de verificacao apenas na primeira pagina
    if (idx === 0 && qrImage) {
      const qrSize = 70;

      // Margem fixa à direita e topo alinhado ao topo do logo
      const qrX = width - margin - qrSize;   // encostado na margem direita
      const qrTopY = headerTopY;             // mesmo topo do cabecalho/logo
      const qrY = qrTopY - qrSize;           // pdf-lib usa coordenada da base

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      const label = tipoDocumento || "Documento";

      // Textos de verificacao logo abaixo do QR, alinhados à esquerda do QR
      const textX = qrX - 160;
      let textY = qrY - 14; // começa logo abaixo da imagem

      page.drawText("Verificacao:", {
        x: textX,
        y: textY,
        size: 8,
      });

      textY -= 12;
      page.drawText(
        sanitizeForPdf(`${label} - codigo: ${codigoVerificacao}`),
        {
          x: textX,
          y: textY,
          size: 8,
        }
      );

      textY -= 12;
      page.drawText(sanitizeForPdf(verUrl), {
        x: textX,
        y: textY,
        size: 8,
      });
    }

  });

  const finalBytes = await docPdf.save();
  return Buffer.from(finalBytes);
}

// ------------------------------------------------------------------
// 1) Ficha de Filiação
// ------------------------------------------------------------------
function gerarPdfFichaFiliacao(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const codigo = gerarCodigoVerificacao(dados, "FILIACAO");
        const finalBuffer = await aplicarLayoutInstitucional(buffer, {
          codigoVerificacao: codigo,
          tipoDocumento: "Ficha de Filiacao",
        });
        resolve(finalBuffer);
      } catch (err) {
        reject(err);
      }
    });
    doc.on("error", reject);

    // ---------------- Conteudo principal ----------------
    // Move um pouco para baixo para nao brigar com o cabecalho institucional
    doc.moveDown(2);

    doc.font("Helvetica-Bold").fontSize(16).text("Ficha de Filiacao", {
      align: "center",
    });
    doc.moveDown(1);

    linha(doc);

    // Dados basicos do servidor
    doc.font("Helvetica-Bold").fontSize(12).text("Dados do servidor:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);

    const nome = sanitizeForPdf(dados.nome || "");
    const cpf = sanitizeForPdf(dados.cpf || "");
    const matricula =
      sanitizeForPdf(dados.matricula || dados.siape || "");
    const lotacao = sanitizeForPdf(dados.lotacao || "");

    doc.text(`Nome: ${nome}`).moveDown(0.2);
    doc.text(`CPF: ${cpf}`).moveDown(0.2);
    doc.text(`Matricula SIAPE: ${matricula}`).moveDown(0.2);
    if (lotacao) {
      doc.text(`Lotacao: ${lotacao}`).moveDown(0.8);
    } else {
      doc.moveDown(0.6);
    }

    linha(doc);

    // Orientacoes para assinatura via Gov.br
    doc.font("Helvetica-Bold").fontSize(12).text("Orientacoes para assinatura e envio:");
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(11).text(
      "Este documento foi gerado a partir dos dados informados no formulario eletronico de filiacao ao SINPRF-ES.",
      { align: "justify" }
    );
    doc.moveDown(0.5);

    doc.text(
      "Para concluir o processo de filiacao, o(a) servidor(a) devera:",
      { align: "justify" }
    );
    doc.moveDown(0.5);

    doc.text(
      "1) Acessar o portal de assinatura eletronica do Gov.br (https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica);",
      { align: "justify" }
    );
    doc.moveDown(0.3);

    doc.text(
      "2) Assinar eletronicamente este PDF;",
      { align: "justify" }
    );
    doc.moveDown(0.3);

    doc.text(
      "3) Encaminhar o documento assinado para o e-mail sinprfes@sinprfes.org.br.",
      { align: "justify" }
    );
    doc.moveDown(1);

    linha(doc);

    doc.font("Helvetica").fontSize(10).text(
      "As informacoes completas prestadas no formulario online foram recebidas e registradas nos sistemas internos do SINPRF-ES.",
      { align: "justify" }
    );
    doc.moveDown(1);

    linha(doc);

    // Rodape tecnico com IP / User-Agent
    const ip = dados.ip || "-";
    const ua = dados.userAgent || "-";
    const cpfLog = dados.cpf || "-";

    doc
      .fontSize(8)
      .fillColor("#666")
      .text(
        sanitizeForPdf(
          `IP de origem: ${ip}  |  User-Agent: ${ua}  |  CPF: ${cpfLog}`
        )
      );

    doc.end();
  });
}

// ------------------------------------------------------------------
// 2) Pedido de Ressarcimento (com anexos incorporados)
// ------------------------------------------------------------------
async function gerarPdfRessarcimento(dados, anexos = []) {
  const codigo = gerarCodigoVerificacao(dados, "RESSARCIMENTO");

  // 1) Gera o PDF principal com PDFKit
  const pdfPrincipalBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Titulo
    // Move um pouco para baixo para nao brigar com o cabecalho institucional
    doc.moveDown(2);

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Pedido de Ressarcimento", {
        align: "center",
      });
    doc.moveDown(1);

    linha(doc);

    // Dados do filiado
    doc.font("Helvetica-Bold").fontSize(12).text("Dados do Filiado:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Nome: ${dados.nome || ""}`);
    doc.text(`CPF: ${dados.cpf || ""}`);
    doc.text(`Telefone: ${dados.telefone_contato || ""}`);
    doc.text(`E-mail: ${dados.email_destino || ""}`);
    doc.moveDown(1);

    linha(doc);

    // Atividade
    doc.font("Helvetica-Bold").fontSize(12).text("Dados da Atividade:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Periodo: ${dados.data_inicio || ""} a ${dados.data_fim || ""}`);
    doc.text(`Local: ${dados.local || ""}`);
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("Descricao:");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).text(dados.descricao || "", {
      align: "justify",
    });
    doc.moveDown(1);

    linha(doc);

    // Quadro financeiro
    const diarias = parseFloat(dados.diarias || 0);
    const valorDiarias = parseFloat(dados.valor_diarias || 0);
    const km = parseFloat(dados.km_total || 0);
    const valorKm = parseFloat(dados.valor_km || 0);
    const valorOutros = parseFloat(dados.valor_outros || 0);
    const valorTotal = parseFloat(dados.valor_total || 0);

    doc.font("Helvetica-Bold").fontSize(12).text("Resumo Financeiro:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);

    doc.text(
      `• Diarias: ${diarias.toFixed(1)} x R$ 500,00 = R$ ${valorDiarias.toFixed(
        2
      )}`
    );
    doc.text(
      `• Km rodado: ${km.toFixed(1)} km x R$ 1,50 = R$ ${valorKm.toFixed(2)}`
    );
    doc.text(`• Outros gastos: R$ ${valorOutros.toFixed(2)}`);
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .text(`TOTAL SOLICITADO: R$ ${valorTotal.toFixed(2)}`, {
        underline: true,
      })
      .moveDown(1);

    // Detalhamento dos outros gastos
    if (dados.descricao_outros) {
      doc.font("Helvetica-Bold").text("Detalhamento dos Outros Gastos:");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).text(dados.descricao_outros, {
        align: "justify",
      });
      doc.moveDown(1);
    }

    linha(doc);

    // Dados bancários
    if (dados.banco || dados.agencia || dados.conta || dados.pix) {
      doc.font("Helvetica-Bold").fontSize(12).text("Dados Bancarios:");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(11);

      doc.text(
        `Banco: ${dados.banco || "-"}   |   Agencia: ${
          dados.agencia || "-"
        }   |   Conta: ${dados.conta || "-"}`
      );
      if (dados.pix) {
        doc.text(`Chave PIX: ${dados.pix}`);
      }
      doc.moveDown(1);

      linha(doc);
    }

    // Declarações
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        "Declaro, para os devidos fins, que as informacoes prestadas sao verdadeiras e que as despesas informadas decorrem de atividade sindical, conforme Resolucao nº 01/2025 do SINPRF/ES.",
        { align: "justify" }
      );
    doc.moveDown(0.8);

    doc.text(
      "Assinado eletronicamente mediante uso de login e senha pessoais na plataforma do SINPRF/ES, nos termos do art. 10, § 2o, da Medida Provisoria nº 2.200-2/2001 e da Resolucao nº 01/2025.",
      { align: "justify" }
    );
    doc.moveDown(1);

    linha(doc);

    doc
      .fontSize(8)
      .fillColor("#666")
      .text(
        `IP de origem: ${dados.ip || "-"}  |  User-Agent: ${
          dados.userAgent || "-"
        }  |  CPF: ${dados.cpf || "-"}`
      );

    doc.end();
  });

  // 2) Se não houver anexos, apenas aplica layout institucional e retorna
  if (!anexos.length) {
    return await aplicarLayoutInstitucional(pdfPrincipalBuffer, {
      codigoVerificacao: codigo,
      tipoDocumento: "Pedido de Ressarcimento",
    });
  }

  // 3) Se houver anexos, incorpora-os usando pdf-lib
  const pdfDoc = await PDFLibDocument.load(pdfPrincipalBuffer);

  // Página de sumário dos anexos
  const sumarioPage = pdfDoc.addPage();
  const { width: sw, height: sh } = sumarioPage.getSize();
  let y = sh - 80;

  sumarioPage.drawText("SUMARIO DOS ANEXOS", {
    x: 70,
    y,
    size: 14,
  });
  y -= 30;

  anexos.forEach((anexo, idx) => {
    const nome = anexo.originalname || `Anexo ${idx + 1}`;
    const linhaTexto = `${String(idx + 1).padStart(2, "0")} - ${nome}`;
    sumarioPage.drawText(sanitizeForPdf(linhaTexto), {
      x: 70,
      y,
      size: 10,
    });
    y -= 16;
  });

  // Incorporação de cada anexo
  let contador = 1;
  for (const anexo of anexos) {
    try {
      const buffer = await fs.readFile(anexo.path);
      const mime = anexo.mimetype || "";
      const nome = anexo.originalname || `Anexo ${contador}`;

      // Página de abertura do anexo
      const intro = pdfDoc.addPage();
      const { width, height } = intro.getSize();
      intro.drawText(`Anexo ${contador}`, {
        x: 70,
        y: height - 80,
        size: 14,
      });
      intro.drawText(sanitizeForPdf(nome), {
        x: 70,
        y: height - 100,
        size: 10,
      });

      if (mime === "application/pdf" || nome.toLowerCase().endsWith(".pdf")) {
        const pdfAnexo = await PDFLibDocument.load(buffer);
        const pages = await pdfDoc.copyPages(
          pdfAnexo,
          pdfAnexo.getPageIndices()
        );
        pages.forEach((p) => pdfDoc.addPage(p));
      } else if (mime.startsWith("image/")) {
        const page = pdfDoc.addPage();
        const { width: pw, height: ph } = page.getSize();
        let img;

        if (mime.includes("jpeg") || mime.includes("jpg")) {
          img = await pdfDoc.embedJpg(buffer);
        } else {
          img = await pdfDoc.embedPng(buffer);
        }

        const iw = img.width;
        const ih = img.height;
        const scale = Math.min((pw * 0.9) / iw, (ph * 0.9) / ih);
        const w = iw * scale;
        const h = ih * scale;

        page.drawImage(img, {
          x: (pw - w) / 2,
          y: (ph - h) / 2,
          width: w,
          height: h,
        });
      }

      contador++;
    } catch (err) {
      console.error("⚠ Erro ao incorporar anexo no PDF:", anexo, err);
    }
  }

  const mergedBuffer = Buffer.from(await pdfDoc.save());

  // 4) Aplica layout institucional (marca d'água, QR, numeração, etc.)
  return await aplicarLayoutInstitucional(mergedBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Pedido de Ressarcimento",
  });
}

module.exports = {
  gerarPdfFichaFiliacao,
  gerarPdfRessarcimento,
};
