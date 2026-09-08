// src/utils/format.js

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

/**
 * Aplica máscara de CEP: 00000-000
 */
function formatarCEP(cep) {
  if (!cep) return "";
  const limpo = cep.toString().replace(/\D/g, "");
  if (limpo.length !== 8) return cep;
  return limpo.replace(/(\d{5})(\d{3})/, "$1-$2");
}

/**
 * Gera o nome de arquivo para o PDF de Pedido de Ressarcimento no formato:
 * Ressarcimento_<Nome_Completo>_<DD_MM_AAAA>.pdf
 */
function gerarNomeArquivoRessarcimento(dados = {}) {
  const nomeBruto = String(dados.nome || "").trim();

  // Sanitização do nome:
  // 1. Remove caracteres de controle e símbolos incompatíveis com nomes de arquivos (\ / : * ? " < > | \0 e aspas)
  // Mantém letras (com acentos), números, espaços, hífens e underscores
  let nomeLimpo = nomeBruto
    .replace(/[\0-\x1F\x7F-\x9F]/g, "")
    .replace(/[\\/:*?"<>|'"]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "");

  // 2. Substitui sequências de espaços/underscores por um único underscore
  nomeLimpo = nomeLimpo.trim().replace(/[\s_]+/g, "_");

  // Fallback se o nome ficar vazio após sanitização
  if (!nomeLimpo) {
    nomeLimpo = "Solicitante";
  }

  // Obtenção e formatação da data em fuso horário de Brasília (America/Sao_Paulo)
  let dataObj;
  if (dados.criadoEm) {
    dataObj = new Date(dados.criadoEm);
    if (isNaN(dataObj.getTime())) {
      dataObj = new Date();
    }
  } else {
    dataObj = new Date();
  }

  const dataPtBr = dataObj.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const dataFormatada = dataPtBr.replace(/\//g, "_");

  return `Ressarcimento_${nomeLimpo}_${dataFormatada}.pdf`;
}

module.exports = {
  normalizarCpf,
  normalizarCep,
  formatarCPF,
  formatarTelefone,
  formatarCEP,
  formatarDataBR,
  formatarAgencia,
  formatarConta,
  escapeHtml,
  gerarNomeArquivoRessarcimento,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};