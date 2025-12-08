// src/controllers/login.controller.js
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { cpf, senha } = req.body;

    if (!cpf || !senha) {
      return res.status(400).json({ error: "CPF e senha são obrigatórios." });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const query = `
      SELECT id, nome, cpf, senha_hash, perfil_acesso, bloqueado
      FROM filiados
      WHERE cpf = $1
    `;

    const { rows } = await pool.query(query, [cpfLimpo]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "CPF não encontrado." });
    }

    const user = rows[0];

    if (user.bloqueado) {
      return res.status(403).json({
        error: "Usuário bloqueado. Entre em contato com o sindicato."
      });
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash || "");
    if (!senhaOk) {
      return res.status(401).json({ error: "Senha inválida." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        nome: user.nome,
        perfil_acesso: user.perfil_acesso,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Login realizado com sucesso.",
      token,
      perfil_acesso: user.perfil_acesso,
    });

  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno no login." });
  }
};
