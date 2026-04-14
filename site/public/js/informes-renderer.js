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
          'div', 'span', 'img', 'article', 'header', 'section', 'footer', 'h2', 'h3'
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
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/#/g, '') // Remove markdown hashes
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
      .filter((line) => line && !/^[\s\-–—•*·=_]*$/.test(line)); // Filter empty or separator-only lines

    const pessoas = [];
    let footer = '';
    const skipHeading = (line) =>
      /^(lista de aniversariantes|aniversariantes|feliz anivers[aá]rio!?|anivers[aá]rio|sinprf\/es celebra com alegria este dia especial\.?)$/i.test(line);

    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i].replace(/^[•\-*]\s*/, '').trim();
      if (!rawLine || skipHeading(rawLine)) continue;

      if (rawLine.startsWith('>') || (i === lines.length - 1 && i > 0 && !/anivers[aá]ri/i.test(rawLine) && rawLine.length > 20 && !/(Dependente de|Filiado\(a\))/i.test(rawLine))) {
        footer = rawLine.replace(/^>\s*/, '').trim();
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
          continue;
        }
      }

      const nextLine = lines[i + 1] ? lines[i + 1].replace(/^[•\-*]\s*/, '').trim() : '';
      if (/^(?:Dependente de|Filiado\(a\))\s*/i.test(nextLine)) {
        pessoas.push({ nome: rawLine, subline: nextLine });
        i += 1;
        continue;
      }

      if (!/anivers[aá]ri/i.test(rawLine) && rawLine.length <= 110 && pessoas.length > 0 && i === lines.length - 1 && !/(Dependente de|Filiado\(a\))/i.test(rawLine)) {
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
    const brasaoUrl = '/img/Logo_ES_semfundo.png';

    const listHtml = parsed.pessoas.map((item) => `
      <li style="padding:12px 0; border-bottom:1px solid rgba(31, 111, 178, 0.08); list-style:none; display:flex; align-items:flex-start; gap:10px;">
        <span style="font-size:1.1rem; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🎈</span>
        <div>
          <div style="font-weight:700; color:#1f6fb2; font-size:1.05rem;">${escapeHTML(item.nome)}</div>
          ${item.subline ? `<div style="margin-top:2px; color:#475569; font-size:0.9rem; font-weight:500;">${escapeHTML(item.subline)}</div>` : ''}
        </div>
      </li>
    `).join('');

    return `
      <article style="background:#ffffff; border:1px solid rgba(31, 111, 178, 0.15); border-radius:20px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(31, 111, 178, 0.1);">
        <header style="background:linear-gradient(135deg, #1f6fb2 0%, #3586c9 100%); padding:20px; display:flex; align-items:center; gap:16px;">
          <div style="background:#fff; padding:6px; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.15);">
            <img src="${brasaoUrl}" alt="SINPRF/ES" style="width:52px; height:52px; object-fit:contain;">
          </div>
          <div>
            <h2 style="margin:0; font-size:1.3rem; color:#ffffff; font-weight:800; letter-spacing:-0.01em;">${escapeHTML(heading)}</h2>
            <div style="margin-top:2px; display:flex; align-items:center; gap:6px;">
              <span style="width:8px; height:8px; border-radius:50%; background:#e83e8c; display:inline-block;"></span>
              <span style="color:rgba(255,255,255,0.9); font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Celebração Institucional</span>
            </div>
          </div>
        </header>

        <div style="padding:20px;">
          <section style="background:linear-gradient(to right, #fdf2f8, #ffffff); border-left:4px solid #e83e8c; border-radius:8px; padding:16px; margin-bottom:20px; box-shadow:0 2px 8px rgba(232, 62, 140, 0.1);">
            <h3 style="margin:0 0 4px; font-size:1.15rem; color:#be185d; font-weight:800; display:flex; align-items:center; gap:8px;">
              <span>🎂</span> Feliz aniversário!
            </h3>
            <p style="margin:0; color:#831843; line-height:1.5; font-weight:500;">O SINPRF/ES parabeniza todos os colegas e familiares que celebram mais um ano de vida hoje!</p>
          </section>

          <section>
            <h3 style="margin:0 0 12px; font-size:0.95rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">🎊</span> Lista de aniversariantes
            </h3>
            <ul style="margin:0; padding:0;">${listHtml}</ul>
          </section>

          ${parsed.footer ? `
            <footer style="margin-top:20px; padding-top:16px; border-top:1px dashed #cbd5e1; color:#64748b; font-size:0.85rem; font-style:italic; line-height:1.5; display:flex; align-items:flex-start; gap:8px;">
              <span style="font-style:normal; opacity:0.7;">ℹ️</span>
              <span>${escapeHTML(parsed.footer)}</span>
            </footer>
          ` : ''}
        </div>
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
