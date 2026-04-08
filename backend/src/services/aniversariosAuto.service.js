const log = require('../utils/log');
const { buildBirthdayCard } = require('../templates/aniversarios/cardTemplate');

function resolveApiBase() {
  const fromEnv = process.env.INTERNAL_API_BASE_URL || process.env.API_INTERNAL_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_e) {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status} em ${url}`);
    err.status = response.status;
    err.response = data;
    throw err;
  }

  return data;
}

async function criarAniversarioAutomatico({ aniversariantes }) {
  if (!Array.isArray(aniversariantes) || aniversariantes.length === 0) {
    return { created: false, reason: 'empty' };
  }

  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    log.warn('ANIVERSARIOS_AUTO_TOKEN_MISSING');
    return { created: false, reason: 'missing_token' };
  }

  const apiBase = resolveApiBase();
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const atuais = await requestJson(`${apiBase}/api/aniversarios?status_editorial=ATUAL`, {
    method: 'GET',
    headers,
  });

  const listaAtuais = Array.isArray(atuais) ? atuais : (atuais.items || atuais.data || []);
  const jaExisteHoje = listaAtuais.some((item) => String(item.data_informe || '').slice(0, 10) === todayIso);

  if (jaExisteHoje) {
    return { created: false, reason: 'already_exists_today' };
  }

  const card = buildBirthdayCard({ aniversariantes, date: new Date() });
  const dataInforme = `${todayIso}T12:00:00.000Z`;

  const criado = await requestJson(`${apiBase}/api/aniversarios`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      titulo: card.titulo,
      subtitulo: card.subtitulo,
      conteudo: card.conteudo,
      data_informe: dataInforme,
      destaque: true,
    }),
  });

  const createdItem = criado?.data || criado;
  if (!createdItem?.id) {
    log.warn('ANIVERSARIOS_AUTO_CREATED_WITHOUT_ID');
    return { created: true, published: false };
  }

  await requestJson(`${apiBase}/api/aniversarios/${createdItem.id}/publicar`, {
    method: 'POST',
    headers,
  });

  return { created: true, published: true, id: createdItem.id };
}

module.exports = {
  criarAniversarioAutomatico,
};
