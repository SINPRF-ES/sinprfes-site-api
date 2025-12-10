// src/controllers/jogos.controller.js
const pool = require("../config/db"); // Conexão com o banco de dados

// Perfis autorizados a gerenciar os jogos
const PERFIS_JOGOS_MANAGER = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

/**
 * POST /api/jogos/inscricao
 * Recebe a manifestação de interesse do filiado logado.
 */
exports.registrarInscricao = async (req, res) => {
  try {
    const userId = req.user.id; // ID do filiado logado
    const filiadoNome = req.user.nome;
    const { modalidades, observacoes } = req.body || {};

    if (!modalidades || modalidades.length === 0) {
      return res.status(400).json({
        error: "Selecione pelo menos uma modalidade de interesse.",
      });
    }
    
    const modalidadesTexto = Array.isArray(modalidades) ? modalidades : [];
    const obsLimpa = String(observacoes || "").trim();

    // Requer que a tabela 'pre_inscricoes_jogos' exista com o campo 'modalidades' como TEXT[] (Array)
    const query = `
      INSERT INTO pre_inscricoes_jogos (
        filiado_id,
        nome_filiado,
        modalidades,
        observacoes,
        data_inscricao
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (filiado_id) DO UPDATE SET
        modalidades = EXCLUDED.modalidades,
        observacoes = EXCLUDED.observacoes,
        data_inscricao = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      userId,
      filiadoNome,
      modalidadesTexto,
      obsLimpa,
    ]);

    return res.status(200).json({
      message: "Pré-inscrição registrada/atualizada com sucesso!",
      inscricao: rows[0],
    });
  } catch (err) {
    console.error("💥 Erro em POST /api/jogos/inscricao:", err);
    return res.status(500).json({
      error: "Erro interno ao registrar a pré-inscrição.",
    });
  }
};

/**
 * GET /api/jogos/inscricoes
 * Lista todas as pré-inscrições (Apenas para ORGANIZADOR, ADMIN, etc.)
 */
exports.listarInscricoes = async (req, res) => {
    try {
        const perfil = (req.user.perfil_acesso || "").toUpperCase();
        
        if (!PERFIS_JOGOS_MANAGER.includes(perfil)) {
            return res.status(403).json({ 
                error: "Acesso negado. Você não tem permissão para visualizar as inscrições." 
            });
        }
        
        const query = `
            SELECT 
                pi.*,
                f.cpf,
                f.telefone1,
                f.email1
            FROM pre_inscricoes_jogos pi
            JOIN filiados f ON pi.filiado_id = f.id
            ORDER BY pi.data_inscricao DESC;
        `;
        
        const { rows } = await pool.query(query);

        return res.json({
            total: rows.length,
            inscricoes: rows
        });

    } catch (err) {
        console.error("💥 Erro em GET /api/jogos/inscricoes:", err);
        return res.status(500).json({
            error: "Erro interno ao listar as inscrições."
        });
    }
};