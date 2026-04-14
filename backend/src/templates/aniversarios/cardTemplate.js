function formatDatePtBR(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function buildBirthdayCard({ aniversariantes, date = new Date() }) {
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

  // O card é renderizado pelos frontends (site e mobile) que possuem lógica de parsing.
  // Mantemos um formato Markdown limpo e semântico.
  const conteudo = [
    '### 🎂 Feliz aniversário!',
    'SINPRF/ES celebra com alegria este dia especial.',
    '',
    '---',
    '',
    '### 🎊 Lista de aniversariantes',
    linhas,
  ].join('\n');

  return { titulo, subtitulo, conteudo };
}

module.exports = { buildBirthdayCard, formatDatePtBR };
