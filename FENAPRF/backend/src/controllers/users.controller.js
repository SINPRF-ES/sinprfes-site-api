// src/controllers/users.controller.js
const path = require("path");
const fs = require("fs");
const { uploadAvatarBuffer, deleteAvatarByPublicId } = require("../services/cloudinary.service");

const pool = require("../config/db");
const log = require("../utils/log");
const Textos = require("../utils/textos");

const usersService = require("../services/users.service");

const { enviarEmailBoasVindasUser } = require("../services/email.service");
const { normalizarCpf, parseUuid } = require("../utils/format");
const {
  normalizeSexo,
  normalizePerfil
} = require("../../shared/canon");

const PERFIL_RANK = {
  ADMIN: 100,
  DIRETORIA: 50,
  COLABORADOR: 30,
  CONSELHEIRO: 10
};

function perfilGestao(perfil) {
  const p = normalizePerfil(perfil);
  return ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(p);
}

function canEditorEditTarget(editorPerfil, targetPerfil) {
  const e = (editorPerfil || "").toUpperCase();
  const t = (targetPerfil || "").toUpperCase();

  if (e === "ADMIN") return true;
  if (e === "COLABORADOR") return t !== "ADMIN";

  const eRank = PERFIL_RANK[e] || 0;
  const tRank = PERFIL_RANK[t] || 0;
  return eRank > tRank;
}

async function verificarConflitoCargo(perfil, cargo, uf, userId = null) {
  if (!perfil || !cargo) return null;
  if (perfil === "ADMIN" || perfil === "COLABORADOR") return null;

  const isDiretoria = perfil === "DIRETORIA";

  // Verifica no primeiro vínculo
  let cond1 = "perfil_acesso = $1 AND cargo = $2";
  let params1 = [perfil, cargo];
  if (!isDiretoria) {
    if (!uf) return null;
    cond1 += " AND uf = $3";
    params1.push(uf);
  }
  if (userId) {
    cond1 += ` AND id != $${params1.length + 1}`;
    params1.push(userId);
  }

  const q1 = `SELECT id, name FROM users WHERE ${cond1} AND arquivado_em IS NULL LIMIT 1`;
  const res1 = await pool.query(q1, params1);
  if (res1.rows.length > 0) return res1.rows[0];

  // Verifica no segundo vínculo
  let cond2 = "perfil_acesso2 = $1 AND cargo2 = $2";
  let params2 = [perfil, cargo];
  if (!isDiretoria) {
    cond2 += " AND uf2 = $3";
    params2.push(uf);
  }
  if (userId) {
    cond2 += ` AND id != $${params2.length + 1}`;
    params2.push(userId);
  }

  const q2 = `SELECT id, name FROM users WHERE ${cond2} AND arquivado_em IS NULL LIMIT 1`;
  const res2 = await pool.query(q2, params2);
  if (res2.rows.length > 0) return res2.rows[0];

  return null;
}

/**
 * Verifica se telefone ou e-mail já existem em outros cadastros ativos.
 * Retorna lista de nomes dos membros que já possuem estes dados.
 */
async function verificarAvisosDuplicidade(payload, userId = null) {
  const names = new Set();
  const email = payload.email || payload.email1;
  const tel1 = payload.telefone1 ? String(payload.telefone1).replace(/\D/g, "") : null;
  const tel2 = payload.telefone2 ? String(payload.telefone2).replace(/\D/g, "") : null;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (email) {
    conditions.push(`email = $${idx}`);
    params.push(email);
    idx++;
  }
  if (tel1 && tel1.length >= 8) {
    conditions.push(`(regexp_replace(telefone1, '[^0-9]', '', 'g') = $${idx} OR regexp_replace(telefone2, '[^0-9]', '', 'g') = $${idx})`);
    params.push(tel1);
    idx++;
  }
  if (tel2 && tel2.length >= 8) {
    conditions.push(`(regexp_replace(telefone1, '[^0-9]', '', 'g') = $${idx} OR regexp_replace(telefone2, '[^0-9]', '', 'g') = $${idx})`);
    params.push(tel2);
    idx++;
  }

  if (conditions.length === 0) return [];

  const where = `(${conditions.join(" OR ")})`;
  const query = `
    SELECT name FROM users
    WHERE ${where}
    AND arquivado_em IS NULL
    ${userId ? `AND id != $${idx}` : ""}
    LIMIT 5
  `;
  if (userId) params.push(userId);

  try {
    const { rows } = await pool.query(query, params);
    rows.forEach(r => names.add(r.name));
  } catch (err) {
    log.error("Erro ao verificar avisos de duplicidade", { error: err.message });
  }

  return Array.from(names);
}

/**
 * Normaliza campos de data para o padrão YYYY-MM-DD.
 */
function normalizeDateField(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return str;
}

/**
 * Valida se um ID é um UUID válido (FENAPRF).
 */
function parseUserId(req, res) {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "ID inválido (UUID esperado)." });
    return null;
  }
  return id;
}

// Dependentes removidos conforme política FENAPRF

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const user = await usersService.getMe(idAlvo);

    if (!user) {
      return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });
    }
    const perfilAtor = (req.user.perfil_acesso || "CONSELHEIRO").toUpperCase();
    const ehGestor = perfilGestao(perfilAtor);
    const ehProprioUsuario = String(atorId) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const { senha_hash, password_hash, ...dadosLimpos } = user;
    return res.json(dadosLimpos);
  } catch (err) {
    log.error("UsersGetByIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId, targetId: idAlvo });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/users/me
 */
exports.getMe = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const user = await usersService.getMe(atorId);

    if (!user) {
      return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });
    }

    const { senha_hash, password_hash, ...dadosLimpos } = user;

    return res.json(dadosLimpos);
  } catch (err) {
    log.error("UsersGetMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/users
 */
exports.listarUsers = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilAcesso = (req.user.perfil_acesso || "CONSELHEIRO").toUpperCase();
    const termoBusca = (req.query.q || "").toString();
    const incluirArquivados = String(req.query.incluirArquivados || "").trim() === "1";
    const apenasArquivados = String(req.query.apenasArquivados || "").trim() === "1";

    const incluirArquivadosEfetivo = incluirArquivados && perfilGestao(perfilAcesso);
    const apenasArquivadosEfetivo = apenasArquivados && perfilGestao(perfilAcesso);

    const lista = await usersService.listarParaPerfil(
      perfilAcesso,
      termoBusca,
      incluirArquivadosEfetivo,
      apenasArquivadosEfetivo
    );

    return res.json({
      total: lista.length,
      users: lista,
    });
  } catch (err) {
    log.error("UsersListarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.LISTAR_USERS });
  }
};

/**
 * PUT /api/users/me
 */
exports.atualizarMeusDados = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const body = req.body || {};

    const payload = {
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email: body.email || body.email1,
      // ViaCEP fields blocked for all in /me
      numero: body.numero,
      complemento: body.complemento,
      cep: body.cep,
      uf_endereco: body.uf_endereco,
    };

    const duplicados = await verificarAvisosDuplicidade(payload, atorId);

    const atualizado = await usersService.atualizarDadosProprios(atorId, payload);

    log.info("UserAtualizouProprios", { userId: atorId, requestId: req.requestId });

    const response = {
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      user: atualizado,
      ok: true
    };

    if (duplicados.length > 0) {
      response.warnings = duplicados.map(nome => ({
        code: "DATA_DUPLICATED_WARNING",
        message: `O telefone/e-mail já é utilizado por: ${nome}.`
      }));
    }

    return res.json(response);
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    log.error("UsersUpdateMeErro", {
      message: err.message,
      stack: err.stack,
      requestId: req.requestId,
      userId: atorId,
      payloadKeys: Object.keys(req.body || {})
    });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

// Excluir dependentes removido conforme política FENAPRF

/**
 * PUT /api/users/:id
 */
exports.atualizarUser = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const alvo = await usersService.getMe(idAlvo);
    if (!alvo) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    // Regra de Hierarquia FENAPRF
    if (!canEditorEditTarget(perfilAtor, alvo.perfil_acesso)) {
      return res.status(403).json({ message: "Você não tem permissão para editar este perfil." });
    }

    const body = req.body || {};

    log.info("UsersUpdateIniciado", {
      targetId: idAlvo,
      atorId,
      perfilAtor,
      bodyKeys: Object.keys(body),
      requestId: req.requestId,
      payload_body: body
    });

    if (body.sexo) {
      const sexoNorm = normalizeSexo(body.sexo);
      if (!sexoNorm) return res.status(400).json({ message: "Sexo inválido. Use M ou F." });
    }

    if (body.cpf) {
      const cpfLimpo = normalizarCpf(body.cpf);
      if (cpfLimpo.length !== 11) return res.status(400).json({ message: "CPF inválido (deve ter 11 dígitos)." });

      const checkCpf = await pool.query(
        "SELECT name FROM users WHERE cpf = $1 AND id != $2 LIMIT 1",
        [cpfLimpo, idAlvo]
      );
      if (checkCpf.rows.length > 0) return res.status(409).json({ message: `CPF já cadastrado para: ${checkCpf.rows[0].name}.` });
    }

    const payload = {
      nome: body.nome || body.name,
      sexo: body.sexo ? normalizeSexo(body.sexo) : undefined,
      cpf: body.cpf ? normalizarCpf(body.cpf) : undefined,
      data_nascimento: body.data_nascimento !== undefined ? normalizeDateField(body.data_nascimento) : undefined,
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email: body.email || body.email1,
      // ViaCEP fields blocked for all in FENAPRF
      // logradouro, bairro, cidade, uf (endereco) are read-only
      numero: body.numero,
      complemento: body.complemento,
      cep: body.cep,
      uf_endereco: body.uf_endereco,
      cargo: body.cargo,
      uf: body.uf || body.uf_voto, // prioriza 'uf' canônico
      cargo_mandato_inicio: body.cargo_mandato_inicio !== undefined ? normalizeDateField(body.cargo_mandato_inicio) : undefined,
      cargo_mandato_fim: body.cargo_mandato_fim !== undefined ? normalizeDateField(body.cargo_mandato_fim) : undefined,
    };

    if (body.perfil_acesso) {
      const novoPerfil = normalizePerfil(body.perfil_acesso);
      if (atorId === idAlvo) return res.status(403).json({ message: "Não é permitido alterar o próprio nível de acesso." });

      if (perfilAtor !== "ADMIN" && (alvo.perfil_acesso === "ADMIN" || novoPerfil === "ADMIN")) {
        return res.status(403).json({ message: "Apenas ADMIN pode conceder ou retirar o perfil ADMIN." });
      }

      // Garante que o editor pode atribuir o novo perfil (não pode promover alguém acima de si)
      if (perfilAtor !== "ADMIN" && PERFIL_RANK[novoPerfil] >= PERFIL_RANK[perfilAtor]) {
         return res.status(403).json({ message: "Você não pode atribuir um perfil igual ou superior ao seu." });
      }

      payload.perfil_acesso = novoPerfil;
    }

    // Suporte a Dual Role
    if (body.perfil_acesso2 !== undefined) payload.perfil_acesso2 = body.perfil_acesso2;
    if (body.cargo2 !== undefined) payload.cargo2 = body.cargo2;
    if (body.uf2 !== undefined) payload.uf2 = body.uf2;

    // Verificação de Conflito de Cargo (reutilizando objeto 'alvo' para evitar chamadas redundantes)
    const p1 = payload.perfil_acesso || alvo.perfil_acesso;
    const c1 = payload.cargo || alvo.cargo;
    const u1 = payload.uf || alvo.uf;

    const conflito1 = await verificarConflitoCargo(p1, c1, u1, idAlvo);
    if (conflito1) {
      const msg = (p1 === "DIRETORIA")
        ? `O cargo ${c1} já é ocupado por ${conflito1.name}.`
        : `O cargo ${c1} na UF ${u1} já é ocupado por ${conflito1.name}.`;

      return res.status(409).json({
        code: "CARGO_JA_OCUPADO",
        message: msg,
        details: { conflictUserId: conflito1.id, conflictUserName: conflito1.name }
      });
    }

    if (payload.perfil_acesso2) {
      const conflito2 = await verificarConflitoCargo(payload.perfil_acesso2, payload.cargo2, payload.uf2, idAlvo);
      if (conflito2) {
        const msg2 = (payload.perfil_acesso2 === "DIRETORIA")
          ? `O segundo cargo (${payload.cargo2}) já é ocupado por ${conflito2.name}.`
          : `O segundo cargo (${payload.cargo2} na UF ${payload.uf2}) já é ocupado por ${conflito2.name}.`;

        return res.status(409).json({
          code: "CARGO_JA_OCUPADO",
          message: msg2,
          details: { conflictUserId: conflito2.id, conflictUserName: conflito2.name }
        });
      }
    }

    // Verificação de Avisos de Duplicidade (Telefone/Email) - AVISO apenas
    const duplicados = await verificarAvisosDuplicidade(payload, idAlvo);

    const atualizado = await usersService.atualizarUserPorId(idAlvo, payload);
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserEditadoPorGestao", { atorId, alvoId: idAlvo, requestId: req.requestId });

    const response = {
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      user: atualizado,
      ok: true
    };

    if (duplicados.length > 0) {
      response.warnings = duplicados.map(nome => ({
        code: "DATA_DUPLICATED_WARNING",
        message: `O telefone/e-mail já é utilizado por: ${nome}.`
      }));
    }

    return res.json(response);
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    if (err && (err.code === "23505" || (err.message && err.message.includes("duplicate")))) return res.status(409).json({ message: "CPF duplicado no sistema." });

    log.error("UsersUpdateGestaoErro", {
        message: err.message,
        stack: err.stack,
        requestId: req.requestId,
        atorId,
        targetId: idAlvo,
        payloadKeys: Object.keys(req.body || {}),
        payload_debug: {
            perfil_acesso: req.body?.perfil_acesso,
            cargo: req.body?.cargo,
            uf: req.body?.uf,
            mandato_inicio: req.body?.cargo_mandato_inicio,
            mandato_fim: req.body?.cargo_mandato_fim
        }
    });
    return res.status(500).json({ success: false, message: `Erro ao atualizar membro: ${err.message}` });
  }
};

exports.listarHistoricoArquivamento = async (req, res) => {
  try {
    const { q } = req.query;
    const historico = await usersService.listarHistoricoMovimentacoes(null, q);
    res.json(historico);
  } catch (err) {
    log.error("UsersHistoricoArquivamentoErro", err);
    res.status(500).json({ message: "Erro ao listar histórico de arquivamento." });
  }
};

exports.getHistoricoArquivamentoPorId = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const historico = await usersService.listarHistoricoMovimentacoes(idAlvo);
    res.json(historico);
  } catch (err) {
    log.error("UsersHistoricoArquivamentoPorIdErro", err);
    res.status(500).json({ message: "Erro ao obter histórico do membro." });
  }
};

/**
 * POST /api/users
 */
exports.criarUser = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilCriador)) return res.status(403).json({ message: Textos.USERS.PERMISSAO_CRIAR });

    const body = req.body || {};

    // Suporte a 'name' como alias de 'nome' e 'email' como alias de 'email1' para compatibilidade com Mobile
    const nomeEfetivo = body.nome || body.name;
    const emailEfetivo = body.email1 || body.email;

    if (!nomeEfetivo || !body.cpf || !emailEfetivo) {
        return res.status(400).json({ message: Textos.USERS.CAMPOS_OBRIGATORIOS });
    }

    const cpfLimpo = normalizarCpf(body.cpf);
    if (cpfLimpo.length !== 11) return res.status(400).json({ message: "CPF inválido (deve ter 11 dígitos)." });

    const checkCpf = await pool.query("SELECT name FROM users WHERE cpf = $1 LIMIT 1", [cpfLimpo]);
    if (checkCpf.rows.length > 0) return res.status(409).json({ message: `CPF já pertence ao membro: ${checkCpf.rows[0].name}.` });

    const perfil_acesso = normalizePerfil(body.perfil_acesso || "CONSELHEIRO");
    const cargo = body.cargo || null;
    const uf = body.uf || null;

    // Verificação de Conflito de Cargo
    const conflito1 = await verificarConflitoCargo(perfil_acesso, cargo, uf);
    if (conflito1) {
      const msg = (perfil_acesso === "DIRETORIA")
        ? `O cargo ${cargo} já é ocupado por ${conflito1.name}.`
        : `O cargo ${cargo} na UF ${uf} já é ocupado por ${conflito1.name}.`;

      return res.status(409).json({
        code: "CARGO_JA_OCUPADO",
        message: msg,
        details: { conflictUserId: conflito1.id, conflictUserName: conflito1.name }
      });
    }

    if (body.perfil_acesso2) {
      const conflito2 = await verificarConflitoCargo(body.perfil_acesso2, body.cargo2, body.uf2);
      if (conflito2) {
        const msg2 = (body.perfil_acesso2 === "DIRETORIA")
          ? `O segundo cargo (${body.cargo2}) já é ocupado por ${conflito2.name}.`
          : `O segundo cargo (${body.cargo2} na UF ${body.uf2}) já é ocupado por ${conflito2.name}.`;

        return res.status(409).json({
          code: "CARGO_JA_OCUPADO",
          message: msg2,
          details: { conflictUserId: conflito2.id, conflictUserName: conflito2.name }
        });
      }
    }

    // Verificação de Avisos de Duplicidade (Telefone/Email) - AVISO apenas
    const tempPayloadParaAviso = {
      email: emailEfetivo,
      telefone1: body.telefone1,
      telefone2: body.telefone2
    };

    const duplicados = await verificarAvisosDuplicidade(tempPayloadParaAviso);

    const dadosNovo = {
      nome: String(body.nome || body.name).trim(),
      sexo: body.sexo ? normalizeSexo(body.sexo) : null,
      cpf: cpfLimpo,
      data_nascimento: normalizeDateField(body.data_nascimento),
      telefone1: body.telefone1 || null,
      telefone2: body.telefone2 || null,
      email: body.email || body.email1 || null,
      perfil_acesso,
      cargo,
      uf,
      perfil_acesso2: body.perfil_acesso2 || null,
      cargo2: body.cargo2 || null,
      uf2: body.uf2 || null,
      logradouro_bairro: body.logradouro_bairro || null,
      numero: body.numero || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      cep: body.cep || null,
      uf_endereco: body.uf_endereco || null,
    };

    const novo = await usersService.criarUserInicial(dadosNovo, perfilCriador);

    try { await enviarEmailBoasVindasUser(novo); } catch (emailErr) { log.error("UserEmailBoasVindasErro", { error: emailErr.message, requestId: req.requestId }); }

    log.info("UserCriado", { creatorId: atorId, newId: novo.id, requestId: req.requestId });

    const response = {
      message: Textos.SUCESSO.CRIADO_SUCESSO,
      user: novo,
      ok: true
    };

    if (duplicados.length > 0) {
      response.warnings = duplicados.map(nome => ({
        code: "DATA_DUPLICATED_WARNING",
        message: `O telefone/e-mail já é utilizado por: ${nome}.`
      }));
    }

    return res.status(201).json(response);
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    log.error("UsersCriarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CRIAR_USER });
  }
};

/**
 * POST /api/users/:id/arquivar
 */
exports.arquivarUser = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const alvo = await usersService.getMe(idAlvo);
    if (!alvo) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    if (!canEditorEditTarget(perfilAtor, alvo.perfil_acesso)) {
      return res.status(403).json({ message: "Você não tem permissão para arquivar este perfil." });
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(400).json({ message: "Motivo é obrigatório." });

    const atualizado = await usersService.arquivarUserPorId(idAlvo, { motivo, atorId });
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserArquivado", { atorId, targetId: idAlvo, requestId: req.requestId });
    return res.json({ message: "Estado do cadastro alterado para: ARQUIVADO.", user: atualizado });
  } catch (err) {
    log.error("UsersArquivarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/users/:id/desarquivar
 */
exports.desarquivarUser = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const alvo = await usersService.getMe(idAlvo);
    if (!alvo) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    if (!canEditorEditTarget(perfilAtor, alvo.perfil_acesso)) {
      return res.status(403).json({ message: "Você não tem permissão para desarquivar este perfil." });
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(400).json({ message: "Informe o motivo da reativação." });

    const atualizado = await usersService.desarquivarUserPorId(idAlvo, { motivo, atorId });
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserDesarquivado", { atorId, targetId: idAlvo, requestId: req.requestId });
    return res.json({ message: "Estado do cadastro alterado para: CADASTRO ATIVO.", user: atualizado });
  } catch (err) {
    log.error("UsersDesarquivarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/users/me/avatar
 */
exports.uploadAvatarMe = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await usersService.getMe(atorId);
    const publicId = `fenaprf/avatars/user_${atorId}`;

    if (antes?.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await usersService.atualizarUserPorId(atorId, { avatar_url: up.avatar_url, avatar_public_id: up.avatar_public_id });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, user: atualizado });
  } catch (err) {
    log.error("UsersUploadAvatarMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/users/:id/avatar
 */
exports.uploadAvatarPorId = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await usersService.getMe(idAlvo);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    // Regra de Hierarquia FENAPRF
    if (!canEditorEditTarget(perfilAtor, antes.perfil_acesso)) {
      return res.status(403).json({ message: "Você não tem permissão para alterar o avatar deste perfil." });
    }

    const publicId = `fenaprf/avatars/user_${idAlvo}`;
    if (antes?.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await usersService.atualizarUserPorId(idAlvo, { avatar_url: up.avatar_url, avatar_public_id: up.avatar_public_id });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, user: atualizado });
  } catch (err) {
    log.error("UsersUploadAvatarPorIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarMe = async (req, res) => {
  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const antes = await usersService.getMe(atorId);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    if (antes.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    await usersService.atualizarUserPorId(atorId, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("UsersRemoverAvatarMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarPorId = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const atorId = req.user?.id;
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const antes = await usersService.getMe(idAlvo);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    // Regra de Hierarquia FENAPRF
    if (!canEditorEditTarget(perfilAtor, antes.perfil_acesso)) {
      return res.status(403).json({ message: "Você não tem permissão para remover o avatar deste perfil." });
    }

    if (antes.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    await usersService.atualizarUserPorId(idAlvo, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("UsersRemoverAvatarPorIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: atorId });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};
