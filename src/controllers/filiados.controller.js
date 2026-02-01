// src/controllers/filiados.controller.js
const path = require("path");
const fs = require("fs");
const { uploadAvatarBuffer, deleteAvatarByPublicId } = require("../services/cloudinary.service");

const pool = require("../config/db");
const log = require("../utils/log");
const Textos = require("../utils/textos");

const {
  buscarPorId,
  listarParaPerfil,
  atualizarDadosProprios,
  atualizarFiliadoPorId,
  criarFiliadoInicial,
  salvarTwoFaSecret,
  arquivarFiliadoPorId,
  desarquivarFiliadoPorId,
} = require("../services/filiados.service");

const { enviarEmailBoasVindasFiliado } = require("../services/email.service");
const { normalizarCpf } = require("../utils/format");
const {
  normalizeSituacaoFuncional,
  normalizePerfil,
  normalizeLotacao
} = require("../../shared/canon");

function perfilGestao(perfil) {
  const p = normalizePerfil(perfil);
  return ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(p);
}

/**
 * Normaliza campos de data para o padrão YYYY-MM-DD.
 * Aceita strings ISO completas (YYYY-MM-DDTHH:mm:ss...) e as trunca.
 * Se o valor for vazio ou inválido, retorna null.
 */
function normalizeDateField(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Se for YYYY-MM-DD ou ISO completo (YYYY-MM-DDTHH:mm...), trunca para os 10 primeiros caracteres
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // Suporte legado ou fallback para formato brasileiro DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return str;
}

/**
 * Valida se um ID é numérico e seguro (INTEGER PK).
 * @returns {number|null} O ID convertido ou null se inválido.
 */
function parseFiliadoId(req, res) {
  const raw = String(req.params.id ?? "").trim();

  // IDs em produção são numéricos (SERIAL/INTEGER)
  if (!/^\d+$/.test(raw)) {
    res.status(400).json({ success: false, message: "ID inválido." });
    return null;
  }

  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: "ID inválido." });
    return null;
  }

  return id;
}

/**
 * Valida, sanitiza e normaliza os dados dos dependentes a partir do corpo da requisição.
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

      if (nome && !cpf) {
        erros.push(`Dependente ${numeroDependenteAtual}: CPF é obrigatório se o nome for preenchido.`);
      }
      if (cpf && !nome) {
        erros.push(`Dependente ${numeroDependenteAtual}: Nome é obrigatório se o CPF for preenchido.`);
      }
      if (cpf && cpf.length !== 11) {
        erros.push(`Dependente ${numeroDependenteAtual}: CPF inválido (deve ter 11 dígitos).`);
      }
      if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
        erros.push(`Dependente ${numeroDependenteAtual}: Data de nascimento inválida (use AAAA-MM-DD).`);
      }

      dependentesValidos.push({
        nome: nome || null,
        cpf: cpf || null,
        data_nascimento: dataNascimento || null,
        parentesco: parentesco || null,
      });
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
 * GET /api/filiados/:id
 */
exports.getFiliadoById = async (req, res) => {
  const idAlvo = parseFiliadoId(req, res);
  if (idAlvo === null) return;

  try {
    const filiado = await buscarPorId(idAlvo);

    if (!filiado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    // Apenas gestores podem ver detalhes de outros filiados
    const atorId = req.user.id;
    const perfilAtor = (req.user.perfil_acesso || "FILIADO").toUpperCase();
    const ehGestor = perfilGestao(perfilAtor);
    const ehProprioUsuario = String(atorId) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const { senha_hash, twofa_secret, ...dadosFiliado } = filiado;

    return res.json(dadosFiliado);
  } catch (err) {
    log.error("FiliadosGetByIdErro", { error: err, requestId: req.requestId, userId: req.user?.id, targetId: idAlvo });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/filiados/me
 */
exports.getMe = async (req, res) => {
  try {
    const id = req.user.id;
    const filiado = await buscarPorId(id);

    if (!filiado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    const { senha_hash, twofa_secret, ...dadosFiliado } = filiado;

    return res.json({
      ...dadosFiliado,
      twofa_ativo: !!twofa_secret,
    });
  } catch (err) {
    log.error("FiliadosGetMeErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/filiados
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfilAcesso = (req.user.perfil_acesso || "FILIADO").toUpperCase();
    const termoBusca = (req.query.q || "").toString();
    const incluirArquivados = String(req.query.incluirArquivados || "").trim() === "1";

    const incluirArquivadosEfetivo = incluirArquivados && perfilGestao(perfilAcesso);

    const lista = await listarParaPerfil(perfilAcesso, termoBusca, incluirArquivadosEfetivo);

    return res.json({
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    log.error("FiliadosListarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.LISTAR_FILIADOS });
  }
};

/**
 * PUT /api/filiados/me
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
      email2: body.email2,
      lotacao: body.lotacao ? normalizeLotacao(body.lotacao) : undefined,
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
      ...dadosDependentes,
    };

    const atualizado = await atualizarDadosProprios(id, payload);

    log.info("FiliadoAtualizouProprios", { userId: id, requestId: req.requestId });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
    });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ message: err.message });
    }
    log.error("FiliadosUpdateMeErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * DELETE /api/filiados/:id/dependentes
 */
exports.excluirDependentes = async (req, res) => {
  try {
    const idAlvo = parseFiliadoId(req, res);
    if (idAlvo === null) return;

    const { indices } = req.body;
    if (!Array.isArray(indices)) {
      return res.status(400).json({ message: "Indices inválidos." });
    }

    const ehGestor = perfilGestao(req.user.perfil_acesso);
    const ehProprioUsuario = String(req.user.id) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const filiado = await buscarPorId(idAlvo);
    if (!filiado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    const dependentesAtuais = [];
    for (let i = 1; i <= 5; i++) {
      if (filiado[`dep${i}_nome`]) {
        dependentesAtuais.push({
          nome: filiado[`dep${i}_nome`],
          cpf: filiado[`dep${i}_cpf`],
          data_nascimento: filiado[`dep${i}_data_nascimento`],
          parentesco: filiado[`dep${i}_parentesco`],
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

    const atualizado = await atualizarFiliadoPorId(idAlvo, dadosDependentes);

    log.info("DependentesExcluidos", { atorId: req.user.id, alvoId: idAlvo, requestId: req.requestId });

    return res.json({
      message: "Dependentes excluídos com sucesso.",
      filiado: atualizado,
    });
  } catch (err) {
    log.error("DependentesExcluirErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * PUT /api/filiados/:id
 */
exports.atualizarFiliado = async (req, res) => {
  const loggedId = Number(req.user?.id);
  const idAlvo = parseFiliadoId(req, res);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();

    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const body = req.body || {};

    if (body.cpf) {
      const cpfLimpo = normalizarCpf(body.cpf);
      if (cpfLimpo.length !== 11) {
        return res.status(400).json({ message: "CPF inválido (deve ter 11 dígitos)." });
      }

      const checkCpf = await pool.query(
        "SELECT nome FROM filiados WHERE cpf = $1 AND CAST(id AS TEXT) != CAST($2 AS TEXT) LIMIT 1",
        [cpfLimpo, idAlvo]
      );

      if (checkCpf.rows.length > 0) {
        return res.status(409).json({ message: `CPF já cadastrado para: ${checkCpf.rows[0].nome}.` });
      }
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
      cpf: body.cpf ? normalizarCpf(body.cpf) : undefined,
      data_nascimento: normalizeDateField(body.data_nascimento) || undefined,
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email1: body.email1,
      email2: body.email2,
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

      // Trava de auto-alteração de perfil
      if (loggedId === idAlvo) {
        return res.status(403).json({ message: "Não é permitido alterar o próprio nível de acesso." });
      }

      const alvo = await buscarPorId(idAlvo);
      if (!alvo) {
        return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
      }

      if (perfilAtor === "ADMIN") {
        // ADMIN pode mudar qualquer perfil (exceto o próprio)
        payload.perfil_acesso = novoPerfil;
      } else {
        if (alvo.perfil_acesso === "ADMIN" || novoPerfil === "ADMIN") {
          return res.status(403).json({ message: "Apenas ADMIN pode conceder ou retirar o perfil ADMIN." });
        }
        payload.perfil_acesso = novoPerfil;
      }
    }

    const atualizado = await atualizarFiliadoPorId(idAlvo, payload);
    if (!atualizado) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    log.info("FiliadoEditadoPorGestao", {
        atorId: loggedId,
        alvoId: idAlvo,
        requestId: req.requestId,
        perfilAtor,
        bodyKeys: Object.keys(body)
    });

    return res.json({ message: Textos.SUCESSO.DADOS_ATUALIZADOS, filiado: atualizado });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ message: err.message });
    }

    // fallback (race-condition): constraint única no CPF
    if (
      err &&
      (err.code === "23505" ||
        err.code === "ER_DUP_ENTRY" ||
        (err.message && err.message.includes("duplicate")))
    ) {
      return res.status(409).json({ message: "CPF duplicado no sistema." });
    }

    log.error("FiliadosUpdateGestaoErro", {
        error: err.message,
        stack: err.stack,
        requestId: req.requestId,
        loggedId,
        targetId: idAlvo,
        bodyKeys: Object.keys(req.body || {})
    });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados
 */
exports.criarFiliado = async (req, res) => {
  try {
    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();

    if (!perfilGestao(perfilCriador)) {
      return res.status(403).json({ message: Textos.FILIADOS.PERMISSAO_CRIAR });
    }

    const body = req.body || {};
    if (!body.nome || !body.cpf || !body.email1) {
      return res.status(400).json({ message: Textos.FILIADOS.CAMPOS_OBRIGATORIOS });
    }

    const cpfLimpo = normalizarCpf(body.cpf);
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ message: "CPF inválido (deve ter 11 dígitos)." });
    }

    const checkCpf = await pool.query("SELECT nome FROM filiados WHERE cpf = $1 LIMIT 1", [cpfLimpo]);

    if (checkCpf.rows.length > 0) {
      return res.status(409).json({ message: `CPF já pertence ao filiado: ${checkCpf.rows[0].nome}.` });
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

    const dadosNovo = {
      nome: String(body.nome).trim(),
      cpf: cpfLimpo,
      data_nascimento: normalizeDateField(body.data_nascimento),
      telefone1: body.telefone1 || null,
      telefone2: body.telefone2 || null,
      email1: body.email1 || null,
      email2: body.email2 || null,
      lotacao: normalizeLotacao(body.lotacao || "SEDE"),
      situacao: normalizeSituacaoFuncional(body.situacao || "ATIVO"),
      perfil_acesso: normalizePerfil(body.perfil_acesso || "FILIADO"),
      logradouro_bairro: body.logradouro_bairro || null,
      numero: body.numero || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      uf: body.uf || null,
      cep: body.cep || null,
      ...dadosDependentes,
    };

    const novo = await criarFiliadoInicial(dadosNovo, perfilCriador);

    try {
      await enviarEmailBoasVindasFiliado(novo);
    } catch (emailErr) {
      log.error("FiliadoEmailBoasVindasErro", { error: emailErr, requestId: req.requestId });
    }

    log.info("FiliadoCriado", { creatorId: req.user.id, newId: novo.id, requestId: req.requestId });

    return res.status(201).json({ message: Textos.SUCESSO.CRIADO_SUCESSO, filiado: novo });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ message: err.message });
    }
    log.error("FiliadosCriarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CRIAR_FILIADO });
  }
};

/**
 * POST /api/filiados/:id/arquivar
 */
exports.arquivarFiliado = async (req, res) => {
  const idAlvo = parseFiliadoId(req, res);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(400).json({ message: "Motivo é obrigatório." });

    const atualizado = await arquivarFiliadoPorId(idAlvo, {
      atorId: req.user.id,
      atorPerfil: perfilAtor,
      motivo,
    });

    if (!atualizado) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    return res.json({ message: "Estado do cadastro alterado para: ARQUIVADO.", filiado: atualizado });
  } catch (err) {
    log.error("FiliadosArquivarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/:id/desarquivar
 */
exports.desarquivarFiliado = async (req, res) => {
  const idAlvo = parseFiliadoId(req, res);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    const motivo = String(req.body?.motivo || "").trim();
    const atualizado = await desarquivarFiliadoPorId(idAlvo, {
      atorId: req.user.id,
      atorPerfil: perfilAtor,
      motivo,
    });

    if (!atualizado) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    return res.json({ message: "Estado do cadastro alterado para: CADASTRO ATIVO.", filiado: atualizado });
  } catch (err) {
    log.error("FiliadosDesarquivarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/me/avatar
 */
exports.uploadAvatarMe = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await buscarPorId(userId);
    const publicId = `sinprfes/avatars/filiado_${userId}`;

    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await atualizarFiliadoPorId(userId, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, filiado: atualizado });
  } catch (err) {
    log.error("FiliadosUploadAvatarMeErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/:id/avatar
 */
exports.uploadAvatarPorId = async (req, res) => {
  const idAlvo = parseFiliadoId(req, res);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ message: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "Arquivo não enviado." });

    const antes = await buscarPorId(idAlvo);
    if (!antes) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    const publicId = `sinprfes/avatars/filiado_${idAlvo}`;
    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await atualizarFiliadoPorId(idAlvo, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({ message: "Avatar atualizado.", avatar_url: up.avatar_url, filiado: atualizado });
  } catch (err) {
    log.error("FiliadosUploadAvatarPorIdErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/2fa/desativar
 */
exports.desativar2fa = async (req, res) => {
  try {
    const userId = req.user.id;
    const atualizado = await salvarTwoFaSecret(userId, null);
    if (!atualizado) return res.status(400).json({ message: "Não foi possível desativar o 2FA." });

    log.info("Filiado2FADesativado", { userId, requestId: req.requestId });
    return res.json({ message: "2FA desativado com sucesso.", twofa_ativo: false });
  } catch (err) {
    log.error("Filiado2FADesativarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarMe = async (req, res) => {
  try {
    const id = req.user.id;
    const antes = await buscarPorId(id);
    if (!antes) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    if (antes.avatar_public_id) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    await atualizarFiliadoPorId(id, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("RemoverAvatarMeErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarPorId = async (req, res) => {
  const id = parseFiliadoId(req, res);
  if (id === null) return;

  try {
    const antes = await buscarPorId(id);
    if (!antes) return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });

    if (antes.avatar_public_id) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    await atualizarFiliadoPorId(id, { avatar_url: null, avatar_public_id: null });
    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("RemoverAvatarPorIdErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};
