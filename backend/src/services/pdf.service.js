// src/services/pdf.service.js
// Serviço de geração de PDFs para Filiação e Ressarcimento
// com layout institucional do SINPRF-ES.

const PDFDocument = require("pdfkit");
const fs = require("fs").promises;
const path = require("path");
const { PDFDocument: PDFLibDocument } = require("pdf-lib");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { formatarCPF, formatarTelefone, formatarDataBR, formatarAgencia, formatarConta } = require("../utils/format");
const { labelFromParentesco } = require('../../../shared/dependentes/parentesco');

// Caminho do logo (brasão) - ajuste se necessário no seu projeto
const LOGO_PATH = path.join(__dirname, "../assets/Logo_ES_semfundo.png");

// URL base para verificação de documentos via QR Code
const QR_BASE_URL =
  process.env.QR_VERIFICATION_URL || "https://sinprfes.org.br/verificar";

// ------------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------------

/**
 * Garante que existe espaço na página para o conteúdo. Se não houver, adiciona nova página.
 * @returns {boolean} True se uma nova página foi adicionada.
 */
function ensureSpace(doc, neededHeight) {
    const bottomMargin = doc.page.margins.bottom || 70;
    if (doc.y + neededHeight > doc.page.height - bottomMargin - 10) {
        doc.addPage();
        doc.moveDown(2);
        return true;
    }
    return false;
}

/**
 * Renderiza blocos de Sexo e Faixa Etária.
 */
function drawDistribuicoes(doc, dados, options = {}) {
    const { isVeterano = false, isPensionista = false } = options;

    ensureSpace(doc, 60);
    doc.font("Helvetica-Bold").fontSize(12).text("Distribuição por Sexo:", { align: 'left' });
    doc.font("Helvetica").fontSize(11);
    doc.text(`Masculino: ${dados.masc}`, { align: 'left' });
    doc.text(`Feminino: ${dados.fem}`, { align: 'left' });
    doc.moveDown(1);

    if (!isPensionista) {
        ensureSpace(doc, 100);
        doc.font("Helvetica-Bold").fontSize(12).text("Distribuição por Faixa Etária:", { align: 'left' });
        doc.font("Helvetica").fontSize(11);
        if (isVeterano) {
            doc.text(`50-59 anos: ${dados.range_50_59}`, { align: 'left' });
            doc.text(`60-69 anos: ${dados.range_60_69}`, { align: 'left' });
            doc.text(`70-79 anos: ${dados.range_70_79}`, { align: 'left' });
            doc.text(`80+ anos: ${dados.range_80_plus}`, { align: 'left' });
        } else {
            doc.text(`20-29 anos: ${dados.range_20_29}`, { align: 'left' });
            doc.text(`30-39 anos: ${dados.range_30_39}`, { align: 'left' });
            doc.text(`40-49 anos: ${dados.range_40_49}`, { align: 'left' });
            doc.text(`50-59 anos: ${dados.range_50_59}`, { align: 'left' });
            doc.text(`60+ anos: ${dados.range_60_plus}`, { align: 'left' });
        }
        doc.text(`Idade desconhecida: ${dados.idade_desconhecida}`, { align: 'left' });
        doc.moveDown(1);
    }
}

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
    "\u2013": "-", // EN DASH
    "\u2014": "-", // EM DASH
    "\u2018": "'", // left single quotation mark
    "\u2019": "'", // right single quotation mark
    "\u201C": '"', // left double quotation mark
    "\u201D": '"', // right double quotation mark
    "\u00A0": " ", // NO-BREAK SPACE
  };

  s = s.replace(/[\u2013\u2014\u2018\u2019\u201C\u201D\u00A0]/g, (c) => {
    return replacements[c] || c;
  });

  // Substitui quaisquer caracteres fora do BMP (emojis etc.)
  s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, " ");
  return s;
}

/**
 * Formata data de forma amigável para o PDF.
 */
function formatDateSafe(val) {
    if (!val) return "Não informada";
    const formatted = formatarDataBR(val);
    // Se o formatarDataBR retornou algo inválido (não contém /), tenta fallback
    if (!formatted || (typeof formatted === 'string' && !formatted.includes('/'))) {
        return "Não informada";
    }
    return formatted;
}

/**
 * Desenha uma tabela com suporte a paginação automática e repetição de cabeçalho.
 */
function drawTableWithPagination(doc, options) {
    const {
        headers,
        rows,
        colWidths = [159, 68, 68, 68, 92], // 35%, 15%, 15%, 15%, 20% de 455 (B2.1)
        rowHeight = 22,
        headerHeight = 22,
        startX = doc.page.margins.left,
        fontSize = 7 // Levemente menor que o texto normal (B2.3)
    } = options;

    const drawHeader = (y) => {
        doc.font("Helvetica-Bold").fontSize(fontSize);
        headers.forEach((h, i) => {
            const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.rect(x, y, colWidths[i], headerHeight).fillAndStroke("#eeeeee", "#333333");
            // Centralizado horizontalmente via width + align (B2.2)
            doc.fillColor("#000").text(h, x, y + (headerHeight / 2) - (fontSize / 2) + 0.5, {
                width: colWidths[i],
                align: 'center',
                lineBreak: false
            });
        });
        return y + headerHeight;
    };

    let currentY = doc.y;

    // Checa espaço para pelo menos o header + 1 linha
    if (ensureSpace(doc, headerHeight + rowHeight)) {
        currentY = doc.y;
    }

    currentY = drawHeader(currentY);

    rows.forEach((row) => {
        // Se mudar de página, redesenha o header (B3)
        if (ensureSpace(doc, rowHeight)) {
            currentY = doc.y;
            currentY = drawHeader(currentY);
        }

        row.forEach((text, i) => {
            const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            const padding = 6; // (B2.3)

            doc.lineWidth(0.5).strokeColor("#333333");
            doc.rect(x, currentY, colWidths[i], rowHeight).stroke();

            doc.font("Helvetica").fontSize(fontSize);

            // Truncamento robusto para TODAS as colunas (B2.2)
            let val = String(text || "");
            const maxWidth = colWidths[i] - (padding * 2);
            if (doc.widthOfString(val) > maxWidth) {
                while (doc.widthOfString(val + "...") > maxWidth && val.length > 0) {
                    val = val.slice(0, -1);
                }
                val += "...";
            }

            // Centralizado horizontal e verticalmente (B2.2)
            doc.text(val, x, currentY + (rowHeight / 2) - (fontSize / 2) + 0.5, {
                width: colWidths[i],
                align: "center",
                lineBreak: false
            });
        });

        currentY += rowHeight;
    });

    // Reset de estado pós-tabela para evitar vazamento de alinhamento/posicionamento (B4)
    doc.x = doc.page.margins.left;
    doc.y = currentY;
    doc.fillColor("#000");
    doc.font("Helvetica").fontSize(11);
}

/**
 * Humaniza o parentesco para o PDF.
 */
function humanizeParentesco(val) {
    if (!val) return "Dependente";
    const label = labelFromParentesco(val);
    if (label === 'Outro' && val !== 'OUTRO' && val !== 'Outro') {
        // Fallback: SNAKE_CASE para Title Case
        return val.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return label;
}

// Carrega o logo como buffer (para pdf-lib)
async function carregarLogoBuffer() {
  try {
    const data = await fs.readFile(LOGO_PATH);
    return data;
  } catch (err) {
    console.error("Erro ao carregar logo para PDF:", err);
    return null;
  }
}

// Gera buffer de QR Code (PNG) a partir de uma string (URL)
async function gerarQrBuffer(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, { margin: 1 });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return Buffer.from(base64, "base64");
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    return null;
  }
}

// Gera um código de verificação simples, baseado em hash
function gerarCodigoVerificacao(dados, tipo) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(dados) + tipo + Date.now().toString())
    .digest("hex");
  return hash.slice(0, 12).toUpperCase();
}

// ------------------------------------------------------------------
// Layout institucional com pdf-lib (aplicado após gerar o PDF principal)
// ------------------------------------------------------------------

// Aplica cabeçalho/rodapé, marca d'água e QR code
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

    // Marca d'água (brasão grande e translúcido) em TODAS as páginas
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

    const headerTopY = height - margin;

    // Logo pequeno + cabeçalho institucional apenas na primeira página
    let logoHeight = 0;
    if (idx === 0 && logoImage) {
      const logoWidth = 50;
      logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      const logoY = headerTopY - logoHeight;

      page.drawImage(logoImage, {
        x: margin,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    }

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

    // Rodapé com informações de contato
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

    // QR code e código de verificação apenas na primeira página
    if (idx === 0 && qrImage) {
      const qrSize = 70;
      const qrX = width - margin - qrSize;
      const qrY = headerTopY - qrSize;

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      const label = tipoDocumento || "Documento";
      const textX = qrX - 160;
      let textY = qrY - 14;

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
// PDF de Filiação
// ------------------------------------------------------------------

async function gerarPdfFichaFiliacao(dados) {
  const codigo = gerarCodigoVerificacao(dados, "FILIACAO");

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Conteúdo da ficha de filiação (mantido do seu projeto original)

    doc.moveDown(2);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Ficha de Filiação", { align: "center" });
    doc.moveDown(1);

    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        "Eu, abaixo assinado(a), venho por meio desta, requerer minha filiação ao Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo – SINPRF/ES, autorizando o desconto em folha da contribuição sindical, conforme legislação vigente e normas internas da entidade.",
        { align: "justify" }
      );
    doc.moveDown(1);

    linha(doc);

    doc.font("Helvetica-Bold").fontSize(12).text("Dados do Filiado:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);

    doc.text(`Nome: ${dados.nome || ""}`);
    doc.text(`CPF: ${dados.cpf || ""}`);
    doc.text(`Matrícula: ${dados.matricula || ""}`);
    doc.text(`Lotação: ${dados.lotacao || ""}`);
    doc.text(`E-mail: ${dados.email || ""}`);
    doc.text(`Telefone 1: ${dados.telefone1 || ""}`);
    doc.text(`Telefone 2: ${dados.telefone2 || ""}`);
    doc.moveDown(1);

    linha(doc);

    doc.font("Helvetica-Bold").fontSize(12).text("Endereço Residencial:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);

    doc.text(
      `Endereço: ${dados.logradouro || ""}, nº ${dados.numero || ""} ${
        dados.complemento || ""
      }`
    );
    doc.text(`Bairro: ${dados.bairro || ""}`);
    doc.text(`Cidade: ${dados.cidade || ""} - UF: ${dados.uf || ""}`);
    doc.text(`CEP: ${dados.cep || ""}`);
    doc.moveDown(1);

    linha(doc);

    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        "Declaro estar ciente e de acordo com o Estatuto Social do SINPRF/ES, bem como com as normas internas relativas à contribuição e aos direitos e deveres dos filiados.",
        { align: "justify" }
      );
    doc.moveDown(2);

    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, "0");
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();
    const dataStr = `${dia}/${mes}/${ano}`;

    doc.text(`Vitória/ES, ${dataStr}.`);
    doc.moveDown(3);

    doc.text("_____________________________________________", {
      align: "center",
    });
    doc.text("Assinatura do Filiado", { align: "center" });

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#666")
      .text(
        `Documento gerado eletronicamente. Código de verificação: ${codigo}`
      );

    doc.end();
  });

  return await aplicarLayoutInstitucional(pdfBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Ficha de Filiação",
  });
}

// ------------------------------------------------------------------
// PDF de Ressarcimento
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

    // ---------------- Conteúdo principal ----------------
    doc.moveDown(2);

    // Título
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Pedido de Ressarcimento de Despesas Sindicais", {
        align: "center",
      });
    doc.moveDown(0.8);

    // Breve introdução
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(
        "Este documento foi gerado automaticamente a partir das informacoes registradas na plataforma eletronica do SINPRF-ES e consolida o pedido de ressarcimento de despesas decorrentes de atividade sindical.",
        { align: "justify" }
      );
    doc.moveDown(1);

    linha(doc);

    // Dados do filiado
    doc.font("Helvetica-Bold").fontSize(12).text("Dados do Filiado:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Nome: ${dados.nome || ""}`);
    doc.text(`CPF: ${formatarCPF(dados.cpf)}`);
    doc.text(`Telefone: ${formatarTelefone(dados.telefone_contato)}`);
    doc.text(`E-mail: ${dados.email_destino || ""}`);
    doc.moveDown(1);

    linha(doc);

    // Dados da atividade
    doc.font("Helvetica-Bold").fontSize(12).text("Dados da Atividade:");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Periodo: ${formatarDataBR(dados.data_inicio)} a ${formatarDataBR(dados.data_fim)}`);
    doc.text(`Local: ${dados.local || ""}`);
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("Descricao da atividade:");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).text(dados.descricao || "", {
      align: "justify",
    });
    doc.moveDown(1);

    linha(doc);

    // Resumo financeiro
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
    doc.moveDown(0.6);

    doc
      .font("Helvetica-Bold")
      .text(`TOTAL SOLICITADO: R$ ${valorTotal.toFixed(2)}`, {
        underline: true,
      })
      .moveDown(1);

    // Detalhamento dos outros gastos (se houver)
    if (dados.descricao_outros) {
      doc.font("Helvetica-Bold").text("Detalhamento dos Outros Gastos:");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).text(dados.descricao_outros, {
        align: "justify",
      });
      doc.moveDown(1);

      linha(doc);
    }

    // Dados bancários
    if (dados.banco || dados.agencia || dados.conta || dados.pix) {
      doc.font("Helvetica-Bold").fontSize(12).text("Dados Bancarios:");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(11);

      doc.text(
        `Banco: ${dados.banco || "-"}   |   Agencia: ${
          formatarAgencia(dados.agencia)
        }   |   Conta: ${formatarConta(dados.conta)}`
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
        "Declaro, para os devidos fins, que as informacoes prestadas neste documento sao verdadeiras e que as despesas indicadas decorrem exclusivamente de participacao em atividade sindical organizada ou autorizada pelo SINPRF/ES, em conformidade com a Resolucao nº 01/2025.",
        { align: "justify" }
      );
    doc.moveDown(0.8);

    doc.text(
      "O presente pedido de ressarcimento foi formalizado de maneira eletronica, mediante autenticacao pessoal na plataforma do SINPRF/ES, nos termos do art. 10, § 2o, da Medida Provisoria nº 2.200-2/2001 e da Resolucao nº 01/2025.",
      { align: "justify" }
    );
    doc.moveDown(1);

    linha(doc);

    // Rodapé técnico com IP / User-Agent
    doc
      .fontSize(8)
      .fillColor("#666")
      .text(
        `IP de origem: ${dados.ip || "-"}  |  User-Agent: ${
          dados.userAgent || "-"
        }  |  CPF: ${formatarCPF(dados.cpf) || "-"}`
      );

    doc.end();
  });

  // 2) Se não houver anexos, aplica layout institucional diretamente
  if (!anexos || anexos.length === 0) {
    return await aplicarLayoutInstitucional(pdfPrincipalBuffer, {
      codigoVerificacao: codigo,
      tipoDocumento: "Pedido de Ressarcimento",
    });
  }

  // 3) Se houver anexos, incorpora-os usando pdf-lib (SEM sumário de anexos)
  const pdfDoc = await PDFLibDocument.load(pdfPrincipalBuffer);

  for (const anexo of anexos) {
    try {
      const buffer = await fs.readFile(anexo.path);
      const mime = anexo.mimetype || "";
      const nome = anexo.originalname || "";

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

        // Calcula escala para caber na página (com margem)
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

async function gerarPdfRelatorioAssembleia(dados) {
  const codigo = gerarCodigoVerificacao(dados, "RELATORIO_ASSEMBLEIA");

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Título e Cabeçalho do Relatório
    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(16).text("Relatório de Assembleia", { align: "center" });
    doc.moveDown(0.5);

    // Carimbo de Geração
    if (dados.solicitante) {
        doc.font("Helvetica-Oblique").fontSize(8).fillColor("#666")
           .text(`Solicitado por: ${dados.solicitante.nome} (${dados.solicitante.perfil}) | Gerado em: ${dados.solicitante.data_geracao}`, { align: "center" });
    }
    doc.fillColor("#000").moveDown(1);

    // Dados da Assembleia
    doc.font("Helvetica-Bold").fontSize(12).text("1. Informações Gerais");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Título: ${dados.assembleia.titulo}`);
    doc.text(`Tipo: ${dados.assembleia.tipo}`);
    doc.text(`Data: ${dados.assembleia.data_evento ? new Date(dados.assembleia.data_evento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}`);
    doc.text(`1ª Chamada: ${dados.assembleia.hora_primeira_chamada || '-'}`);
    doc.text(`2ª Chamada: ${dados.assembleia.hora_segunda_chamada || '-'}`);
    doc.text(`Status Final: ${dados.assembleia.estado}`);
    doc.text(`ID da Assembleia: ${dados.assembleia.id}`);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text("Pauta:");
    doc.font("Helvetica").text(dados.assembleia.pauta || "Não informada", { align: "justify" });
    doc.moveDown(1);

    linha(doc);

    // Mesa Diretora
    doc.font("Helvetica-Bold").fontSize(12).text("2. Mesa Diretora");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    if (dados.mesa) {
        doc.text(`Presidente: ${dados.mesa.presidente_nome || '-'}`);
        doc.text(`Secretário: ${dados.mesa.secretario_nome || '-'}`);
    } else {
        doc.text("Mesa não definida.");
    }
    doc.moveDown(1);

    linha(doc);

    // Quórum e Presença
    doc.font("Helvetica-Bold").fontSize(12).text("3. Quórum e Presença");
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold").fontSize(10).text("Resumo de Presença Apurada:");
    doc.font("Helvetica").fontSize(10).text(`Total de presentes (únicos): ${dados.presentes_total || 0}`);
    if (!dados.presentes_total) {
        doc.font("Helvetica-Oblique").fontSize(9).text("(sem registros de check-in)");
    }
    doc.moveDown(1);

    if (dados.quorums && dados.quorums.length > 0) {
        dados.quorums.forEach((q) => {
            const dataHora = new Date(q.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const tipoDesc = q.tipo_chamada === 'PRIMEIRA' ? '1ª Chamada (Qualificado)' : (q.tipo_chamada === 'RECONTAGEM' ? 'Recontagem de Quórum' : '2ª Chamada (Real)');

            doc.font("Helvetica-Bold").fontSize(10).text(`Fase: ${tipoDesc}`);
            doc.font("Helvetica").fontSize(10).text(`Início: ${dataHora} | Token: ${q.token}`);
            doc.text(`Filiados Aptos: ${q.quorum_total_ativos || '-'} | Mínimo Necessário: ${q.quorum_necessario || 'Qualquer número'}`);
            doc.text(`Total de presentes registrados: ${q.presentes?.length || 0}`);

            if (q.presentes && q.presentes.length > 0) {
                doc.font("Helvetica-Oblique").fontSize(9).text("Lista de Presentes nesta fase:");
                const nomes = q.presentes.map(p => p.nome).join(", ");
                doc.font("Helvetica").fontSize(8).text(nomes, { align: "justify" });
            }

            doc.moveDown(0.8);
        });
    } else {
        doc.font("Helvetica").fontSize(10).text("Nenhum registro de quórum.");
    }
    doc.moveDown(1);

    linha(doc);

    // Itens de Votação
    doc.font("Helvetica-Bold").fontSize(12).text("4. Deliberações e Votações");
    doc.moveDown(0.5);
    if (dados.votacoes && dados.votacoes.length > 0) {
        dados.votacoes.forEach((v, idx) => {
            const abertaEm = new Date(v.aberta_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
            const encerradaEm = v.finalizada_em ? new Date(v.finalizada_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }) : '--:--:--';

            doc.font("Helvetica-Bold").fontSize(10).text(`${idx + 1}. ${v.titulo}`);
            doc.font("Helvetica").fontSize(9).text(`Período: ${abertaEm} às ${encerradaEm} | Duração: ${v.duracao_segundos}s`);
            doc.font("Helvetica").fontSize(10).text(`Descrição: ${v.descricao || '-'}`);
            doc.font("Helvetica-Bold").text(`Resultado: SIM: ${v.contagem?.SIM || 0} | NÃO: ${v.contagem?.NAO || 0} | ABSTENÇÃO: ${v.contagem?.ABSTENCAO || 0}`);
            doc.font("Helvetica").text(`Total de votos registrados: ${v.contagem?.total || 0}`);

            if (v.votosNominais && v.votosNominais.length > 0) {
                const nominalStr = v.votosNominais.map(vn => `${vn.nome} (${vn.voto})`).join("; ");
                doc.font("Helvetica-Oblique").fontSize(8).text(`Votos Nominais: ${nominalStr}`, { align: "justify" });
            }

            doc.moveDown(0.8);
        });
    } else {
        doc.font("Helvetica").fontSize(10).text("Nenhum item votado.");
    }

    doc.end();
  });

  return await aplicarLayoutInstitucional(pdfBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Relatório de Assembleia",
  });
}

// ------------------------------------------------------------------
// RELATÓRIOS (NOVO)
// ------------------------------------------------------------------

/**
 * PDF: DOSSIÊ DO FILIADO
 */
async function gerarPdfDossieFiliado(filiado, options = {}) {
  const { podeVerCpf = false } = options;
  const codigo = gerarCodigoVerificacao(filiado, "DOSSIE");

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(16).text("Dossiê do Filiado", { align: "center" });
    doc.moveDown(1);

    // 1. Identificação
    doc.font("Helvetica-Bold").fontSize(12).text("1. Identificação");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Nome: ${filiado.nome || ""}`);
    doc.text(`CPF: ${podeVerCpf ? formatarCPF(filiado.cpf) : "***.***.***-**"}`);
    doc.text(`Matrícula (SIAPE): ${filiado.siape || "-"}`);
    doc.text(`Sexo: ${filiado.sexo === 'M' ? 'Masculino' : (filiado.sexo === 'F' ? 'Feminino' : '-')}`);
    doc.text(`Data de Nascimento: ${formatDateSafe(filiado.data_nascimento)}`);
    doc.moveDown(1);
    linha(doc);

    // 2. Dados Funcionais
    doc.font("Helvetica-Bold").fontSize(12).text("2. Dados Funcionais");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Lotação: ${filiado.lotacao || "SEDE"}`);
    doc.text(`Situação Funcional: ${filiado.situacao || "ATIVO"}`);
    doc.moveDown(1);
    linha(doc);

    // 3. Contatos e Endereço
    doc.font("Helvetica-Bold").fontSize(12).text("3. Contatos e Endereço");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    doc.text(`E-mail 1: ${filiado.email1 || "-"}`);
    doc.text(`E-mail 2: ${filiado.email2 || "-"}`);
    doc.text(`Telefone 1: ${filiado.telefone1 ? formatarTelefone(filiado.telefone1) : "-"}`);
    doc.text(`Telefone 2: ${filiado.telefone2 ? formatarTelefone(filiado.telefone2) : "-"}`);
    doc.moveDown(0.5);
    doc.text(`Endereço: ${filiado.logradouro_bairro || ""}, nº ${filiado.numero || ""} ${filiado.complemento || ""}`);
    doc.text(`Cidade: ${filiado.cidade || ""} - UF: ${filiado.uf || ""} | CEP: ${filiado.cep || ""}`);
    doc.moveDown(1);
    linha(doc);

    // 4. Dependentes
    doc.font("Helvetica-Bold").fontSize(12).text("4. Dependentes");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(11);
    let temDependente = false;
    for (let i = 1; i <= 5; i++) {
        if (filiado[`dep${i}_nome`]) {
            temDependente = true;
            const parentescoLabel = humanizeParentesco(filiado[`dep${i}_parentesco`]);
            doc.text(`${i}. ${filiado[`dep${i}_nome`]} (${parentescoLabel})`);
            doc.text(`   CPF: ${podeVerCpf ? formatarCPF(filiado[`dep${i}_cpf`]) : "***.***.***-**"} | Nasc: ${formatDateSafe(filiado[`dep${i}_data_nascimento`])}`);
        }
    }
    if (!temDependente) doc.text("Nenhum dependente cadastrado.");

    doc.end();
  });

  return await aplicarLayoutInstitucional(pdfBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Dossiê do Filiado",
  });
}

/**
 * PDF: RELATÓRIO ESTATÍSTICO (Lotação, Situação)
 */
async function gerarPdfRelatorioAgregado(dados, titulo) {
  const codigo = gerarCodigoVerificacao(dados, "ESTATISTICO");

  const pdfBuffer = await new Promise((resolve, reject) => {
    const mesesPtBr = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(16).text(titulo, { align: "center" });
    doc.moveDown(1);

    // Bloco "Resumo da Lotação" (LAYOUT TIPO DOSSIÊ - B1)
    if (dados.repasse) {
        doc.font("Helvetica-Bold").fontSize(14).text("Resumo da Lotação");
        doc.moveDown(0.5);

        const r = dados.repasse;
        const comp = r.competencia
            ? `${mesesPtBr[r.competencia.month - 1]}/${r.competencia.year}`
            : "—";
        const hoje = new Date();
        const dataHoje = `${mesesPtBr[hoje.getMonth()]}/${hoje.getFullYear()}`;

        doc.font("Helvetica").fontSize(11);
        doc.text(`Efetivo total: ${r.prfTotal !== null ? String(r.prfTotal) : "Não informado"}`, { align: 'left' });
        doc.text(`Filiados cadastrados: ${r.filiadosAtivos !== null ? String(r.filiadosAtivos) : "—"}`, { align: 'left' });
        doc.text(`Índice de sindicalização: ${r.percentual !== null ? r.percentual.toFixed(2) + "%" : "—"}`, { align: 'left' });
        doc.text(`Base do efetivo: ${comp}`, { align: 'left' });
        doc.text(`Relatório gerado em: ${dataHoje}`, { align: 'left' });

        doc.moveDown(1);
        linha(doc);
    }

    if (!dados.repasse && !dados.repasseBreakdown) {
        doc.font("Helvetica-Bold").fontSize(14).text("Resumo Geral");
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(12);
        doc.text(`Total de filiados: ${dados.total}`);
        doc.moveDown(1);
    } else if (dados.repasseBreakdown) {
        // ESPECIAL: Relatório por Situação ATIVO (LAYOUT TIPO DOSSIÊ - B1)
        doc.font("Helvetica-Bold").fontSize(14).text("Resumo Global do Efetivo (Ativos)");
        doc.moveDown(0.5);

        const totalPrf = dados.repasseBreakdown.reduce((acc, curr) => acc + (curr.prfTotal || 0), 0);
        const totalFiliadosAtivos = dados.repasseBreakdown.reduce((acc, curr) => acc + (curr.filiadosAtivos || 0), 0);
        const percentualGlobal = totalPrf > 0 ? (totalFiliadosAtivos / totalPrf) * 100 : 0;

        doc.font("Helvetica").fontSize(11);
        doc.text(`Efetivo total: ${totalPrf}`, { align: 'left' });
        doc.text(`Filiados cadastrados: ${totalFiliadosAtivos}`, { align: 'left' });
        doc.text(`Índice de sindicalização global: ${percentualGlobal.toFixed(2)}%`, { align: 'left' });
        doc.text(`Base do efetivo: Dados por lotação (ver tabela abaixo)`, { align: 'left' });
        doc.moveDown(1);

        // Tabela por Lotação
        doc.font("Helvetica-Bold").fontSize(12).text("Distribuição por Lotação (Efetivo PRF)");
        doc.moveDown(0.5);

        const headers = ["Lotação", "Efetivo", "Filiados", "%", "Base"];
        const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        const tableRows = dados.repasseBreakdown.map(r => [
            r.lotacao,
            r.prfTotal !== null ? String(r.prfTotal) : "—",
            String(r.filiadosAtivos),
            r.percentual !== null ? r.percentual.toFixed(2) + "%" : "—",
            r.competencia ? `${mesesAbrev[r.competencia.month - 1]}/${String(r.competencia.year).slice(-2)}` : "—"
        ]);

        drawTableWithPagination(doc, {
            headers,
            rows: tableRows,
            rowHeight: 22
        });

        doc.moveDown(1);
        linha(doc);
    }

    drawDistribuicoes(doc, dados);

    doc.end();
  });

  return await aplicarLayoutInstitucional(pdfBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Relatório Estatístico",
  });
}

/**
 * PDF: RELATÓRIO GLOBAL (Completo)
 */
async function gerarPdfRelatorioGlobal(dados) {
  const codigo = gerarCodigoVerificacao(dados, "GLOBAL");

  const pdfBuffer = await new Promise((resolve, reject) => {
    const mesesPtBr = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 140, bottom: 70, left: 70, right: 70 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.moveDown(2);
    doc.font("Helvetica-Bold").fontSize(18).text("Relatório Global SINPRF/ES", { align: "center" });
    doc.moveDown(1);

    // -------------------------------------------------------------------------
    // SEÇÃO 1: ATIVO
    // -------------------------------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#003366").text("1. FILIADOS ATIVOS");
    doc.fillColor("#000").moveDown(0.5);

    const a = dados.ativo;
    const totalPrf = a.repasseBreakdown.reduce((acc, curr) => acc + (curr.prfTotal || 0), 0);
    const totalFiliadosAtivos = a.repasseBreakdown.reduce((acc, curr) => acc + (curr.filiadosAtivos || 0), 0);
    const percentualGlobal = totalPrf > 0 ? (totalFiliadosAtivos / totalPrf) * 100 : 0;

    doc.font("Helvetica").fontSize(11);
    doc.text(`Efetivo total (PRF): ${totalPrf}`, { align: 'left' });
    doc.text(`Filiados ativos: ${totalFiliadosAtivos}`, { align: 'left' });
    doc.text(`Índice de sindicalização global: ${percentualGlobal.toFixed(2)}%`, { align: 'left' });
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Distribuição por Lotação (Ativos)");
    doc.moveDown(0.5);

    const headers = ["Lotação", "Efetivo", "Filiados", "%", "Base"];
    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const tableRows = a.repasseBreakdown.map(r => [
        r.lotacao,
        r.prfTotal !== null ? String(r.prfTotal) : "—",
        String(r.filiadosAtivos),
        r.percentual !== null ? r.percentual.toFixed(2) + "%" : "—",
        r.competencia ? `${mesesAbrev[r.competencia.month - 1]}/${String(r.competencia.year).slice(-2)}` : "—"
    ]);

    drawTableWithPagination(doc, {
        headers,
        rows: tableRows,
        rowHeight: 22
    });

    doc.moveDown(1);
    drawDistribuicoes(doc, a);

    doc.addPage();
    doc.moveDown(2);

    // -------------------------------------------------------------------------
    // SEÇÃO 2: VETERANO
    // -------------------------------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#003366").text("2. VETERANOS");
    doc.fillColor("#000").moveDown(0.5);

    const v = dados.veterano;
    doc.font("Helvetica").fontSize(11).text(`Total de veteranos cadastrados: ${v.total}`);
    doc.moveDown(1);
    drawDistribuicoes(doc, v, { isVeterano: true });
    doc.moveDown(1);

    // -------------------------------------------------------------------------
    // SEÇÃO 3: PENSIONISTA
    // -------------------------------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#003366").text("3. PENSIONISTAS");
    doc.fillColor("#000").moveDown(0.5);

    const p = dados.pensionista;
    doc.font("Helvetica").fontSize(11).text(`Total de pensionistas cadastrados: ${p.total}`);
    doc.moveDown(1);
    drawDistribuicoes(doc, p, { isPensionista: true });

    doc.end();
  });

  return await aplicarLayoutInstitucional(pdfBuffer, {
    codigoVerificacao: codigo,
    tipoDocumento: "Relatório Global",
  });
}

module.exports = {
  gerarPdfFichaFiliacao,
  gerarPdfRessarcimento,
  gerarPdfRelatorioAssembleia,
  gerarPdfDossieFiliado,
  gerarPdfRelatorioAgregado,
  gerarPdfRelatorioGlobal
};
