// src/controllers/logistica.controller.js
const pool = require("../config/db");
const log = require("../utils/log");
const {
  enviarEmailLogistica,
  enviarEmailCancelamentoLogistica,
} = require("../services/email.service");
// No backend, usamos require para o arquivo compartilhado.
// Como ele usa UMD, ele exporta via module.exports se detectado.
const LogisticaConstants = require("../../shared/constants");

/**
 * Helpers para compatibilidade
 */
function getUserId(req) {
  return req?.user?.id ?? req?.user?.userId ?? null;
}

function isManager(req) {
  const perfil = (req.user?.perfil_acesso || "").toUpperCase();
  return ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfil);
}

/**
 * EVENTOS
 */

exports.listarEventos = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM logistica_eventos ORDER BY data_inicio DESC"
    );
    return res.json(rows);
  } catch (err) {
    log.error("LogisticaListarEventosErro", err);
    return res.status(500).json({ error: "Erro ao listar eventos." });
  }
};

exports.obterEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM logistica_eventos WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }
    return res.json(rows[0]);
  } catch (err) {
    log.error("LogisticaObterEventoErro", err);
    return res.status(500).json({ error: "Erro ao obter evento." });
  }
};

exports.criarEvento = async (req, res) => {
  try {
    const { titulo, descricao, data_inicio, data_fim, status, documento_link } =
      req.body;

    if (!titulo || !data_inicio || !data_fim) {
      return res
        .status(400)
        .json({ error: "Título, data de início e fim são obrigatórios." });
    }

    const { rows } = await pool.query(
      `INSERT INTO logistica_eventos (titulo, descricao, data_inicio, data_fim, status, documento_link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        titulo,
        descricao,
        data_inicio,
        data_fim,
        status || "ativo",
        documento_link,
      ]
    );

    log.info("LogisticaEventoCriado", { eventoId: rows[0].id, by: getUserId(req) });
    return res.status(201).json(rows[0]);
  } catch (err) {
    log.error("LogisticaCriarEventoErro", err);
    return res.status(500).json({ error: "Erro ao criar evento." });
  }
};

exports.atualizarEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, data_inicio, data_fim, status, documento_link } =
      req.body;

    const { rows } = await pool.query(
      `UPDATE logistica_eventos
       SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, status = $5, documento_link = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [titulo, descricao, data_inicio, data_fim, status, documento_link, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    log.info("LogisticaEventoAtualizado", { eventoId: id, by: getUserId(req) });
    return res.json(rows[0]);
  } catch (err) {
    log.error("LogisticaAtualizarEventoErro", err);
    return res.status(500).json({ error: "Erro ao atualizar evento." });
  }
};

exports.cancelarEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;
    const actorId = getUserId(req);

    if (!justificativa) {
      return res.status(400).json({ error: "Justificativa é obrigatória para cancelar um evento." });
    }

    const { rows } = await pool.query(
      `UPDATE logistica_eventos
       SET status = 'cancelado', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    log.info("LogisticaEventoCancelado", { eventoId: id, by: actorId, justificativa });

    // Opcionalmente: cancelar todas as inscrições do evento ou notificar
    // Para simplificar, apenas marcamos o evento como cancelado.

    return res.json({ message: "Evento cancelado com sucesso.", evento: rows[0] });
  } catch (err) {
    log.error("LogisticaCancelarEventoErro", err);
    return res.status(500).json({ error: "Erro ao cancelar evento." });
  }
};

/**
 * INSCRIÇÕES
 */

exports.listarInscricoesPorEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        li.*,
        u.nome as name,
        u.cargo,
        u.uf,
        u.cpf,
        u.telefone1 as telefone,
        u.email1 as email
      FROM logistica_inscricoes li
      JOIN users u ON li.user_id = u.id
      WHERE li.evento_id = $1
      ORDER BY u.nome ASC
    `;
    const { rows } = await pool.query(query, [id]);
    return res.json(rows);
  } catch (err) {
    log.error("LogisticaListarInscricoesErro", err);
    return res.status(500).json({ error: "Erro ao listar inscrições." });
  }
};

exports.inscreverProprio = async (req, res) => {
  try {
    const evento_id = req.params.id;
    const user_id = getUserId(req);
    const { data_chegada, data_saida, observacoes } = req.body;

    if (!data_chegada || !data_saida) {
      return res
        .status(400)
        .json({ error: "Data de chegada e saída são obrigatórias." });
    }

    if (new Date(data_chegada) >= new Date(data_saida)) {
      return res
        .status(400)
        .json({ error: "A data de chegada deve ser anterior à data de saída." });
    }

    // Verificar se o evento está encerrado
    const { rows: evRows } = await pool.query("SELECT status FROM logistica_eventos WHERE id = $1", [evento_id]);
    if (evRows.length > 0 && evRows[0].status === 'encerrado') {
        return res.status(400).json({ error: "Este evento já está encerrado e não aceita mais inscrições." });
    }

    const query = `
      INSERT INTO logistica_inscricoes (evento_id, user_id, data_chegada, data_saida, observacoes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (evento_id, user_id) DO UPDATE SET
        data_chegada = EXCLUDED.data_chegada,
        data_saida = EXCLUDED.data_saida,
        observacoes = EXCLUDED.observacoes,
        updated_at = NOW()
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      evento_id,
      user_id,
      data_chegada,
      data_saida,
      observacoes,
    ]);

    const inscricao = rows[0];

    // Auditoria
    await pool.query(
      `INSERT INTO logistica_inscricoes_auditoria (inscricao_id, evento_id, user_id, acao, realizado_por, dados_novos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [inscricao.id, evento_id, user_id, "CRIAR", user_id, JSON.stringify(inscricao)]
    );

    // E-mail de confirmação
    try {
        const { rows: uRows } = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
        const { rows: eRows } = await pool.query("SELECT * FROM logistica_eventos WHERE id = $1", [evento_id]);
        if (uRows.length > 0 && eRows.length > 0) {
            await enviarEmailLogistica(uRows[0], eRows[0], inscricao);
        }
    } catch (e) {
        log.error("LogisticaEmailErro", e);
    }

    return res.status(200).json(inscricao);
  } catch (err) {
    log.error("LogisticaInscreverErro", err);
    return res.status(500).json({ error: "Erro ao realizar inscrição." });
  }
};

exports.atualizarInscricao = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = getUserId(req);
    const { data_chegada, data_saida, observacoes, justificativa } = req.body;

    // Buscar inscrição atual
    const { rows: currentRows } = await pool.query(
      "SELECT * FROM logistica_inscricoes WHERE id = $1",
      [id]
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ error: "Inscrição não encontrada." });
    }
    const current = currentRows[0];

    // Verificar se o evento está encerrado
    const { rows: evRows } = await pool.query("SELECT status FROM logistica_eventos WHERE id = $1", [current.evento_id]);
    if (evRows.length > 0 && evRows[0].status === 'encerrado') {
        return res.status(400).json({ error: "Este evento está encerrado e não permite mais alterações." });
    }

    // Verificar permissão
    const ehGestor = isManager(req);
    if (!ehGestor && current.user_id !== actorId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    // Se for gestor alterando de terceiro, justificativa é obrigatória
    if (ehGestor && current.user_id !== actorId && !justificativa) {
        return res.status(400).json({ error: "A justificativa é obrigatória para alterações realizadas pela gestão." });
    }

    if (data_chegada && data_saida && new Date(data_chegada) >= new Date(data_saida)) {
        return res.status(400).json({ error: "A data de chegada deve ser anterior à data de saída." });
    }

    const { rows } = await pool.query(
      `UPDATE logistica_inscricoes
       SET data_chegada = COALESCE($1, data_chegada),
           data_saida = COALESCE($2, data_saida),
           observacoes = COALESCE($3, observacoes),
           justificativa = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data_chegada, data_saida, observacoes, justificativa, id]
    );

    const updated = rows[0];

    // Auditoria
    await pool.query(
      `INSERT INTO logistica_inscricoes_auditoria (inscricao_id, evento_id, user_id, acao, realizado_por, justificativa, dados_anteriores, dados_novos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, updated.evento_id, updated.user_id, "ALTERAR", actorId, justificativa, JSON.stringify(current), JSON.stringify(updated)]
    );

    // E-mail de confirmação (apenas se o próprio alterou ou se a gestão alterou para o user)
    try {
        const { rows: uRows } = await pool.query("SELECT * FROM users WHERE id = $1", [updated.user_id]);
        const { rows: eRows } = await pool.query("SELECT * FROM logistica_eventos WHERE id = $1", [updated.evento_id]);
        if (uRows.length > 0 && eRows.length > 0) {
            await enviarEmailLogistica(uRows[0], eRows[0], updated);
        }
    } catch (e) {
        log.error("LogisticaEmailErro", e);
    }

    return res.json(updated);
  } catch (err) {
    log.error("LogisticaAtualizarInscricaoErro", err);
    return res.status(500).json({ error: "Erro ao atualizar inscrição." });
  }
};

exports.cancelarInscricao = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = getUserId(req);
    const { justificativa } = req.body;

    // Buscar inscrição atual
    const { rows: currentRows } = await pool.query(
      `SELECT li.*, u.nome as user_nome, u.email1, u.email2, e.titulo as evento_titulo, e.status as evento_status
       FROM logistica_inscricoes li
       JOIN users u ON li.user_id = u.id
       JOIN logistica_eventos e ON li.evento_id = e.id
       WHERE li.id = $1`,
      [id]
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ error: "Inscrição não encontrada." });
    }
    const current = currentRows[0];

    // Verificar se o evento está encerrado
    if (current.evento_status === 'encerrado') {
        return res.status(400).json({ error: "Este evento está encerrado e não permite cancelamentos." });
    }

    // Verificar permissão
    const ehGestor = isManager(req);
    if (!ehGestor && current.user_id !== actorId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    // Se for gestor cancelando de terceiro, justificativa é obrigatória
    if (ehGestor && current.user_id !== actorId && !justificativa) {
        return res.status(400).json({ error: "A justificativa é obrigatória para cancelamentos realizados pela gestão." });
    }

    await pool.query("DELETE FROM logistica_inscricoes WHERE id = $1", [id]);

    // Auditoria
    await pool.query(
      `INSERT INTO logistica_inscricoes_auditoria (inscricao_id, evento_id, user_id, acao, realizado_por, justificativa, dados_anteriores)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, current.evento_id, current.user_id, "CANCELAR", actorId, justificativa, JSON.stringify(current)]
    );

    // E-mail de cancelamento
    try {
        await enviarEmailCancelamentoLogistica(current, { titulo: current.evento_titulo }, current);
    } catch (e) {
        log.error("LogisticaEmailCancelamentoErro", e);
    }

    return res.json({ message: "Inscrição cancelada com sucesso." });
  } catch (err) {
    log.error("LogisticaCancelarInscricaoErro", err);
    return res.status(500).json({ error: "Erro ao cancelar inscrição." });
  }
};

exports.exportarInscricoes = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'pdf' ou 'xls'

    const { rows: eventoRows } = await pool.query("SELECT * FROM logistica_eventos WHERE id = $1", [id]);
    if (eventoRows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
    const evento = eventoRows[0];

    const query = `
      SELECT
        u.nome,
        u.cargo,
        u.uf,
        u.cpf,
        u.telefone1 as telefone,
        u.email1 as email,
        li.data_chegada,
        li.data_saida,
        li.observacoes
      FROM logistica_inscricoes li
      JOIN users u ON li.user_id = u.id
      WHERE li.evento_id = $1
      ORDER BY u.nome ASC
    `;
    const { rows: inscricoes } = await pool.query(query, [id]);

    if (format === 'pdf') {
        const { gerarPdfLogistica } = require("../services/pdf.service");
        const pdfBuffer = await gerarPdfLogistica(evento, inscricoes);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=inscricoes_${id}.pdf`);
        return res.send(pdfBuffer);
    } else {
        // Exportar como CSV (compatível com Excel)
        let csv = "Nome;Cargo;UF;CPF;Telefone;E-mail;Chegada;Saida;Observacoes\n";
        inscricoes.forEach(i => {
            csv += `${i.nome};${i.cargo};${i.uf};${i.cpf};${i.telefone};${i.email};${new Date(i.data_chegada).toLocaleString('pt-BR')};${new Date(i.data_saida).toLocaleString('pt-BR')};${(i.observacoes || "").replace(/;/g, ',')}\n`;
        });
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=inscricoes_${id}.csv`);
        return res.send(Buffer.from("\uFEFF" + csv, 'utf-8')); // Add BOM for Excel UTF-8
    }
  } catch (err) {
    log.error("LogisticaExportarErro", err);
    return res.status(500).json({ error: "Erro ao exportar inscrições." });
  }
};
