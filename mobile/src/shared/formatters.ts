export const onlyDigits = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/\D/g, '');
};

export const formatCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return '';
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatTelefone = (tel: string | null | undefined): string => {
  if (!tel) return '';
  const digits = onlyDigits(tel);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
};

export const formatCep = (cep: string | null | undefined): string => {
  if (!cep) return '';
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};
