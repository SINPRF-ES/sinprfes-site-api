// src/controllers/jogos.controller.js
const pool = require("../config/db");
const log = require("../utils/log"); // 🟢 LOGGER

const PERFIS_JOGOS_MANAGER = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

exports.registrarInscricao = async (req, res) => {
  try {
    const userId = req.user.id;
    const filiadoNome = req.user.nome;
    const { modalidades, observacoes } = req.body || {};

    if (!modalidades || modalidades.length === 0) {
      return res.status(400).json({
        error: "Selecione pelo menos uma modalidade de interesse.",
      });
    }
    
    const modalidadesTexto = Array.isArray(modalidades) ? modalidades : [];
    const obsLimpa = String(observacoes || "").trim();

    const query = `
      INSERT INTO pre_inscricoes_jogos (
        filiado_id, nome_filiado, modalidades, observacoes, data_inscricao
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (filiado_id) DO UPDATE SET
        modalidades = EXCLUDED.modalidades,
        observacoes = EXCLUDED.observacoes,
        data_inscricao = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      userId, filiadoNome, modalidadesTexto, obsLimpa,
    ]);

    // 🟢 LOG
    log.info("JogosInscricao", { 
        userId, 
        modalidades: modalidadesTexto 
    });

    return res.status(200).json({
      message: "Pré-inscrição registrada/atualizada com sucesso!",
      inscricao: rows[0],
    });
  } catch (err) {
    log.error("JogosInscricaoErro", err);
    return res.status(500).json({
      error: "Erro interno ao registrar a pré-inscrição.",
    });
  }
};

exports.listarInscricoes = async (req, res) => {
    try {
        const perfil = (req.user.perfil_acesso || "").toUpperCase();
        
        if (!PERFIS_JOGOS_MANAGER.includes(perfil)) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        
        const query = `
            SELECT 
                pi.*,
                f.cpf, f.telefone1, f.email1
            FROM pre_inscricoes_jogos pi
            JOIN filiados f ON pi.filiado_id = f.id
            ORDER BY pi.data_inscricao DESC;
        `;
        
        const { rows } = await pool.query(query);

        // 🟢 LOG (Opcional: logar quem visualizou a lista)
        log.info("JogosListagemVisualizada", { viewerId: req.user.id });

        return res.json({
            total: rows.length,
            inscricoes: rows
        });

    } catch (err) {
        log.error("JogosListagemErro", err);
        return res.status(500).json({
            error: "Erro interno ao listar as inscrições."
        });
    }
};