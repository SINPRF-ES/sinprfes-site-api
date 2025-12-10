// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// REMOVIDO: const nodemailer = require("nodemailer");
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

    // ... (Validação e busca no banco de dados, sem alterações)
    // ...

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    // ... (Lógica de CPF não encontrado e e-mail ausente, sem alterações)
    // ...

    // Gera token de reset de senha (1h)
    const token = jwt.sign(
      // ... (Payload e assinatura, sem alterações)
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

    // CHAMA A NOVA FUNÇÃO BASE DO RESEND (via HTTPS)
    try {
        await enviarEmailBase(emailDestino, subject, corpoEmail);
    } catch (err) {
        // Captura o erro do Resend ou de ENV vars ausentes
        console.warn("⚠ Não foi possível enviar e-mail de reset com Resend:", err.message);
        return res.json({
            message:
                "Não foi possível enviar o e-mail agora. Tente novamente mais tarde ou contate a secretaria.",
            email_destino: null,
        });
    }

    // ... (Retorno de sucesso padrão, sem alterações)
    // ...
    
  } catch (err) {
    console.error("💥 Erro em POST /api/senha/recuperar:", err);
    return res.status(500).json({
      error: "Erro interno ao processar a solicitação de redefinição de senha.",
    });
  }
};

exports.resetarSenha = async (req, res) => {
  // ... (Esta função não sofreu alterações)
  // ...
};