// Shared renderer for Informes: aligns web rendering with mobile (Markdown-first).
(function (global) {
  if (global.InformesRenderer) return;

  function escapeHTML(value) {
    if (global.Utils?.escapeHTML) return global.Utils.escapeHTML(value || '');
    return String(value || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getMarkdownRenderer() {
    if (!global.markdownit) return null;

    return global.markdownit({
      html: false,
      linkify: true,
      typographer: false,
      breaks: true,
    });
  }

  function sanitizeHtml(html, options = {}) {
    const allowRichHtml = options && options.allowRichHtml === true;
    if (!global.DOMPurify) return html;

    const baseConfig = {
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    };

    if (allowRichHtml) {
      return global.DOMPurify.sanitize(html, {
        ...baseConfig,
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 's', 'blockquote',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr',
          'div', 'span', 'img'
        ],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'style'],
      });
    }

    return global.DOMPurify.sanitize(html, {
      ...baseConfig,
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 's', 'blockquote',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr'
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      FORBID_ATTR: [...baseConfig.FORBID_ATTR, 'style'],
    });
  }

  function enforceSafeLinks(container) {
    const links = container.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = (link.getAttribute('href') || '').trim();
      const isSafe = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
      if (!isSafe) {
        link.removeAttribute('href');
        return;
      }

      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function renderInformesMarkdown(conteudo, options = {}) {
    const markdown = getMarkdownRenderer();
    const allowRichHtml = options && options.allowRichHtml === true;
    if (!markdown) {
      return `<p>${escapeHTML(conteudo || '')}</p>`;
    }

    const source = String(conteudo || '');
    const normalizedSource = allowRichHtml
      ? source
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n')
      : source;

    if (allowRichHtml) {
      const markdownWithHtml = global.markdownit({
        html: true,
        linkify: true,
        typographer: false,
        breaks: true,
      });
      return sanitizeHtml(markdownWithHtml.render(normalizedSource), { allowRichHtml: true });
    }

    const rendered = markdown.render(normalizedSource);
    return sanitizeHtml(rendered, options);
  }


  function renderInformesPlainText(conteudo, options = {}) {
    const markdown = getMarkdownRenderer();
    if (!markdown) return String(conteudo || '').replace(/\s+/g, ' ').trim();

    const rendered = renderInformesMarkdown(conteudo, options);
    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeHtml(rendered, options);
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const BIRTHDAY_BR_PREFIX_REGEX = /^\s*BR\s*[:\-|]?\s*/i;
  const BIRTHDAY_EMOJI_PREFIX_REGEX = /^[\s\-–—•*·]*[🎉🎂🎈✨🥳🎊🎁🍰🎆]+\s*/u;

  function normalizeBirthdayLine(line) {
    return String(line || '')
      .replace(BIRTHDAY_BR_PREFIX_REGEX, '')
      .replace(BIRTHDAY_EMOJI_PREFIX_REGEX, '')
      .trim();
  }

  function sanitizeBirthdayHeading(value) {
    const cleaned = normalizeBirthdayLine(String(value || '').replace(/[🎉🎂🎈✨🥳🎊🎁🍰🎆]/gu, '').trim());
    return cleaned || 'Aniversariantes do dia';
  }

  function parseBirthdayContent(conteudo) {
    const lines = String(conteudo || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => normalizeBirthdayLine(line))
      .filter(Boolean);

    const pessoas = [];
    let footer = '';
    const skipHeading = (line) => /^(lista de aniversariantes|aniversariantes|feliz anivers[aá]rio!?|anivers[aá]rio)$/i.test(line);

    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i].replace(/^[•\-*]\s*/, '').trim();
      if (!rawLine || skipHeading(rawLine)) continue;

      const splitWithDependent = rawLine.split(/\s*[·|-]\s*(?=Dependente de\s+)/i);
      if (splitWithDependent.length > 1) {
        pessoas.push({ nome: splitWithDependent[0].trim(), subline: splitWithDependent[1].trim() });
        continue;
      }

      if (/^Dependente de\s+/i.test(rawLine) && pessoas.length > 0) {
        if (!pessoas[pessoas.length - 1].subline) pessoas[pessoas.length - 1].subline = rawLine;
        continue;
      }

      const nextLine = lines[i + 1] ? lines[i + 1].replace(/^[•\-*]\s*/, '').trim() : '';
      if (/^Dependente de\s+/i.test(nextLine)) {
        pessoas.push({ nome: rawLine, subline: nextLine });
        i += 1;
        continue;
      }

      if (!/anivers[aá]ri/i.test(rawLine) && rawLine.length <= 110 && pessoas.length > 0) {
        footer = rawLine;
        continue;
      }

      pessoas.push({ nome: rawLine });
    }

    return { pessoas, footer };
  }

  function renderBirthdayCard(conteudo, options = {}) {
    const parsed = parseBirthdayContent(conteudo);
    const heading = sanitizeBirthdayHeading(options.title || '');
    const listHtml = parsed.pessoas.map((item) => `
      <li style="padding:10px 0; border-bottom:1px solid #f1f5f9; list-style:disc; margin-left:18px;">
        <div style="font-weight:600; color:#1f2937;">${escapeHTML(item.nome)}</div>
        ${item.subline ? `<div style="margin-top:2px; color:#64748b; font-size:0.94rem;">${escapeHTML(item.subline)}</div>` : ''}
      </li>
    `).join('');

    return `
      <article style="background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:16px;">
        <header style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
          <span aria-hidden="true" style="font-size:1rem;">🎉</span>
          <h2 style="margin:0; font-size:1.45rem; line-height:1.35; color:#1f2937; font-weight:700;">${escapeHTML(heading)}</h2>
        </header>
        <section style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
          <h3 style="margin:0 0 6px; font-size:1.08rem; color:#0f172a; font-weight:700;">🎂 Feliz aniversário!</h3>
          <p style="margin:0; color:#475569; line-height:1.55;">SINPRF/ES celebra com alegria este dia especial.</p>
        </section>
        <section>
          <h3 style="margin:0 0 10px; font-size:1rem; color:#111827; font-weight:600;">Lista de aniversariantes</h3>
          <ul style="margin:0; padding:0;">${listHtml}</ul>
        </section>
        ${parsed.footer ? `<footer style="margin-top:12px; color:#6b7280; font-size:0.93rem; font-style:italic;">${escapeHTML(parsed.footer)}</footer>` : ''}
      </article>
    `;
  }

  function mountRenderedMarkdown(container, conteudo, options = {}) {
    if (!container) return;
    if (options && options.variant === 'birthdayCard') {
      container.innerHTML = sanitizeHtml(renderBirthdayCard(conteudo, options), { allowRichHtml: true });
    } else {
      container.innerHTML = renderInformesMarkdown(conteudo, options);
    }
    enforceSafeLinks(container);
  }

  global.InformesRenderer = {
    renderInformesMarkdown,
    renderInformesPlainText,
    mountRenderedMarkdown,
  };
})(window);
