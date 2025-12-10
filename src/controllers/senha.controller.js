// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { enviarEmailBase } = require("../services/email.service"); 
const log = require("../utils/log");
const Textos = require require("../utils/textos"); // 🟢 TEXTOS

function getEmailPrincipal(row) {
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  if (row.email2 && row.email2.trim() !== "") return row.email2.trim();
  return null;
}

exports.solicitarResetSenha = async (req, res) => {
  try {
    const { cpf } = req.body || {};

    if (!cpf) {
      return res.status(400).json({ error: Textos.SENHA.INFORME_CPF }); // ✨
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const query = `
      SELECT id, nome, cpf, email1, email2
      FROM filiados
      WHERE cpf = $1
    `;
    const { rows } = await pool.query(query, [cpfLimpo]);
    
    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO; // ✨

    if (rows.length === 0) {
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      log.warn("SenhaResetSemEmail", { userId: user.id });
      return res.json({
        message: Textos.SENHA.EMAIL_NAO_CADASTRADO, // ✨
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

    await enviarEmailBase(emailDestino, subject, corpoEmail);
    
    log.info("SenhaResetEmailEnviado", { userId: user.id, email: emailDestino });

    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    log.error("SenhaResetSolicitarErro", err);
    return res.status(500).json({
      error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, // ✨ Reutilizando esta mensagem
    });
  }
};

exports.resetarSenha = async (req, res) => {
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_E_SENHA_OBRIGATORIOS, // ✨
      });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({
        error: Textos.SENHA.SENHA_MUITO_CURTA, // ✨
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      log.warn("SenhaResetTokenInvalido", { error: err.message });
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_SENHA_EXPIRADO, // ✨
      });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_TIPO_INVALIDO, // ✨
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

    log.info("SenhaAlteradaSucesso", { userId });

    return res.json({
      message: Textos.SUCESSO.SENHA_REDEFINIDA, // ✨
    });
  } catch (err) {
    log.error("SenhaResetConfirmarErro", err);
    return res.status(500).json({
      error: Textos.ERROS_INTERNOS.RESET_SENHA, // ✨
    });
  }
};