export const formatAgeDetailed = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    let birthDate: Date;
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/').map(Number);
      birthDate = new Date(year, month - 1, day);
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

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

    return parts.length > 0 ? parts.join(', ').replace(/, ([^,]*)$/, ' e $1') : '0 dias';
  } catch {
    return '—';
  }
};
