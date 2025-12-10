// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// IMPORTAÇÃO DA NOVA FUNÇÃO BASE DE ENVIO
const { enviarEmailBase } = require("../services/email.service"); 

/**
 * Util: obtém e-mail principal do filiado
 * priorizando email1, depois email2.
 */
function getEmailPrincipal(row) {
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  if (row.email2 && row.email2.trim() !== "") return row.email2.trim();
  return null;
}

/**
 * POST /api/senha/recuperar
 */
exports.solicitarResetSenha = async (req, res) => {
  try {
    const { cpf } = req.body || {};

    if (!cpf) {
      return res.status(400).json({ error: "Informe o CPF." });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    // 1. LÓGICA REINSERIDA: Consulta o banco de dados pelo CPF
    const query = `
      SELECT id, nome, cpf, email1, email2
      FROM filiados
      WHERE cpf = $1
    `;
    const { rows } = await pool.query(query, [cpfLimpo]);
    // ----------------------------------------------------
    
    // Sempre envia mensagem genérica para não expor se CPF existe ou não.
    const mensagemPadrao =
      "Se houver um cadastro para este CPF, um e-mail com link de redefinição de senha foi enviado.";

    if (rows.length === 0) {
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      return res.json({
        message:
          "CPF localizado, mas não há e-mail válido cadastrado. " +
          "Por favor, entre em contato com a secretaria do sindicato pela página de contato.",
        email_destino: null,
      });
    }

    // 2. Gera token de reset de senha (1h)
    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        tipo: "reset-senha",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const baseUrl = process.env.APP_BASE_URL || "https://sinprfes.org.br";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(
      token
    )}`;

    const subject = "SINPRF-ES – Redefinição de senha da área do filiado";
    const corpoEmail = 
        `Olá, ${user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua área do filiado no SINPRF-ES.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nSINPRF-ES`;

    // 3. Envia o e-mail (Chamada ao serviço Resend)
    await enviarEmailBase(emailDestino, subject, corpoEmail);
    
    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    console.error("💥 Erro em POST /api/senha/recuperar:", err);
    // Erro 500 agora capturará falhas de DB, JWT_SECRET ou falhas reais do Resend
    return res.status(500).json({
      error: "Erro interno ao processar a solicitação de redefinição de senha.",
    });
  }
};

/**
 * POST /api/senha/resetar
 * Corpo: { token: "...", senha_nova: "..." }
 *
 * Valida o token e grava nova senha em senha_hash.
 */
exports.resetarSenha = async (req, res) => {
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({
        error: "Token e nova senha são obrigatórios.",
      });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({
        error: "A nova senha deve ter pelo menos 6 caracteres.",
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("Token de reset inválido/expirado:", err);
      return res.status(400).json({
        error: "Link de redefinição inválido ou expirado. Solicite novamente.",
      });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({
        error: "Token de redefinição inválido.",
      });
    }

    const userId = payload.id;

    const senhaHash = await bcrypt.hash(senha_nova, 10);

    const updateSql = `
      UPDATE filiados
      SET senha_hash = $1, atualizado_em = NOW()
      WHERE id = $2
    `;
    await pool.query(updateSql, [senhaHash, userId]);

    return res.json({
      message: "Senha redefinida com sucesso. Você já pode fazer login com a nova senha.",
    });
  } catch (err) {
    console.error("💥 Erro em POST /api/senha/resetar:", err);
    return res.status(500).json({
      error: "Erro interno ao redefinir a senha.",
    });
  }
};