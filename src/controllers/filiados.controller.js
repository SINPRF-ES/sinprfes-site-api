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

function perfilGestao(perfil) {
  return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"].includes((perfil || "").toUpperCase());
}

/**
 * Valida, sanitiza e normaliza os dados dos dependentes a partir do corpo da requisição.
 * A função remove entradas vazias e retorna um array compacto e ordenado de dependentes.
 *
 * @param {object} body O corpo da requisição (req.body).
 * @returns {Array<object>} Um array de objetos, onde cada objeto representa um dependente válido.
 * @throws {Error} Lança um erro com mensagens de validação se houver inconsistências.
 */
function validarESanitizarDependentes(body) {
  const dependentesValidos = [];
  const erros = [];

  for (let i = 1; i <= 5; i++) {
    const nome = (body[`dep${i}_nome`] || "").trim();
    const cpf = (body[`dep${i}_cpf`] || "").replace(/\D/g, "");
    const dataNascimento = (body[`dep${i}_data_nascimento`] || "").trim();
    const parentesco = (body[`dep${i}_parentesco`] || "").trim();

    const temAlgumDado = nome || cpf || dataNascimento || parentesco;

    if (temAlgumDado) {
      // A validação agora usa o número do dependente VÁLIDO, não o do formulário.
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
    log.error("FiliadosGetMeErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/filiados
 * Query:
 *  - q: termo de busca
 *  - incluirArquivados=1: inclui arquivados (somente perfis de gestão)
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfilAcesso = (req.user.perfil_acesso || "FILIADO").toUpperCase();
    const termoBusca = (req.query.q || "").toString();

    const incluirArquivados = String(req.query.incluirArquivados || "").trim() === "1";

    // Somente perfis de gestão podem listar arquivados
    const incluirArquivadosEfetivo = incluirArquivados && perfilGestao(perfilAcesso);

    if (termoBusca) {
      log.info("FiliadosBusca", { user: req.user.id, termo: termoBusca });
    }

    const lista = await listarParaPerfil(perfilAcesso, termoBusca, incluirArquivadosEfetivo);

    return res.json({
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    log.error("FiliadosListarErro", err);
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
      lotacao: body.lotacao,
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
      ...dadosDependentes,
    };

    const atualizado = await atualizarDadosProprios(id, payload);

    log.info("FiliadoAtualizouProprios", { userId: id });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
    });
  } catch (err) {
    if (err.isValidationError) {
      log.warn("FiliadosUpdateMeValidation", { userId: req.user.id, error: err.message });
      return res.status(400).json({ message: err.message });
    }
    log.error("FiliadosUpdateMeErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * DELETE /api/filiados/:id/dependentes
 */
exports.excluirDependentes = async (req, res) => {
  try {
    const idAlvo = parseInt(req.params.id, 10);
    const { indices } = req.body; // Ex: [0, 2] para remover dependente 1 e 3

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }
    if (!Array.isArray(indices) || indices.some(isNaN)) {
      return res.status(400).json({ message: "O corpo da requisição deve conter um array de 'indices' numéricos." });
    }

    // VERIFICAÇÃO DE PERMISSÃO: Permite se for gestor OU o próprio usuário
    const ehGestor = perfilGestao(req.user.perfil_acesso);
    const ehProprioUsuario = Number(req.user.id) === idAlvo;

    if (!ehGestor && !ehProprioUsuario) {
      return res.status(403).json({ message: "Você não tem permissão para executar esta ação." });
    }

    const filiado = await buscarPorId(idAlvo);
    if (!filiado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    // 1. Extrair dependentes existentes para um array
    const dependentesAtuais = [];
    for (let i = 1; i <= 5; i++) {
      const nome = filiado[`dep${i}_nome`];
      if (nome) { // Considera que se tem nome, é um dependente válido
        dependentesAtuais.push({
          nome: filiado[`dep${i}_nome`],
          cpf: filiado[`dep${i}_cpf`],
          data_nascimento: filiado[`dep${i}_data_nascimento`],
          parentesco: filiado[`dep${i}_parentesco`],
        });
      }
    }

    // 2. Filtrar o array, removendo os dependentes nos índices especificados
    const dependentesMantidos = dependentesAtuais.filter((_, index) => !indices.includes(index));

    // 3. Mapear o array filtrado de volta para o formato de payload do serviço
    const dadosDependentes = {};
    for (let i = 0; i < 5; i++) {
      const dep = dependentesMantidos[i];
      dadosDependentes[`dep${i + 1}_nome`] = dep ? dep.nome : null;
      dadosDependentes[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
      dadosDependentes[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
      dadosDependentes[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
    }

    // 4. Chamar o serviço de atualização para salvar o estado reordenado
    const atualizado = await atualizarFiliadoPorId(idAlvo, dadosDependentes);

    log.info("DependentesExcluidos", {
      atorId: req.user.id,
      alvoId: idAlvo,
      indicesExcluidos: indices,
    });

    return res.json({
      message: "Dependentes excluídos e reordenados com sucesso.",
      filiado: atualizado,
    });
  } catch (err) {
    log.error("DependentesExcluirErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * PUT /api/filiados/:id
 */
exports.atualizarFiliado = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    const idAlvo = parseInt(req.params.id, 10);

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }

    if (!perfilGestao(perfil)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const body = req.body || {};

    // 🟢 VERIFICAÇÃO PROATIVA DE CPF DUPLICADO (EDIÇÃO)
    if (body.cpf) {
      const cpfLimpo = normalizarCpf(body.cpf);
      const checkCpf = await pool.query(
        "SELECT nome FROM filiados WHERE cpf = $1 AND id != $2 LIMIT 1",
        [cpfLimpo, idAlvo]
      );

      if (checkCpf.rows.length > 0) {
        const dono = checkCpf.rows[0].nome;
        return res.status(409).json({
          message: `Não foi possível atualizar. O CPF ${body.cpf} já está cadastrado para: ${dono}.`,
        });
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
      data_nascimento: body.data_nascimento === "" ? undefined : body.data_nascimento, // esperado: yyyy-MM-dd
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email1: body.email1,
      email2: body.email2,
      lotacao: body.lotacao,
      situacao: body.situacao ? String(body.situacao).toUpperCase() : undefined,
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
      ...dadosDependentes,
    };

    // Somente ADMIN altera perfil_acesso
    if (perfil === "ADMIN" && body.perfil_acesso) {
      payload.perfil_acesso = String(body.perfil_acesso).toUpperCase();
    }

    const atualizado = await atualizarFiliadoPorId(idAlvo, payload);

    if (!atualizado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    log.info("FiliadoEditadoPorGestao", {
      atorId: req.user.id,
      alvoId: idAlvo,
      atorPerfil: perfil,
      campos: Object.keys(payload).filter((k) => payload[k] !== undefined),
    });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
    });
  } catch (err) {
    // fallback (race-condition): constraint única no CPF
    if (
      err &&
      (err.code === "23505" ||
        err.code === "ER_DUP_ENTRY" ||
        (err.message && err.message.includes("duplicate")))
    ) {
      return res.status(409).json({ message: "CPF duplicado no sistema." });
    }

    log.error("FiliadosUpdateGestaoErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados
 */
exports.criarFiliado = async (req, res) => {
  try {
    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();

    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilCriador)) {
      return res.status(403).json({ message: Textos.FILIADOS.PERMISSAO_CRIAR });
    }

    const body = req.body || {};
    if (!body.nome || !body.cpf || !body.email1) {
      return res.status(400).json({ message: Textos.FILIADOS.CAMPOS_OBRIGATORIOS });
    }

    // 🟢 VERIFICAÇÃO PROATIVA DE CPF DUPLICADO (CRIAÇÃO)
    const cpfLimpo = normalizarCpf(body.cpf);
    const checkCpf = await pool.query("SELECT nome FROM filiados WHERE cpf = $1 LIMIT 1", [cpfLimpo]);

    if (checkCpf.rows.length > 0) {
      const dono = checkCpf.rows[0].nome;
      return res.status(409).json({
        message: `Impossível cadastrar. O CPF ${body.cpf} já pertence ao filiado: ${dono}.`,
      });
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
      data_nascimento: body.data_nascimento || null,
      telefone1: body.telefone1 || null,
      telefone2: body.telefone2 || null,
      email1: body.email1 || null,
      email2: body.email2 || null,
      lotacao: body.lotacao || "SEDE",
      situacao: (body.situacao || "ATIVO").toUpperCase(),
      perfil_acesso: body.perfil_acesso || "FILIADO",
      logradouro_bairro: body.logradouro_bairro || null,
      numero: body.numero || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      uf: body.uf || null,
      cep: body.cep || null,
      ...dadosDependentes,
    };

    let novo;
    try {
      novo = await criarFiliadoInicial(dadosNovo, perfilCriador);
    } catch (err) {
      if (err.code === "CPF_DUPLICADO") {
        return res.status(409).json({ message: "CPF já cadastrado." });
      }
      throw err;
    }

    try {
      await enviarEmailBoasVindasFiliado(novo);
    } catch (emailErr) {
      log.error("FiliadoEmailBoasVindasErro", emailErr);
    }

    log.info("FiliadoCriado", { creatorId: req.user.id, newId: novo.id });

    return res.status(201).json({
      message: Textos.SUCESSO.CRIADO_SUCESSO,
      filiado: novo,
    });
  } catch (err) {
    log.error("FiliadosCriarErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.CRIAR_FILIADO });
  }
};

/**
 * POST /api/filiados/:id/arquivar
 */
exports.arquivarFiliado = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    const idAlvo = parseInt(req.params.id, 10);

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }

    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) {
      return res.status(400).json({ message: "Motivo é obrigatório para arquivar." });
    }

    const atualizado = await arquivarFiliadoPorId(idAlvo, {
      atorId: req.user.id,
      atorPerfil: perfil,
      motivo,
    });

    if (!atualizado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    return res.json({ message: "Estado do cadastro alterado para: ARQUIVADO.", filiado: atualizado });
  } catch (err) {
    log.error("FiliadosArquivarErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/:id/desarquivar
 */
exports.desarquivarFiliado = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    const idAlvo = parseInt(req.params.id, 10);

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }

    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const atualizado = await desarquivarFiliadoPorId(idAlvo, {
      atorId: req.user.id,
      atorPerfil: perfil,
    });

    if (!atualizado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    return res.json({ message: "Estado do cadastro alterado para: CADASTRO ATIVO.", filiado: atualizado });
  } catch (err) {
    log.error("FiliadosDesarquivarErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/me/avatar  (upload)
 * Requer multipart/form-data (campo: avatar)
 */
exports.uploadAvatarMe = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo não enviado (campo 'avatar')." });
    }

    const antes = await buscarPorId(userId);

    // public_id estável por filiado (mantém URL previsível e evita gerar múltiplas variações)
    const publicId = `sinprfes/avatars/filiado_${userId}`;

    // Se havia avatar anterior com public_id diferente (legado), remove para evitar lixo
    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try {
        await deleteAvatarByPublicId(antes.avatar_public_id);
      } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);

    const atualizado = await atualizarFiliadoPorId(userId, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({
      message: "Avatar atualizado com sucesso.",
      avatar_url: up.avatar_url,
      filiado: atualizado,
    });
  } catch (err) {
    log.error("FiliadosUploadAvatarMeErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

/**
 * POST /api/filiados/:id/avatar (upload por gestão)
 */
exports.uploadAvatarPorId = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil)) {
      return res.status(403).json({ message: "Sem permissão." });
    }

    const idAlvo = parseInt(req.params.id, 10);
    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo não enviado (campo 'avatar')." });
    }

    const antes = await buscarPorId(idAlvo);
    if (!antes) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    const publicId = `sinprfes/avatars/filiado_${idAlvo}`;

    // Se havia avatar anterior com public_id diferente (legado), remove para evitar lixo
    if (antes?.avatar_public_id && antes.avatar_public_id !== publicId) {
      try {
        await deleteAvatarByPublicId(antes.avatar_public_id);
      } catch {}
    }

    const up = await uploadAvatarBuffer(req.file.buffer, publicId);

    const atualizado = await atualizarFiliadoPorId(idAlvo, {
      avatar_url: up.avatar_url,
      avatar_public_id: up.avatar_public_id,
    });

    return res.json({
      message: "Avatar atualizado com sucesso.",
      avatar_url: up.avatar_url,
      filiado: atualizado,
    });
  } catch (err) {
    log.error("FiliadosUploadAvatarPorIdErro", err);
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

    if (!atualizado) {
      return res.status(400).json({ message: "Não foi possível desativar o 2FA. Tente novamente." });
    }

    log.info("Filiado2FADesativado", { userId });

    return res.json({
      message: "Autenticação em duas etapas desativada com sucesso.",
      twofa_ativo: false,
    });
  } catch (err) {
    log.error("Filiado2FADesativarErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarMe = async (req, res) => {
  try {
    const id = req.user.id;
    const antes = await buscarPorId(id);

    if (!antes) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    // Preferencial: remove no Cloudinary quando houver public_id
    if (antes.avatar_public_id) {
      try {
        await deleteAvatarByPublicId(antes.avatar_public_id);
      } catch {}
    } else {
      // Fallback legado: remove do disco, se existir
      try {
        if (antes.avatar_url?.startsWith("/uploads/avatars/")) {
          const file = path.join(process.cwd(), "public", antes.avatar_url);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      } catch {}
    }

    await atualizarFiliadoPorId(id, {
      avatar_url: null,
      avatar_public_id: null,
    });

    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("RemoverAvatarMeErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};

exports.removerAvatarPorId = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: Textos.FILIADOS.ID_INVALIDO });
    }

    const antes = await buscarPorId(id);
    if (!antes) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    // Preferencial: remove no Cloudinary quando houver public_id
    if (antes.avatar_public_id) {
      try {
        await deleteAvatarByPublicId(antes.avatar_public_id);
      } catch {}
    } else {
      // Fallback legado: remove do disco, se existir
      try {
        if (antes.avatar_url?.startsWith("/uploads/avatars/")) {
          const file = path.join(process.cwd(), "public", antes.avatar_url);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      } catch {}
    }

    await atualizarFiliadoPorId(id, { avatar_url: null, avatar_public_id: null });

    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("RemoverAvatarPorIdErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};
