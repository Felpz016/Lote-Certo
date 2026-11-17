// Menu e layout: menu lateral no computador; barra de baixo e "Mais" no celular.
const { test, expect, abrirDemo, abrirArea, ehCelular, AREAS, NA_BARRA } = require('./ajuda');

test.describe('Navegação', () => {
  test('o layout certo para o tamanho da tela', async ({ page }, testInfo) => {
    await abrirDemo(page);
    if (ehCelular(testInfo)) {
      await expect(page.locator('.side')).toBeHidden();
      await expect(page.locator('#tabbar')).toBeVisible();
      // 4 áreas na barra + botão "Mais"
      await expect(page.locator('#tabbar a')).toHaveCount(NA_BARRA.length);
      await expect(page.locator('#tabbar [data-act=mais]')).toHaveText(/Mais/);
    } else {
      await expect(page.locator('.side')).toBeVisible();
      await expect(page.locator('#tabbar')).toBeHidden();
      await expect(page.locator('#nav a')).toHaveCount(AREAS.length);
    }
  });

  test('todas as áreas abrem pelo menu', async ({ page }, testInfo) => {
    await abrirDemo(page);
    for (const [k, titulo] of AREAS) {
      await abrirArea(page, testInfo, k, titulo);
      await expect(page.locator('.content')).not.toBeEmpty();
    }
  });

  test('as abas de uma área trocam a tela', async ({ page }, testInfo) => {
    await abrirDemo(page);
    await abrirArea(page, testInfo, 'lotes', 'Lotes');
    for (const aba of ['Entrada de lote', 'Morte e perda', 'Lotes ativos']) {
      await page.locator('#abas a', { hasText: aba }).click();
      await expect(page.locator('#abas a[aria-current=page]')).toHaveText(aba);
    }
  });

  test('no celular nenhuma tela passa da largura (sem rolar para o lado)', async ({ page }, testInfo) => {
    test.skip(!ehCelular(testInfo), 'só no celular');
    await abrirDemo(page);
    for (const [k, titulo] of AREAS) {
      await abrirArea(page, testInfo, k, titulo);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, `a tela ${titulo} passa da largura`).toBeLessThanOrEqual(1);
    }
  });

  test('no celular o "Mais" abre e fecha', async ({ page }, testInfo) => {
    test.skip(!ehCelular(testInfo), 'só no celular');
    await abrirDemo(page);
    await page.locator('#tabbar [data-act=mais]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('.sheet')).toContainText('Conta e fazendas');
    await expect(page.locator('.sheet')).toContainText('Baixar planilha Excel');
    await page.locator('.scrim').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.sheet')).toHaveCount(0);
  });
});
