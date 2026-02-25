// src/controllers/filiados.controller.js
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
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
  normalizeLotacao,
  normalizeNome,
  ehPerfilGestao,
  ME_EDITABLE_FIELDS_FILIADO,
  ME_EDITABLE_FIELDS_GESTAO
} = require('../shared/canon');

const rolesConfig = require("../config/roles.config");
const { normalizeParentesco, requiresParentescoOutro } = require('../shared/dependentes/parentesco');

const {
  normalizeTelefone,
  normalizeCep,
  parseDateToISO
} = require('../shared/format');


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
    // Log detalhado sempre ocorre no servidor (seguro)
    const errorInfo = {
        message: err?.message,
        detail: err?.detail,
        hint: err?.hint,
        code: err?.code,
        constraint: err?.constraint,
        requestId
    };

    // Padrão de erro de Schema ou Constraint Violations (23... ou 42703)
    if (err && (String(err.code).startsWith('23') || err.code === '42703')) {
        log.error("FiliadosConstraintErro", errorInfo);

        // Resposta genérica segura para o cliente (NUNCA vazar err.detail que contém dados da linha)
        let safeMessage = "Não foi possível processar seus dados. Verifique se os campos obrigatórios estão preenchidos.";

        if (err.code === '23505') {
            safeMessage = "Os dados informados já constam em nosso sistema (conflito de CPF ou E-mail).";
            return res.status(409).json({ success: false, message: safeMessage, code: err.code, requestId });
        }

        // 23502: not_null_violation, 23514: check_violation
        if (err.code === '23502' || err.code === '23514') {
          safeMessage = "Existem campos obrigatórios não preenchidos ou com formato inválido.";
        }

        return res.status(422).json({
            success: false,
            message: safeMessage,
            code: err.code,
            requestId
        });
    }

    // Para qualquer outro erro de banco (500)
    log.error("FiliadosDbErro", errorInfo);

    // Garantir que NUNCA enviamos a mensagem do erro se ela contiver palavras suspeitas de vazamento ou detalhes técnicos
    const hasLeakRisk = err?.message && (
      err.message.includes("Failing row") ||
      err.message.includes("violates") ||
      err.message.includes("SQLSTATE") ||
      err.message.includes("duplicate key") ||
      err.message.includes("check constraint")
    );
    const finalMessage = hasLeakRisk ? defaultMessage : (defaultMessage || "Erro interno no servidor");

    return res.status(500).json({
        success: false,
        message: finalMessage,
        requestId
    });
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
    const dataNascimento = parseDateToISO(body[`dep${i}_data_nascimento`]);
    const parentesco = (body[`dep${i}_parentesco`] || "").trim();
    const parentescoOutro = (body[`dep${i}_parentesco_outro`] || "").trim();

    const temAlgumDado = nome || cpf || dataNascimento || parentesco || parentescoOutro;

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

      if (requiresParentescoOutro(parentesco) && !parentescoOutro) {
        erros.push(`Dependente ${numeroDependenteAtual}: O campo "Outro parentesco" é obrigatório quando o parentesco é "OUTRO".`);
      }

      dependentesValidos.push({
        nome: nome || null,
        cpf: cpf || null,
        data_nascimento: dataNascimento || null,
        parentesco: parentesco || null,
        parentesco_outro: parentescoOutro || null
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
    const ehGestor = ehPerfilGestao(perfilAtor);
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
    const perfil = (dadosFiliado.perfil_acesso || "FILIADO").toUpperCase();
    const permissions = rolesConfig[perfil] || [];

    return res.json({
      ...dadosFiliado,
      twofa_ativo: !!twofa_secret,
      permissions,
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

    const incluirArquivadosEfetivo = incluirArquivados && ehPerfilGestao(perfilAcesso);

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
 * Permite que o usuário atualize seus próprios dados.
 * Implementa whitelist rigorosa baseada no perfil do usuário (Defesa em Profundidade).
 */
exports.atualizarMeusDados = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const perfilAtor = (req.user?.perfil_acesso || "").toUpperCase();

  try {
    const body = req.body || {};

    // 1. Whitelist Canônica por Perfil (B1)
    // ADMIN, DIRETORIA e FUNCIONARIO usam a whitelist de GESTAO.
    // FILIADO e demais perfis usam a whitelist de FILIADO.
    const ehGestor = ehPerfilGestao(perfilAtor);
    const whitelist = ehGestor ? ME_EDITABLE_FIELDS_GESTAO : ME_EDITABLE_FIELDS_FILIADO;

    const receivedFields = Object.keys(body);
    const forbiddenFields = receivedFields.filter(f => !whitelist.includes(f));

    if (forbiddenFields.length > 0) {
      log.warn("FiliadoTentouAlterarCamposProibidos", {
        atorId,
        perfilAtor,
        forbiddenFields,
        requestId
      });
      // Comportamento Canônico (B2): ignoramos campos proibidos e prosseguimos com os permitidos.
      forbiddenFields.forEach(f => delete body[f]);
    }

    // 2. Validação e Normalização com Zod
    const schema = z.object({
      nome: z.string().trim().min(2, "Nome muito curto").optional(),
      cpf: z.string().transform(v => String(v).replace(/\D/g, "")).refine(v => v.length === 11, "CPF inválido").optional(),
      siape: z.string().transform(v => String(v).replace(/\D/g, "")).optional(),
      sexo: z.string().toUpperCase().optional(),
      data_nascimento: z.string().optional(),
      situacao: z.string().optional(),
      telefone1: z.string().nullable().optional(),
      telefone2: z.string().nullable().optional(),
      email1: z.string().trim().min(1, "Obrigatório").email("E-mail inválido").toLowerCase(),
      email2: z.string().trim().toLowerCase().nullable().optional()
        .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
      lotacao: z.string().optional(),
      logradouro_bairro: z.string().trim().nullable().optional(),
      numero: z.string().trim().nullable().optional(),
      complemento: z.string().trim().nullable().optional(),
      cidade: z.string().trim().nullable().optional(),
      uf: z.string().trim().toUpperCase().nullable().optional()
        .refine(v => !v || v.length === 2, "Deve ter 2 letras"),
      cep: z.string().nullable().optional()
        .transform(v => v ? String(v).replace(/\D/g, "") : v)
        .refine(v => !v || v.length === 8, "Deve ter 8 dígitos"),
    }).partial();

    const result = schema.safeParse(body);

    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      return res.status(422).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Existem erros nos campos informados.",
        fields: fieldErrors,
        requestId
      });
    }

    const payload = {};
    const validatedData = result.data;

    // Normalização manual para garantir que só campos enviados sejam incluídos e campos vazios virem null
    if (validatedData.nome !== undefined) payload.nome = normalizeNome(validatedData.nome);
    if (validatedData.cpf !== undefined) payload.cpf = validatedData.cpf; // Já normalizado no Zod (digits only)
    if (validatedData.siape !== undefined) payload.siape = (validatedData.siape || "").toString().replace(/\D/g, "").slice(0, 7) || null;
    if (validatedData.sexo !== undefined) payload.sexo = normalizeSexo(validatedData.sexo);
    if (validatedData.data_nascimento !== undefined) payload.data_nascimento = parseDateToISO(validatedData.data_nascimento);
    if (validatedData.situacao !== undefined) payload.situacao = normalizeSituacaoFuncional(validatedData.situacao);

    if (validatedData.telefone1 !== undefined) payload.telefone1 = normalizeTelefone(validatedData.telefone1) || null;
    if (validatedData.telefone2 !== undefined) payload.telefone2 = normalizeTelefone(validatedData.telefone2) || null;
    if (validatedData.email1 !== undefined) payload.email1 = validatedData.email1;
    if (validatedData.email2 !== undefined) payload.email2 = (validatedData.email2 && validatedData.email2.trim()) || null;
    if (validatedData.lotacao !== undefined) payload.lotacao = normalizeLotacao(validatedData.lotacao);
    if (validatedData.numero !== undefined) payload.numero = validatedData.numero;
    if (validatedData.complemento !== undefined) payload.complemento = (validatedData.complemento && validatedData.complemento.trim()) || null;
    if (validatedData.cep !== undefined) payload.cep = normalizeCep(validatedData.cep) || null;

    // Endereço automático (Canon): Logradouro, Cidade e UF só podem ser alterados via fluxo buscaCEP (acompanhados de CEP)
    if (validatedData.cep !== undefined) {
      if (validatedData.logradouro_bairro !== undefined) payload.logradouro_bairro = validatedData.logradouro_bairro;
      if (validatedData.cidade !== undefined) payload.cidade = validatedData.cidade;
      if (validatedData.uf !== undefined) payload.uf = validatedData.uf;
    }

    // 3. Dependentes (sempre processa o conjunto se algum campo de dependente vier)
    const temCamposDependentes = Object.keys(body).some(k => k.startsWith('dep'));
    if (temCamposDependentes) {
      const dependentesArray = validarESanitizarDependentes(body);
      for (let i = 0; i < 5; i++) {
        const dep = dependentesArray[i];
        payload[`dep${i + 1}_nome`] = dep ? dep.nome : null;
        payload[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
        payload[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
        payload[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
        payload[`dep${i + 1}_parentesco_outro`] = dep ? dep.parentesco_outro : null;
      }
    }

    if (Object.keys(payload).length === 0) {
      return res.status(422).json({ success: false, message: "Nenhum dado informado para atualização.", requestId });
    }

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
      return res.status(422).json({ success: false, message: err.message, requestId });
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

    const ehGestor = ehPerfilGestao(req.user.perfil_acesso);
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
          parentesco_outro: filiado[`dep${i}_parentesco_outro`],
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
      dadosDependentes[`dep${i + 1}_parentesco_outro`] = dep ? dep.parentesco_outro : null;
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
 * DELETE /api/filiados/me/dependentes
 */
exports.excluirDependentesMe = async (req, res) => {
  req.params.id = req.user.id;
  return exports.excluirDependentes(req, res);
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

    if (!ehPerfilGestao(perfilAtor)) {
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
      dadosDependentes[`dep${i + 1}_parentesco_outro`] = dep ? dep.parentesco_outro : null;
    }

    const payload = {
      nome: body.nome,
      sexo: body.sexo ? normalizeSexo(body.sexo) : undefined,
      cpf: body.cpf ? normalizarCpf(body.cpf) : undefined,
      siape: body.siape ? String(body.siape).replace(/\D/g, "").slice(0, 7) : undefined,
      data_nascimento: parseDateToISO(body.data_nascimento) || undefined,
      telefone1: body.telefone1 !== undefined ? normalizeTelefone(body.telefone1) : undefined,
      telefone2: body.telefone2 !== undefined ? normalizeTelefone(body.telefone2) : undefined,
      email1: body.email1,
      email2: body.email2,
      lotacao: body.lotacao ? normalizeLotacao(body.lotacao) : undefined,
      situacao: body.situacao ? normalizeSituacaoFuncional(body.situacao) : undefined,
      numero: body.numero,
      complemento: body.complemento,
      cep: body.cep,
      // Endereço automático (Canon): Logradouro, Cidade e UF só podem ser alterados via fluxo buscaCEP (acompanhados de CEP)
      logradouro_bairro: body.cep !== undefined ? body.logradouro_bairro : undefined,
      cidade: body.cep !== undefined ? body.cidade : undefined,
      uf: body.cep !== undefined ? body.uf : undefined,
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

    if (!ehPerfilGestao(perfilCriador)) {
      return res.status(403).json({ success: false, message: Textos.FILIADOS.PERMISSAO_CRIAR, requestId });
    }

    const body = req.body || {};
    if (!body.nome || !body.cpf || !body.email1 || !body.telefone1) {
      return res.status(400).json({ success: false, message: Textos.FILIADOS.CAMPOS_OBRIGATORIOS, requestId });
    }

    if (!body.lotacao || String(body.lotacao).trim() === "" || body.lotacao === "Selecione a Lotação...") {
      return res.status(422).json({
        success: false,
        message: "Selecione a lotação",
        fields: { lotacao: "Selecione a lotação" },
        requestId
      });
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
      dadosDependentes[`dep${i + 1}_parentesco_outro`] = dep ? dep.parentesco_outro : null;
    }

    const dadosNovo = {
      nome: String(body.nome).trim(),
      sexo: body.sexo ? normalizeSexo(body.sexo) : null,
      cpf: cpfLimpo,
      siape: body.siape ? String(body.siape).replace(/\D/g, "").slice(0, 7) : null,
      data_nascimento: parseDateToISO(body.data_nascimento),
      telefone1: normalizeTelefone(body.telefone1),
      telefone2: (body.telefone2 !== undefined && body.telefone2 !== "") ? normalizeTelefone(body.telefone2) : null,
      email1: body.email1 || null,
      email2: body.email2 || null,
      lotacao: normalizeLotacao(body.lotacao),
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
    if (!ehPerfilGestao(perfilAtor)) {
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
    if (!ehPerfilGestao(perfilAtor)) {
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
    if (!ehPerfilGestao(perfilAtor)) {
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
