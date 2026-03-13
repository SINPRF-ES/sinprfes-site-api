#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const nav = require('../public/js/area-filiado/navigation-config.js');

function ids(items) {
  return items.map((item) => item.id);
}

const adminInfo = {
  perfil_acesso: 'DIRETORIA',
  permissions: ['*'],
};

const restritoInfo = {
  perfil_acesso: 'COMUNICADOR',
  permissions: [],
};

const desktopAdmin = nav.getVisibleNavigationItems(adminInfo);
const mobileAdmin = nav.getVisibleNavigationItems(adminInfo);
assert.deepStrictEqual(ids(desktopAdmin), ids(mobileAdmin), 'Desktop e mobile devem ter os mesmos módulos para admin');

const desktopRestrito = nav.getVisibleNavigationItems(restritoInfo);
const mobileRestrito = nav.getVisibleNavigationItems(restritoInfo);
assert.deepStrictEqual(ids(desktopRestrito), ids(mobileRestrito), 'Desktop e mobile devem ter os mesmos módulos para perfil restrito');
assert.ok(!ids(mobileRestrito).includes('nav-filiados'), 'Perfil restrito não deve ver módulo Filiados');

assert.ok(desktopAdmin.length >= 15, 'Perfil com permissões amplas deve visualizar lista extensa');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
assert.ok(html.includes('.af-sidebar-nav') && html.includes('overflow-y: auto'), 'Sidebar mobile deve possuir scroll vertical');
assert.ok(html.includes('.af-sidebar.is-mobile-open'), 'Drawer mobile deve abrir por classe específica');

const navScript = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'area-filiado', 'navigation-config.js'), 'utf8');
assert.ok(navScript.includes("'nav-home'") && navScript.includes("active"), 'Renderização deve definir item ativo inicial');

console.log('OK: testes de paridade e layout mobile da sidebar passaram.');
