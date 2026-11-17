// Entrada no sistema: tela de login, site de vendas e modo demonstração.
const { test, expect, abrirDemo } = require('./ajuda');

test.describe('Acesso', () => {
  test('sem login, o sistema mostra a tela de entrada com Google', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('#btnEntrar')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#btnEntrar')).toHaveText(/Entrar com Google/);
    await expect(page.getByRole('link', { name: /Ainda não é assinante/ })).toHaveAttribute('href', '../');
    await expect(page.locator('.app')).toHaveCount(0); // nenhum dado aparece antes de entrar
  });

  test('o site de vendas abre e leva para o sistema', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lote Certo/);
    await expect(page.locator('a[href*="app"]').first()).toBeAttached();
  });

  test('modo demonstração abre o painel com a fazenda de exemplo', async ({ page }) => {
    await abrirDemo(page);
    await expect(page.locator('#title')).toHaveText('Painel');
    await expect(page.locator('.banner')).toContainText('Modo demonstração');
    await expect(page.locator('#fazNome')).toHaveText('Fazenda Boa Vista');
  });

  test('@producao endereço publicado mostra a tela de entrada (só leitura)', async ({ page }) => {
    // Só abre a página publicada e confere o botão. Não entra e não grava nada.
    await page.goto('https://lote-certo-2ec77.web.app/app/');
    await expect(page.locator('#btnEntrar')).toBeVisible({ timeout: 20_000 });
  });
});
