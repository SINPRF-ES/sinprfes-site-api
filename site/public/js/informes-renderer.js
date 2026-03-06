// Shared renderer for Informes: aligns web rendering with mobile (Markdown-first).
(function (global) {
  if (global.InformesRenderer) return;

  function escapeHTML(value) {
    if (global.Utils?.escapeHTML) return global.Utils.escapeHTML(value || '');
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
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

  function sanitizeHtml(html) {
    if (!global.DOMPurify) return html;

    return global.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 's', 'blockquote',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr'
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
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

  function renderInformesMarkdown(conteudo) {
    const markdown = getMarkdownRenderer();
    if (!markdown) {
      return `<p>${escapeHTML(conteudo || '')}</p>`;
    }

    const rendered = markdown.render(String(conteudo || ''));
    return sanitizeHtml(rendered);
  }


  function renderInformesPlainText(conteudo) {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderInformesMarkdown(conteudo);
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function mountRenderedMarkdown(container, conteudo) {
    if (!container) return;
    container.innerHTML = renderInformesMarkdown(conteudo);
    enforceSafeLinks(container);
  }

  global.InformesRenderer = {
    renderInformesMarkdown,
    renderInformesPlainText,
    mountRenderedMarkdown,
  };
})(window);
