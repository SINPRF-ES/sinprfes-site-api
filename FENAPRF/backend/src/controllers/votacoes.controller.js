// src/controllers/votacoes.controller.js
const service = require("../services/votacoes.service");
const { parseUuid } = require("../utils/format");

function parseId(req) {
  return parseUuid(req.params.id);
}

exports.listar = async (req, res) => {
  try {
    const status = (req.query.status || "").toString().toUpperCase().trim(); // opcional
    const lista = await service.listarVotacoes({ userId: req.user.id, status });
    return res.json(lista);
  } catch (err) {
    console.error("VotacoesListarErro:", err);
    return res.status(500).json({ error: "Erro ao listar votações." });
  }
};

exports.detalhe = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return res.status(400).json({ error: "ID inválido." });

    const v = await service.obterVotacao({ votacaoId: id, userId: req.user.id });
    if (!v) return res.status(404).json({ error: "Votação não encontrada." });

    return res.json(v);
  } catch (err) {
    console.error("VotacoesDetalheErro:", err);
    return res.status(500).json({ error: "Erro ao carregar votação." });
  }
};

exports.criar = async (req, res) => {
  try {
    const { titulo, descricao, abre_em, encerra_em, opcoes } = req.body || {};

    if (!titulo || typeof titulo !== "string") {
      return res.status(400).json({ error: "Informe o título." });
    }
    if (!Array.isArray(opcoes) || opcoes.length < 2) {
      return res.status(400).json({ error: "Informe pelo menos 2 opções." });
    }

    const result = await service.criarVotacao({
      criadoPor: req.user.id,
      titulo: titulo.trim(),
      descricao: (descricao || "").toString(),
      abreEm: abre_em || null,
      encerraEm: encerra_em || null,
      opcoes,
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error("VotacoesCriarErro:", err);
    return res.status(500).json({ error: "Erro ao criar votação." });
  }
};

exports.abrir = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return res.status(400).json({ error: "ID inválido." });

    const ok = await service.abrirVotacao({ votacaoId: id });
    if (!ok) return res.status(404).json({ error: "Votação não encontrada." });

    return res.json({ message: "Votação aberta." });
  } catch (err) {
    console.error("VotacoesAbrirErro:", err);
    return res.status(500).json({ error: "Erro ao abrir votação." });
  }
};

exports.encerrar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return res.status(400).json({ error: "ID inválido." });

    const ok = await service.encerrarVotacao({ votacaoId: id });
    if (!ok) return res.status(404).json({ error: "Votação não encontrada." });

    return res.json({ message: "Votação encerrada." });
  } catch (err) {
    console.error("VotacoesEncerrarErro:", err);
    return res.status(500).json({ error: "Erro ao encerrar votação." });
  }
};

exports.votar = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return res.status(400).json({ error: "ID inválido." });

    const body = req.body || {};

    // Aceita snake_case (Thunder/legacy) e camelCase (app)
    const opcaoId =
      body.opcao_id ??
      body.opcaoId ??
      body.opcao ??
      body.opcaoID;

    const deviceId = body.device_id ?? body.deviceId ?? null;
    const biometriaConfirmada =
      body.biometria_confirmada ?? body.biometriaConfirmada ?? false;

    if (!opcaoId || !parseUuid(opcaoId)) {
      return res.status(400).json({
        error: "Opção inválida (UUID esperado).",
        debug: {
          recebido: opcaoId,
          esperado: "opcao_id (uuid) ou opcaoId (uuid)",
        },
      });
    }

    const result = await service.registrarVoto({
      votacaoId: id,
      opcaoId,
      userId: req.user.id,
      deviceId: deviceId ? String(deviceId) : null,
      biometriaConfirmada: Boolean(biometriaConfirmada),
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(201).json(result);
  } catch (err) {
    const msg = err?.message || "Erro ao registrar voto.";
    const code =
      msg.includes("já votou") ||
      msg.includes("encerrada") ||
      msg.includes("não está aberta") ||
      msg.toLowerCase().includes("opção inválida")
        ? 400
        : 500;

    console.error("VotacoesVotarErro:", err);
    return res.status(code).json({ error: msg });
  }
};

exports.resultado = async (req, res) => {
  try {
    const id = parseId(req);
    if (!id) return res.status(400).json({ error: "ID inválido." });

    const r = await service.obterResultado({ votacaoId: id });
    if (!r) return res.status(404).json({ error: "Votação não encontrada." });

    return res.json(r);
  } catch (err) {
    console.error("VotacoesResultadoErro:", err);
    return res.status(500).json({ error: "Erro ao carregar resultado." });
  }
};
