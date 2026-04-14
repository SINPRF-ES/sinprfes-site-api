function formatDatePtBR(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const BRASAO_SINPRF_ES_URL = 'https://sinprfes.org.br/img/placeholder-sinprf.png';

function buildBirthdayCard({ aniversariantes, date = new Date() }) {
  const brasaoUrl = BRASAO_SINPRF_ES_URL;
  const dataLabel = formatDatePtBR(date);

  const linhas = aniversariantes
    .map((pessoa) => {
      const vinculo = pessoa.tipo === 'DEPENDENTE'
        ? `Dependente de ${pessoa.nome_filiado_vinculo || 'filiado(a)'}`
        : 'Filiado(a)';
      return `- 🎈 **${pessoa.nome || 'Aniversariante'}** · ${vinculo}`;
    })
    .join('\n');

  const titulo = `🎉 Aniversariantes do dia ${dataLabel}`;
  const subtitulo = 'Parabéns aos colegas e familiares que celebram mais um ano de vida!';

  const conteudo = [
    `<div style="border:2px solid #1E88E5;border-radius:16px;padding:16px;background:linear-gradient(135deg,#ffffff 0%,#E8F5E9 45%,#FFF8E1 100%);">`,
    `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">`,
    `<img src="${brasaoUrl}" alt="Brasão SINPRF/ES" style="width:64px;height:64px;object-fit:contain;border-radius:10px;background:#fff;padding:6px;border:1px solid #e2e8f0;" />`,
    `<div>`,
    `<p style="margin:0;font-size:1.2rem;font-weight:700;color:#0D47A1;">🎂 Feliz aniversário!</p>`,
    `<p style="margin:4px 0 0;color:#2E7D32;">SINPRF/ES celebra com alegria este dia especial.</p>`,
    `</div>`,
    `</div>`,
    `</div>`,
    '',
    '---',
    '',
    '### 🎊 Lista de aniversariantes',
    linhas,
  ].join('\n');

  return { titulo, subtitulo, conteudo };
}

module.exports = { buildBirthdayCard, formatDatePtBR, BRASAO_SINPRF_ES_URL };
