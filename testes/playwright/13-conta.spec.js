// Conta e fazendas: várias fazendas, troca de fazenda e dados guardados no aparelho.
const { test, expect, ehCelular, abrirDemo, novaFazenda, ir, cadastrarPasto, entrarLote001 } = require('./ajuda');

test.describe('Conta e fazendas', () => {
  test('criar outra fazenda e trocar entre elas', async ({ page }, testInfo) => {
    await abrirDemo(page);
    await novaFazenda(page, 'Sítio Aurora');
    await expect(page.locator('#fazSel option')).toHaveCount(2);
    await expect(page.locator('.item.faz')).toHaveCount(2);
    await ir(page, 'lotes/ativos');
    await expect(page.locator('body')).toContainText(/nenhum lote ativo/i);
    if (ehCelular(testInfo)) {
      // no celular a troca é pela tela da conta (o nome da fazenda no topo leva até lá)
      await expect(page.locator('#fazTop')).toContainText('▾');
      await page.locator('#fazTop').click();
      await page.locator('.item.faz', { hasText: 'Fazenda Boa Vista' }).locator('[data-act=usar-fazenda]').click();
    } else {
      await page.selectOption('#fazSel', { label: 'Fazenda Boa Vista' });
    }
    await expect(page.locator('#fazNome')).toHaveText('Fazenda Boa Vista');
    await ir(page, 'lotes/ativos');
    await expect(page.locator('body')).not.toContainText(/nenhum lote ativo/i);
  });

  test('nome de fazenda repetido é recusado', async ({ page }) => {
    await abrirDemo(page);
    await ir(page, 'conta');
    await page.fill('#nf-nome', 'Fazenda Boa Vista');
    await page.click('#fNovaFaz button');
    await expect(page.locator('body')).toContainText('Já existe uma fazenda com esse nome.');
  });

  test('os lançamentos continuam depois de recarregar a página', async ({ page }) => {
    await abrirDemo(page);
    await novaFazenda(page);
    await cadastrarPasto(page, 'Pasto A', 20, 730);
    await entrarLote001(page, { dieta: null });
    await page.reload();
    await expect(page.locator('#fazNome')).toHaveText('Fazenda Teste');
    await ir(page, 'lotes/ativos');
    await expect(page.locator('body')).toContainText('001');
  });

  test('conta mostra importação de planilha e registro de alterações', async ({ page }) => {
    await abrirDemo(page);
    await ir(page, 'conta');
    await expect(page.locator('body')).toContainText(/Importar/i);
    await expect(page.locator('body')).toContainText(/Registro de alterações|Correções e exclusões/i);
  });
});
