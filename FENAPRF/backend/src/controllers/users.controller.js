// src/controllers/users.controller.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { uploadAvatarBuffer, deleteAvatarByPublicId } = require("../services/cloudinary.service");

const pool = require("../config/db");
const log = require("../utils/log");
const Textos = require("../utils/textos");

const usersService = require("../services/users.service");

const { enviarEmailBoasVindasUser } = require("../services/email.service");
const { normalizarCpf } = require("../utils/format");
const {
  normalizeSituacaoFuncional,
  normalizeSexo,
  normalizePerfil,
  normalizeLotacao
} = require("../../shared/canon");

function perfilGestao(perfil) {
  const p = normalizePerfil(perfil);
  return ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(p);
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
  const raw = String(req.params.id ?? "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw)) {
    res.status(400).json({ success: false, message: "ID inválido (UUID esperado)." });
    return null;
  }
  return raw;
}

/**
 * Valida, sanitiza e normaliza os dados dos dependentes.
 */
function validarESanitizarDependentes(body) {
  const dependentesValidos = [];
  const erros = [];

  for (let i = 1; i <= 5; i++) {
    const nome = (body[`dep${i}_nome`] || "").trim();
    const cpf = (body[`dep${i}_cpf`] || "").replace(/\D/g, "");
    const dataNascimento = normalizeDateField(body[`dep${i}_data_nascimento`]);
    const parentesco = (body[`dep${i}_parentesco`] || "").trim();

    const temAlgumDado = nome || cpf || dataNascimento || parentesco;

    if (temAlgumDado) {
      const numeroDependenteAtual = dependentesValidos.length + 1;
      if (nome && !cpf) erros.push(`Dependente ${numeroDependenteAtual}: CPF é obrigatório se o nome for preenchido.`);
      if (cpf && !nome) erros.push(`Dependente ${numeroDependenteAtual}: Nome é obrigatório se o CPF for preenchido.`);
      if (cpf && cpf.length !== 11) erros.push(`Dependente ${numeroDependenteAtual}: CPF inválido (deve ter 11 dígitos).`);
      if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) erros.push(`Dependente ${numeroDependenteAtual}: Data de nascimento inválida (use AAAA-MM-DD).`);

      dependentesValidos.push({ nome: nome || null, cpf: cpf || null, data_nascimento: dataNascimento || null, parentesco: parentesco || null });
    }
  }

  if (erros.length > 0) {
    const error = new Error(erros.join(" \n"));
    error.isValidationError = true;
    throw error;
  }
  return dependentesValidos;
}

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const user = await usersService.getMe(idAlvo);

    if (!user) {
      return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });
    }

    const atorId = req.user.id;
    const perfilAtor = (req.user.perfil_acesso || "CONSELHEIRO").toUpperCase();
    const ehGestor = perfilGestao(perfilAtor);
    const ehProprioUsuario = String(atorId) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const { senha_hash, password_hash, twofa_secret, ...dadosLimpos } = user;
    return res.json(dadosLimpos);
  } catch (err) {
    log.error("UsersGetByIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id, targetId: idAlvo });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/users/me
 */
exports.getMe = async (req, res) => {
  try {
    const id = req.user.id;
    const user = await usersService.getMe(id);

    if (!user) {
      return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });
    }

    const { senha_hash, password_hash, twofa_secret, ...dadosLimpos } = user;

    return res.json({
      ...dadosLimpos,
      twofa_ativo: false,
    });
  } catch (err) {
    log.error("UsersGetMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/users
 */
exports.listarUsers = async (req, res) => {
  try {
    const perfilAcesso = (req.user.perfil_acesso || "CONSELHEIRO").toUpperCase();
    const termoBusca = (req.query.q || "").toString();
    const incluirArquivados = String(req.query.incluirArquivados || "").trim() === "1";

    const incluirArquivadosEfetivo = incluirArquivados && perfilGestao(perfilAcesso);

    const lista = await usersService.listarParaPerfil(perfilAcesso, termoBusca, incluirArquivadosEfetivo);

    return res.json({
      total: lista.length,
      users: lista,
    });
  } catch (err) {
    log.error("UsersListarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.LISTAR_USERS });
  }
};

/**
 * PUT /api/users/me
 */
exports.atualizarMeusDados = async (req, res) => {
  try {
    const id = req.user.id;
    const body = req.body || {};

    const dependentesArray = validarESanitizarDependentes(body);
    const dadosDependentes = {};
    for (let i = 0; i < 5; i++) {
      const dep = dependentesArray[i];
      dadosDependentes[`dep${i + 1}_nome`] = dep ? dep.nome : null;
      dadosDependentes[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
      dadosDependentes[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
      dadosDependentes[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
    }

    const payload = {
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email1: body.email1,
      email: body.email,
      lotacao: body.lotacao ? normalizeLotacao(body.lotacao) : undefined,
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
      ...dadosDependentes,
    };

    const atualizado = await usersService.atualizarDadosProprios(id, payload);

    log.info("UserAtualizouProprios", { userId: id, requestId: req.requestId });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      user: atualizado,
    });
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    log.error("UsersUpdateMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * DELETE /api/users/:id/dependentes
 */
exports.excluirDependentes = async (req, res) => {
  try {
    const idAlvo = parseUserId(req, res);
    if (idAlvo === null) return;

    const { indices } = req.body;
    if (!Array.isArray(indices)) return res.status(400).json({ message: "Indices inválidos." });

    const ehGestor = perfilGestao(req.user.perfil_acesso);
    const ehProprioUsuario = String(req.user.id) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const user = await usersService.getMe(idAlvo);
    if (!user) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    const dependentesAtuais = [];
    for (let i = 1; i <= 5; i++) {
      if (user[`dep${i}_nome`]) {
        dependentesAtuais.push({
          nome: user[`dep${i}_nome`],
          cpf: user[`dep${i}_cpf`],
          data_nascimento: user[`dep${i}_data_nascimento`],
          parentesco: user[`dep${i}_parentesco`],
        });
      }
    }

    const dependentesMantidos = dependentesAtuais.filter((_, index) => !indices.includes(index));

    const dadosDependentes = {};
    for (let i = 0; i < 5; i++) {
      const dep = dependentesMantidos[i];
      dadosDependentes[`dep${i + 1}_nome`] = dep ? dep.nome : null;
      dadosDependentes[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
      dadosDependentes[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
      dadosDependentes[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
    }

    const atualizado = await usersService.atualizarUserPorId(idAlvo, dadosDependentes);

    log.info("DependentesExcluidos", { atorId: req.user.id, alvoId: idAlvo, requestId: req.requestId });

    return res.json({ message: "Dependentes excluídos com sucesso.", user: atualizado });
  } catch (err) {
    log.error("DependentesExcluirErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * PUT /api/users/:id
 */
exports.atualizarUser = async (req, res) => {
  const loggedId = req.user?.id;
  const idAlvo = parseUserId(req, res);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const body = req.body || {};

    log.info("UsersUpdateIniciado", { targetId: idAlvo, loggedId, perfilAtor, bodyKeys: Object.keys(body), requestId: req.requestId });

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

    const dependentesArray = validarESanitizarDependentes(body);
    const dadosDependentes = {};
    for (let i = 0; i < 5; i++) {
      const dep = dependentesArray[i];
      dadosDependentes[`dep${i + 1}_nome`] = dep ? dep.nome : null;
      dadosDependentes[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
      dadosDependentes[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
      dadosDependentes[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
    }

    const payload = {
      nome: body.nome,
      sexo: body.sexo ? normalizeSexo(body.sexo) : undefined,
      cpf: body.cpf ? normalizarCpf(body.cpf) : undefined,
      data_nascimento: normalizeDateField(body.data_nascimento) || undefined,
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email1: body.email1,
      email: body.email,
      lotacao: body.lotacao ? normalizeLotacao(body.lotacao) : undefined,
      situacao: body.situacao ? normalizeSituacaoFuncional(body.situacao) : undefined,
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
      ...dadosDependentes,
    };

    if (body.perfil_acesso) {
      const novoPerfil = normalizePerfil(body.perfil_acesso);
      if (loggedId === idAlvo) return res.status(403).json({ message: "Não é permitido alterar o próprio nível de acesso." });

      const alvo = await usersService.getMe(idAlvo);
      if (!alvo) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

      if (perfilAtor !== "ADMIN" && (alvo.perfil_acesso === "ADMIN" || novoPerfil === "ADMIN")) {
        return res.status(403).json({ message: "Apenas ADMIN pode conceder ou retirar o perfil ADMIN." });
      }
      payload.perfil_acesso = novoPerfil;
    }

    const atualizado = await usersService.atualizarUserPorId(idAlvo, payload);
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserEditadoPorGestao", { atorId: loggedId, alvoId: idAlvo, requestId: req.requestId });
    return res.json({ message: Textos.SUCESSO.DADOS_ATUALIZADOS, user: atualizado });
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    if (err && (err.code === "23505" || (err.message && err.message.includes("duplicate")))) return res.status(409).json({ message: "CPF duplicado no sistema." });

    log.error("UsersUpdateGestaoErro", { message: err.message, stack: err.stack, requestId: req.requestId, loggedId, targetId: idAlvo });
    return res.status(500).json({ success: false, message: "Erro ao atualizar usuário" });
  }
};

/**
 * POST /api/users
 */
exports.criarUser = async (req, res) => {
  try {
    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilCriador)) return res.status(403).json({ message: Textos.USERS.PERMISSAO_CRIAR });

    const body = req.body || {};
    if (!body.nome || !body.cpf || (!body.email1 && !body.email)) return res.status(400).json({ message: Textos.USERS.CAMPOS_OBRIGATORIOS });

    const cpfLimpo = normalizarCpf(body.cpf);
    if (cpfLimpo.length !== 11) return res.status(400).json({ message: "CPF inválido (deve ter 11 dígitos)." });

    const checkCpf = await pool.query("SELECT name FROM users WHERE cpf = $1 LIMIT 1", [cpfLimpo]);
    if (checkCpf.rows.length > 0) return res.status(409).json({ message: `CPF já pertence ao usuário: ${checkCpf.rows[0].name}.` });

    const dependentesArray = validarESanitizarDependentes(body);
    const dadosDependentes = {};
    for (let i = 0; i < 5; i++) {
      const dep = dependentesArray[i];
      dadosDependentes[`dep${i + 1}_nome`] = dep ? dep.nome : null;
      dadosDependentes[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
      dadosDependentes[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
      dadosDependentes[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
    }

    const dadosNovo = {
      nome: String(body.nome).trim(),
      sexo: body.sexo ? normalizeSexo(body.sexo) : null,
      cpf: cpfLimpo,
      data_nascimento: normalizeDateField(body.data_nascimento),
      telefone1: body.telefone1 || null,
      telefone2: body.telefone2 || null,
      email1: body.email1 || null,
      email: body.email || null,
      lotacao: normalizeLotacao(body.lotacao || "SEDE"),
      situacao: normalizeSituacaoFuncional(body.situacao || "ATIVO"),
      perfil_acesso: normalizePerfil(body.perfil_acesso || "CONSELHEIRO"),
      logradouro_bairro: body.logradouro_bairro || null,
      numero: body.numero || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      uf: body.uf || null,
      cep: body.cep || null,
      ...dadosDependentes,
    };

    const novo = await usersService.criarUserInicial(dadosNovo, perfilCriador);

    try { await enviarEmailBoasVindasUser(novo); } catch (emailErr) { log.error("UserEmailBoasVindasErro", { error: emailErr.message, requestId: req.requestId }); }

    log.info("UserCriado", { creatorId: req.user.id, newId: novo.id, requestId: req.requestId });
    return res.status(201).json({ message: Textos.SUCESSO.CRIADO_SUCESSO, user: novo });
  } catch (err) {
    if (err.isValidationError) return res.status(400).json({ message: err.message });
    log.error("UsersCriarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
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
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(400).json({ message: "Motivo é obrigatório." });

    const atualizado = await usersService.arquivarUserPorId(idAlvo, { motivo });
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserArquivado", { atorId: req.user.id, targetId: idAlvo, requestId: req.requestId });
    return res.json({ message: "Estado do cadastro alterado para: ARQUIVADO.", user: atualizado });
  } catch (err) {
    log.error("UsersArquivarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
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
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    const atualizado = await usersService.desarquivarUserPorId(idAlvo);
    if (!atualizado) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    log.info("UserDesarquivado", { atorId: req.user.id, targetId: idAlvo, requestId: req.requestId });
    return res.json({ message: "Estado do cadastro alterado para: CADASTRO ATIVO.", user: atualizado });
  } catch (err) {
    log.error("UsersDesarquivarErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/users/me/avatar
 */
exports.uploadAvatarMe = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await usersService.getMe(userId);
    const publicId = `fenaprf/avatars/user_${userId}`;

    if (antes?.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await usersService.atualizarUserPorId(userId, { avatar_url: up.avatar_url, avatar_public_id: up.avatar_public_id });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, user: atualizado });
  } catch (err) {
    log.error("UsersUploadAvatarMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
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
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });

    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await usersService.getMe(idAlvo);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    const publicId = `fenaprf/avatars/user_${idAlvo}`;
    if (antes?.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await usersService.atualizarUserPorId(idAlvo, { avatar_url: up.avatar_url, avatar_public_id: up.avatar_public_id });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, user: atualizado });
  } catch (err) {
    log.error("UsersUploadAvatarPorIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/users/2fa/desativar
 */
exports.desativar2fa = async (req, res) => {
    return res.status(400).json({ error: "Funcionalidade não disponível para este ambiente." });
};

exports.removerAvatarMe = async (req, res) => {
  try {
    const id = req.user.id;
    const antes = await usersService.getMe(id);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    if (antes.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    await usersService.atualizarUserPorId(id, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("UsersRemoverAvatarMeErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarPorId = async (req, res) => {
  const id = parseUserId(req, res);
  if (id === null) return;

  try {
    const antes = await usersService.getMe(id);
    if (!antes) return res.status(404).json({ message: Textos.USERS.USER_NAO_ENCONTRADO });

    if (antes.avatar_public_id) { try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {} }

    await usersService.atualizarUserPorId(id, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("UsersRemoverAvatarPorIdErro", { message: err.message, stack: err.stack, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};
