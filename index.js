// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const pool = require('./db');
const auth = require('./auth');

const app = express();

// Middleware para JSON no corpo das requisições
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Função utilitária: normalizar CPF (remover pontos e traços)
function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.replace(/\D/g, '');
}

// Função utilitária: converter "dd/mm/aaaa" para "aaaa-mm-dd"
function parseDataNascimento(texto) {
  if (!texto) return null;

  // Aceita "dd/mm/aaaa" ou "aaaa-mm-dd"
  if (texto.includes('/')) {
    const [dia, mes, ano] = texto.split('/');
    if (!dia || !mes || !ano) return null;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  // Se já vier como "aaaa-mm-dd", retornamos como está
  if (texto.includes('-')) {
    return texto;
  }

  return null;
}

// ========================
// Rotas públicas
// ========================

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

// ========================
// Fluxo de PRIMEIRO ACESSO
// ========================

/**
 * 1) Iniciar primeiro acesso
 *    - Entrada: { cpf, data_nascimento }
 *    - Regra:
 *       - cpf deve existir na tabela filiados
 *       - senha_hash deve ser NULL (ainda não cadastrou senha)
 *       - data_nascimento deve bater com a do banco
 *    - Saída (se tudo ok): dados básicos para confirmação (do próprio filiado)
 */
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
const dataBancoNormalizada = parseDataNascimento(filiado.data_nascimento); // vira "aaaa-mm-dd"
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
    console.error('💥 ERRO INTERNO DETECTADO:', err);
    res.status(500).json({ error: 'Erro interno ao iniciar primeiro acesso.' });
  }
});


/**
 * 2) Confirmar dados e definir senha
 *    - Entrada: { cpf, data_nascimento, telefone1, telefone2, email1, email2, endereco, senha }
 *    - Regra:
 *       - Revalidar CPF + data_nascimento
 *       - Atualizar dados de contato
 *       - Definir senha_hash
 */
app.post('/api/primeiro-acesso/confirmar', async (req, res) => {
  try {
    const {
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      senha,
    } = req.body;

    const cpfLimpo = normalizarCpf(cpf);
    const dataNormalizada = parseDataNascimento(data_nascimento);

    if (!cpfLimpo || !dataNormalizada) {
      return res.status(400).json({ error: 'CPF ou data de nascimento inválidos.' });
    }

    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
    }

    const result = await pool.query(
      `SELECT id, data_nascimento, senha_hash FROM filiados WHERE cpf = $1`,
      [cpfLimpo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'CPF não encontrado.' });
    }

    const filiado = result.rows[0];

    if (filiado.senha_hash) {
      return res.status(400).json({ error: 'Este CPF já possui cadastro. Use a tela de login.' });
    }

    const dataBancoNormalizada = parseDataNascimento(filiado.data_nascimento);
if (!dataBancoNormalizada || dataBancoNormalizada !== dataNormalizada) {
  return res.status(400).json({ error: 'Data de nascimento não confere.' });
}


    const senhaHash = await bcrypt.hash(senha, 12);

    await pool.query(
      `
      UPDATE filiados
      SET telefone1 = $1,
          telefone2 = $2,
          email1    = $3,
          email2    = $4,
          endereco  = $5,
          senha_hash = $6,
          atualizado_em = NOW()
      WHERE cpf = $7
      `,
      [telefone1, telefone2, email1, email2, endereco, senhaHash, cpfLimpo]
    );

    res.json({ ok: true, message: 'Cadastro concluído com sucesso. Você já pode fazer login.' });
  } catch (err) {
    console.error('Erro em /api/primeiro-acesso/confirmar:', err);
    res.status(500).json({ error: 'Erro interno ao concluir primeiro acesso.' });
  }
});

// ========================
// LOGIN + 2FA (Google Authenticator)
// ========================

/**
 * Login
 * - Entrada: { cpf, senha, token2fa (opcional) }
 * - Regra:
 *    - Se existir twofa_secret, exigir token2fa válido
 *    - Gerar JWT se tudo ok
 */
app.post('/api/login', async (req, res) => {
  try {
    const { cpf, senha, token2fa } = req.body;
    const cpfLimpo = normalizarCpf(cpf);

    if (!cpfLimpo || !senha) {
      return res.status(400).json({ error: 'CPF e senha são obrigatórios.' });
    }

    const result = await pool.query(
      `SELECT id, nome, cpf, senha_hash, twofa_secret FROM filiados WHERE cpf = $1`,
      [cpfLimpo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'CPF ou senha inválidos.' });
    }

    const user = result.rows[0];

    if (!user.senha_hash) {
      return res.status(400).json({ error: 'Primeiro acesso não concluído. Use a opção de primeiro acesso.' });
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ error: 'CPF ou senha inválidos.' });
    }

    // Se o usuário já tiver 2FA configurado, exigir token2fa
    if (user.twofa_secret) {
      if (!token2fa) {
        return res.status(401).json({ error: 'Token do Google Authenticator é obrigatório.' });
      }

      const valid2FA = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token: token2fa,
        window: 1, // tolerância de 30s pra frente/tras
      });

      if (!valid2FA) {
        return res.status(401).json({ error: 'Token do Google Authenticator inválido ou expirado.' });
      }
    }

    // Gera o JWT
    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        nome: user.nome,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Atualiza ultimo_acesso
    await pool.query(
      `UPDATE filiados SET ultimo_acesso = NOW() WHERE id = $1`,
      [user.id]
    );

    res.json({
      ok: true,
      token,
      requires2fa: !!user.twofa_secret,
    });
  } catch (err) {
    console.error('Erro em /api/login:', err);
    res.status(500).json({ error: 'Erro interno no login.' });
  }
});

/**
 * Ativar 2FA (Google Authenticator)
 * - Rota protegida (precisa estar logado)
 * - Gera segredo e otpauth_url para configurar no app de Autenticador
 */
app.post('/api/2fa/ativar', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const secret = speakeasy.generateSecret({
      name: 'SINPRF-ES (Área Restrita)',
    });

    await pool.query(
      `UPDATE filiados SET twofa_secret = $1, atualizado_em = NOW() WHERE id = $2`,
      [secret.base32, userId]
    );

    res.json({
      ok: true,
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      message: '2FA ativado. Configure o app Google Authenticator com o QRCode ou chave informados.',
    });
  } catch (err) {
    console.error('Erro em /api/2fa/ativar:', err);
    res.status(500).json({ error: 'Erro ao ativar 2FA.' });
  }
});

// ========================
// Rotas protegidas (Área Restrita)
// ========================

/**
 * Dados completos do próprio filiado (LGPD OK: só ele mesmo vê)
 */
app.get('/api/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT nome, cpf, data_nascimento, telefone1, telefone2,
             email1, email2, endereco, situacao,
             ultimo_acesso, criado_em, atualizado_em
      FROM filiados
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filiado não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro em /api/me:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do filiado.' });
  }
});

/**
 * Lista resumida de filiados:
 * - Apenas nome + telefone1
 * - Nunca expõe CPF, e-mail ou endereço de terceiros
 */
app.get('/api/filiados', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT nome, telefone1
      FROM filiados
      ORDER BY nome
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro em /api/filiados:', err);
    res.status(500).json({ error: 'Erro ao listar filiados.' });
  }
});

// ========================
// Inicialização do servidor
// ========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SINPRF-ES rodando na porta ${PORT}`);
});
