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

/**
 * Formata uma data ISO para HH:MM:SS no timezone America/Sao_Paulo.
 */
export const formatTimeSP = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '--:--:--';
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '--:--:--';

    return date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    console.error('formatTimeSP error', e);
    return '--:--:--';
  }
};

export const toBrazilianDate = (isoDate: string | null | undefined): string => {
  return formatISOToBR(isoDate);
};

export const parseBRToISO = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Se for ISO ou similar (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // Se for formato brasileiro DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
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
    const raw = String(dateStr || '').trim();

    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    let day;
    let month;
    let year;

    if (brMatch) {
      day = Number(brMatch[1]);
      month = Number(brMatch[2]);
      year = Number(brMatch[3]);
    } else if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]);
      day = Number(isoMatch[3]);
    } else {
      return '—';
    }

    const birthDate = new Date(year, month - 1, day, 12, 0, 0, 0);

    // Bloqueia datas inválidas que o JS "corrige" automaticamente (ex.: 31/02).
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      return '—';
    }

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
  } catch (e) {
    return '—';
  }
};
