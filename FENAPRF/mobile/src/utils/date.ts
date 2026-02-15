/**
 * FENAPRF - Utilitários de Data
 */
import { onlyDigits } from './format';

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY).
 */
export const formatISOToBR = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

/**
 * Converte data ISO para formato brasileiro com hora (DD/MM/YYYY HH:mm).
 */
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

export interface MandateTimeResult {
  elapsed: string;
  remaining: string;
}

/**
 * Calcula o tempo decorrido e restante de um mandato (Regra FENAPRF).
 */
export const calculateMandateTime = (inicioStr?: string | null, fimStr?: string | null): MandateTimeResult => {
  const naoInformado = 'não informado';
  const fallback = { elapsed: naoInformado, remaining: naoInformado };

  if (!inicioStr || !fimStr) return fallback;

  try {
    const parse = (d: string) => {
      if (d.includes('/')) {
        const [dia, mes, ano] = d.split('/').map(Number);
        return new Date(ano, mes - 1, dia);
      }
      return new Date(d);
    };

    const inicio = parse(inicioStr);
    const fim = parse(fimStr);
    const hoje = new Date();

    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return fallback;

    const formatDiff = (start: Date, end: Date) => {
      let s = start;
      let e = end;

      if (start > end) {
        return '0 anos, 0 meses e 0 dias';
      }

      let years = e.getFullYear() - s.getFullYear();
      let months = e.getMonth() - s.getMonth();
      let days = e.getDate() - s.getDate();

      if (days < 0) {
        months--;
        const lastMonth = new Date(e.getFullYear(), e.getMonth(), 0);
        days += lastMonth.getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      const parts = [];
      parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
      parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
      parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

      return parts.join(', ').replace(/, ([^,]*)$/, ' e $1');
    };

    const elapsed = formatDiff(inicio, hoje);
    const remaining = hoje >= fim ? 'Mandato encerrado' : formatDiff(hoje, fim);

    return { elapsed, remaining };
  } catch (e) {
    return fallback;
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

/**
 * Alias para formatISOToBR.
 */
export const toBrazilianDate = (isoDate: string | null | undefined): string => {
  return formatISOToBR(isoDate);
};

/**
 * Converte data brasileira (DD/MM/YYYY ou DDMMYYYY) para ISO (YYYY-MM-DD).
 */
export const parseBRToISO = (brDate: string | null | undefined): string | null => {
  if (!brDate) return null;

  // DD/MM/YYYY
  if (brDate.includes('/')) {
    const parts = brDate.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DDMMYYYY
  if (/^\d{8}$/.test(brDate)) {
    const day = brDate.substring(0, 2);
    const month = brDate.substring(2, 4);
    const year = brDate.substring(4, 8);
    return `${year}-${month}-${day}`;
  }

  return null;
};

/**
 * Alias para parseBRToISO.
 */
export const toISODate = (brDate: string | null | undefined): string | null => {
  return parseBRToISO(brDate);
};

/**
 * Formata texto para máscara de data DD/MM/YYYY conforme digitação.
 */
export const formatDateToDdMmYyyy = (text: string): string => {
  const digits = onlyDigits(text);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/**
 * Formata texto para máscara de data e hora DD/MM/YYYY HH:mm conforme digitação.
 */
export const formatDateTimeMask = (text: string): string => {
  const digits = onlyDigits(text);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
};

/**
 * Converte data e hora brasileira (DD/MM/YYYY HH:mm) para ISO.
 */
export const parseBRDateTimeToISO = (brDateTime: string): string | null => {
  const digits = onlyDigits(brDateTime);
  if (digits.length < 12) return null;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
};

/**
 * Calcula a idade detalhada (anos, meses, dias) a partir de uma data de nascimento.
 */
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

/**
 * Normaliza diferentes formatos de data para o padrão ISO YYYY-MM-DD.
 */
export function toIsoDateYYYYMMDD(input: string | Date | null | undefined): string | null {
  if (!input) return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, '0');
    const day = String(input.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dateStr = String(input).trim();
  if (!dateStr) return null;

  // Caso 1: ISO completa ou apenas data (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // Caso 2: Formato brasileiro (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Caso 3: Formato sem separadores (DDMMYYYY)
  if (/^\d{8}$/.test(dateStr)) {
    const d = dateStr.substring(0, 2);
    const m = dateStr.substring(2, 4);
    const y = dateStr.substring(4, 8);
    return `${y}-${m}-${d}`;
  }

  // Fallback: Tenta dar parse no que sobrar
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // ignore
  }

  return null;
}
