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
// PDF de Filiação (mantido – ajuste só se você quiser mudar layout)
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
// PDF de Ressarcimento (NOVO LAYOUT, sem sumário de anexos)
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

  // 🟢 CORREÇÃO: Removido loop que cria páginas de título (intro)
  // O código agora insere o conteúdo do anexo direto
  for (const anexo of anexos) {
    try {
      const buffer = await fs.readFile(anexo.path);
      const mime = anexo.mimetype || "";
      const nome = anexo.originalname || "";

      // Aqui estava o código da página "intro". Foi removido.

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

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

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
    doc.moveDown(1);

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

module.exports = {
  gerarPdfFichaFiliacao,
  gerarPdfRessarcimento,
  gerarPdfRelatorioAssembleia,
};