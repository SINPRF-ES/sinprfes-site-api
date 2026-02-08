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
  return calculateDuration(dateStr, new Date().toISOString());
};

/**
 * Calcula a diferença entre duas datas em anos, meses e dias.
 * @param fromDateStr Data de início (ISO ou BR)
 * @param toDateStr Data de fim (ISO ou BR)
 */
export const calculateDuration = (fromDateStr: string | null | undefined, toDateStr: string | null | undefined): string => {
  if (!fromDateStr || !toDateStr) return '—';
  try {
    const parseDate = (d: string) => {
      if (d.includes('/')) {
        const parts = d.split('/').map(Number);
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return new Date(d);
    };

    const start = parseDate(fromDateStr);
    const end = parseDate(toDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';

    let diff = end.getTime() - start.getTime();
    const isNegative = diff < 0;

    // Para simplificar o cálculo de anos/meses/dias, trabalhamos com o absoluto e ajustamos depois se necessário
    // mas a lógica abaixo já lida bem com a ordem se invertermos as datas para positivo.
    const d1 = isNegative ? end : start;
    const d2 = isNegative ? start : end;

    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();

    if (days < 0) {
      months--;
      const lastMonth = new Date(d2.getFullYear(), d2.getMonth(), 0);
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

    const result = parts.length > 0 ? parts.join(', ').replace(/, ([^,]*)$/, ' e $1') : '0 dias';
    return isNegative ? `passou do prazo (${result})` : result;
  } catch (e) {
    return '—';
  }
};
