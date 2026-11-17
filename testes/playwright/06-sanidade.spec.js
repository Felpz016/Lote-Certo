// Sanidade: medicamentos com preço por vigência, protocolo, tratamento e calendário.
const { test, expect, abrirDemo, novaFazenda, ir, dia, textoDe, montarFazendaBase, cadastrarMedicamento, abrirGavetaDoLote } = require('./ajuda');

test.describe('Sanidade', () => {
  test('medicamento: preço por ml e preço novo com vigência futura', async ({ page }) => {
    await abrirDemo(page); await novaFazenda(page);
    await cadastrarMedicamento(page, 'Ivermectina', 30, 50);
    await expect(page.locator('body')).toContainText('R$ 0,60/ml'); // R$ 30 por 50 ml
    await page.click('details.mais summary');
    const id = await page.evaluate(() => document.querySelector('form[data-preco]').dataset.preco);
    await page.fill('#mp-p-' + id, '35');
    await page.fill('#mp-d-' + id, dia(-3)); // vale daqui a 3 dias
    await page.click('form[data-preco] button[type=submit]');
    const corpo = page.locator('body');
    await expect(corpo).toContainText('a partir de');
    await expect(corpo).toContainText('R$ 0,70/ml');
    await expect(corpo).toContainText('R$ 0,60/ml');
  });

  test('protocolo e tratamento entram no custo do lote', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await ir(page, 'sanidade/protocolo');
    await page.fill('#s-data', dia(8));
    await page.selectOption('#s-med-0', { label: 'Ivermectina' });
    await page.fill('#s-ml-0', '5');
    expect(await textoDe(page, '#s-calc')).toContain('30,00'); // 5 ml × 10 cab × R$ 0,60
    await page.click('#fSan button[type=submit]');
    await page.waitForTimeout(200);

    await ir(page, 'sanidade/tratamento');
    await page.fill('#t-data', dia(1)); await page.fill('#t-doenca', 'Pneumonia');
    await page.selectOption('#t-med', { label: 'Ivermectina' }); await page.fill('#t-ml', '10'); await page.fill('#t-an', '2');
    await page.click('#fTrat button[type=submit]');
    await expect(page.locator('body')).toContainText('Pneumonia');

    // 30,00 do protocolo + 10 ml × 0,60 = 6,00 do tratamento
    const gaveta = await abrirGavetaDoLote(page);
    await expect(gaveta).toContainText('36,00');
  });

  test('manejo atrasado do calendário aparece no painel', async ({ page }) => {
    await abrirDemo(page); await montarFazendaBase(page);
    await ir(page, 'sanidade/calendario');
    await page.fill('#ag-data', dia(2)); await page.fill('#ag-desc', 'Vacina aftosa');
    await page.click('#fAg button[type=submit]');
    await page.waitForTimeout(200);
    await ir(page, 'painel');
    await expect(page.locator('body')).toContainText('Vacina aftosa');
    await expect(page.locator('body')).toContainText(/atrasado/i);
  });
});
