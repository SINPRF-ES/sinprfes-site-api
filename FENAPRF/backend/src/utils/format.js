// src/utils/format.js
const { v7: uuidv7 } = require("uuid");

function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.toString().replace(/\D/g, "");
}

function normalizarCep(cep) {
  if (!cep) return null;
  const limpo = cep.toString().replace(/\D/g, "");
  if (limpo === "") return null;
  return limpo.slice(0, 8);
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
function formatarCPF(cpf) {
  if (!cpf) return "";
  const limpo = cpf.toString().replace(/\D/g, "");
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Aplica máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000
 */
function formatarTelefone(tel) {
  if (!tel) return "";
  const limpo = tel.toString().replace(/\D/g, "");
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return tel;
}

/**
 * Formata data ISO (AAAA-MM-DD) ou objeto Date para PT-BR (DD/MM/AAAA).
 * Garante tratamento robusto para evitar strings crude do sistema.
 */
function formatarDataBR(data) {
  if (!data) return "";

  let d;
  if (data instanceof Date) {
    d = data;
  } else {
    const s = data.toString().trim();

    // Se já estiver no formato DD/MM/AAAA, retorna como está
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

    // Se for ISO ou similar (YYYY-MM-DD...)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, dayPart] = s.split("T")[0].split("-");
      return `${dayPart}/${m}/${y}`;
    }

    d = new Date(data);
  }

  // Fallback se não for uma data válida
  if (isNaN(d.getTime())) {
    return data && typeof data === 'string' ? data : "";
  }

  // Usamos os métodos UTC para evitar problemas de fuso horário em datas de nascimento
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Escapa caracteres HTML perigosos para prevenir XSS.
 */
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isUuid(val) {
  return typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
}

/**
 * Valida e normaliza um UUID string. Retorna null se inválido.
 */
function parseUuid(val) {
  const s = String(val || "").trim();
  if (!isUuid(s)) return null;
  return s;
}

/**
 * Gera um UUIDv7 para persistência (FENAPRF Standard).
 */
function generateUuid() {
  return uuidv7();
}

/**
 * Aplica máscara de Agência: 0000-0 ou 0000
 */
function formatarAgencia(agencia) {
  if (!agencia) return "-";
  const limpa = agencia.toString().replace(/\D/g, "");
  if (limpa.length < 1) return agencia;
  // Preserva zeros à esquerda e tenta colocar hífen se tiver 5 ou mais dígitos (comum em DV)
  // Mas o requisito diz: manter dígito verificador quando houver (ex.: 1234-5)
  if (limpa.length === 5) {
    return limpa.replace(/(\d{4})(\d{1})/, "$1-$2");
  }
  return agencia; // Se for 4 dígitos ou outro formato, retorna como está
}

/**
 * Aplica máscara de Conta: 000000-0
 */
function formatarConta(conta) {
  if (!conta) return "-";
  const limpa = conta.toString().replace(/\D/g, "");
  if (limpa.length < 2) return conta;
  // Coloca hífen antes do último dígito (DV)
  return limpa.replace(/(\d+)(\d{1})$/, "$1-$2");
}

module.exports = {
  normalizarCpf,
  normalizarCep,
  formatarCPF,
  formatarTelefone,
  formatarDataBR,
  formatarAgencia,
  formatarConta,
  escapeHtml,
  isUuid,
  parseUuid,
  generateUuid,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};