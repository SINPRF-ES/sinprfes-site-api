// src/controllers/ressarcimento.controller.js
// ============================================================
// Controller para criação de pedidos de ressarcimento
// ============================================================

const { gerarPdfRessarcimento } = require("../services/pdf.service");
const { enviarEmailRessarcimento } = require("../services/email.service");
const log = require("../utils/log"); // 🟢 LOGGER
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");

/**
 * Controller para criação de pedido de ressarcimento.
 * Recebe:
 * - body (FormData -> campos do formulário)
 * - files (anexos do multer)
 * - user (do middleware auth)
 */
exports.criarRequerimento = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, message: "Não autenticado.", requestId });
  }

  try {
    const usuario = req.user || {}; // id, cpf, nome, possivelmente email/email1/email2 — vindos do token
    const body = req.body || {};
    const anexos = req.files || [];

    // Normaliza campos numéricos (vírgula → ponto)
    const parseNumero = (v) =>
      parseFloat(String(v || "0").replace(",", ".")) || 0;

    // Normalizador simples de e-mail
    const normalizarEmail = (v) =>
      (v || "").toString().trim().toLowerCase();

    // E-mails do filiado (vindo do usuário autenticado ou corpo, se um dia você mandar por lá)
    const email1 = normalizarEmail(
      body.email1 || usuario.email1 || usuario.email
    );
    const email2 = normalizarEmail(body.email2 || usuario.email2);

    // Define o e-mail de destino (cópia para o filiado)
    const emailDestino =
      normalizarEmail(body.email_destino) || email1 || email2 || "";

    // Monta objeto do pedido
    const pedido = {
      // Do usuário autenticado
      id_filiado: usuario.id,
      cpf: String(body.cpf || usuario.cpf || "").replace(/\D/g, ""),
      nome: body.nome || usuario.nome || "",

      // Contato / envio
      email_destino: emailDestino,
      email1,               // 🟢 agora o service pode usar como fallback
      email2,               // 🟢 idem
      telefone_contato: String(body.telefone_contato || usuario.telefone1 || "").replace(/\D/g, ""),

      // Atividade
      data_inicio: body.data_inicio || "",
      data_fim: body.data_fim || "",
      local: body.local || "",
      descricao: body.descricao || "",

      // Cálculos
      diarias: parseNumero(body.diarias),
      valor_diarias: parseNumero(body.valor_diarias),
      km_total: parseNumero(body.km_total),
      valor_km: parseNumero(body.valor_km),
      valor_outros: parseNumero(body.valor_outros),
      descricao_outros: body.descricao_outros || "",
      valor_total: parseNumero(body.valor_total),

      // Dados bancários
      banco: body.banco || "",
      agencia: body.agencia || "",
      conta: body.conta || "",
      pix: body.pix || "",

      // Metadados técnicos
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      criadoEm: new Date().toISOString(),
    };

    // 🟢 LOG SUCESSO PRELIMINAR (Recebido)
    log.info("RessarcimentoRecebido", {
      requestId,
      filiadoId: usuario.id,
      valorTotal: pedido.valor_total,
      qtdAnexos: anexos.length,
      emailDestino: pedido.email_destino || "(vazio)",
      email1: pedido.email1 || "(vazio)",
      email2: pedido.email2 || "(vazio)",
    });

    if (!pedido.email_destino) {
      log.warn("RessarcimentoSemEmailDestino", {
        requestId,
        filiadoId: usuario.id,
      });
      // continua mesmo assim: sindicato recebe, filiado talvez não receba cópia
    }

    // 1) Gera PDF consolidado (pedido + anexos)
    const pdfBuffer = await gerarPdfRessarcimento(pedido, anexos);

    // 2) Envia e-mail para sindicato + cópia para filiado (se houver e-mail_destino/email1/email2)
    await enviarEmailRessarcimento(pedido, pdfBuffer);

    // 🟢 LOG SUCESSO FINAL
    log.info("RessarcimentoProcessado", { requestId, filiadoId: usuario.id });

    return res.status(200).json({
      success: true,
      message: pedido.email_destino
        ? "Solicitação de ressarcimento registrada. O sindicato recebeu o pedido e uma cópia foi enviada para o seu e-mail."
        : "Solicitação de ressarcimento registrada. O sindicato recebeu o pedido (sem envio de cópia por falta de e-mail cadastrado).",
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao registrar pedido de ressarcimento.");
  }
};
