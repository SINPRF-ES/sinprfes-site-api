// src/controllers/filiados.controller.js
const pool = require("../config/db");

/**
 * GET /api/filiados/me
 * Retorna os dados completos do filiado logado
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        id,
        nome,
        cpf,
        data_nascimento,
        telefone1,
        telefone2,
        email1,
        email2,
        endereco,
        situacao,
        perfil_acesso
      FROM filiados
      WHERE id = $1
    `;

    const { rows } = await pool.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Filiado não encontrado." });
    }

    const row = rows[0];

    // Normaliza data_nascimento para string legível (se existir)
    let dataNasc = row.data_nascimento;
    if (dataNasc instanceof Date) {
      dataNasc = dataNasc.toISOString().slice(0, 10); // yyyy-mm-dd
    }

    return res.json({
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      data_nascimento: dataNasc,
      telefone1: row.telefone1,
      telefone2: row.telefone2,
      email1: row.email1,
      email2: row.email2,
      endereco: row.endereco,
      situacao: row.situacao,
      perfil_acesso: row.perfil_acesso || "FILIADO",
    });
  } catch (err) {
    console.error("💥 Erro em GET /api/filiados/me:", err);
    return res.status(500).json({ error: "Erro interno ao carregar seus dados." });
  }
};

/**
 * GET /api/filiados
 * - FILIADO: vê apenas nome + telefone1 dos demais
 * - DIRETORIA/FUNCIONARIO: vê dados completos
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfil = req.user.perfil_acesso || "FILIADO";

    let query;
    if (perfil === "DIRETORIA" || perfil === "FUNCIONARIO") {
      // Acesso ampliado
      query = `
        SELECT
          id,
          nome,
          cpf,
          telefone1,
          telefone2,
          email1,
          email2,
          endereco,
          situacao,
          perfil_acesso
        FROM filiados
        ORDER BY nome ASC
      `;
    } else {
      // Acesso restrito
      query = `
        SELECT
          id,
          nome,
          telefone1
        FROM filiados
        WHERE situacao IS NULL OR situacao ILIKE 'ativo%'
        ORDER BY nome ASC
      `;
    }

    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (err) {
    console.error("💥 Erro em GET /api/filiados:", err);
    return res.status(500).json({ error: "Erro interno ao listar filiados." });
  }
};
