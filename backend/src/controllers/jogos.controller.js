const pool = require("../config/db");
const log = require("../utils/log");
const Textos = require("../utils/textos");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");

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
  const requestId = req.requestId || uuidv4();
  return res.status(410).json({
    success: false,
    error: "As inscrições dos Jogos de Integração 2026 foram encerradas.",
    requestId,
  });
};

/**
 * Cancela a pré-inscrição do filiado.
 * Fluxo legado encerrado para preservar os participantes já registrados.
 */
exports.cancelarInscricao = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  return res.status(410).json({
    success: false,
    error: "As inscrições dos Jogos de Integração 2026 foram encerradas.",
    requestId,
  });
};

/**
 * Obtém a inscrição do próprio filiado logado (inclui dados auxiliares do filiado).
 * IMPORTANTE: inclui data_nascimento para cálculo de idade no frontend.
 */
exports.obterMinhaInscricao = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const userId = atorId || getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, error: "Usuário não autenticado.", requestId });
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

    log.info("JogosMinhaInscricaoVisualizada", { userId, requestId });

    return res.json({
      success: true,
      inscricao: rows[0] || null,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos?.ERROS_INTERNOS?.LISTAR_FILIADOS || "Erro ao obter inscrição.");
  }
};

/**
 * Lista inscrições (apenas perfis autorizados).
 * IMPORTANTE: inclui data_nascimento para cálculo de idade no frontend.
 */
exports.listarInscricoes = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();

    if (!PERFIS_JOGOS_MANAGER.includes(perfil)) {
      return res.status(403).json({ success: false, error: "Acesso negado.", requestId });
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

    log.info("JogosListagemVisualizada", { viewerId: atorId, requestId });

    return res.json({ success: true, total: rows.length, inscricoes: rows, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos?.ERROS_INTERNOS?.LISTAR_FILIADOS || "Erro ao listar inscrições.");
  }
};
