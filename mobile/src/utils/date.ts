import { onlyDigits } from '../shared/format/formatters';

export const formatISOToBR = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
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
    const isoDate = dateStr.includes('/') ? parseBRToISO(dateStr) : dateStr.split('T')[0];
    if (!isoDate) return '—';
    const birth = new Date(isoDate);
    if (isNaN(birth.getTime())) return '—';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} anos`;
  } catch {
    return '—';
  }
};
