// Financeiro: visão geral com gráficos, por lote, projeção, relatórios e o perfil campo.
const { test, expect, abrirDemo, ir, montarFazendaBase } = require('./ajuda');

async function venderLote(page) {
  await ir(page, 'saida/saida');
  await page.fill('#x-dest', 'Frigorífico'); await page.fill('#x-peso', '540'); await page.fill('#x-arroba', '300'); await page.fill('#x-rend', '54');
  await page.click('#fSai button[type=submit]');
  await page.waitForTimeout(300);
  await ir(page, 'saida/historico');
  await page.locator('tr[data-act=lote], [data-act=lote]').filter({ visible: true }).first().click();
  await page.fill('#rd-real', '55');
  await page.click('#fRend button');
  await expect(page.locator('.drawer')).toContainText('198,0 @');
  await page.click('#fechaLote');
}

test.describe('Financeiro', () => {
  test('visão geral e por lote mostram a receita do lote vendido', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await venderLote(page); // 198 @ × R$ 300 = R$ 59.400
    await ir(page, 'financeiro/geral');
    expect(await page.locator('.graf').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('body')).toContainText('R$ 59,4 mil');
    await ir(page, 'financeiro/lotes');
    await expect(page.locator('body')).toContainText('59.400');
  });

  test('projeção e relatórios do lote ativo', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await ir(page, 'financeiro/projecao');
    await expect(page.locator('body')).toContainText(/Preço que empata/i);
    await expect(page.locator('body')).toContainText('001');
    await ir(page, 'financeiro/relatorios');
    await expect(page.locator('body')).toContainText('Pasto A');
    await expect(page.locator('body')).toContainText(/Demonstrativo/i);
    await ir(page, 'financeiro/areas');
    await expect(page.locator('#lista')).not.toBeEmpty();
  });

  test('perfil campo não vê financeiro nem valores em dinheiro', async ({ page }) => {
    await abrirDemo(page, '&perfil=campo');
    await expect(page.locator('.content')).not.toContainText(/R\$ ?\d/);
    await ir(page, 'financeiro/geral');
    await expect(page.locator('.content')).not.toContainText(/R\$ ?\d/);
    await expect(page.locator('.graf')).toHaveCount(0);
    await expect(page.locator('#nav a[href="#financeiro"]')).toHaveCount(0);
    await expect(page.locator('[data-act=excel]')).toHaveCount(0);
  });
});
