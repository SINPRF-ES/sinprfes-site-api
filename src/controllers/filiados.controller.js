// src/controllers/filiados.controller.js
const pool = require("../config/db");
const log = require("../utils/log"); 
const Textos = require("../utils/textos"); // 🟢 TEXTOS
const {
  buscarPorId,
  listarParaPerfil,
  atualizarDadosProprios,
  atualizarFiliadoPorId,
  criarFiliadoInicial,
  salvarTwoFaSecret, // 🟢 Importado para desativar 2FA
} = require("../services/filiados.service");
const { enviarEmailBoasVindasFiliado } = require("../services/email.service");
const { normalizarCpf } = require("../utils/format");

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

    // 🟢 SEGURANÇA: Remove senha e secret, retorna flag twofa_ativo
    const { senha_hash, twofa_secret, ...dadosFiliado } = filiado;

    return res.json({
        ...dadosFiliado,
        twofa_ativo: !!twofa_secret, 
    });
  } catch (err) {
    log.error("FiliadosGetMeErro", err);
    return res
      .status(500)
      .json({ message: Textos.ERROS_INTERNOS.CARREGAR_DADOS });
  }
};

/**
 * GET /api/filiados
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfilAcesso = req.user.perfil_acesso || "FILIADO";
    const termoBusca = (req.query.q || "").toString();

    if (termoBusca) {
        log.info("FiliadosBusca", { user: req.user.id, termo: termoBusca });
    }

    const lista = await listarParaPerfil(perfilAcesso, termoBusca);

    return res.json({
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    log.error("FiliadosListarErro", err);
    return res
      .status(500)
      .json({ message: Textos.ERROS_INTERNOS.LISTAR_FILIADOS });
  }
};

/**
 * PUT /api/filiados/me
 */
exports.atualizarMeusDados = async (req, res) => {
  try {
    const id = req.user.id;
    const body = req.body;

    const atualizado = await atualizarDadosProprios(id, {
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
    });

    log.info("FiliadoAtualizouProprios", { userId: id });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
    });
  } catch (err) {
    log.error("FiliadosUpdateMeErro", err);
    return res
      .status(500)
      .json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
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

    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"].includes(perfil)) {
        return res.status(403).json({ message: "Sem permissão." });
    }

    const body = req.body;
    const payload = {
      nome: body.nome,
      cpf: body.cpf,
      data_nascimento: body.data_nascimento,
      telefone1: body.telefone1,
      telefone2: body.telefone2,
      email1: body.email1,
      email2: body.email2,
      lotacao: body.lotacao,
      situacao: (body.situacao || "ATIVO").toUpperCase(),
      logradouro_bairro: body.logradouro_bairro,
      numero: body.numero,
      complemento: body.complemento,
      cidade: body.cidade,
      uf: body.uf,
      cep: body.cep,
    };

    if (perfil === "ADMIN" && body.perfil_acesso) {
        payload.perfil_acesso = body.perfil_acesso.toUpperCase();
    }

    const atualizado = await atualizarFiliadoPorId(idAlvo, payload);

    if (!atualizado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    log.info("FiliadoEditadoPorAdmin", { 
        adminId: req.user.id, 
        alvoId: idAlvo, 
        campos: Object.keys(payload) 
    });

    return res.json({
      message: Textos.SUCESSO.DADOS_ATUALIZADOS,
      filiado: atualizado,
    });
  } catch (err) {
    log.error("FiliadosUpdateAdminErro", err);
    return res
      .status(500)
      .json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
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

    const body = req.body;
    if (!body.nome || !body.cpf || !body.email1) {
      return res.status(400).json({ message: Textos.FILIADOS.CAMPOS_OBRIGATORIOS });
    }

    const dadosNovo = {
      nome: body.nome.trim(),
      cpf: normalizarCpf(body.cpf),
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
    };

    let novo;
    try {
      novo = await criarFiliadoInicial(dadosNovo, perfilCriador);
    } catch (err) {
      if (err.code === "CPF_DUPLICADO") {
        log.warn("FiliadoCriacaoDuplicada", { cpf: body.cpf });
        return res.status(409).json({ message: Textos.FILIADOS.CPF_DUPLICADO });
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
 * POST /api/filiados/2fa/desativar
 * Permite que o filiado desative o 2FA.
 */
exports.desativar2fa = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const atualizado = await salvarTwoFaSecret(userId, null);

    if (!atualizado) {
      return res
        .status(400)
        .json({ message: "Não foi possível desativar o 2FA. Tente novamente." });
    }

    log.info("Filiado2FADesativado", { userId });

    return res.json({
      message: "Autenticação em duas etapas desativada com sucesso.",
      twofa_ativo: false,
    });
  } catch (err) {
    log.error("Filiado2FADesativarErro", err);
    return res
      .status(500)
      .json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};