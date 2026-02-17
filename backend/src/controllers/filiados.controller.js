// src/controllers/filiados.controller.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
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
  normalizeSexo,
  normalizePerfil,
  normalizeLotacao
} = require('../shared/canon');

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
 * Valida se um ID é numérico e seguro.
 */
function parseFiliadoId(req, res, requestId) {
  const raw = String(req.params.id ?? "").trim();

  if (!/^\d+$/.test(raw)) {
    res.status(400).json({ success: false, message: "ID inválido.", requestId });
    return null;
  }

  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: "ID inválido.", requestId });
    return null;
  }

  return id;
}

function handleDbError(err, res, requestId, defaultMessage = "Erro no banco de dados") {
    // Padrão de erro de Schema ou Constraint Violations (23... ou 42703)
    if (err && (String(err.code).startsWith('23') || err.code === '42703')) {
        return res.status(400).json({
            success: false,
            message: err.detail || err.message || defaultMessage,
            code: err.code,
            requestId
        });
    }

    log.error("FiliadosDbErro", { error: err.message, code: err.code, requestId });
    return res.status(500).json({ success: false, message: defaultMessage, requestId });
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
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const idAlvo = parseFiliadoId(req, res, requestId);
  if (idAlvo === null) return;

  try {
    const filiado = await buscarPorId(idAlvo);

    if (!filiado) {
      return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });
    }

    const perfilAtor = (req.user.perfil_acesso || "FILIADO").toUpperCase();
    const ehGestor = perfilGestao(perfilAtor);
    const ehProprioUsuario = String(atorId) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    const { senha_hash, twofa_secret, ...dadosFiliado } = filiado;

    return res.json({ ...dadosFiliado, requestId });
  } catch (err) {
    log.error("FiliadosGetByIdErro", { error: err, requestId, atorId, targetId: idAlvo });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.CARREGAR_DADOS, requestId });
  }
};

/**
 * GET /api/filiados/me
 */
exports.getMe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const filiado = await buscarPorId(atorId);

    if (!filiado) {
      return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });
    }

    const { senha_hash, twofa_secret, ...dadosFiliado } = filiado;

    return res.json({
      ...dadosFiliado,
      twofa_ativo: !!twofa_secret,
      requestId
    });
  } catch (err) {
    log.error("FiliadosGetMeErro", { error: err, requestId, atorId });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.CARREGAR_DADOS, requestId });
  }
};

/**
 * GET /api/filiados
 */
exports.listarFiliados = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const perfilAcesso = (req.user.perfil_acesso || "FILIADO").toUpperCase();
    const termoBusca = (req.query.q || "").toString();
    const incluirArquivados = String(req.query.incluirArquivados || "").trim() === "1";

    const incluirArquivadosEfetivo = incluirArquivados && perfilGestao(perfilAcesso);

    const lista = await listarParaPerfil(perfilAcesso, termoBusca, incluirArquivadosEfetivo);

    return res.json({
      total: lista.length,
      filiados: lista,
      requestId
    });
  } catch (err) {
    log.error("FiliadosListarErro", { error: err, requestId, atorId });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.LISTAR_FILIADOS, requestId });
  }
};

/**
 * PUT /api/filiados/me
 */
exports.atualizarMeusDados = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
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

    const atualizado = await atualizarDadosProprios(atorId, payload);

    log.info("FiliadoAtualizouProprios", { atorId, requestId });

    return res.json({
      success: true,
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
      requestId
    });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ success: false, message: err.message, requestId });
    }
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.ATUALIZAR_DADOS);
  }
};

/**
 * DELETE /api/filiados/:id/dependentes
 */
exports.excluirDependentes = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const idAlvo = parseFiliadoId(req, res, requestId);
    if (idAlvo === null) return;

    const { indices } = req.body;
    if (!Array.isArray(indices)) {
      return res.status(400).json({ success: false, message: "Indices inválidos.", requestId });
    }

    const ehGestor = perfilGestao(req.user.perfil_acesso);
    const ehProprioUsuario = String(atorId) === String(idAlvo);

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    const filiado = await buscarPorId(idAlvo);
    if (!filiado) {
      return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });
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

    log.info("DependentesExcluidos", { atorId, alvoId: idAlvo, requestId });

    return res.json({
      success: true,
      message: "Dependentes excluídos com sucesso.",
      filiado: atualizado,
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.ATUALIZAR_DADOS);
  }
};

/**
 * PUT /api/filiados/:id
 */
exports.atualizarFiliado = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const idAlvo = parseFiliadoId(req, res, requestId);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();

    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    const body = req.body || {};

    log.info("FiliadosUpdateIniciado", {
        targetId: idAlvo,
        atorId,
        perfilAtor,
        requestId,
        bodyKeys: Object.keys(body)
    });

    if (body.siape) {
      const siapeLimpo = String(body.siape).replace(/\D/g, "");
      if (siapeLimpo && (siapeLimpo.length < 6 || siapeLimpo.length > 7)) {
        return res.status(400).json({ success: false, message: "Matrícula (SIAPE) deve ter 6 ou 7 dígitos.", requestId });
      }
    }

    if (body.sexo) {
      const sexoNorm = normalizeSexo(body.sexo);
      if (!sexoNorm) {
        return res.status(400).json({ success: false, message: "Sexo inválido. Use M ou F.", requestId });
      }
    }

    if (body.cpf) {
      const cpfLimpo = normalizarCpf(body.cpf);
      if (cpfLimpo.length !== 11) {
        return res.status(400).json({ success: false, message: "CPF inválido (deve ter 11 dígitos).", requestId });
      }

      const checkCpf = await pool.query(
        "SELECT nome FROM filiados WHERE cpf = $1 AND id != $2 LIMIT 1",
        [cpfLimpo, idAlvo]
      );

      if (checkCpf.rows.length > 0) {
        return res.status(409).json({ success: false, message: `CPF já cadastrado para: ${checkCpf.rows[0].nome}.`, requestId });
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
      sexo: body.sexo ? normalizeSexo(body.sexo) : undefined,
      cpf: body.cpf ? normalizarCpf(body.cpf) : undefined,
      siape: body.siape ? String(body.siape).replace(/\D/g, "").slice(0, 7) : undefined,
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

      if (atorId === idAlvo) {
        return res.status(403).json({ success: false, message: "Não é permitido alterar o próprio nível de acesso.", requestId });
      }

      const alvo = await buscarPorId(idAlvo);
      if (!alvo) {
        return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });
      }

      if (perfilAtor === "ADMIN") {
        payload.perfil_acesso = novoPerfil;
      } else {
        if (alvo.perfil_acesso === "ADMIN" || novoPerfil === "ADMIN") {
          return res.status(403).json({ success: false, message: "Apenas ADMIN pode conceder ou retirar o perfil ADMIN.", requestId });
        }
        payload.perfil_acesso = novoPerfil;
      }
    }

    const atualizado = await atualizarFiliadoPorId(idAlvo, payload);
    if (!atualizado) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    log.info("FiliadoEditadoPorGestao", {
        atorId,
        alvoId: idAlvo,
        requestId,
        perfilAtor,
        bodyKeys: Object.keys(body)
    });

    return res.json({ success: true, message: Textos.SUCESSO.DADOS_ATUALIZADOS, filiado: atualizado, requestId });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ success: false, message: err.message, requestId });
    }
    return handleDbError(err, res, requestId, "Erro ao atualizar filiado");
  }
};

/**
 * POST /api/filiados
 */
exports.criarFiliado = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();

    if (!perfilGestao(perfilCriador)) {
      return res.status(403).json({ success: false, message: Textos.FILIADOS.PERMISSAO_CRIAR, requestId });
    }

    const body = req.body || {};
    if (!body.nome || !body.cpf || !body.email1) {
      return res.status(400).json({ success: false, message: Textos.FILIADOS.CAMPOS_OBRIGATORIOS, requestId });
    }

    if (body.siape) {
      const siapeLimpo = String(body.siape).replace(/\D/g, "");
      if (siapeLimpo && (siapeLimpo.length < 6 || siapeLimpo.length > 7)) {
        return res.status(400).json({ success: false, message: "Matrícula (SIAPE) deve ter 6 ou 7 dígitos.", requestId });
      }
    }

    if (body.sexo) {
      const sexoNorm = normalizeSexo(body.sexo);
      if (!sexoNorm) {
        return res.status(400).json({ success: false, message: "Sexo inválido. Use M ou F.", requestId });
      }
    }

    const cpfLimpo = normalizarCpf(body.cpf);
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ success: false, message: "CPF inválido (deve ter 11 dígitos).", requestId });
    }

    const checkCpf = await pool.query("SELECT nome FROM filiados WHERE cpf = $1 LIMIT 1", [cpfLimpo]);

    if (checkCpf.rows.length > 0) {
      return res.status(409).json({ success: false, message: `CPF já pertence ao filiado: ${checkCpf.rows[0].nome}.`, requestId });
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
      sexo: body.sexo ? normalizeSexo(body.sexo) : null,
      cpf: cpfLimpo,
      siape: body.siape ? String(body.siape).replace(/\D/g, "").slice(0, 7) : null,
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
      log.error("FiliadoEmailBoasVindasErro", { error: emailErr, requestId });
    }

    log.info("FiliadoCriado", { atorId, newId: novo.id, requestId });

    return res.status(201).json({ success: true, message: Textos.SUCESSO.CRIADO_SUCESSO, filiado: novo, requestId });
  } catch (err) {
    if (err.isValidationError) {
      return res.status(400).json({ success: false, message: err.message, requestId });
    }
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.CRIAR_FILIADO);
  }
};

/**
 * POST /api/filiados/:id/arquivar
 */
exports.arquivarFiliado = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const idAlvo = parseFiliadoId(req, res, requestId);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(400).json({ success: false, message: "Motivo é obrigatório.", requestId });

    const atualizado = await arquivarFiliadoPorId(idAlvo, {
      atorId,
      atorPerfil: perfilAtor,
      motivo,
    });

    if (!atualizado) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    return res.json({ success: true, message: "Estado do cadastro alterado para: ARQUIVADO.", filiado: atualizado, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.ATUALIZAR_DADOS);
  }
};

/**
 * POST /api/filiados/:id/desarquivar
 */
exports.desarquivarFiliado = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const idAlvo = parseFiliadoId(req, res, requestId);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    const motivo = String(req.body?.motivo || "").trim();
    const atualizado = await desarquivarFiliadoPorId(idAlvo, {
      atorId,
      atorPerfil: perfilAtor,
      motivo,
    });

    if (!atualizado) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    return res.json({ success: true, message: "Estado do cadastro alterado para: CADASTRO ATIVO.", filiado: atualizado, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.ATUALIZAR_DADOS);
  }
};

/**
 * POST /api/filiados/me/avatar
 */
exports.uploadAvatarMe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: "Arquivo não enviado.", requestId });

    const antes = await buscarPorId(atorId);
    const publicId = `sinprfes/avatars/filiado_${atorId}`;

    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await atualizarFiliadoPorId(atorId, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({ success: true, message: "Avatar atualizado.", avatar_url: up.avatar_url, filiado: atualizado, requestId });
  } catch (err) {
    log.error("FiliadosUploadAvatarMeErro", { error: err, requestId, atorId });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, requestId });
  }
};

/**
 * POST /api/filiados/:id/avatar
 */
exports.uploadAvatarPorId = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const idAlvo = parseFiliadoId(req, res, requestId);
  if (idAlvo === null) return;

  try {
    const perfilAtor = (req.user.perfil_acesso || "").toUpperCase();
    if (!perfilGestao(perfilAtor)) {
      return res.status(403).json({ success: false, message: Textos.AUTH.PERMISSAO_INSUFICIENTE, requestId });
    }

    if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: "Arquivo não enviado.", requestId });

    const antes = await buscarPorId(idAlvo);
    if (!antes) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    const publicId = `sinprfes/avatars/filiado_${idAlvo}`;
    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);
    const atualizado = await atualizarFiliadoPorId(idAlvo, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({ success: true, message: "Avatar atualizado.", avatar_url: up.avatar_url, filiado: atualizado, requestId });
  } catch (err) {
    log.error("FiliadosUploadAvatarPorIdErro", { error: err, requestId, atorId, targetId: idAlvo });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, requestId });
  }
};

/**
 * POST /api/filiados/2fa/desativar
 */
exports.desativar2fa = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const atualizado = await salvarTwoFaSecret(atorId, null);
    if (!atualizado) return res.status(400).json({ success: false, message: "Não foi possível desativar o 2FA.", requestId });

    log.info("Filiado2FADesativado", { atorId, requestId });
    return res.json({ success: true, message: "2FA desativado com sucesso.", twofa_ativo: false, requestId });
  } catch (err) {
    log.error("Filiado2FADesativarErro", { error: err, requestId, atorId });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, requestId });
  }
};

exports.removerAvatarMe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const antes = await buscarPorId(atorId);
    if (!antes) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    if (antes.avatar_public_id) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    await atualizarFiliadoPorId(atorId, { avatar_url: null, avatar_public_id: null });
    return res.json({ success: true, message: "Foto removida com sucesso.", avatar_url: null, requestId });
  } catch (err) {
    log.error("RemoverAvatarMeErro", { error: err, requestId, atorId });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, requestId });
  }
};

exports.removerAvatarPorId = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const id = parseFiliadoId(req, res, requestId);
  if (id === null) return;

  try {
    const antes = await buscarPorId(id);
    if (!antes) return res.status(404).json({ success: false, message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });

    if (antes.avatar_public_id) {
      try { await deleteAvatarByPublicId(antes.avatar_public_id); } catch {}
    }

    await atualizarFiliadoPorId(id, { avatar_url: null, avatar_public_id: null });
    return res.json({ success: true, message: "Foto removida com sucesso.", avatar_url: null, requestId });
  } catch (err) {
    log.error("RemoverAvatarPorIdErro", { error: err, requestId, atorId, targetId: id });
    return res.status(500).json({ success: false, message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, requestId });
  }
};
