// Manejo de pasto: cadastro, mudança de pasto e disposição.
const { test, expect, abrirDemo, novaFazenda, ir, dia, cadastrarPasto, entrarLote001 } = require('./ajuda');

test.describe('Manejo de pasto', () => {
  test.beforeEach(async ({ page }) => { await abrirDemo(page); await novaFazenda(page); });

  test('cadastro de pastos', async ({ page }) => {
    await cadastrarPasto(page, 'Pasto A', 20, 730);
    await cadastrarPasto(page, 'Pasto B', 10, 365);
    await expect(page.locator('.content')).toContainText(/Pasto A/i);
    await expect(page.locator('.content')).toContainText(/Pasto B/i);
  });

  test('mudança de pasto deixa o pasto antigo vazio', async ({ page }) => {
    await cadastrarPasto(page, 'Pasto A', 20, 730);
    await cadastrarPasto(page, 'Pasto B', 10, 365);
    await entrarLote001(page, { dieta: null });
    await ir(page, 'pasto/mudanca');
    await page.fill('#mv-data', dia(3));
    await page.selectOption('#mv-pasto', { label: 'Pasto B' });
    await page.click('#fMov button[type=submit]');
    await page.waitForTimeout(200);
    await ir(page, 'pasto/disposicao');
    await expect(page.locator('body')).toContainText(/Vazio há 3 dias/i);
  });
});
