export type BirthdayPerson = {
  nome: string;
  subline?: string;
};

const BIRTHDAY_EMOJI_PREFIX_REGEX = /^[\s\-–—•*·]*[🎉🎂🎈✨🥳🎊🎁🍰🎆]+\s*/u;
const BIRTHDAY_BR_PREFIX_REGEX = /^\s*BR\s*[:\-|]?\s*/i;
const GENERIC_BIRTHDAY_LIST_SUMMARY = 'Lista de aniversariantes do dia.';

const normalizeBirthdayLine = (line: string): string => {
  return String(line || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*/g, '')
    .replace(/#/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(BIRTHDAY_BR_PREFIX_REGEX, '')
    .replace(BIRTHDAY_EMOJI_PREFIX_REGEX, '')
    .trim();
};

const isBirthdayHeading = (line: string) =>
  /^(lista de aniversariantes|aniversariantes|feliz anivers[aá]rio!?|anivers[aá]rio|sinprf\/es celebra com alegria este dia especial\.?)$/i.test(line);

const isDecorativeFooterLine = (line: string) => {
  const normalized = line.toLowerCase();
  return (
    /cores inspiradas na bandeira/.test(normalized) ||
    /clima de festa/.test(normalized) ||
    /celebra[çc][aã]o coletiva/.test(normalized) ||
    (/bal[õo]es/.test(normalized) && /bolo/.test(normalized))
  );
};

export const sanitizeBirthdayHeading = (value?: string | null): string => {
  const cleaned = normalizeBirthdayLine(String(value || '').replace(/[🎉🎂🎈✨🥳🎊🎁🍰🎆]/gu, '').trim());
  return cleaned || 'Aniversariantes do dia';
};

export const parseBirthdayContent = (conteudo?: string | null): { pessoas: BirthdayPerson[] } => {
  const lines = String(conteudo || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeBirthdayLine(line))
    .filter((line) => line && !/^[\s\-–—•*·=_]*$/.test(line));

  const pessoas: BirthdayPerson[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i].replace(/^[•\-*]\s*/, '').trim();
    if (!rawLine || isBirthdayHeading(rawLine) || isDecorativeFooterLine(rawLine)) continue;

    if (rawLine.startsWith('>')) {
      continue;
    }

    const splitWithDependent = rawLine.split(/\s*[·|-]\s*(?=(?:Dependente de|Filiado\(a\))\s*)/i);
    if (splitWithDependent.length > 1) {
      pessoas.push({ nome: splitWithDependent[0].trim(), subline: splitWithDependent[1].trim() });
      continue;
    }

    if (/^(?:Dependente de|Filiado\(a\))\s*/i.test(rawLine) && pessoas.length > 0) {
      if (!pessoas[pessoas.length - 1].subline) {
        pessoas[pessoas.length - 1].subline = rawLine;
      }
      continue;
    }

    const nextLine = lines[i + 1] ? lines[i + 1].replace(/^[•\-*]\s*/, '').trim() : '';
    if (/^(?:Dependente de|Filiado\(a\))\s*/i.test(nextLine)) {
      pessoas.push({ nome: rawLine, subline: nextLine });
      i += 1;
      continue;
    }

    if (pessoas.length > 0 && rawLine.length > 110 && !/(Dependente de|Filiado\(a\))/i.test(rawLine)) {
      continue;
    }

    pessoas.push({ nome: rawLine });
  }

  return { pessoas };
};

export const getBirthdayListSummary = (conteudo?: string | null): string => {
  const { pessoas } = parseBirthdayContent(conteudo);
  if (pessoas.length > 0) {
    return `Lista de aniversariantes do dia (${pessoas.length}).`;
  }
  return GENERIC_BIRTHDAY_LIST_SUMMARY;
};
