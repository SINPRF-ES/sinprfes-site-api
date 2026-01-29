const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Mock API calls
  await page.route('**/api/assembleias', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 1,
      titulo: 'Assembleia de Teste',
      tipo: 'AGE',
      status: 'ENCERRADA',
      data: '2026-03-01',
      horario: '10:00'
    }]),
  }));

  await page.route('**/api/assembleias/1/estado', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 1,
      titulo: 'Assembleia de Teste',
      tipo: 'AGE',
      status: 'ENCERRADA',
      data: '2026-03-01',
      horario: '10:00',
      pauta: 'Teste de pauta\n\n- Ponto 1\n- Ponto 2',
      edital_url: '/api/assembleias/proxy-edital',
      quorumVigente: { total: 10, presentes: 5, quorum_necessario: 20 }
    }),
  }));

  // Mock user profile as FILIADO
  await page.addInitScript(() => {
    window.userProfile = 'FILIADO';
    // If the app uses localStorage or cookies, mock them here
    localStorage.setItem('perfil', 'FILIADO');
  });

  await page.goto('http://localhost:3000/area-filiado/assembleias.html');
  await page.waitForSelector('text="Assembleia de Teste"');
  await page.screenshot({ path: '/home/jules/verification/list_filiado.png' });

  // Click on details
  const detailBtn = await page.waitForSelector('button:has-text("Ver Detalhes e Participar")');
  await detailBtn.click();

  // Wait for the detail view to render
  // Check if "Relatório PDF" button is visible for FILIADO in ENCERRADA assembly
  await page.waitForSelector('button:has-text("Relatório PDF")', { timeout: 5000 });

  await page.screenshot({ path: '/home/jules/verification/detail_filiado.png' });

  await browser.close();
})();
