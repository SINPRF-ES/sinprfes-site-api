// src/controllers/ressarcimento.controller.js
// ============================================================
// Controller para criação de pedidos de ressarcimento
// ============================================================

const { gerarPdfRessarcimento } = require("../services/pdf.service");
const { enviarEmailRessarcimento } = require("../services/email.service");

/**
 * Controller para criação de pedido de ressarcimento.
 * Recebe:
 *  - body (FormData -> campos do formulário)
 *  - files (anexos do multer)
 *  - user (do middleware auth)
 */
exports.criarRequerimento = async (req, res) => {
  try {
    const usuario = req.user || {};   // id, cpf, nome — vindo do token
    const body = req.body || {};
    const anexos = req.files || [];

    // Normaliza campos numéricos (vírgula → ponto)
    const parseNumero = (v) =>
      parseFloat(String(v || "0").replace(",", ".")) || 0;

    // Monta objeto do pedido
    const pedido = {
      // Do usuário autenticado
      id_filiado: usuario.id,
      cpf: body.cpf || usuario.cpf || "",
      nome: body.nome || usuario.nome || "",

      // Contato / envio
      email_destino: body.email_destino || "",
      telefone_contato: body.telefone_contato || "",

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

    console.log("📄 Novo pedido de ressarcimento recebido:", {
      usuario,
      pedido,
      qtdAnexos: anexos.length,
    });

    // 1) Gera PDF consolidado (pedido + anexos)
    const pdfBuffer = await gerarPdfRessarcimento(pedido, anexos);

    // 2) Envia e-mail para sindicato + cópia para filiado
    await enviarEmailRessarcimento(pedido, pdfBuffer);

    // 3) Futuro: persistência em tabela "ressarcimentos"

    return res.status(200).json({
      message:
        "Solicitação de ressarcimento registrada. O sindicato recebeu o pedido e uma cópia foi enviada para o seu e-mail.",
    });

  } catch (err) {
    console.error("❌ Erro ao registrar pedido de ressarcimento:", err);
    return res
      .status(500)
      .json({ error: "Erro ao registrar pedido de ressarcimento." });
  }
};
