const pool = require("../config/db");
const log = require("../utils/log");
const { enviarEmailConfirmacaoInscricaoLogistica, enviarEmailCancelamentoInscricaoLogistica, enviarEmailRelatorio } = require("../services/email.service");
const pdfService = require("../services/pdf.service");
const usersService = require("../services/users.service");
const { parseUuid } = require("../utils/format");
const { STATUS_EVENTO, ACOES_AUDITORIA, RECURSO_TIPO } = require("../../shared/logistica");
const { isGestao, canRegisterForEvent } = require("../../shared/canon");
const Textos = require("../utils/textos");

/**
 * Valida determinísticamente se uma string está nos formatos:
 * - YYYY-MM-DD (Data simples)
 * - YYYY-MM-DDTHH:mm:ssZ (ISO 8601 UTC)
 * - YYYY-MM-DDTHH:mm:ss.sssZ (ISO 8601 UTC com milissegundos)
 */
function isValidDateString(str) {
    if (!str || typeof str !== 'string') return false;

    const regexDate = /^\d{4}-\d{2}-\d{2}$/;
    const regexIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

    if (!regexDate.test(str) && !regexIso.test(str)) return false;

    const d = new Date(str);
    return !isNaN(d.getTime());
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
    const atorId = req.user?.id;
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

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
        log.error("Logistica.listarEventos.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao listar eventos logísticos.", requestId: req.requestId });
    }
};

exports.criarEvento = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        const { titulo, descricao, data_inicio, data_fim, documento_url, documento_id, assembleia_id } = req.body;

        if (!titulo || !data_inicio || !data_fim) {
            return res.status(400).json({ error: "Título e datas são obrigatórios." });
        }

        if (!isValidDateString(data_inicio) || !isValidDateString(data_fim)) {
            return res.status(400).json({ error: "Datas de início ou fim inválidas (formatos aceitos: YYYY-MM-DD ou ISO 8601 UTC)." });
        }

        const validAssembleiaId = assembleia_id ? parseUuid(assembleia_id) : null;
        if (assembleia_id && !validAssembleiaId) {
            return res.status(400).json({ error: "assembleia_id inválido." });
        }

        await client.query("BEGIN");

        const query = `
            INSERT INTO logistica_eventos (titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status, assembleia_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const { rows } = await client.query(query, [titulo, descricao, data_inicio, data_fim, documento_url, documento_id, STATUS_EVENTO.ATIVO, validAssembleiaId]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: evento.id,
            eventId: evento.id,
            gestorId: atorId,
            action: ACOES_AUDITORIA.CRIAR,
            justification: "Criação inicial do evento",
            newData: evento
        });

        await client.query("COMMIT");
        res.status(201).json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.criarEvento.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao criar evento.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

exports.atualizarEvento = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        const eventoId = parseUuid(req.params.id);
        if (!eventoId) return res.status(400).json({ error: "ID inválido (UUID esperado).", requestId: req.requestId });
        const { titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status, justificativa, assembleia_id } = req.body;

        if (!justificativa) {
            return res.status(400).json({ error: "Justificativa é obrigatória para alterações de gestão.", requestId: req.requestId });
        }

        if ((data_inicio && !isValidDateString(data_inicio)) || (data_fim && !isValidDateString(data_fim))) {
            return res.status(400).json({ error: "Datas de início ou fim inválidas (formatos aceitos: YYYY-MM-DD ou ISO 8601 UTC).", requestId: req.requestId });
        }

        const validAssembleiaId = assembleia_id ? parseUuid(assembleia_id) : null;
        if (assembleia_id && !validAssembleiaId) {
            return res.status(400).json({ error: "assembleia_id inválido.", requestId: req.requestId });
        }

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Evento não encontrado.", requestId: req.requestId });
        const oldData = oldRows[0];

        const query = `
            UPDATE logistica_eventos
            SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, documento_url = $5, documento_id = $6, status = $7, assembleia_id = $8, atualizado_em = NOW()
            WHERE id = $9
            RETURNING *
        `;
        const { rows } = await client.query(query, [titulo, descricao, data_inicio, data_fim, documento_url, documento_id, status, validAssembleiaId, eventoId]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: eventoId,
            eventId: eventoId,
            gestorId: atorId,
            action: ACOES_AUDITORIA.ALTERAR,
            justification: justificativa,
            oldData,
            newData: evento
        });

        await client.query("COMMIT");
        res.json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.atualizarEvento.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao atualizar evento.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

exports.encerrarEvento = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        const eventoId = parseUuid(req.params.id);
        if (!eventoId) return res.status(400).json({ error: "ID inválido (UUID esperado).", requestId: req.requestId });
        const { justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória para encerrar evento.", requestId: req.requestId });

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Evento não encontrado.", requestId: req.requestId });
        const oldData = oldRows[0];

        if (oldData.status === STATUS_EVENTO.ENCERRADO) return res.status(400).json({ error: "Evento já está encerrado.", requestId: req.requestId });

        const query = `
            UPDATE logistica_eventos
            SET status = $1, encerrado_em = NOW(), encerrado_por = $2, encerrado_motivo = $3, atualizado_em = NOW()
            WHERE id = $4
            RETURNING *
        `;
        const { rows } = await client.query(query, [STATUS_EVENTO.ENCERRADO, atorId, justificativa, eventoId]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: eventoId,
            eventId: eventoId,
            gestorId: atorId,
            action: ACOES_AUDITORIA.ALTERAR,
            justification: justificativa,
            oldData,
            newData: evento
        });

        await client.query("COMMIT");
        res.json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.encerrarEvento.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao encerrar evento.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

exports.cancelarEvento = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        const eventoId = parseUuid(req.params.id);
        if (!eventoId) return res.status(400).json({ error: "ID inválido (UUID esperado).", requestId: req.requestId });
        const { justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória para cancelar evento.", requestId: req.requestId });

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Evento não encontrado.", requestId: req.requestId });
        const oldData = oldRows[0];

        if (oldData.status === STATUS_EVENTO.CANCELADO) return res.status(400).json({ error: "Evento já está cancelado.", requestId: req.requestId });

        const query = `
            UPDATE logistica_eventos
            SET status = $1, cancelado_em = NOW(), cancelado_por = $2, cancelado_motivo = $3, atualizado_em = NOW()
            WHERE id = $4
            RETURNING *
        `;
        const { rows } = await client.query(query, [STATUS_EVENTO.CANCELADO, atorId, justificativa, eventoId]);
        const evento = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.EVENTO,
            resourceId: eventoId,
            eventId: eventoId,
            gestorId: atorId,
            action: ACOES_AUDITORIA.CANCELAR,
            justification: justificativa,
            oldData,
            newData: evento
        });

        await client.query("COMMIT");
        res.json(evento);
    } catch (err) {
        await client.query("ROLLBACK");
        log.error("Logistica.cancelarEvento.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao cancelar evento.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

// --- INSCRIÇÕES ---

exports.listarInscricoes = async (req, res) => {
    try {
        const eventoId = parseUuid(req.params.eventoId);
        if (!eventoId) return res.status(400).json({ error: "ID de evento inválido.", requestId: req.requestId });
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
        log.error("Logistica.listarInscricoes.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao listar inscrições.", requestId: req.requestId });
    }
};

exports.registrarMinhaInscricao = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        // CANON: Apenas Diretoria e Conselheiro podem se inscrever
        if (!canRegisterForEvent(req.user.perfil_acesso)) {
            return res.status(403).json({ error: "Seu perfil não possui permissão para se inscrever em eventos." });
        }

        const { evento_id, data_chegada, data_saida, observacoes } = req.body;

        if (!evento_id || !data_chegada || !data_saida) {
            return res.status(400).json({ error: "Evento e datas são obrigatórios." });
        }

        const validEventoId = parseUuid(evento_id);
        if (!validEventoId) return res.status(400).json({ error: "evento_id inválido (UUID esperado)." });

        if (!isValidDateString(data_chegada) || !isValidDateString(data_saida)) {
            return res.status(400).json({ error: "Datas de chegada ou saída inválidas (formatos aceitos: YYYY-MM-DD ou ISO 8601 UTC)." });
        }

        // Validar datas
        if (new Date(data_chegada) >= new Date(data_saida)) {
            return res.status(400).json({ error: "A data de chegada deve ser anterior à data de saída." });
        }

        // Verificar se evento está ativo
        const { rows: evRows } = await client.query("SELECT status, titulo, data_inicio, data_fim FROM logistica_eventos WHERE id = $1", [validEventoId]);
        if (evRows.length === 0) return res.status(404).json({ error: "Evento não encontrado.", requestId: req.requestId });

        if (evRows[0].status !== STATUS_EVENTO.ATIVO) {
            const msg = evRows[0].status === STATUS_EVENTO.ENCERRADO ? "Evento encerrado." : "Evento cancelado.";
            return res.status(400).json({ error: msg, requestId: req.requestId });
        }

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
        const { rows } = await client.query(query, [validEventoId, atorId, data_chegada, data_saida, observacoes]);
        const inscricao = rows[0];

        await client.query("COMMIT");

        // Enviar e-mail (best effort)
        try {
            const { rows: uRows } = await pool.query("SELECT name as nome, email FROM users WHERE id = $1", [atorId]);
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
        log.error("Logistica.registrarMinhaInscricao.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao registrar inscrição.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

exports.cancelarMinhaInscricao = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        if (!atorId) return res.status(401).json({ error: "Sessão inválida.", requestId: req.requestId });

        const eventoId = parseUuid(req.params.eventoId);
        if (!eventoId) return res.status(400).json({ error: "ID de evento inválido.", requestId: req.requestId });

        await client.query("BEGIN");

        const { rows: evRows } = await client.query("SELECT status, titulo FROM logistica_eventos WHERE id = $1", [eventoId]);
        if (evRows.length > 0 && evRows[0].status !== STATUS_EVENTO.ATIVO) {
            const msg = evRows[0].status === STATUS_EVENTO.ENCERRADO ? "Evento encerrado." : "Evento cancelado.";
            return res.status(400).json({ error: msg, requestId: req.requestId });
        }

        const { rows: iRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE evento_id = $1 AND user_id = $2", [eventoId, atorId]);
        if (iRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada.", requestId: req.requestId });
        const snapshot = iRows[0];

        await client.query("DELETE FROM logistica_inscricoes WHERE evento_id = $1 AND user_id = $2", [eventoId, atorId]);

        await client.query("COMMIT");

        // Enviar e-mail
        try {
            const { rows: uRows } = await pool.query("SELECT name as nome, email FROM users WHERE id = $1", [atorId]);
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
        log.error("Logistica.cancelarMinhaInscricao.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao cancelar inscrição.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

// --- GESTÃO DE INSCRIÇÕES ---

exports.atualizarInscricaoTerceiro = async (req, res) => {
    const atorId = req.user?.id;
    const client = await pool.connect();
    try {
        const gestorId = atorId;
        const inscricaoId = parseUuid(req.params.id); // ID da inscrição
        if (!inscricaoId) return res.status(400).json({ error: "ID de inscrição inválido.", requestId: req.requestId });
        const { data_chegada, data_saida, observacoes, justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória.", requestId: req.requestId });

        if ((data_chegada && !isValidDateString(data_chegada)) || (data_saida && !isValidDateString(data_saida))) {
            return res.status(400).json({ error: "Datas de chegada ou saída inválidas (formatos aceitos: YYYY-MM-DD ou ISO 8601 UTC).", requestId: req.requestId });
        }

        // Validar datas
        if (data_chegada && data_saida && new Date(data_chegada) >= new Date(data_saida)) {
            return res.status(400).json({ error: "A data de chegada deve ser anterior à data de saída.", requestId: req.requestId });
        }

        await client.query("BEGIN");

        const { rows: oldRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE id = $1", [inscricaoId]);
        if (oldRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada.", requestId: req.requestId });
        const oldData = oldRows[0];

        const query = `
            UPDATE logistica_inscricoes
            SET data_chegada = $1, data_saida = $2, observacoes = $3, atualizado_em = NOW()
            WHERE id = $4
            RETURNING *
        `;
        const { rows } = await client.query(query, [data_chegada, data_saida, observacoes, inscricaoId]);
        const inscricao = rows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.INSCRICAO,
            resourceId: inscricaoId,
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
        log.error("Logistica.atualizarInscricaoTerceiro.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao atualizar inscrição de terceiro.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

exports.cancelarInscricaoTerceiro = async (req, res) => {
    const client = await pool.connect();
    try {
        const gestorId = getUserId(req);
        const inscricaoId = parseUuid(req.params.id);
        if (!inscricaoId) return res.status(400).json({ error: "ID de inscrição inválido.", requestId: req.requestId });
        const { justificativa } = req.body;

        if (!justificativa) return res.status(400).json({ error: "Justificativa obrigatória.", requestId: req.requestId });

        await client.query("BEGIN");

        const { rows: iRows } = await client.query("SELECT * FROM logistica_inscricoes WHERE id = $1", [inscricaoId]);
        if (iRows.length === 0) return res.status(404).json({ error: "Inscrição não encontrada.", requestId: req.requestId });
        const snapshot = iRows[0];

        await registrarAuditoria(client, {
            resourceType: RECURSO_TIPO.INSCRICAO,
            resourceId: inscricaoId,
            eventId: snapshot.evento_id,
            targetUserId: snapshot.user_id,
            gestorId,
            action: ACOES_AUDITORIA.CANCELAR,
            justification,
            oldData: snapshot
        });

        await client.query("DELETE FROM logistica_inscricoes WHERE id = $1", [inscricaoId]);

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
        log.error("Logistica.cancelarInscricaoTerceiro.Erro", { error: err.message, stack: err.stack, requestId: req.requestId });
        res.status(500).json({ error: "Erro ao cancelar inscrição de terceiro.", requestId: req.requestId });
    } finally {
        client.release();
    }
};

// --- RELATÓRIOS ---

exports.exportarPdf = async (req, res) => {
    const requestId = req.requestId;
    const userId = getUserId(req);
    const eventoId = parseUuid(req.params.eventoId);
    if (!eventoId) return res.status(400).json({ error: "ID de evento inválido." });

    try {
        const [eventoRes, user] = await Promise.all([
            pool.query("SELECT * FROM logistica_eventos WHERE id = $1", [eventoId]),
            usersService.getMe(userId)
        ]);

        if (eventoRes.rows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
        const evento = eventoRes.rows[0];

        if (!user) return res.status(404).json({ error: "Usuário solicitante não encontrado." });

        const queryInscricoes = `
            SELECT i.*, u.name as nome, u.cargo, u.uf, u.cpf, u.telefone1, u.email
            FROM logistica_inscricoes i
            JOIN users u ON i.user_id = u.id
            WHERE i.evento_id = $1
            ORDER BY u.name ASC
        `;
        const { rows: inscricoes } = await pool.query(queryInscricoes, [eventoId]);

        const pdfBuffer = await pdfService.gerarPdfInscricoesLogistica(evento, inscricoes, { podeVerCpf: true });

        log.info("Logistica.exportarPdf.Iniciado", { requestId, userId, eventoId });

        await enviarEmailRelatorio(
            user,
            `Inscrições Logística: ${evento.titulo}`,
            pdfBuffer,
            `inscricoes_logistica_${eventoId.slice(0, 8)}.pdf`
        );

        res.json({ success: true, message: "Exportação enviada para seu e-mail." });
    } catch (err) {
        log.error("Logistica.exportarPdf.Erro", { requestId, userId, eventoId, error: err.message, stack: err.stack });
        res.status(500).json({ error: "Erro ao processar exportação PDF." });
    }
};

exports.exportarXls = async (req, res) => {
    const requestId = req.requestId;
    const userId = getUserId(req);
    const eventoId = parseUuid(req.params.eventoId);
    if (!eventoId) return res.status(400).json({ error: "ID de evento inválido." });

    try {
        const [eventoRes, user] = await Promise.all([
            pool.query("SELECT titulo FROM logistica_eventos WHERE id = $1", [eventoId]),
            usersService.getMe(userId)
        ]);

        if (eventoRes.rows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
        const evento = eventoRes.rows[0];

        if (!user) return res.status(404).json({ error: "Usuário solicitante não encontrado." });

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
        const xlsBuffer = Buffer.from(csvContent, 'utf-8');

        log.info("Logistica.exportarXls.Iniciado", { requestId, userId, eventoId });

        await enviarEmailRelatorio(
            user,
            `Inscrições Logística (XLS): ${evento.titulo}`,
            xlsBuffer,
            `inscricoes_${eventoId.slice(0, 8)}.xls`
        );

        res.json({ success: true, message: "Exportação enviada para seu e-mail." });
    } catch (err) {
        log.error("Logistica.exportarXls.Erro", { requestId, userId, eventoId, error: err.message, stack: err.stack });
        res.status(500).json({ error: "Erro ao processar exportação XLS." });
    }
};
