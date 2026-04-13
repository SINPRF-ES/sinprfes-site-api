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
    if (allowRichHtml) {
      const markdownWithHtml = global.markdownit({
        html: true,
        linkify: true,
        typographer: false,
        breaks: true,
      });
      return sanitizeHtml(markdownWithHtml.render(source), { allowRichHtml: true });
    }

    const rendered = markdown.render(source);
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

  function mountRenderedMarkdown(container, conteudo, options = {}) {
    if (!container) return;
    container.innerHTML = renderInformesMarkdown(conteudo, options);
    enforceSafeLinks(container);
  }

  global.InformesRenderer = {
    renderInformesMarkdown,
    renderInformesPlainText,
    mountRenderedMarkdown,
  };
})(window);
