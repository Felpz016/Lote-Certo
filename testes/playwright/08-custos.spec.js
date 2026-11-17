// Custos fixos e gerais.
const { test, expect, abrirDemo, novaFazenda, ir, dia } = require('./ajuda');

test.describe('Custos', () => {
  test.beforeEach(async ({ page }) => { await abrirDemo(page); await novaFazenda(page); });

  test('custo fixo mensal', async ({ page }) => {
    await ir(page, 'custos/fixos');
    await page.fill('#cf-desc', 'Vaqueiro'); await page.fill('#cf-valor', '3000');
    await page.click('#fFixo button[type=submit]');
    await expect(page.locator('.content')).toContainText('Vaqueiro');
  });

  test('custo geral diluído em 12 meses', async ({ page }) => {
    await ir(page, 'custos/gerais');
    await page.fill('#cg-desc', 'Reforma'); await page.fill('#cg-data', dia(10)); await page.fill('#cg-valor', '36000');
    await page.click('#fGeral button[type=submit]');
    await expect(page.locator('body')).toContainText('R$ 3.000,00 por mês');
  });
});
