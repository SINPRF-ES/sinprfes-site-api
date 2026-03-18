(function (global) {
  if (global.AreaFiliadoNavigation) return;

  const NAVIGATION_ITEMS = [
    { id: 'nav-home', target: 'sec-home', label: 'Página Inicial', icon: '🏠', order: 10, section: 'principal' },
    { id: 'nav-informes', target: 'sec-informes', label: 'Informes', icon: '📢', order: 20, section: 'principal' },
    { id: 'nav-convenios', target: 'sec-convenios', label: 'Convênios', icon: '🤝', order: 25, section: 'principal' },
    { id: 'nav-meus-dados', target: 'sec-meus-dados', label: 'Meus Dados', icon: '👤', order: 30, section: 'principal' },
    { id: 'nav-filiados', target: 'sec-filiados', label: 'Filiados', icon: '👥', order: 40, section: 'principal', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-publicacoes', target: 'sec-publicacoes', label: 'Publicações', icon: '📚', order: 50, section: 'principal', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-ressarcimento', target: 'sec-ressarcimento', label: 'Ressarcimento', icon: '💸', order: 60, section: 'principal' },
    { id: 'nav-jogos', target: 'sec-jogos', label: 'Jogos 2026', icon: '🏆', order: 70, section: 'principal', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-assembleias', target: 'sec-assembleias', label: 'Assembleias e Votações', icon: '🗳️', order: 80, section: 'principal', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-enquetes', target: 'sec-enquetes', label: 'Enquetes', icon: '🗨️', order: 90, section: 'principal', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-estatuto', target: 'sec-estatuto', label: 'Estatuto', icon: '📜', order: 100, section: 'principal' },
    { id: 'nav-seguranca', target: 'sec-seguranca', label: 'Segurança', icon: '🔒', order: 110, section: 'principal' },
    { id: 'nav-notificacoes', target: 'sec-notificacoes', label: 'Notificações', icon: '📢', order: 120, section: 'gestao', visible: ({ hasPerm }) => hasPerm('PUSH_GERENCIAR') },
    { id: 'nav-repasse', target: 'sec-repasse', label: 'Repasse', icon: '💱', order: 130, section: 'gestao', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-relatorios', target: 'sec-relatorios', label: 'Relatórios', icon: '📊', order: 140, section: 'gestao', visible: ({ hasPerm }) => hasPerm('RELATORIOS_VER') },
    { id: 'nav-consulta-processual', target: 'sec-consulta-processual', label: 'Consulta Processual', icon: '⚖️', order: 150, section: 'gestao', visible: ({ isComunicador }) => !isComunicador },
    { id: 'nav-novo-filiado', target: null, label: 'Novo Filiado', icon: '➕', order: 160, section: 'gestao', controls: 'sec-filiados', visible: ({ isComunicador, hasPerm }) => !isComunicador && hasPerm('CREATE_FILIADO') },
    { id: 'nav-informes-admin', target: 'sec-informes-admin', label: 'Informes (Interno)', icon: '🗂️', order: 165, section: 'gestao', visible: ({ hasPerm }) => hasPerm('EDIT_CONTENT') },
    { id: 'nav-noticias-admin', target: 'sec-noticias-admin', label: 'Notícias do Site', icon: '📰', order: 166, section: 'gestao', visible: ({ hasPerm }) => hasPerm('EDIT_CONTENT') },
    { id: 'nav-cms', target: 'sec-cms', label: 'Site (CMS)', icon: '🌐', order: 170, section: 'gestao', visible: ({ hasPerm }) => hasPerm('EDIT_CONTENT') },
    { id: 'nav-diagnostico', target: 'sec-diagnostico', label: 'Diagnóstico', icon: '🛠️', order: 180, section: 'gestao', visible: ({ hasPerm }) => hasPerm('PUSH_GERENCIAR') },
  ];

  function buildContext(info = {}) {
    const perfil = (info.perfil_acesso || info.perfil || 'FILIADO').toUpperCase();
    const perms = Array.isArray(info.permissions) ? info.permissions : [];
    const hasPerm = (perm) => perms.includes('*') || perms.includes(perm);
    return { perfil, isComunicador: perfil === 'COMUNICADOR', hasPerm };
  }

  function getVisibleNavigationItems(info = {}) {
    const context = buildContext(info);
    return NAVIGATION_ITEMS
      .filter((item) => (typeof item.visible === 'function' ? item.visible(context) : true))
      .sort((a, b) => a.order - b.order);
  }

  function renderSidebarNav(container) {
    if (!container) return;
    container.innerHTML = NAVIGATION_ITEMS
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const isActive = item.id === 'nav-home';
        const isHighlight = item.id === 'nav-novo-filiado';
        const controls = item.controls || item.target || 'sec-home';
        const targetAttr = item.target ? ` data-target="${item.target}"` : '';
        const classes = ['af-nav-item'];
        if (isActive) classes.push('active');
        if (isHighlight) classes.push('pulse-highlight');

        return `<button class="${classes.join(' ')}"${targetAttr} id="${item.id}" role="tab" aria-selected="${isActive ? 'true' : 'false'}" aria-controls="${controls}"><span aria-hidden="true">${item.icon}</span> ${item.label}</button>`;
      })
      .join('');
  }

  function syncVisibility(info = {}) {
    const visible = new Set(getVisibleNavigationItems(info).map((item) => item.id));
    NAVIGATION_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (!el) return;
      el.style.display = visible.has(item.id) ? 'flex' : 'none';
    });
  }

  const api = { NAVIGATION_ITEMS, getVisibleNavigationItems, renderSidebarNav, syncVisibility };
  global.AreaFiliadoNavigation = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
