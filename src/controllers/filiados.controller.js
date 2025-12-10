// src/controllers/filiados.controller.js
const pool = require("../config/db");
const {
  buscarPorId,
  listarParaPerfil,
  atualizarDadosProprios,
  atualizarFiliadoPorId,
  criarFiliadoInicial,
} = require("../services/filiados.service");
const { enviarEmailBoasVindasFiliado } = require("../services/email.service");
const { normalizarCpf } = require("../utils/format");

/**
 * GET /api/filiados/me
 * Retorna os dados completos do usuário logado.
 */
exports.getMe = async (req, res) => {
  try {
    const id = req.user.id;
    const filiado = await buscarPorId(id);

    if (!filiado) {
      return res.status(404).json({ message: "Filiado não encontrado." });
    }

    return res.json({
      id: filiado.id,
      nome: filiado.nome,
      cpf: filiado.cpf,
      data_nascimento: filiado.data_nascimento,
      telefone1: filiado.telefone1,
      telefone2: filiado.telefone2,
      email1: filiado.email1,
      email2: filiado.email2,
      // 🟢 ENDEREÇO
      logradouro_bairro: filiado.logradouro_bairro,
      numero: filiado.numero,
      complemento: filiado.complemento,
      cidade: filiado.cidade,
      uf: filiado.uf,
      cep: filiado.cep,
      // FIM ENDEREÇO
      lotacao: filiado.lotacao,
      situacao: filiado.situacao,
      perfil_acesso: filiado.perfil_acesso,
      avatar_url: filiado.avatar_url,
      bloqueado: filiado.bloqueado,
      ultimo_acesso: filiado.ultimo_acesso,
      criado_em: filiado.criado_em,
      atualizado_em: filiado.atualizado_em,
    });
  } catch (err) {
    console.error("Erro em getMe:", err);
    return res
      .status(500)
      .json({ message: "Erro interno ao buscar informações do filiado." });
  }
};

/**
 * GET /api/filiados
 * Lista filiados de acordo com o perfil de acesso.
 * Suporta ?q= para busca por nome/CPF.
 */
exports.listarFiliados = async (req, res) => {
  try {
    const perfilAcesso = req.user.perfil_acesso || "FILIADO";
    const termoBusca = (req.query.q || "").toString();

    const lista = await listarParaPerfil(perfilAcesso, termoBusca);

    return res.json({
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    console.error("Erro em listarFiliados:", err);
    return res
      .status(500)
      .json({ message: "Erro interno ao listar filiados." });
  }
};

/**
 * PUT /api/filiados/me
 * Atualiza dados básicos do próprio filiado:
 */
exports.atualizarMeusDados = async (req, res) => {
  try {
    const id = req.user.id;

    const {
      telefone1,
      telefone2,
      email1,
      email2,
      lotacao,
      // NOVAS COLUNAS:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
      // REMOVIDO: endereco (antigo)
    } = req.body;

    const atualizado = await atualizarDadosProprios(id, {
      telefone1,
      telefone2,
      email1,
      email2,
      lotacao,
      // PASSANDO AS 6 NOVAS COLUNAS PARA O SERVICE:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
    });

    return res.json({
      message: "Dados atualizados com sucesso.",
      filiado: atualizado,
    });
  } catch (err) {
    console.error("Erro em atualizarMeusDados:", err);
    return res
      .status(500)
      .json({ message: "Erro interno ao atualizar seus dados." });
  }
};

/**
 * PUT /api/filiados/:id
 * Atualização feita por ADMIN / DIRETORIA / FUNCIONARIO.
 */
exports.atualizarFiliado = async (req, res) => {
  try {
    const perfil = (req.user.perfil_acesso || "").toUpperCase();
    const idAlvo = parseInt(req.params.id, 10);

    if (Number.isNaN(idAlvo)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil)) {
      return res
        .status(403)
        .json({ message: "Você não tem permissão para alterar outros filiados." });
    }

    const {
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      lotacao,
      situacao,
      perfil_acesso,
      // ENDEREÇO:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
    } = req.body;

    const payload = {
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      lotacao,
      // 🟢 CORREÇÃO: Garante que a situação seja salva em UPPERCASE
      situacao: (situacao || "ATIVO").toUpperCase(),
      // ENDEREÇO:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
    };

    // Só ADMIN pode mexer em perfil_acesso
    if (perfil === "ADMIN" && perfil_acesso) {
      const perfilNovo = perfil_acesso.toUpperCase();
      if (["FILIADO", "FUNCIONARIO", "DIRETORIA", "ADMIN"].includes(perfilNovo)) {
        payload.perfil_acesso = perfilNovo;
      }
    }

    const atualizado = await atualizarFiliadoPorId(idAlvo, payload);

    if (!atualizado) {
      return res.status(404).json({ message: "Filiado não encontrado." });
    }

    return res.json({
      message: "Filiado atualizado com sucesso.",
      filiado: atualizado,
    });
  } catch (err) {
    console.error("Erro em atualizarFiliado:", err);
    return res
      .status(500)
      .json({ message: "Erro interno ao atualizar filiado." });
  }
};

/**
 * POST /api/filiados
 * Criação de novo filiado a partir do portal (ADMIN / DIRETORIA / FUNCIONARIO).
 */
exports.criarFiliado = async (req, res) => {
  try {
    const perfilCriador = (req.user.perfil_acesso || "").toUpperCase();
    if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilCriador)) {
      return res
        .status(403)
        .json({ message: "Você não tem permissão para criar filiados." });
    }

    const {
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      // REMOVIDO: endereco (antigo)
      lotacao,
      situacao,
      perfil_acesso,
      // ENDEREÇO:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
    } = req.body;

    if (!nome || !cpf || !email1) {
      return res.status(400).json({
        message: "Campos obrigatórios: nome, cpf, email1.",
      });
    }

    const dadosNovo = {
      nome: nome.trim(),
      cpf: normalizarCpf(cpf),
      data_nascimento: data_nascimento || null,
      telefone1: telefone1 || null,
      telefone2: telefone2 || null,
      email1: email1 || null,
      email2: email2 || null,
      lotacao: lotacao || "SEDE",
      // 🟢 CORREÇÃO: Garante que a situação seja salva em UPPERCASE
      situacao: (situacao || "ATIVO").toUpperCase(),
      perfil_acesso: perfil_acesso || "FILIADO",
      // ENDEREÇO:
      logradouro_bairro: logradouro_bairro || null,
      numero: numero || null,
      complemento: complemento || null,
      cidade: cidade || null,
      uf: uf || null,
      cep: cep || null,
    };

    let novo;
    try {
      novo = await criarFiliadoInicial(dadosNovo, perfilCriador);
    } catch (err) {
      if (err.code === "CPF_DUPLICADO") {
        return res.status(409).json({ message: err.message });
      }
      throw err;
    }

    // Tenta enviar o e-mail de boas-vindas,
    try {
      await enviarEmailBoasVindasFiliado(novo);
    } catch (emailErr) {
      console.error("Erro ao enviar e-mail de boas-vindas:", emailErr);
    }

    return res.status(201).json({
      message: "Filiado criado com sucesso.",
      filiado: novo,
    });
  } catch (err) {
    console.error("Erro em criarFiliado:", err);
    return res
      .status(500)
      .json({ message: "Erro interno ao criar filiado." });
  }
};