// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const pool = require('./db');
const auth = require('./auth');

const app = express();

// Middleware para JSON no corpo das requisições
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));


// ------------------------------------------------------
// Funções utilitárias
// ------------------------------------------------------
function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.replace(/\D/g, '');
}

// Converte datas de:
//  - "dd/mm/aaaa" → "aaaa-mm-dd"
//  - "aaaa-mm-dd" → mantém
function parseDataNascimento(texto) {
  if (!texto) return null;

  if (texto.includes('/')) {
    const [dia, mes, ano] = texto.split('/');
    if (!dia || !mes || !ano) return null;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  if (texto.includes('-')) {
    return texto;
  }

  return null;
}

// ======================================================
// UTILITÁRIOS – Ficha de filiação (PDF + envio por e-mail)
// ======================================================

function gerarPdfFichaFiliacao(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Cabeçalho
    doc
      .fontSize(18)
      .text('FICHA DE FILIAÇÃO', { align: 'center' })
      .moveDown(0.3);
    doc
      .fontSize(14)
      .text('SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo', {
        align: 'center',
      })
      .moveDown(1);

    doc
      .fontSize(10)
      .text(`Data da solicitação: ${new Date(dados.data_solicitacao).toLocaleString('pt-BR')}`)
      .moveDown(1);

    doc
      .fontSize(12)
      .text('DADOS PESSOAIS', { underline: true })
      .moveDown(0.5);

    const linha = (label, value) => {
      doc.font('Helvetica-Bold').text(label, { continued: true });
      doc.font('Helvetica').text(` ${value || ''}`);
    };

    linha('Nome completo:', dados.nome);
    linha('CPF:', dados.cpf);
    linha('Data de nascimento:', dados.data_nascimento);
    linha('Telefone principal:', dados.telefone1);
    linha('Telefone adicional:', dados.telefone2 || '-');
    linha('E-mail principal:', dados.email1);
    linha('E-mail adicional:', dados.email2 || '-');

    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').text('Endereço completo:');
    doc.font('Helvetica').text(dados.endereco || '').moveDown(1);

    doc
      .font('Helvetica-Bold')
      .text('Declaração:')
      .moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(
        'Declaro, para todos os fins, que as informações aqui prestadas são verdadeiras e que ' +
        'autorizo o tratamento dos meus dados pessoais pelo SINPRF-ES para as finalidades ' +
        'ligadas à representação sindical, nos termos da legislação aplicável.',
        { align: 'justify' }
      )
      .moveDown(2);

    doc
      .font('Helvetica')
      .fontSize(11)
      .text('Assinatura do filiado (via meio eletrônico):', { align: 'left' })
      .moveDown(3);

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(
        'Observações técnicas: esta ficha foi gerada eletronicamente pelo sistema do SINPRF-ES. ' +
        'A confirmação jurídica da adesão pode estar vinculada a mecanismos adicionais de ' +
        'validação de identidade (ex.: autenticação gov.br, conferência manual etc.).',
        { align: 'justify' }
      );

    // Rodapé técnico
    doc
      .moveDown(2)
      .fontSize(8)
      .fillColor('#888888')
      .text(
        `IP de origem: ${dados.ip || '-'} | User-Agent: ${dados.userAgent || '-'} | CPF: ${dados.cpf}`,
        { align: 'left' }
      );

    doc.end();
  });
}

// ... dentro de index.js (Substitua a sua função enviarEmailFichaFiliacao existente)

async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO_FILIACAO,
  } = process.env;

  const host = SMTP_HOST;
  const port = parseInt(SMTP_PORT || '587', 10);
  const user = SMTP_USER;
  const pass = SMTP_PASS;
  const mailFrom = MAIL_FROM || SMTP_USER;
  const mailTo = MAIL_TO_FILIACAO;

  console.log('🛠 SMTP DEBUG:', {
    host,
    port,
    user,
    mailFrom,
    mailTo,
    hasPass: !!pass,
  });

  if (!host || !port || !user || !pass || !mailTo) {
    console.error('❌ CONFIGURAÇÃO SMTP FALTANDO! Verifique as variáveis de ambiente.');
    throw new Error('Configuração de e-mail (SMTP) está incompleta no servidor.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 = STARTTLS, 465 = SSL
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });

  const mailOptions = {
    from: mailFrom,
    to: mailTo,
    cc: dados.email2, // e-mail pessoal do filiado
    subject: `[FILIAÇÃO] Nova solicitação de ${dados.nome}`,
    html: `
      <p>Uma nova solicitação de filiação foi enviada por <b>${dados.nome}</b> (${dados.cpf}).</p>
      <p>Os detalhes completos e a ficha de filiação estão anexados como PDF.</p>
      <p><b>E-mail pessoal (cópia):</b> ${dados.email2}</p>
      <p><b>Matrícula SIAPE:</b> ${dados.siape}</p>
      <p><i>Este é um envio automático gerado pelo site do SINPRF-ES.</i></p>
    `,
    attachments: pdfBuffer
      ? [
          {
            filename: `Filiacao_${dados.cpf}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ E-mail de filiação enviado com sucesso para ${mailTo} (cópia para ${dados.email2}) – ID: ${info.messageId}`
    );
  } catch (emailError) {
    console.error('❌ ERRO NO ENVIO DO E-MAIL (SMTP):', emailError);
    throw new Error(`Falha no envio do e-mail. Motivo: ${emailError.message}`);
  }
}

// ------------------------------------------------------
// Rotas básicas
// ------------------------------------------------------

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API SINPRF-ES rodando',
  });
});

// Rota principal - entrega o index.html do site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================================================
// ROTA – Solicitação de filiação (filiese.html)
// ======================================================

app.post('/api/filiese', async (req, res) => {
  try {
    const dados = req.body || {};

    // Atenção: email2 = e-mail pessoal (obrigatório), email1 = funcional (opcional)
    const obrigatorios = [
      'nome',
      'cpf',
      'data_nascimento',
      'telefone1',
      'email2',
      'endereco',
      'bairro',
      'cidade',
      'uf',
      'cep',
      'siape',
      'lotacao',
    ];

    for (const campo of obrigatorios) {
      if (!dados[campo] || String(dados[campo]).trim() === '') {
        return res
          .status(400)
          .json({ error: `Preencha o campo obrigatório: ${campo}` });
      }
    }

    if (!dados.aceite_estatuto || !dados.aceite_lgpd) {
      return res.status(400).json({
        error: 'É necessário aceitar o Estatuto e a LGPD para continuar.',
      });
    }

    const agora = new Date().toISOString();

    const normalizados = {
      nome: String(dados.nome).trim(),
      cpf: String(dados.cpf).trim(),
      data_nascimento: String(dados.data_nascimento).trim(),
      telefone1: String(dados.telefone1).trim(),
      telefone2: (dados.telefone2 || '').toString().trim(),
      email1: (dados.email1 || '').toString().trim(), // funcional
      email2: (dados.email2 || '').toString().trim(), // pessoal
      endereco: String(dados.endereco).trim(),
      complemento: (dados.complemento || '').toString().trim(),
      bairro: (dados.bairro || '').toString().trim(),
      cidade: (dados.cidade || '').toString().trim(),
      uf: (dados.uf || '').toString().trim(),
      cep: (dados.cep || '').toString().trim(),
      siape: (dados.siape || '').toString().trim(),
      lotacao: (dados.lotacao || '').toString().trim(),
      data_solicitacao: agora,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
    };

    console.log('📥 Nova solicitação de filiação recebida:', {
      nome: normalizados.nome,
      cpf: normalizados.cpf,
      email_pessoal: normalizados.email2,
      email_funcional: normalizados.email1,
    });

    const pdfBuffer = await gerarPdfFichaFiliacao(normalizados);

    await enviarEmailFichaFiliacao(normalizados, pdfBuffer);

    return res.json({
      message:
        'Solicitação enviada com sucesso. Você receberá uma cópia no seu e-mail pessoal.',
    });
  } catch (err) {
    console.error('💥 Erro em /api/filiese:', err);
    return res.status(500).json({
      error: 'Erro interno ao processar sua solicitação de filiação.',
    });
  }
});

// ------------------------------------------------------
// 1) PRIMEIRO ACESSO - INICIAR
//    Entrada: { cpf, data_nascimento }
//    Saída: dados para conferência (do próprio filiado)
// ------------------------------------------------------
app.post('/api/primeiro-acesso/iniciar', async (req, res) => {
  try {
    console.log('🔍 Recebido:', req.body);

    const { cpf, data_nascimento } = req.body;

    const cpfLimpo = normalizarCpf(cpf);
    const dataNormalizada = parseDataNascimento(data_nascimento);

    console.log('➡ CPF normalizado:', cpfLimpo);
    console.log('➡ Data normalizada:', dataNormalizada);

    if (!cpfLimpo || !dataNormalizada) {
      console.log('❌ CPF ou data inválidos');
      return res.status(400).json({ error: 'CPF ou data de nascimento inválidos.' });
    }

    const query = `
      SELECT id, nome, cpf, data_nascimento, telefone1, telefone2,
             email1, email2, endereco, situacao, senha_hash
      FROM filiados
      WHERE cpf = $1
    `;

    console.log('📡 Rodando SELECT para CPF:', cpfLimpo);

    const result = await pool.query(query, [cpfLimpo]);

    console.log('📦 Resultado do SELECT:', result.rows);

    if (result.rows.length === 0) {
      console.log('❌ CPF não encontrado no banco');
      return res.status(404).json({ error: 'CPF não encontrado na base de filiados.' });
    }

    const filiado = result.rows[0];

    if (filiado.senha_hash) {
      console.log('⚠ Já possui senha cadastrada');
      return res.status(400).json({ error: 'Este CPF já possui cadastro. Use a tela de login.' });
    }

    console.log('📅 Data nascimento no banco (string):', filiado.data_nascimento);

    // No banco está como "dd/mm/aaaa"
    const dataBancoNormalizada = parseDataNascimento(filiado.data_nascimento);
    console.log('➡ Datas normalizadas:', dataBancoNormalizada, ' vs ', dataNormalizada);

    if (!dataBancoNormalizada || dataBancoNormalizada !== dataNormalizada) {
      console.log('❌ Data não confere');
      return res.status(400).json({ error: 'Data de nascimento não confere.' });
    }

    res.json({
      ok: true,
      id: filiado.id,
      nome: filiado.nome,
      cpf: filiado.cpf,
      data_nascimento: dataBancoNormalizada, // "aaaa-mm-dd"
      telefone1: filiado.telefone1 || '',
      telefone2: filiado.telefone2 || '',
      email1: filiado.email1 || '',
      email2: filiado.email2 || '',
      endereco: filiado.endereco || '',
      situacao: filiado.situacao || '',
    });
  } catch (err) {
    console.error('💥 ERRO INTERNO DETECTADO em /api/primeiro-acesso/iniciar:', err);
    res.status(500).json({ error: 'Erro interno ao iniciar primeiro acesso.' });
  }
});

// ------------------------------------------------------
// 2) PRIMEIRO ACESSO - CONFIRMAR E DEFINIR SENHA
//    Entrada: { id, telefone1?, telefone2?, email1?, email2?, endereco?, senha }
//    Regra: apenas id e senha são obrigatórios; demais campos são opcionais.
// ------------------------------------------------------
app.post('/api/primeiro-acesso/confirmar', async (req, res) => {
  try {
    const {
      id,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      senha,
    } = req.body;

    if (!id || !senha) {
      return res.status(400).json({ error: 'ID e senha são obrigatórios.' });
    }

    // Gera hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    const query = `
      UPDATE filiados
      SET telefone1   = $1,
          telefone2   = $2,
          email1      = $3,
          email2      = $4,
          endereco    = $5,
          senha_hash  = $6,
          atualizado_em = NOW()
      WHERE id = $7
      RETURNING id, nome, cpf, perfil_acesso;
    `;

    const result = await pool.query(query, [
      telefone1 || '',
      telefone2 || '',
      email1 || '',
      email2 || '',
      endereco || '',
      senhaHash,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Filiado não encontrado.' });
    }

    const user = result.rows[0];

    // Gera token JWT para já deixar logado após o primeiro acesso
    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        nome: user.nome,
        perfil_acesso: user.perfil_acesso || 'FILIADO',
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      status: 'ok',
      message: 'Primeiro acesso concluído.',
      token,
    });
  } catch (err) {
    console.error('💥 Erro em /api/primeiro-acesso/confirmar:', err);
    res.status(500).json({ error: 'Erro interno ao confirmar primeiro acesso.' });
  }
});

// ------------------------------------------------------
// LOGIN + 2FA (Google Authenticator)
// ------------------------------------------------------

// Login:
//  - Entrada: { cpf, senha, token2fa? }
//  - Se twofa_secret estiver preenchido, token2fa passa a ser obrigatório.
app.post('/api/login', async (req, res) => {
  try {
    const { cpf, senha, token2fa } = req.body;
    const cpfLimpo = normalizarCpf(cpf);

    if (!cpfLimpo || !senha) {
      return res.status(400).json({ error: 'CPF e senha são obrigatórios.' });
    }

    const result = await pool.query(
      `SELECT id, nome, cpf, senha_hash, twofa_secret, perfil_acesso
       FROM filiados
       WHERE cpf = $1`,
      [cpfLimpo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'CPF ou senha inválidos.' });
    }

    const user = result.rows[0];

    if (!user.senha_hash) {
      return res.status(400).json({
        error: 'Primeiro acesso não concluído. Use a opção de primeiro acesso.',
      });
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ error: 'CPF ou senha inválidos.' });
    }

    // Se já tiver 2FA ativado, exige token
    if (user.twofa_secret) {
      if (!token2fa) {
        return res.status(401).json({ error: 'Token do Google Authenticator é obrigatório.' });
      }

      const valid2FA = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token: token2fa,
        window: 1,
      });

      if (!valid2FA) {
        return res.status(401).json({ error: 'Token do Google Authenticator inválido ou expirado.' });
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        nome: user.nome,
        perfil_acesso: user.perfil_acesso || 'FILIADO',
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await pool.query(
      `UPDATE filiados
       SET ultimo_acesso = NOW()
       WHERE id = $1`,
      [user.id]
    );

    res.json({
      ok: true,
      token,
      requires2fa: !!user.twofa_secret,
      perfil_acesso: user.perfil_acesso || 'FILIADO',
    });
  } catch (err) {
    console.error('💥 Erro em /api/login:', err);
    res.status(500).json({ error: 'Erro interno no login.' });
  }
});

// Ativar 2FA (opcional, mas recomendado)
// - Rota protegida, precisa de JWT
// - Gera segredo e URL para Google Authenticator
app.post('/api/2fa/ativar', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const secret = speakeasy.generateSecret({
      name: 'SINPRF-ES (Área Restrita)',
    });

    await pool.query(
      `UPDATE filiados
       SET twofa_secret = $1,
           atualizado_em = NOW()
       WHERE id = $2`,
      [secret.base32, userId]
    );

    res.json({
      ok: true,
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      message: '2FA ativado. Configure o Google Authenticator com o QRCode ou a chave fornecida.',
    });
  } catch (err) {
    console.error('💥 Erro em /api/2fa/ativar:', err);
    res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
});

// ------------------------------------------------------
// Rotas protegidas (Área Restrita)
// ------------------------------------------------------

// Dados completos do próprio filiado
app.get('/api/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nome, cpf, data_nascimento, telefone1, telefone2,
              email1, email2, endereco, situacao,
              ultimo_acesso, criado_em, atualizado_em, perfil_acesso
       FROM filiados
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filiado não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('💥 Erro em /api/me:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do filiado.' });
  }
});

// Lista resumida de filiados:
//  - FILIADO: vê apenas nome + telefone1
//  - DIRETORIA / FUNCIONARIO: vê dados completos
app.get('/api/filiados', auth, async (req, res) => {
  try {
    let query;
    const perfil = req.user.perfil_acesso || 'FILIADO';

    if (perfil === 'DIRETORIA' || perfil === 'FUNCIONARIO') {
      // Acesso ampliado
      query = `
        SELECT nome, cpf, data_nascimento, telefone1, telefone2,
               email1, email2, endereco, situacao
        FROM filiados
        ORDER BY nome
      `;
    } else {
      // Acesso padrão (LGPD-friendly)
      query = `
        SELECT nome, telefone1
        FROM filiados
        ORDER BY nome
      `;
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('💥 Erro em /api/filiados:', err);
    res.status(500).json({ error: 'Erro ao listar filiados.' });
  }
});

app.get('/debug-env', (req, res) => {
  res.json({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS ? '(definida)' : '(vazia)',
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_TO_FILIACAO: process.env.MAIL_TO_FILIACAO
  });
});


// ------------------------------------------------------
// Inicialização do servidor
// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SINPRF-ES rodando na porta ${PORT}`);
});
