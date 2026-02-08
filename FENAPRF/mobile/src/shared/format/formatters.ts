export const onlyDigits = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
};

export const formatCpf = (cpf: string | null | undefined): string => {
  try {
    if (!cpf) return '';
    const digits = onlyDigits(cpf).slice(0, 11);
    if (!digits) return '';

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  } catch (e) {
    console.error('[Formatters.formatCpf.error]', e);
    return '—';
  }
};

export const formatTelefone = (tel: string | null | undefined): string => {
  if (!tel) return '';
  const digits = onlyDigits(tel).slice(0, 11);
  const len = digits.length;
  if (len === 0) return '';

  if (len === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (len === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Para comprimentos intermediários, evita máscaras parciais com caracteres "soltos" (ex: '(' ou '-')
  // Retorna apenas os dígitos para garantir uma UI limpa em caso de dados incompletos
  return digits;
};

export const formatCep = (cep: string | null | undefined): string => {
  const digits = onlyDigits(cep);
  if (!digits) return '';
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const formatData = (data: string | null | undefined): string => {
  if (!data) return '';
  const digits = onlyDigits(data).slice(0, 8);
  const len = digits.length;
  if (len === 0) return '';

  if (len <= 2) return digits;
  if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const formatAgencia = (agencia: string | null | undefined): string => {
  const digits = onlyDigits(agencia);
  if (!digits) return '';
  const limited = digits.slice(0, 5);
  if (limited.length < 5) return limited;
  return `${limited.slice(0, 4)}-${limited.slice(4)}`;
};

export const formatConta = (conta: string | null | undefined): string => {
  const digits = onlyDigits(conta);
  if (!digits) return '';
  const limited = digits.slice(0, 10); // Permitir mais que 6 digitos se necessário, mas formatar os últimos
  if (limited.length < 2) return limited;
  return `${limited.slice(0, -1)}-${limited.slice(-1)}`;
};

const Formatters = {
  onlyDigits,
  formatCpf,
  formatTelefone,
  formatCep,
  formatData,
  formatAgencia,
  formatConta
};

export default Formatters;
