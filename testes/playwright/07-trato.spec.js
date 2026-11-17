// Trato: dieta que soma 100%, custo por kg, trato do dia e fornecimento real.
const { test, expect, abrirDemo, novaFazenda, ir, dia, textoDe, cadastrarIngredientes, cadastrarDieta, montarFazendaBase } = require('./ajuda');

test.describe('Trato', () => {
  test('dieta precisa somar 100% e mostra o custo por kg', async ({ page }) => {
    await abrirDemo(page); await novaFazenda(page);
    await cadastrarIngredientes(page);
    await cadastrarDieta(page, '80'); // 80 + 10 = 90%
    await expect(page.locator('body')).toContainText('Tem que dar 100%');
    await page.fill('#di-pct-0', '90');
    await page.click('#fDieta button[type=submit]');
    await expect(page.locator('body')).toContainText('R$ 1,100/kg'); // 90% × 1,00 + 10% × 2,00
  });

  test('trato do dia do lote em matéria seca e no vagão', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await ir(page, 'trato/dia');
    // peso hoje 310 kg × 10 cab × 1% = 31 kg de MS; ÷ 88,2% de MS = 35 kg no vagão; 10% de farelo = 3,5 kg
    const corpo = page.locator('body');
    await expect(corpo).toContainText(/31 kg de MS/);
    await expect(corpo).toContainText(/\b35 kg/);
    await expect(corpo).toContainText('3,5 kg');
  });

  test('fornecimento real com sobra', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await ir(page, 'trato/real');
    await page.fill('#fr-data', dia(1)); await page.fill('#fr-kg', '100'); await page.fill('#fr-sobra', '10');
    expect(await textoDe(page, '#fr-calc')).toContain('110,00'); // 100 kg × R$ 1,100
    await page.click('#fReal button[type=submit]');
    await page.waitForTimeout(200);
  });
});
