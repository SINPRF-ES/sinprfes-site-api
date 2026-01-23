import { onlyDigits } from '../shared/format/formatters';

export const formatISOToBR = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export const formatISOToBRDateTime = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '—';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '—';

    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const ano = date.getFullYear();
    const hora = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');

    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch (e) {
    return '—';
  }
};

export const toBrazilianDate = (isoDate: string | null | undefined): string => {
  return formatISOToBR(isoDate);
};

export const parseBRToISO = (brDate: string | null | undefined): string | null => {
  if (!brDate) return null;
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const toISODate = (brDate: string | null | undefined): string | null => {
  return parseBRToISO(brDate);
};

export const formatDateToDdMmYyyy = (text: string): string => {
  const digits = onlyDigits(text);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

export const calculateAgeBreakdown = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    let birthDate;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/').map(Number);
      birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      birthDate = new Date(dateStr);
    }

    if (isNaN(birthDate.getTime())) return '—';

    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

    return parts.length > 0 ? parts.join(', ').replace(/, ([^,]*)$/, ' e $1') : '0 dias';
  } catch (e) {
    return '—';
  }
};
