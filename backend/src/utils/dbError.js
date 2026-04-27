const log = require("./log");

/**
 * Utilitário centralizado para tratamento de erros de banco de dados (Sentinel Pattern).
 * Evita vazamento de detalhes do esquema ou dados das linhas para o cliente.
 *
 * @param {Error} err O erro retornado pelo pg
 * @param {Object} res Objeto de resposta do Express
 * @param {string} requestId ID da requisição para rastreabilidade
 * @param {string} defaultMessage Mensagem genérica caso não seja um erro mapeado
 */
function handleDbError(err, res, requestId, defaultMessage = "Erro no banco de dados") {
    const errorInfo = {
        message: err?.message,
        detail: err?.detail,
        hint: err?.hint,
        code: err?.code,
        constraint: err?.constraint,
        requestId
    };

    if (err?.code === "CPF_DUPLICADO") {
        return res.status(409).json({
            success: false,
            message: "Este CPF já está cadastrado.",
            code: err.code,
            requestId
        });
    }

    if (err?.code === "SIAPE_DUPLICADO") {
        return res.status(409).json({
            success: false,
            message: "Esta matrícula (SIAPE) já está cadastrada.",
            code: err.code,
            requestId
        });
    }

    // Padrão de erro de Schema ou Constraint Violations (23... ou 42703)
    if (err && (String(err.code).startsWith('23') || err.code === '42703')) {
        log.error("DatabaseConstraintErro", errorInfo);

        // Resposta genérica segura para o cliente (NUNCA vazar err.detail)
        let safeMessage = "Não foi possível processar seus dados. Verifique se os campos obrigatórios estão preenchidos.";

        if (err.code === '23505') {
            safeMessage = err.constraint === "filiados_cpf_key"
              ? "Este CPF já está cadastrado."
              : err.constraint === "filiados_siape_key"
                ? "Esta matrícula (SIAPE) já está cadastrada."
                : "Os dados informados já constam em nosso sistema (conflito de duplicidade).";
            return res.status(409).json({ success: false, message: safeMessage, code: err.code, requestId });
        }

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
    log.error("DatabaseDbErro", errorInfo);

    // Garantir que NUNCA enviamos a mensagem do erro se ela contiver palavras suspeitas de vazamento
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

module.exports = { handleDbError };
