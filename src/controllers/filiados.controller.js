// src/controllers/filiados.controller.js
const path = require("path");
const fs = require("fs");

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
    if (err && (err.code === "23505" || err.code === "ER_DUP_ENTRY" || (err.message && err.message.includes("duplicate")))) {
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

    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado (campo 'avatar')." });
    }

    const publicUrl = `/uploads/avatars/${req.file.filename}`;
    const atualizado = await atualizarFiliadoPorId(userId, { avatar_url: publicUrl });

    return res.json({
      message: "Avatar atualizado com sucesso.",
      avatar_url: publicUrl,
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

    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado (campo 'avatar')." });
    }

    const publicUrl = `/uploads/avatars/${req.file.filename}`;
    const atualizado = await atualizarFiliadoPorId(idAlvo, { avatar_url: publicUrl });

    if (!atualizado) {
      return res.status(404).json({ message: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    return res.json({
      message: "Avatar atualizado com sucesso.",
      avatar_url: publicUrl,
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

    await atualizarFiliadoPorId(id, { avatar_url: null });

    try {
      if (antes.avatar_url?.startsWith("/uploads/avatars/")) {
        const file = path.join(process.cwd(), "public", antes.avatar_url);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch {}

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

    await atualizarFiliadoPorId(id, { avatar_url: null });

    try {
      if (antes.avatar_url?.startsWith("/uploads/avatars/")) {
        const file = path.join(process.cwd(), "public", antes.avatar_url);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch {}

    return res.json({ message: "Foto removida com sucesso.", avatar_url: null });
  } catch (err) {
    log.error("RemoverAvatarPorIdErro", err);
    return res.status(500).json({ message: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS });
  }
};
