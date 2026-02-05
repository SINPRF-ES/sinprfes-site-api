/**
 * Utilitário compartilhado para cálculo de idade.
 * Mantém consistência entre Mobile e Site.
 */

/**
 * Calcula a idade detalhada a partir de uma data (ISO ou BR).
 * Retorna: "37 anos, 5 meses e 11 dias"
 */
function formatAgeDetailed(dateStr) {
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
    // Pega o último dia do mês anterior
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
}

// Suporte para Node (CommonJS) e Browser (Global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatAgeDetailed
  };
} else {
  window.AgeUtils = {
    formatAgeDetailed
  };
}
