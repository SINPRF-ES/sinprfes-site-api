export const onlyDigits = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
};

export const formatCpf = (cpf: string | null | undefined): string => {
  const digits = onlyDigits(cpf);
  if (!digits) return '';
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatTelefone = (tel: string | null | undefined): string => {
  const digits = onlyDigits(tel);
  if (!digits) return '';

  const limited = digits.slice(0, 11);
  if (limited.length <= 2) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

export const formatCep = (cep: string | null | undefined): string => {
  const digits = onlyDigits(cep);
  if (!digits) return '';
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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
  formatAgencia,
  formatConta
};

export default Formatters;
