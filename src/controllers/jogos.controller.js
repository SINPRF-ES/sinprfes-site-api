const pool = require("../config/db");
const log = require("../utils/log"); 
const Textos = require("../utils/textos");

const PERFIS_JOGOS_MANAGER = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

exports.registrarInscricao = async (req, res) => {
  try {
    const userId = req.user.id;
    const filiadoNome = req.user.nome;
    
    // 🟢 NOVOS CAMPOS: sexo, qtd_familiares, familiares
    const { modalidades, observacoes, familiares, qtd_familiares, sexo } = req.body || {};

    if (!modalidades || modalidades.length === 0) {
      return res.status(400).json({
        error: "Selecione pelo menos uma modalidade de interesse.",
      });
    }
    
    const modalidadesTexto = Array.isArray(modalidades) ? modalidades : [];
    const obsLimpa = String(observacoes || "").trim();
    const familiaresLimpo = String(familiares || "").trim();
    const qtdFamiliaresInt = parseInt(qtd_familiares) || 0;
    const sexoLimpo = String(sexo || "").trim();

    // Query atualizada com os novos campos
    const query = `
      INSERT INTO pre_inscricoes_jogos (
        filiado_id, nome_filiado, modalidades, observacoes, familiares, qtd_familiares, sexo, data_inscricao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (filiado_id) DO UPDATE SET
        modalidades = EXCLUDED.modalidades,
        observacoes = EXCLUDED.observacoes,
        familiares = EXCLUDED.familiares,
        qtd_familiares = EXCLUDED.qtd_familiares,
        sexo = EXCLUDED.sexo,
        data_inscricao = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      userId, 
      filiadoNome, 
      modalidadesTexto, 
      obsLimpa, 
      familiaresLimpo,
      qtdFamiliaresInt,
      sexoLimpo
    ]);

    log.info("JogosInscricao", { userId, modalidades: modalidadesTexto });

    return res.status(200).json({
      message: Textos.SUCESSO.INSCRICAO_JOGOS_SUCESSO,
      inscricao: rows[0],
    });
  } catch (err) {
    log.error("JogosInscricaoErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.cancelarInscricao = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `DELETE FROM pre_inscricoes_jogos WHERE filiado_id = $1`;
    await pool.query(query, [userId]);

    log.info("JogosInscricaoCancelada", { userId });

    return res.json({ message: "Sua pré-inscrição foi cancelada com sucesso." });
  } catch (err) {
    log.error("JogosCancelarErro", err);
    return res.status(500).json({ error: "Erro ao cancelar inscrição." });
  }
};

// 🔵 NOVO: obter a inscrição do PRÓPRIO filiado logado
exports.obterMinhaInscricao = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        pi.*,
        f.telefone1
      FROM pre_inscricoes_jogos pi
      JOIN filiados f ON pi.filiado_id = f.id
      WHERE pi.filiado_id = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [userId]);

    if (rows.length === 0) {
      // Nenhuma inscrição ainda
      return res.status(404).json({ error: "Nenhuma pré-inscrição encontrada para este usuário." });
    }

    log.info("JogosMinhaInscricaoVisualizada", { userId });

    return res.json(rows[0]);
  } catch (err) {
    log.error("JogosMinhaInscricaoErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LISTAR_FILIADOS });
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
        f.telefone1
      FROM pre_inscricoes_jogos pi
      JOIN filiados f ON pi.filiado_id = f.id
      ORDER BY pi.nome_filiado ASC; 
    `;
    
    const { rows } = await pool.query(query);

    log.info("JogosListagemVisualizada", { viewerId: req.user.id });

    return res.json({ total: rows.length, inscricoes: rows });

  } catch (err) {
    log.error("JogosListagemErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LISTAR_FILIADOS });
  }
};
