// Funções usadas por todos os testes do Playwright.
const base = require('@playwright/test');
const { expect } = base;

/** O "test" de todos os arquivos: falha se a página tiver qualquer erro de JavaScript. */
const test = base.test.extend({
  page: async ({ page }, use) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await use(page);
    expect(erros, 'erros de JavaScript na página').toEqual([]);
  },
});

/** Data de n dias atrás (negativo = no futuro), no formato do campo de data: 2026-11-17. */
const dia = (n) => {
  const d = new Date(Date.now() - n * 864e5);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
/** 2026-11-17 vira 17/11/2026. */
const br = (iso) => iso.split('-').reverse().join('/');

/** Áreas que ficam direto na barra de baixo do celular. As outras ficam em "Mais". */
const NA_BARRA = ['painel', 'lotes', 'pasto', 'pesagem'];
const AREAS = [
  ['painel', 'Painel'],
  ['lotes', 'Lotes'],
  ['pasto', 'Manejo de pasto'],
  ['pesagem', 'Pesagem e apartação'],
  ['sanidade', 'Sanidade'],
  ['trato', 'Trato'],
  ['custos', 'Custos fixos e gerais'],
  ['saida', 'Saída'],
  ['indices', 'Índices'],
  ['financeiro', 'Financeiro'],
];

const ehCelular = (testInfo) => testInfo.project.name !== 'computador';

/** Abre o modo demonstração (sem banco, dados só no navegador do teste). */
async function abrirDemo(page, extra = '') {
  await page.goto('/app/?demo' + extra + '#painel');
  await expect(page.locator('.app')).toBeAttached();
  await expect(page.locator('#sync')).toContainText('Modo demonstração');
}

/** Vai direto para uma tela pelo endereço, ex.: ir(page, 'lotes/entrada'). */
async function ir(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(250);
}

/** Vai para uma área tocando no menu, como a pessoa faz: menu lateral no computador, barra de baixo e "Mais" no celular. */
async function abrirArea(page, testInfo, k, titulo) {
  if (!ehCelular(testInfo)) {
    await page.locator(`#nav a[href="#${k}"]`).click();
  } else if (NA_BARRA.includes(k)) {
    await page.locator(`#tabbar a[href="#${k}"]`).click();
  } else {
    await page.locator('#tabbar [data-act=mais]').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.locator(`.sheet a[href="#${k}"]`).click();
  }
  await expect(page.locator('#title')).toHaveText(titulo);
}

/** Cria uma fazenda vazia e passa a usar ela. */
async function novaFazenda(page, nome = 'Fazenda Teste') {
  await ir(page, 'conta');
  await page.fill('#nf-nome', nome);
  await page.click('#fNovaFaz button');
  await expect(page.locator('#fazNome')).toHaveText(nome);
}

async function cadastrarPasto(page, nome, area, custo, cap) {
  await ir(page, 'pasto/cadastro');
  await page.fill('#pa-nome', nome);
  await page.fill('#pa-area', String(area));
  await page.fill('#pa-custo', String(custo));
  if (cap) await page.fill('#pa-cap', String(cap));
  await page.click('#fPasto button[type=submit]');
  await page.waitForTimeout(200);
}

async function cadastrarMedicamento(page, nome = 'Ivermectina', preco = 30, ml = 50) {
  await ir(page, 'sanidade/medicamentos');
  await page.fill('#md-nome', nome);
  await page.fill('#md-preco', String(preco));
  await page.fill('#md-ml', String(ml));
  await page.click('#fMed button[type=submit]');
  await page.waitForTimeout(250);
}

/** Milho (88% MS, R$ 1.000/t) e farelo de amendoim (90% MS, R$ 2.000/t). */
async function cadastrarIngredientes(page) {
  await ir(page, 'trato/ingredientes');
  for (const [n, ms, pr] of [['Milho', '88', '1000'], ['Farelo de amendoim', '90', '2000']]) {
    await page.fill('#in-nome', n);
    await page.fill('#in-ms', ms);
    await page.fill('#in-preco', pr);
    await page.click('#fIng button[type=submit]');
    await page.waitForTimeout(150);
  }
}

/** Dieta 1% do peso vivo: 90% milho e 10% farelo de amendoim = R$ 1,100/kg. */
async function cadastrarDieta(page, pctMilho = '90') {
  await ir(page, 'trato/dietas');
  await page.fill('#di-nome', 'Dieta 1%');
  await page.fill('#di-pv', '1');
  await page.selectOption('#di-ing-0', { label: 'Milho' });
  await page.fill('#di-pct-0', pctMilho);
  await page.selectOption('#di-ing-1', { label: 'Farelo de amendoim' });
  await page.fill('#di-pct-1', '10');
  await page.click('#fDieta button[type=submit]');
  await page.waitForTimeout(200);
}

/**
 * Lote 001: 10 cabeças de 300 kg, entrou há 10 dias, R$ 10/kg + R$ 500 de comissão + R$ 500 de frete
 * (aquisição de R$ 31.000), Nelore, GMD estimado de 1 kg/dia.
 */
async function entrarLote001(page, { pasto = 'Pasto A', dieta = 'Dieta 1%' } = {}) {
  await ir(page, 'lotes/entrada');
  await page.fill('#e-data', dia(10));
  await page.fill('#e-qtd', '10');
  await page.fill('#e-peso', '300');
  await page.fill('#e-ckg', '10');
  await page.fill('#e-com', '500');
  await page.fill('#e-fre', '500');
  await page.fill('#e-raca', 'Nelore');
  if (pasto) await page.selectOption('#e-pasto', { label: pasto });
  if (dieta) await page.selectOption('#e-dieta', { label: dieta });
  await page.fill('#e-gmd', '1');
  await page.click('#fEnt button[type=submit]');
  await page.waitForTimeout(300);
}

/**
 * Fazenda de teste com tudo o que os lançamentos precisam: Pasto A (20 ha) e Pasto B (10 ha),
 * Ivermectina a R$ 0,60/ml, milho, farelo, Dieta 1% e o lote 001 no Pasto A com a Dieta 1%.
 */
async function montarFazendaBase(page) {
  await novaFazenda(page);
  await cadastrarPasto(page, 'Pasto A', 20, 730);
  await cadastrarPasto(page, 'Pasto B', 10, 365);
  await cadastrarMedicamento(page);
  await cadastrarIngredientes(page);
  await cadastrarDieta(page);
  await entrarLote001(page);
}

/** Abre a gaveta (detalhe) do primeiro lote da lista de lotes ativos. */
async function abrirGavetaDoLote(page) {
  await ir(page, 'lotes/ativos');
  await page.locator('[data-act=lote]').filter({ visible: true }).first().click();
  await expect(page.locator('.drawer')).toBeVisible();
  return page.locator('.drawer');
}

/** Texto do elemento com os espaços juntados (os números vêm com espaço fino). */
const textoDe = async (page, sel) => (await page.locator(sel).innerText()).replace(/\s+/g, ' ');

module.exports = {
  test, expect, dia, br, NA_BARRA, AREAS, ehCelular, abrirDemo, ir, abrirArea, novaFazenda,
  cadastrarPasto, cadastrarMedicamento, cadastrarIngredientes, cadastrarDieta, entrarLote001,
  montarFazendaBase, abrirGavetaDoLote, textoDe,
};
