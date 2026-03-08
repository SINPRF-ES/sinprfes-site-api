#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = fs.readdirSync(publicDir)
  .filter((name) => name.endsWith('.html'))
  .filter((name) => !['modelo_pagina.html', 'scroll_test.html'].includes(name));

const errors = [];

for (const file of htmlFiles) {
  const fullPath = path.join(publicDir, file);
  const html = fs.readFileSync(fullPath, 'utf8');
  const hasSiteShellMount = /id=["']site-header["']/.test(html) || /id=["']site-footer["']/.test(html);

  if (!hasSiteShellMount) continue;

  if (!/href=["']\/css\/style\.css["']/.test(html)) {
    errors.push(`${file}: faltando /css/style.css`);
  }

  if (!/src=["']\/css\/ui-canon\.css["']/.test(html) && !/href=["']\/css\/ui-canon\.css["']/.test(html)) {
    errors.push(`${file}: faltando /css/ui-canon.css`);
  }

  if (!/src=["']\/js\/main\.js["']/.test(html)) {
    errors.push(`${file}: faltando /js/main.js para renderizar header/footer canônicos`);
  }
}

if (errors.length) {
  console.error('Contrato de layout público violado:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`OK: contrato de layout validado em ${htmlFiles.length} páginas.`);
