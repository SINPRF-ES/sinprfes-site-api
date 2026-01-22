export const onlyDigits = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\D/g, '');
};

export const formatCpf = (cpf: string | null | undefined): string => {
  try {
    if (!cpf) return '—';
    const digits = onlyDigits(cpf);
    if (!digits) return '—';
    if (digits.length !== 11) return digits;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  } catch (e) {
    console.error('[Formatters.formatCpf.error]', e);
    return '—';
  }
  if (!cpf) return '';
  const digits = onlyDigits(cpf).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatTelefone = (tel: string | null | undefined): string => {
  if (!tel) return '';
  const digits = onlyDigits(tel).slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const formatCep = (cep: string | null | undefined): string => {
  if (!cep) return '';
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const formatAgencia = (agencia: string | null | undefined): string => {
  if (!agencia) return '';
  const digits = onlyDigits(agencia).slice(0, 5);
  if (digits.length < 5) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const formatConta = (conta: string | null | undefined): string => {
  if (!conta) return '';
  const digits = onlyDigits(conta).slice(0, 6);
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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
