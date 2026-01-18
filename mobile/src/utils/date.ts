// mobile/src/utils/date.ts

import { onlyDigits } from '../shared/formatters';

/**
 * Converte uma data do formato DD/MM/YYYY para YYYY-MM-DD.
 * Retorna null se a data de entrada for inválida, vazia ou nula.
 * @param dateString A data no formato DD/MM/YYYY.
 * @returns A data no formato YYYY-MM-DD ou null.
 */
export const toISODate = (dateString: string | null | undefined): string | null => {
  if (!dateString) {
    return null;
  }

  const parts = dateString.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;
  // Validação básica
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return null;
  }

  // Retorna no formato AAAA-MM-DD
  return `${year}-${month}-${day}`;
};

/**
 * Converte uma data do formato YYYY-MM-DD para DD/MM/YYYY.
 * Retorna uma string vazia se a data de entrada for inválida, vazia ou nula.
 * @param dateString A data no formato YYYY-MM-DD.
 * @returns A data no formato DD/MM/YYYY ou ''.
 */
export const toBrazilianDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '';
  }

  // Garante que estamos lidando apenas com a parte da data (YYYY-MM-DD)
  const datePart = dateString.substring(0, 10);

  const parts = datePart.split('-');
  if (parts.length !== 3) {
    return dateString; // Retorna o original se não estiver no formato esperado
  }

  const [year, month, day] = parts;

  // Validação mais robusta para garantir que os componentes são válidos
  if (year.length !== 4 || month.length !== 2 || day.length !== 2 || isNaN(parseInt(day)) || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
    return dateString;
  }

  // Retorna no formato DD/MM/YYYY
  return `${day}/${month}/${year}`;
};

/**
 * Converte uma data no formato dd/MM/yyyy para o formato ISO yyyy-MM-dd.
 * Retorna null se a data for inválida ou vazia.
 */
export const parseBRToISO = (brDate: string | null | undefined): string | null => {
  if (!brDate) return null;
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Formata com padding (ex: 1 -> "01")
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
};

/**
 * Converte uma data ISO (yyyy-MM-dd ou com T/Z) para o formato dd/MM/yyyy.
 * Retorna uma string vazia se a data for inválida ou vazia.
 */
export const formatISOToBR = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';

  // Pega apenas a parte da data, ignorando o T/Z
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length !== 3) return '';

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  return `${day}/${month}/${year}`;
};

/**
 * Calcula a idade detalhada a partir de uma data de nascimento.
 * Aceita formatos ISO (YYYY-MM-DD) ou BR (DD/MM/YYYY).
 * Retorna uma string como "37 anos, 5 meses e 11 dias" ou "—" se inválida.
 */
export const calculateAgeBreakdown = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';

  let isoDate = dateStr;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Validação básica para YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return '—';

  const birthDate = new Date(isoDate.substring(0, 10) + 'T12:00:00');
  if (isNaN(birthDate.getTime())) return '—';

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (birthDate > today) return '—';

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  if (days > 0 || (years === 0 && months === 0)) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

  if (parts.length === 0) return '0 dias';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;

  const lastPart = parts.pop();
  return `${parts.join(', ')} e ${lastPart}`;
};

/**
 * Formata uma string de data para o formato DD/MM/YYYY, ideal para inputs.
 * Garante que as barras sejam inseridas nos locais corretos.
 */
export const formatDateToDdMmYyyy = (text: string): string => {
  const digits = onlyDigits(text);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};
