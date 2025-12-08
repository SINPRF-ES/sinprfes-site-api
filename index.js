// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { enviarEmailFichaFiliacao } = require("./utils/email");
const { gerarPdfFichaFiliacao } = require("./utils/pdf");

const pool = require('./db');
const auth = require('./auth');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------
// Funções utilitárias
// ------------------------------------------------------

function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.replace(/\D/g, '');
}

function parseDataNascimento(texto) {
  if (!texto) return null;

  if (texto.includes('/')) {
    const [d, m, a] = texto.split('/');
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return texto;
}

// ------------------------------------------------------
// PDF – Ficha de filiação
// ------------------------------------------------------

function gerarPdfFichaFiliacao(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('FICHA DE FILIAÇÃO', { align: 'center' }).moveDown(0.3);
    doc.fontSize(14).text(
      'SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo',
      { align: 'center' }
    ).moveDown(1);

    doc.fontSize(10)
      .text(`Data da solicitação: ${new Date(dados.data_solicitacao).toLocaleString('pt-BR')}`)
      .moveDown(1);

    const linha = (label, v) => {
      doc.font('Helvetica-Bold').text(label, { continued: true });
      doc.font('Helvetica').text(` ${v || ''}`);
    };

    doc.fontSize(12).text('DADOS PESSOAIS', { underline: true }).moveDown(0.5);

    linha('Nome completo:', dados.nome);
    linha('CPF:', dados.cpf);
    linha('Data de nascimento:', dados.data_nascimento);
    linha('Telefone principal:', dados.telefone1);
    linha('Telefone adicional:', dados.telefone2 || '-');
    linha('E-mail principal:', dados.email2);
    linha('E-mail funcional:', dados.email1 || '-');

    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').text('Endereço completo:');
    doc.font('Helvetica').text(dados.endereco).moveDown(1);

    doc.font('Helvetica-Bold').text('Declaração:').moveDown(0.3);
    doc.font('Helvetica').fontSize(11).text(
      'Declaro, para todos os fins, que as informações aqui prestadas são verdadeiras e que ' +
      'autorizo o tratamento dos meus dados pessoais pelo SINPRF-ES para fins sindicais.',
      { align: 'justify' }
    ).moveDown(2);

    doc.font('Helvetica').fontSize(11)
      .text('Assinatura do filiado (via meio eletrônico):').moveDown(3);

    doc.fontSize(8).fillColor('#888')
      .text(`IP de origem: ${dados.ip} | User-Agent: ${dados.userAgent} | CPF: ${dados.cpf}`);

    doc.end();
  });
}

// ------------------------------------------------------
// Envio de e-mail
// ------------------------------------------------------

async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO_FILIACAO,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO_FILIACAO) {
    console.log("⚠ SMTP não configurado. Ignorando envio.");
    return;
  }

  const portNumber = Number(SMTP_PORT) || 587;
  const isSecure = portNumber === 465;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: portNumber,
    secure: isSecure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    socketTimeout: 20000,
  });

  const mailOptions = {
    from: MAIL_FROM || SMTP_USER,
    to: MAIL_TO_FILIACAO,
    subject: `Nova solicitação de filiação – ${dados.nome} (${dados.cpf})`,
    text:
      `Nova solicitação de filiação.\n\n` +
      `Nome: ${dados.nome}\nCPF: ${dados.cpf}\nE-mail pessoal: ${dados.email2}\n` +
      `Telefone: ${dados.telefone1}\nSIAPE: ${dados.siape}\nLotação: ${dados.lotacao}\n`,
    attachments: [
      { filename: 'ficha_filiacao.pdf', content: pdfBuffer }
    ]
  };

  return transporter.sendMail(mailOptions)
    .then(info => console.log("📧 Enviado:", info.messageId))
    .catch(err => {
      console.error("💥 Erro no envio:", err);
      throw err;
    });
}

// ======================================================
// ROTA – Solicitação de filiação (filiese.html)
// ======================================================

app.post("/api/filiese", async (req, res) => {
  try {
    const {
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      aceite_estatuto,
      aceite_lgpd,
    } = req.body || {};

    // 🔎 Validações
    if (!nome || !cpf || !data_nascimento || !telefone1 || !email1 || !endereco) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
    }

    if (!aceite_estatuto || !aceite_lgpd) {
      return res.status(400).json({
        error: "Você deve aceitar o Estatuto e a LGPD para continuar.",
      });
    }

    const dados = {
      nome: nome.trim(),
      cpf: cpf.trim(),
      data_nascimento,
      telefone1,
      telefone2: telefone2 || "",
      email1,
      email2: email2 || "",
      endereco,
      data_solicitacao: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "",
    };

    console.log("📥 Nova solicitação de filiação recebida:", {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email1,
    });

    // ----------- Geração do PDF -----------
    const pdfBuffer = await gerarPdfFichaFiliacao(dados);

    // ----------- Envio do e-mail -----------
    await enviarEmailFichaFiliacao(dados, pdfBuffer);

    return res.json({
      message: "Solicitação enviada! Sua ficha foi enviada ao SINPRF-ES.",
    });
  } catch (err) {
    console.error("💥 Erro em /api/filiese:", err);
    return res.status(500).json({
      error: "Erro interno ao processar sua solicitação.",
    });
  }
});


    const pdfBuffer = await gerarPdfFichaFiliacao(normalizados);
    await enviarEmailFichaFiliacao(normalizados, pdfBuffer);

    return res.json({ message: "Solicitação enviada com sucesso." });

  } catch (err) {
    console.error("❌ ERRO FILIAÇÃO:", err);
    return res.status(500).json({ error: "Erro interno.", details: err.message });
  }
});

// ------------------------------------------------------
// Health check
// ------------------------------------------------------
app.get('/health', (_, res) => res.json({ status: "ok" }));

// ------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("Rodando...")
);
