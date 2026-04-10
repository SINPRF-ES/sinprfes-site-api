const parseBirthDate = (dateStr: string): Date | null => {
  const raw = String(dateStr || '').trim();

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  let day: number;
  let month: number;
  let year: number;

  if (brMatch) {
    day = Number(brMatch[1]);
    month = Number(brMatch[2]);
    year = Number(brMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  const birthDate = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  return birthDate;
};

export const formatAgeDetailed = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';

  const birthDate = parseBirthDate(dateStr);
  if (!birthDate) return '—';

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (birthDate > today) return '—';

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  if (days > 0 || (years === 0 && months === 0)) {
    parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
  }

  if (parts.length === 0) return '0 dias';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;

  const lastPart = parts.pop();
  return `${parts.join(', ')} e ${lastPart}`;
};
