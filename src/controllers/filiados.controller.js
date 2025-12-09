// src/controllers/filiados.controller.js
const pool = require("../config/db");
const {
  buscarPorId,
  atualizarDadosContato,
  atualizarDadosCompleto,
} = require("../services/filiados.service");

/**
 * Util: formata objeto de filiado para resposta JSON
 */
function formatarFiliado(row) {
  if (!row) return null;

  let dataNasc = row.data_nascimento;
  if (dataNasc instanceof Date) {
    dataNasc = dataNasc.toISOString().slice(0, 10); // yyyy-mm-dd
  }

  return {
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
  };
}

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

    const filiado = formatarFiliado(rows[0]);

    return res.json(filiado);
  } catch (err) {
    console.error("💥 Erro em GET /api/filiados/me:", err);
    return res.status(500).json({ error: "Erro interno ao carregar seus dados." });
  }
};

/**
 * PUT /api/filiados/me
 * FILIADO pode alterar apenas os próprios telefones, e-mails e endereço.
 */
exports.atualizarMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      telefone1 = null,
      telefone2 = null,
      email1 = null,
      email2 = null,
      endereco = null,
    } = req.body || {};

    if (
      telefone1 === null &&
      telefone2 === null &&
      email1 === null &&
      email2 === null &&
      endereco === null
    ) {
      return res.status(400).json({
        error: "Informe ao menos um campo (telefones, e-mails ou endereço) para atualizar.",
      });
    }

    const atualizado = await atualizarDadosContato(userId, {
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
    });

    if (!atualizado) {
      return res.status(404).json({ error: "Filiado não encontrado." });
    }

    return res.json({
      message: "Seus dados foram atualizados com sucesso.",
      filiado: formatarFiliado(atualizado),
    });
  } catch (err) {
    console.error("💥 Erro em PUT /api/filiados/me:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar seus dados." });
  }
};

/**
 * GET /api/filiados
 * - FILIADO: vê apenas nome + telefone1 dos demais (ativos)
 * - DIRETORIA/FUNCIONARIO/ADMIN: vê dados completos
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfil = req.user.perfil_acesso || "FILIADO";

    let query;
    if (perfil === "DIRETORIA" || perfil === "FUNCIONARIO" || perfil === "ADMIN") {
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
      // Acesso restrito: só vê quem está ativo e apenas nome + telefone1
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

/**
 * PUT /api/filiados/:id
 *
 * Regras:
 * - FILIADO:
 *    - só pode alterar se :id === próprio id
 *    - mesmo assim, apenas telefones, e-mails e endereço
 * - DIRETORIA / FUNCIONARIO:
 *    - pode alterar todos os campos, EXCETO perfil_acesso
 * - ADMIN:
 *    - pode alterar todos os campos, INCLUINDO perfil_acesso
 */
exports.atualizarFiliado = async (req, res) => {
  try {
    const perfil = req.user.perfil_acesso || "FILIADO";
    const userId = req.user.id;
    const idAlvo = parseInt(req.params.id, 10);

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const body = req.body || {};

    // Caso seja FILIADO "normal"
    if (perfil === "FILIADO") {
      if (idAlvo !== userId) {
        return res.status(403).json({
          error: "Você só pode alterar os seus próprios dados.",
        });
      }

      const {
        telefone1 = null,
        telefone2 = null,
        email1 = null,
        email2 = null,
        endereco = null,
      } = body;

      if (
        telefone1 === null &&
        telefone2 === null &&
        email1 === null &&
        email2 === null &&
        endereco === null
      ) {
        return res.status(400).json({
          error: "Informe ao menos um campo (telefones, e-mails ou endereço) para atualizar.",
        });
      }

      const atualizado = await atualizarDadosContato(idAlvo, {
        telefone1,
        telefone2,
        email1,
        email2,
        endereco,
      });

      if (!atualizado) {
        return res.status(404).json({ error: "Filiado não encontrado." });
      }

      return res.json({
        message: "Dados atualizados com sucesso.",
        filiado: formatarFiliado(atualizado),
      });
    }

    // DIRETORIA / FUNCIONARIO / ADMIN
    const existente = await buscarPorId(idAlvo);
    if (!existente) {
      return res.status(404).json({ error: "Filiado não encontrado." });
    }

    // Controle de alteração de perfil_acesso:
    // - Se não for ADMIN e tentou enviar perfil_acesso, bloqueia
    if (body.perfil_acesso && perfil !== "ADMIN") {
      return res.status(403).json({
        error: "Apenas usuário com perfil ADMIN pode alterar o perfil de acesso.",
      });
    }

    const novoPerfil = body.perfil_acesso || existente.perfil_acesso;

    const dadosAtualizar = {
      nome: body.nome ?? existente.nome,
      cpf: body.cpf ?? existente.cpf,
      data_nascimento: body.data_nascimento ?? existente.data_nascimento,
      telefone1: body.telefone1 ?? existente.telefone1,
      telefone2: body.telefone2 ?? existente.telefone2,
      email1: body.email1 ?? existente.email1,
      email2: body.email2 ?? existente.email2,
      endereco: body.endereco ?? existente.endereco,
      situacao: body.situacao ?? existente.situacao,
      perfil_acesso: novoPerfil,
    };

    const atualizado = await atualizarDadosCompleto(idAlvo, dadosAtualizar);

    return res.json({
      message: "Filiado atualizado com sucesso.",
      filiado: formatarFiliado(atualizado),
    });
  } catch (err) {
    console.error("💥 Erro em PUT /api/filiados/:id:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar filiado." });
  }
};
