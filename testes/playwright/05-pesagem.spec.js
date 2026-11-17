// Pesagem: balança contra o peso estimado e o GMD real.
const { test, expect, abrirDemo, ir, dia, textoDe, montarFazendaBase } = require('./ajuda');

test.describe('Pesagem', () => {
  test.beforeEach(async ({ page }) => { await abrirDemo(page); await montarFazendaBase(page); });

  test('pesagem calcula o peso estimado e o GMD real', async ({ page }) => {
    await ir(page, 'pesagem/pesagem');
    await page.fill('#p-data', dia(4));
    await page.fill('#p-peso', '309');
    // 6 dias depois da entrada: estimado 300 + 6 × 1 = 306 kg; real (309 − 300) ÷ 6 = 1,500 kg/dia
    const calc = await textoDe(page, '#p-calc');
    expect(calc).toContain('306,0 kg');
    expect(calc).toContain('1,500');
    await page.click('#fPes button[type=submit]');
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toContainText('309');
  });

  test('as outras abas da pesagem abrem', async ({ page }) => {
    for (const aba of ['gmd', 'apartacao']) {
      await ir(page, 'pesagem/' + aba);
      await expect(page.locator('#abas a[aria-current=page]')).toBeVisible();
      await expect(page.locator('#form')).not.toBeEmpty();
    }
  });
});
