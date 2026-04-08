(function (global) {
  if (global.AreaFiliadoContentModules) return;

  const CONTENT_MODULES = {
    INFORMES: {
      key: 'informes',
      label: 'Informes',
      title: '📰 Informes internos',
      emoji: '📰',
      navId: 'nav-informes',
      sectionId: 'sec-informes',
      routeBase: '/api/informes',
    },
    ANIVERSARIOS: {
      key: 'aniversarios',
      label: 'Aniversários',
      title: '🎂 Aniversários internos',
      emoji: '🎂',
      navId: 'nav-aniversarios',
      sectionId: 'sec-aniversarios',
      routeBase: '/api/aniversarios',
    },
  };

  global.AreaFiliadoContentModules = CONTENT_MODULES;
})(typeof window !== 'undefined' ? window : globalThis);
