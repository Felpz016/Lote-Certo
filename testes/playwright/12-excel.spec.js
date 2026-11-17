// Planilha Excel: baixa pelo painel e pelo menu, e confere as abas do arquivo.
const ExcelJS = require('exceljs');
const { test, expect, abrirDemo, ehCelular } = require('./ajuda');

const ABAS = ['Resumo', 'Lotes', 'Entradas', 'Saídas', 'Pesagens', 'Sanidade', 'Trato', 'Custos'];

async function conferirPlanilha(download, testInfo) {
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const arq = testInfo.outputPath('planilha.xlsx');
  await download.saveAs(arq);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arq);
  const nomes = wb.worksheets.map((w) => w.name);
  for (const aba of ABAS) expect(nomes, `aba ${aba}`).toContain(aba);
  expect(wb.getWorksheet('Lotes').rowCount).toBeGreaterThan(3); // a fazenda de exemplo tem lotes
}

test.describe('Excel', () => {
  test('baixar a planilha pelo painel', async ({ page }, testInfo) => {
    await abrirDemo(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), page.click('.hero [data-act=excel]')]);
    await conferirPlanilha(dl, testInfo);
  });

  test('baixar a planilha pelo menu', async ({ page }, testInfo) => {
    await abrirDemo(page);
    let botao;
    if (ehCelular(testInfo)) {
      await page.locator('#tabbar [data-act=mais]').click();
      botao = page.locator('.sheet [data-act=excel]');
    } else {
      botao = page.locator('.side [data-act=excel]');
    }
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), botao.click()]);
    await conferirPlanilha(dl, testInfo);
  });
});
