// Saída do lote com o fechamento, histórico e rendimento real.
const { test, expect, abrirDemo, ir, textoDe, montarFazendaBase } = require('./ajuda');

test.describe('Saída e fechamento', () => {
  test.beforeEach(async ({ page }) => { await abrirDemo(page); await montarFazendaBase(page); });

  test('saída para o frigorífico fecha o lote', async ({ page }) => {
    await ir(page, 'saida/saida');
    await page.fill('#x-dest', 'Frigorífico'); await page.fill('#x-peso', '540'); await page.fill('#x-arroba', '300'); await page.fill('#x-rend', '54');
    // 10 × 540 = 5.400 kg × 54% ÷ 15 = 194,4 @ × R$ 300 = R$ 58.320
    const fech = await textoDe(page, '#x-fech');
    expect(fech).toContain('194,4 @');
    expect(fech).toContain('58.320');
    expect(fech).toContain('Custo/dia com a compra');
    expect(fech).toContain('Custo/dia só produção');
    await page.click('#fSai button[type=submit]');
    await page.waitForTimeout(300);

    await ir(page, 'saida/historico');
    await expect(page.locator('body')).toContainText('Frigorífico');
    await expect(page.locator('body')).toContainText('Falta o rendimento real');

    // rendimento real de 55% vale mais que o estimado: 198,0 @
    await page.locator('tr[data-act=lote], [data-act=lote]').filter({ visible: true }).first().click();
    await expect(page.locator('#fRend')).toBeVisible();
    await page.fill('#rd-real', '55');
    await page.click('#fRend button');
    await expect(page.locator('.drawer')).toContainText('198,0 @');
    await page.click('#fechaLote');

    await ir(page, 'painel');
    await expect(page.locator('body')).toContainText(/nenhum lote na fazenda/i);
  });
});
