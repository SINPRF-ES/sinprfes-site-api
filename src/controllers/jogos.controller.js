const pool = require("../config/db");
const log = require("../utils/log");
const Textos = require("../utils/textos");

// E-mails (confirmação / cancelamento)
const {
  enviarEmailConfirmacaoInscricaoJogos,
  enviarEmailCancelamentoInscricaoJogos,
} = require("../services/email.service");

const PERFIS_JOGOS_MANAGER = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

/**
 * Helpers para compatibilidade com diferentes formatos de req.user
 */
function getUserId(req) {
  return (
    req?.user?.id ??
    req?.user?.filiado_id ??
    req?.user?.filiadoId ??
    req?.user?.userId ??
    req?.user?.uid ??
    null
  );
}

function getUserNome(req) {
  return req?.user?.nome ?? req?.user?.name ?? null;
}

/**
 * Registra (ou atualiza) a pré-inscrição do filiado nos jogos.
 * - Mantém os campos: modalidades, observacoes, familiares, qtd_familiares, sexo
 * - Dispara e-mail de confirmação (best-effort: não derruba a inscrição se falhar)
 */
exports.registrarInscricao = async (req, res) => {
  try {
    const userId = getUserId(req);
    const filiadoNome = getUserNome(req);

    if (!userId) {
      log.error("JogosInscricaoErroUserId", { user: req?.user });
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const { modalidades, observacoes, familiares, qtd_familiares, sexo } = req.body || {};

    if (!modalidades || modalidades.length === 0) {
      return res.status(400).json({
        error: "Selecione pelo menos uma modalidade de interesse.",
      });
    }

    const modalidadesTexto = Array.isArray(modalidades) ? modalidades : [];
    const obsLimpa = String(observacoes || "").trim();
    const familiaresLimpo = String(familiares || "").trim();
    const qtdFamiliaresInt = parseInt(qtd_familiares, 10) || 0;
    const sexoLimpo = String(sexo || "").trim();

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
      sexoLimpo,
    ]);

    const inscricao = rows[0];

    log.info("JogosInscricao", { userId, modalidades: modalidadesTexto });

    // E-mail de confirmação (não bloqueia fluxo)
    try {
      const { rows: fRows } = await pool.query(
        `
        SELECT id, nome, email1, email2, telefone1, data_nascimento
        FROM filiados
        WHERE id = $1
        LIMIT 1
      `,
        [userId]
      );

      const filiado = fRows && fRows[0];

      // Log diagnóstico (remova depois se quiser)
      log.info("JogosEmailConfirmacaoDebug", {
        userId,
        filiadoEncontrado: !!filiado,
        email1: filiado?.email1 || null,
        email2: filiado?.email2 || null,
      });

      if (filiado && (filiado.email1 || filiado.email2)) {
        await enviarEmailConfirmacaoInscricaoJogos({
          filiado,
          inscricao: {
            modalidades: inscricao?.modalidades ?? modalidadesTexto,
            observacoes: inscricao?.observacoes ?? obsLimpa,
            familiares: inscricao?.familiares ?? familiaresLimpo,
            qtd_familiares: inscricao?.qtd_familiares ?? qtdFamiliaresInt,
            sexo: inscricao?.sexo ?? sexoLimpo,
            data_inscricao: inscricao?.data_inscricao ?? null,
          },
        });
      } else {
        log.warn("EmailJogosConfirmacao: filiado sem email1/email2.", {
          filiadoId: filiado?.id,
          userId,
        });
      }
    } catch (emailErr) {
      log.error("EmailJogosConfirmacaoErro", emailErr);
    }

    return res.status(200).json({
      message: Textos?.SUCESSO?.INSCRICAO_JOGOS_SUCESSO || "Pré-inscrição registrada com sucesso.",
      inscricao,
    });
  } catch (err) {
    log.error("JogosInscricaoErro", err);
    return res.status(500).json({
      error: Textos?.ERROS_INTERNOS?.ATUALIZAR_DADOS || "Erro interno ao registrar pré-inscrição.",
    });
  }
};

/**
 * Cancela a pré-inscrição do filiado.
 * - Captura a inscrição antes do DELETE para poder enviar e-mail com contexto.
 * - Dispara e-mail de cancelamento (best-effort).
 */
exports.cancelarInscricao = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      log.error("JogosCancelarErroUserId", { user: req?.user });
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    // Captura dados para e-mail antes de apagar
    let snapshot = null;
    try {
      const { rows } = await pool.query(
        `
        SELECT
          pi.*,
          f.id as filiado_id,
          f.nome as filiado_nome,
          f.email1,
          f.email2,
          f.telefone1,
          f.data_nascimento
        FROM pre_inscricoes_jogos pi
        JOIN filiados f ON pi.filiado_id = f.id
        WHERE pi.filiado_id = $1
        LIMIT 1
      `,
        [userId]
      );
      snapshot = rows && rows[0] ? rows[0] : null;
    } catch (e) {
      // não bloqueia cancelamento
      log.error("JogosCancelarSnapshotErro", e);
    }

    const query = `DELETE FROM pre_inscricoes_jogos WHERE filiado_id = $1`;
    await pool.query(query, [userId]);

    log.info("JogosInscricaoCancelada", { userId });

    // E-mail de cancelamento (não bloqueia fluxo)
    try {
      if (snapshot && (snapshot.email1 || snapshot.email2)) {
        await enviarEmailCancelamentoInscricaoJogos({
          filiado: {
            id: snapshot.filiado_id,
            nome: snapshot.filiado_nome || snapshot.nome_filiado,
            email1: snapshot.email1,
            email2: snapshot.email2,
            telefone1: snapshot.telefone1,
            data_nascimento: snapshot.data_nascimento,
          },
          inscricao: {
            modalidades: snapshot.modalidades,
            observacoes: snapshot.observacoes,
            familiares: snapshot.familiares,
            qtd_familiares: snapshot.qtd_familiares,
            sexo: snapshot.sexo,
            data_inscricao: snapshot.data_inscricao,
          },
        });
      } else {
        log.warn("EmailJogosCancelamento: filiado sem email1/email2.", {
          filiadoId: snapshot?.filiado_id,
          userId,
        });
      }
    } catch (emailErr) {
      log.error("EmailJogosCancelamentoErro", emailErr);
    }

    return res.json({ message: "Sua pré-inscrição foi cancelada com sucesso." });
  } catch (err) {
    log.error("JogosCancelarErro", err);
    return res.status(500).json({ error: "Erro ao cancelar inscrição." });
  }
};

/**
 * Obtém a inscrição do próprio filiado logado (inclui dados auxiliares do filiado).
 * IMPORTANTE: inclui data_nascimento para cálculo de idade no frontend.
 */
exports.obterMinhaInscricao = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const query = `
      SELECT 
        pi.*,
        f.telefone1,
        f.data_nascimento,
        f.email1,
        f.email2
      FROM pre_inscricoes_jogos pi
      JOIN filiados f ON pi.filiado_id = f.id
      WHERE pi.filiado_id = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [userId]);

    if (!rows || rows.length === 0) {
      return res.status(204).send();
    }

    log.info("JogosMinhaInscricaoVisualizada", { userId });

    return res.json(rows[0]);
  } catch (err) {
    log.error("JogosMinhaInscricaoErro", err);
    return res.status(500).json({
      error: Textos?.ERROS_INTERNOS?.LISTAR_FILIADOS || "Erro ao obter inscrição.",
    });
  }
};

/**
 * Lista inscrições (apenas perfis autorizados).
 * IMPORTANTE: inclui data_nascimento para cálculo de idade no frontend.
 */
exports.listarInscricoes = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();

    if (!PERFIS_JOGOS_MANAGER.includes(perfil)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const query = `
      SELECT 
        pi.*,
        f.telefone1,
        f.data_nascimento,
        f.email1,
        f.email2
      FROM pre_inscricoes_jogos pi
      JOIN filiados f ON pi.filiado_id = f.id
      ORDER BY pi.nome_filiado ASC; 
    `;

    const { rows } = await pool.query(query);

    log.info("JogosListagemVisualizada", { viewerId: getUserId(req) });

    return res.json({ total: rows.length, inscricoes: rows });
  } catch (err) {
    log.error("JogosListagemErro", err);
    return res.status(500).json({
      error: Textos?.ERROS_INTERNOS?.LISTAR_FILIADOS || "Erro ao listar inscrições.",
    });
  }
};
