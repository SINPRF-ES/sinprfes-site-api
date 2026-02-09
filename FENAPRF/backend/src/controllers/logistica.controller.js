const pool = require("../config/db");
const log = require("../utils/log");
const { enviarEmailConfirmacaoInscricaoLogistica, enviarEmailCancelamentoInscricaoLogistica } = require("../services/email.service");
const pdfService = require("../services/pdf.service");
const { STATUS_EVENTO, ACOES_AUDITORIA, RECURSO_TIPO } = require("../../shared/logistica");

/**
 * Helpers para compatibilidade com diferentes formatos de req.user
 */
function getUserId(req) {
    return req?.user?.id || req?.user?.user_id || null;
}

/**
 * Registra auditoria de logística
 */
async function registrarAuditoria(client, { resourceType, resourceId, eventId, targetUserId, gestorId, action, justification, oldData, newData }) {
    const query = `
        INSERT INTO logistica_auditoria (
            recurso_tipo, recurso_id, evento_id, user_id, gestor_id, acao, justificativa, dados_anteriores, dados_novos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await client.query(query, [
        resourceType, resourceId, eventId, targetUserId, gestorId, action, justification,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null
    ]);
}

// --- EVENTOS ---

exports.listarEventos = async (req, res) => {
    try {
        const { status } = req.query;
        let query = "SELECT * FROM logistica_eventos";
        const params = [];

        if (status) {
            query += " WHERE status = $1";
            params.push(status);
        }

        query += " ORDER BY data_inicio DESC";

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        log.error("Logistica.listarEventos.Erro", err);
        res.status(500).json({ error: "Erro ao listar eventos logísticos." });
    }
};

exports.criarEvento = async (req, res) => {
    const client = await pool.connect();
    try {
        const gestorId = getUserId(req);
        const { titulo, descricao, data_inicio, data_fim, documento_url, documento_id } = req.body;

        if (!titulo || !data_inicio || !data_fim) {
            return res.status(400).json({ error: "Título e datas são obrigatórios." });
        }

        await client.query("BEGIN");

        const query = `
            INSERT INTO logistica_eventos (titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const { rows } = await client.query(query, [titulo, descricao, data_inicio, data_fim, documento_url, documento_id, STATUS_EVENTO.ATIVO]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: evento.id,
            eventId: evento.id,
            gestorId,
            action: ACOES_AUDITORIA.CRIAR,
            justification: "Criação inicial do evento",
            newData: evento
        });

        await client.query("COMMIT");
        res.status(201).json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.criarEvento.Erro", err);
        res.status(500).json({ error: "Erro ao criar evento." });
    } finally {
        client.release();
    }
};

exports.atualizarEvento = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const gestorId = getUserId(req);
        const { titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status, justificativa } = req.body;

        if (!justificativa) {
            return res.status(400).json({ error: "Justificativa é obrigatória para alterações de gestão." });
        }

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_eventos WHERE id = $1", [id]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
        const oldData = oldRows[0];

        const query = `
            UPDATE logistica_eventos
            SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, documento_url = $5, documento_id = $6, status = $7, atualizado_em = NOW()
            WHERE id = $8
            RETURNING *
        `;
        const { rows } = await client.query(query, [titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status, id]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: id,
            eventId: id,
            gestorId,
            action: ACOES_AUDITORIA.ALTERAR,
            justification,
            oldData,
            newData: evento
        });

        await client.query("COMMIT");
        res.json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.atualizarEvento.Erro", err);
        res.status(500).json({ error: "Erro ao atualizar evento." });
    } finally {
        client.release();
    }
};

// --- INSCRIÇÕES ---

exports.listarInscricoes = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const query = `
            SELECT
                i.*,
                u.name as nome,
                u.cargo,
                u.uf,
                u.cpf,
                u.telefone1 as telefone,
                u.email
            FROM logistica_inscricoes i
            JOIN users u ON i.user_id = u.id
            WHERE i.evento_id = $1
            ORDER BY u.name ASC
        `;
        const { rows } = await pool.query(query, [eventoId]);
        res.json(rows);
    } catch (err) {
        log.error("Logistica.listarInscricoes.Erro", err);
        res.status(500).json({ error: "Erro ao listar inscrições." });
    }
};

exports.registrarMinhaInscricao = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = getUserId(req);
        const { evento_id, data_chegada, data_saida, observacoes } = req.body;

        if (!evento_id || !data_chegada || !data_saida) {
            return res.status(400).json({ error: "Evento e datas são obrigatórios." });
        }

        // Validar datas
        if (new Date(data_chegada) >= new Date(data_saida)) {
            return res.status(400).json({ error: "A data de chegada deve ser anterior à data de saída." });
        }

        // Verificar se evento está ativo
        const { rows: evRows } = await client.query("SELECT status, titulo, data_inicio, data_fim FROM logistica_eventos WHERE id = $1", [evento_id]);
        if (evRows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
        if (evRows[0].status === STATUS_EVENTO.ENCERRADO) return res.status(400).json({ error: "Evento encerrado." });

        await client.query("BEGIN");

        const query = `
            INSERT INTO logistica_inscricoes (evento_id, user_id, data_chegada, data_saida, observacoes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (evento_id, user_id) DO UPDATE SET
                data_chegada = EXCLUDED.data_chegada,
                data_saida = EXCLUDED.data_saida,
                observacoes = EXCLUDED.observacoes,
                atualizado_em = NOW()
            RETURNING *
        `;
        const { rows } = await client.query(query, [evento_id, userId, data_chegada, data_saida, observacoes]);
        const inscricao = rows[0];

        await client.query("COMMIT");

        // Enviar e-mail (best effort)
        try {
            const { rows: uRows } = await pool.query("SELECT name as nome, email FROM users WHERE id = $1", [userId]);
            if (uRows.length > 0) {
                await enviarEmailConfirmacaoInscricaoLogistica({
                    user: uRows[0],
                    inscricao,
                    evento: evRows[0]
                });
            }
        } catch (e) { log.error("Logistica.EmailConfirmacao.Erro", e); }

        res.json(inscricao);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.registrarMinhaInscricao.Erro", err);
        res.status(500).json({ error: "Erro ao registrar inscrição." });
    } finally {
        client.release();
    }
};

exports.cancelarMinhaInscricao = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = getUserId(req);
        const { eventoId } = req.params;

        await client.query("BEGIN");

        const { rows: evRows } = await client.query("SELECT status, titulo FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (evRows.length > 0 && evRows[0].status === STATUS_EVENTO.ENCERRADO) {
            return res.status(400).json({ error: "Evento encerrado." });
        }

        const { rows: iRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE evento_id = $1 AND user_id = $2", [eventoId, userId]);
        if (iRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada." });
        const snapshot = iRows[0];

        await client.query("DELETE FROM logistica_inscricoes WHERE evento_id = $1 AND user_id = $2", [eventoId, userId]);

        await client.query("COMMIT");

        // Enviar e-mail
        try {
            const { rows: uRows } = await pool.query("SELECT name as nome, email FROM users WHERE id = $1", [userId]);
            if (uRows.length > 0) {
                await enviarEmailCancelamentoInscricaoLogistica({
                    user: uRows[0],
                    inscricao: snapshot,
                    evento: evRows[0]
                });
            }
        } catch (e) { log.error("Logistica.EmailCancelamento.Erro", e); }

        res.json({ success: true });
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.cancelarMinhaInscricao.Erro", err);
        res.status(500).json({ error: "Erro ao cancelar inscrição." });
    } finally {
        client.release();
    }
};

// --- GESTÃO DE INSCRIÇÕES ---

exports.atualizarInscricaoTerceiro = async (req, res) => {
    const client = await pool.connect();
    try {
        const gestorId = getUserId(req);
        const { id } = req.params; // ID da inscrição
        const { data_chegada, data_saida, observacoes, justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória." });

        // Validar datas
        if (data_chegada && data_saida && new Date(data_chegada) >= new Date(data_saida)) {
            return res.status(400).json({ error: "A data de chegada deve ser anterior à data de saída." });
        }

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE id = $1", [id]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada." });
        const oldData = oldRows[0];

        const query = `
            UPDATE logistica_inscricoes
            SET data_chegada = $1, data_saida = $2, observacoes = $3, atualizado_em = NOW()
            WHERE id = $4
            RETURNING *
        `;
        const { rows } = await client.query(query, [data_chegada, data_saida, observacoes, id]);
        const inscricao = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.INSCRICAO,
            resourceId: id,
            eventId: inscricao.evento_id,
            targetUserId: inscricao.user_id,
            gestorId,
            action: ACOES_AUDITORIA.ALTERAR,
            justification,
            oldData,
            newData: inscricao
        });

        await client.query("COMMIT");
        res.json(inscricao);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.atualizarInscricaoTerceiro.Erro", err);
        res.status(500).json({ error: "Erro ao atualizar inscrição de terceiro." });
    } finally {
        client.release();
    }
};

exports.cancelarInscricaoTerceiro = async (req, res) => {
    const client = await pool.connect();
    try {
        const gestorId = getUserId(req);
        const { id } = req.params;
        const { justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória." });

        await client.query("BEGIN");

        const { rows: iRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE id = $1", [id]);
        if (iRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada." });
        const snapshot = iRows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.INSCRICAO,
            resourceId: id,
            eventId: snapshot.evento_id,
            targetUserId: snapshot.user_id,
            gestorId,
            action: ACOES_AUDITORIA.CANCELAR,
            justification,
            oldData: snapshot
        });

        await client.query("DELETE FROM logistica_inscricoes WHERE id = $1", [id]);

        await client.query("COMMIT");

        // Enviar e-mail de cancelamento para o user
        try {
            const { rows: uRows } = await pool.query("SELECT name as nome, email FROM users WHERE id = $1", [snapshot.user_id]);
            const { rows: evRows } = await pool.query("SELECT titulo FROM logistica_eventos WHERE id = $1", [snapshot.evento_id]);
            if (uRows.length > 0) {
                await enviarEmailCancelamentoInscricaoLogistica({
                    user: uRows[0],
                    inscricao: snapshot,
                    evento: evRows[0] || {}
                });
            }
        } catch (e) { log.error("Logistica.EmailCancelamentoTerceiro.Erro", e); }

        res.json({ success: true });
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.cancelarInscricaoTerceiro.Erro", err);
        res.status(500).json({ error: "Erro ao cancelar inscrição de terceiro." });
    } finally {
        client.release();
    }
};

// --- RELATÓRIOS ---

exports.exportarPdf = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const { rows: evRows } = await pool.query("SELECT * FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (evRows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
        const evento = evRows[0];

        const queryInscricoes = `
            SELECT i.*, u.name as nome, u.cargo, u.uf, u.cpf, u.telefone1, u.email
            FROM logistica_inscricoes i
            JOIN users u ON i.user_id = u.id
            WHERE i.evento_id = $1
            ORDER BY u.name ASC
        `;
        const { rows: inscricoes } = await pool.query(queryInscricoes, [eventoId]);

        const pdfBuffer = await pdfService.gerarPdfInscricoesLogistica(evento, inscricoes, { podeVerCpf: true });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=inscricoes_logistica_${eventoId.slice(0,8)}.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        log.error("Logistica.exportarPdf.Erro", err);
        res.status(500).json({ error: "Erro ao gerar PDF." });
    }
};

exports.exportarXls = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const { rows: evRows } = await pool.query("SELECT titulo FROM logistica_eventos WHERE id = $1", [eventoId]);
        const titulo = evRows[0]?.titulo || "Evento";

        const query = `
            SELECT
                u.name as Nome,
                u.cargo as Cargo,
                u.uf as UF,
                u.cpf as CPF,
                u.telefone1 as Telefone,
                u.email as Email,
                i.data_chegada as Chegada,
                i.data_saida as Saida,
                i.observacoes as Observacoes
            FROM logistica_inscricoes i
            JOIN users u ON i.user_id = u.id
            WHERE i.evento_id = $1
            ORDER BY u.name ASC
        `;
        const { rows } = await pool.query(query, [eventoId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Nenhuma inscrição para exportar." });
        }

        const headers = Object.keys(rows[0]).join(";");
        const csvRows = rows.map(row => {
            return Object.values(row).map(val => {
                if (val instanceof Date) return val.toLocaleString('pt-BR');
                return `"${String(val || "").replace(/"/g, '""')}"`;
            }).join(";");
        });

        const csvContent = "\ufeff" + headers + "\n" + csvRows.join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=inscricoes_${eventoId.slice(0,8)}.xls`);
        res.send(Buffer.from(csvContent, 'utf-8'));
    } catch (err) {
        log.error("Logistica.exportarXls.Erro", err);
        res.status(500).json({ error: "Erro ao exportar XLS." });
    }
};
