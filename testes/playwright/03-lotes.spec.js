// Lotes: entrada com o custo de aquisição, validações, peso de compra, peso-alvo, capacidade do pasto e morte.
const { test, expect, abrirDemo, novaFazenda, ir, dia, br, textoDe, cadastrarPasto, abrirGavetaDoLote } = require('./ajuda');

test.describe('Lotes', () => {
  test.beforeEach(async ({ page }) => { await abrirDemo(page); await novaFazenda(page); });

  test('fazenda nova começa sem lotes', async ({ page }) => {
    await ir(page, 'painel');
    await expect(page.locator('body')).toContainText(/nenhum lote na fazenda/i);
  });

  test('entrada calcula a aquisição e o lote aparece nos ativos', async ({ page }) => {
    await cadastrarPasto(page, 'Pasto A', 20, 730);
    await ir(page, 'lotes/entrada');
    await page.fill('#e-data', dia(10)); await page.fill('#e-qtd', '10'); await page.fill('#e-peso', '300');
    await page.fill('#e-ckg', '10'); await page.fill('#e-com', '500'); await page.fill('#e-fre', '500');
    await page.fill('#e-raca', 'Nelore'); await page.selectOption('#e-pasto', { label: 'Pasto A' }); await page.fill('#e-gmd', '1');
    // 10 cab × 300 kg × R$ 10 + R$ 500 + R$ 500 = R$ 31.000
    expect(await textoDe(page, '#e-calc')).toContain('31.000');
    await page.click('#fEnt button[type=submit]');
    await ir(page, 'lotes/ativos');
    await expect(page.locator('body')).toContainText('001');
    const gaveta = await abrirGavetaDoLote(page);
    await expect(gaveta).toContainText('31.000,00');
    await page.click('#fechaLote');
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('entrada sem os campos obrigatórios mostra o que falta', async ({ page }) => {
    await ir(page, 'lotes/entrada');
    await page.fill('#e-data', dia(-2)); // data no futuro
    await page.click('#fEnt button[type=submit]');
    const corpo = page.locator('body');
    await expect(corpo).toContainText('A data de entrada não pode ser no futuro.');
    await expect(corpo).toContainText('Informe quantas cabeças');
    await expect(corpo).toContainText('Informe o peso de entrada.');
    await expect(corpo).toContainText('Informe a raça.');
    await ir(page, 'lotes/ativos');
    await expect(corpo).not.toContainText('001');
  });

  test('peso de compra, peso-alvo, capacidade do pasto e morte', async ({ page }) => {
    await cadastrarPasto(page, 'Pasto C', 5, 365, 2);
    await ir(page, 'lotes/entrada');
    await page.fill('#e-data', dia(20)); await page.fill('#e-qtd', '20'); await page.fill('#e-peso', '300'); await page.fill('#e-pcompra', '310');
    await page.fill('#e-ckg', '10'); await page.fill('#e-raca', 'Nelore'); await page.fill('#e-alvo', '400');
    await page.fill('#e-gta', 'SP-1'); await page.fill('#e-nf', '77'); await page.selectOption('#e-pasto', { label: 'Pasto C' }); await page.fill('#e-gmd', '1');
    // compra paga o peso da origem: 20 × 310 × 10 = R$ 62.000; quebra (310 − 300) ÷ 310 = 3,2%
    const calc = await textoDe(page, '#e-calc');
    expect(calc).toContain('62.000');
    expect(calc).toContain('3,2%');
    await page.click('#fEnt button[type=submit]');

    // hoje o peso estimado é 300 + 20 dias × 1 kg = 320 kg; faltam 80 kg = 80 dias
    await ir(page, 'lotes/ativos');
    await expect(page.locator('body')).toContainText('alvo 400 kg: ' + br(dia(-80)));

    // 20 cab × 320 kg ÷ 450 = 14,2 UA em 5 ha = 2,84 UA/ha, acima da capacidade de 2
    await ir(page, 'painel');
    await expect(page.locator('body')).toContainText(/acima da capacidade/i);

    await ir(page, 'lotes/mortes');
    await page.fill('#mo-data', dia(5)); await page.fill('#mo-qtd', '1'); await page.fill('#mo-causa', 'Raio');
    await page.click('#fMorte button[type=submit]');
    await expect(page.locator('body')).toContainText('Raio');
    await expect(page.locator('body')).toContainText(/5,0\s?%/); // 1 de 20 cabeças

    // a morte não tira o custo do lote
    const gaveta = await abrirGavetaDoLote(page);
    await expect(gaveta).toContainText('62.000,00');
    await expect(gaveta).toContainText(/empata/i);
  });
});
