// Índices: arroba e milho na B3, dólar, notícias e o que o preço significa para a fazenda.
// O modo demonstração usa um retrato fixo dos índices (src/indices-demo.js), por isso os números são certos.
const { test, expect, abrirDemo, ir } = require('./ajuda');

test.describe('Índices', () => {
  test('cotações, vencimentos, notícias e contas da fazenda', async ({ page }) => {
    await abrirDemo(page);
    await ir(page, 'indices');
    await expect(page.locator('.ix-cot').first()).toBeVisible();
    const corpo = page.locator('body');
    await expect(corpo).toContainText('402,15');
    await expect(corpo).toContainText(/por vencimento/i);
    await expect(corpo).toContainText('dez/26');
    await expect(corpo).toContainText(/Para a sua fazenda hoje/i);
    expect(await page.locator('.ix-not').count()).toBeGreaterThanOrEqual(8);
  });

  test('gráfico do dólar e filtro de notícias', async ({ page }) => {
    await abrirDemo(page);
    await ir(page, 'indices');
    await page.click('[data-cot=dolar]');
    await expect(page.locator('.content .graf').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Banco Central');
    const todas = await page.locator('.ix-not').count();
    await page.click('[data-tema=clima]');
    await expect(page.locator('[data-tema=clima]')).toHaveAttribute('aria-pressed', 'true');
    const filtradas = await page.locator('.ix-not').count();
    expect(filtradas).toBeGreaterThanOrEqual(1);
    expect(filtradas).toBeLessThan(todas);
  });

  test('perfil campo vê os preços, mas não as contas da fazenda', async ({ page }) => {
    await abrirDemo(page, '&perfil=campo');
    await ir(page, 'indices');
    await expect(page.locator('.content')).toContainText('402,15');
    await expect(page.locator('.content')).not.toContainText(/Para a sua fazenda/i);
  });
});
