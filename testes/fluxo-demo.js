// Teste do fluxo completo no modo demonstração (sem banco), no tamanho de celular.
// Uso: npm run dev   e, em outro terminal:   node testes/fluxo-demo.js   (precisa do Playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const ok = (c, m) => console.log((c ? 'OK  ' : 'FALHOU ') + m);
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 400, height: 800 }, acceptDownloads: true });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('ERR', p.url(), e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  const ir = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(250); };
  let t0; const txt = () => p.evaluate(() => document.body.innerText);
  const dia = (n) => { const d = new Date(Date.now() - n * 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  await p.goto('http://localhost:8080/app/?demo#conta');
  await p.waitForSelector('#nf-nome');
  await p.fill('#nf-nome', 'Fazenda Teste'); await p.click('#fNovaFaz button');
  await p.waitForFunction(() => document.querySelector('#fazNome')?.textContent === 'Fazenda Teste');
  await ir('painel'); ok(/nenhum lote na fazenda/i.test(await txt()), 'fazenda nova começa vazia');

  await ir('pasto/cadastro');
  await p.fill('#pa-nome', 'Pasto A'); await p.fill('#pa-area', '20'); await p.fill('#pa-custo', '730'); await p.click('#fPasto button[type=submit]');
  await p.fill('#pa-nome', 'Pasto B'); await p.fill('#pa-area', '10'); await p.fill('#pa-custo', '365'); await p.click('#fPasto button[type=submit]');
  ok((await txt()).includes('PASTO B') || (await txt()).includes('Pasto B'), 'pastos cadastrados');

  await ir('sanidade/medicamentos');
  await p.fill('#md-nome', 'Ivermectina'); await p.fill('#md-preco', '30'); await p.fill('#md-ml', '50'); await p.click('#fMed button[type=submit]'); await p.waitForTimeout(250);
  ok((await txt()).includes('R$ 0,60/ml'), 'medicamento: R$ 30 por 50 ml = R$ 0,60/ml');
  // preço novo só vale a partir de daqui a 3 dias: as aplicações de agora continuam a 0,60
  await p.click('details.mais summary');
  const idMed = await p.evaluate(() => document.querySelector('form[data-preco]').dataset.preco);
  await p.fill('#mp-p-' + idMed, '35'); await p.fill('#mp-d-' + idMed, dia(-3)); await p.click('form[data-preco] button[type=submit]');
  await p.waitForTimeout(250); t0 = await txt(); ok(t0.includes('a partir de') && t0.includes('R$ 0,70/ml') && t0.includes('R$ 0,60/ml'), 'preço novo com vigência futura: 0,70/ml agendado, 0,60/ml continua valendo');

  await ir('trato/ingredientes');
  for (const [n, ms, pr] of [['Milho', '88', '1000'], ['Farelo de amendoim', '90', '2000']]) { await p.fill('#in-nome', n); await p.fill('#in-ms', ms); await p.fill('#in-preco', pr); await p.click('#fIng button[type=submit]'); }
  await ir('trato/dietas');
  await p.fill('#di-nome', 'Dieta 1%'); await p.fill('#di-pv', '1');
  await p.selectOption('#di-ing-0', { label: 'Milho' }); await p.fill('#di-pct-0', '80');
  await p.selectOption('#di-ing-1', { label: 'Farelo de amendoim' }); await p.fill('#di-pct-1', '10');
  await p.click('#fDieta button[type=submit]'); await p.waitForTimeout(150);
  ok((await txt()).includes('Tem que dar 100%'), 'dieta com soma 90% é recusada');
  await p.fill('#di-pct-0', '90'); await p.click('#fDieta button[type=submit]'); await p.waitForTimeout(200);
  ok((await txt()).includes('R$ 1,100/kg'), 'dieta: 90% × 1,00 + 10% × 2,00 = R$ 1,100/kg');

  await ir('lotes/entrada');
  await p.fill('#e-data', dia(10)); await p.fill('#e-qtd', '10'); await p.fill('#e-peso', '300'); await p.fill('#e-ckg', '10'); await p.fill('#e-com', '500'); await p.fill('#e-fre', '500');
  await p.fill('#e-raca', 'Nelore'); await p.selectOption('#e-pasto', { label: 'Pasto A' }); await p.selectOption('#e-dieta', { label: 'Dieta 1%' }); await p.fill('#e-gmd', '1');
  ok((await p.textContent('#e-calc')).replace(/\s+/g, ' ').includes('31.000'), 'aquisição: 10 × 300 × 10 + 500 + 500 = R$ 31.000');
  await p.click('#fEnt button[type=submit]'); await p.waitForTimeout(300);
  ok((await txt()).includes('001'), 'lote 001 cadastrado e aparece nos ativos');

  await ir('trato/dia'); let t = await txt();
  // peso estimado hoje: 300 + 10 dias × 1 kg = 310 kg; consumo 10 × 310 × 1% = 31 kg
  // dieta em matéria seca: 31 kg de MS ÷ 88,2% de MS da dieta = 35 kg no vagão, 10% de farelo = 3,5 kg
  ok(/31 kg de MS/.test(t) && /\b35 kg/.test(t) && t.includes('3,5 kg'), 'trato do dia: 31 kg de matéria seca viram 35 kg no vagão, 3,5 kg de farelo de amendoim');

  await ir('sanidade/protocolo');
  await p.fill('#s-data', dia(8)); await p.selectOption('#s-med-0', { label: 'Ivermectina' }); await p.fill('#s-ml-0', '5');
  ok((await p.textContent('#s-calc')).includes('30,00'), 'protocolo: 5 ml × 10 cab × 0,60 = R$ 30,00');
  await p.click('#fSan button[type=submit]'); await p.waitForTimeout(200);
  await p.fill('#s-data', dia(2)); await p.selectOption('#s-med-0', { label: 'Ivermectina' }); await p.fill('#s-ml-0', '5');
  ok((await p.textContent('#s-calc')).includes('30,00'), 'segundo protocolo: preço novo ainda não vale, R$ 30,00');
  await p.click('#fSan button[type=submit]'); await p.waitForTimeout(200);
  await ir('sanidade/tratamento');
  await p.fill('#t-data', dia(1)); await p.fill('#t-doenca', 'Pneumonia'); await p.selectOption('#t-med', { label: 'Ivermectina' }); await p.fill('#t-ml', '10'); await p.fill('#t-an', '2');
  await p.click('#fTrat button[type=submit]'); await p.waitForTimeout(200);
  ok((await txt()).includes('Pneumonia'), 'tratamento lançado');

  await ir('pesagem/pesagem');
  await p.fill('#p-data', dia(4)); await p.fill('#p-peso', '309');
  t = (await p.textContent('#p-calc')).replace(/\s+/g, ' ');
  ok(t.includes('306,0 kg') && t.includes('1,500'), 'pesagem: estimado 306 kg, balança 309, GMD real 1,500');
  await p.click('#fPes button[type=submit]'); await p.waitForTimeout(200);

  await ir('pasto/mudanca');
  await p.fill('#mv-data', dia(3)); await p.selectOption('#mv-pasto', { label: 'Pasto B' }); await p.click('#fMov button[type=submit]'); await p.waitForTimeout(200);
  await ir('pasto/disposicao'); t = await txt();
  ok(/Vazio há 3 dias/i.test(t), 'mudança de pasto: Pasto A vazio há 3 dias, lote no Pasto B');

  await ir('custos/fixos');
  await p.fill('#cf-desc', 'Vaqueiro'); await p.fill('#cf-valor', '3000'); await p.click('#fFixo button[type=submit]'); await p.waitForTimeout(200);
  await ir('custos/gerais');
  await p.fill('#cg-desc', 'Reforma'); await p.fill('#cg-data', dia(10)); await p.fill('#cg-valor', '36000'); await p.click('#fGeral button[type=submit]'); await p.waitForTimeout(200);
  ok((await txt()).includes('R$ 3.000,00 por mês'), 'custo geral: R$ 36.000 em 12 meses = R$ 3.000 por mês');

  await ir('lotes/ativos'); await p.click('[data-act=lote]:visible'); await p.waitForSelector('.drawer');
  t = await p.textContent('.drawer');
  ok(t.includes('31.000,00') && t.includes('66,00'), 'gaveta do lote: aquisição R$ 31.000 e sanidade R$ 66,00 (30 + 30 + 6)');
  await p.click('#fechaLote');

  await ir('saida/saida');
  await p.fill('#x-dest', 'Frigorífico'); await p.fill('#x-peso', '540'); await p.fill('#x-arroba', '300'); await p.fill('#x-rend', '54');
  t = (await p.textContent('#x-fech')).replace(/\s+/g, ' ');
  // 10 × 540 = 5.400 kg × 54% ÷ 15 = 194,4 @ × 300 = R$ 58.320
  ok(t.includes('194,4 @') && t.includes('58.320'), 'saída: 194,4 arrobas e receita de R$ 58.320');
  ok(t.includes('Custo/dia com a compra') && t.includes('Custo/dia só produção'), 'saída mostra os dois custos por dia');
  await p.click('#fSai button[type=submit]'); await p.waitForTimeout(300);
  await ir('saida/historico'); t = await txt();
  ok(t.includes('Frigorífico') && t.includes('Falta o rendimento real'), 'histórico de saídas com aviso de rendimento real');
  await p.click('tr[data-act=lote]:visible'); await p.waitForSelector('#fRend');
  await p.fill('#rd-real', '55'); await p.click('#fRend button'); await p.waitForTimeout(300);
  ok((await p.textContent('.drawer')).includes('198,0 @'), 'rendimento real 55% prevalece: 198,0 arrobas');
  await p.click('#fechaLote');
  await ir('painel'); ok(/nenhum lote na fazenda/i.test(await txt()), 'lote saiu dos ativos');

  // ---------- melhorias: peso de compra, peso-alvo, morte, capacidade, calendário, fornecimento real, financeiro e perfis
  await ir('pasto/cadastro');
  await p.fill('#pa-nome', 'Pasto C'); await p.fill('#pa-area', '5'); await p.fill('#pa-custo', '365'); await p.fill('#pa-cap', '2'); await p.click('#fPasto button[type=submit]'); await p.waitForTimeout(200);
  await ir('lotes/entrada');
  await p.fill('#e-data', dia(20)); await p.fill('#e-qtd', '20'); await p.fill('#e-peso', '300'); await p.fill('#e-pcompra', '310'); await p.fill('#e-ckg', '10');
  await p.fill('#e-raca', 'Nelore'); await p.fill('#e-alvo', '400'); await p.fill('#e-gta', 'SP-1'); await p.fill('#e-nf', '77'); await p.selectOption('#e-pasto', { label: 'Pasto C' }); await p.selectOption('#e-dieta', { label: 'Dieta 1%' }); await p.fill('#e-gmd', '1');
  t = (await p.textContent('#e-calc')).replace(/\s+/g, ' ');
  // a compra paga o peso da origem: 20 × 310 × 10 = R$ 62.000; quebra de (310 − 300) ÷ 310 = 3,2%
  ok(t.includes('62.000') && t.includes('3,2%'), 'peso de compra: aquisição de R$ 62.000 sobre 310 kg e quebra de 3,2%');
  await p.click('#fEnt button[type=submit]'); await p.waitForTimeout(300);
  await ir('lotes/ativos'); t = await txt();
  // peso estimado hoje 300 + 20 = 320 kg; faltam 80 kg a 1 kg/dia = 80 dias
  ok(t.includes('alvo 400 kg: ' + dia(-80).split('-').reverse().join('/')), 'peso-alvo de 400 kg: previsto para daqui a 80 dias');
  await ir('painel'); t = await txt();
  // 20 cab × 320 kg ÷ 450 = 14,2 UA em 5 ha = 2,84 UA/ha, acima da capacidade de 2
  ok(/acima da capacidade/i.test(t), 'painel avisa pasto acima da capacidade');
  await ir('lotes/mortes');
  await p.fill('#mo-data', dia(5)); await p.fill('#mo-qtd', '1'); await p.fill('#mo-causa', 'Raio'); await p.click('#fMorte button[type=submit]'); await p.waitForTimeout(300);
  t = await txt(); ok(t.includes('Raio') && /5,0\s?%/.test(t), 'morte lançada: 1 de 20 cabeças = mortalidade de 5,0%');
  await ir('lotes/ativos'); await p.click('[data-act=lote]:visible'); await p.waitForSelector('.drawer'); t = await p.textContent('.drawer');
  ok(t.includes('62.000,00'), 'depois da morte o custo de aquisição continua R$ 62.000 no lote');
  ok(/empata/i.test(t), 'gaveta do lote mostra a projeção com o preço que empata');
  await p.click('#fechaLote');
  await ir('sanidade/calendario');
  await p.fill('#ag-data', dia(2)); await p.fill('#ag-desc', 'Vacina aftosa'); await p.click('#fAg button[type=submit]'); await p.waitForTimeout(200);
  await ir('painel'); t = await txt(); ok(t.includes('Vacina aftosa') && /atrasado/i.test(t), 'painel mostra o manejo sanitário atrasado');
  await ir('trato/real');
  await p.fill('#fr-data', dia(1)); await p.fill('#fr-kg', '100'); await p.fill('#fr-sobra', '10');
  t = (await p.textContent('#fr-calc')).replace(/\s+/g, ' ');
  // fornecido 100 kg × R$ 1,100 = R$ 110,00
  ok(t.includes('110,00'), 'fornecimento real: 100 kg × R$ 1,100 = R$ 110,00');
  await p.click('#fReal button[type=submit]'); await p.waitForTimeout(200);
  for (const aba of ['geral', 'lotes', 'areas', 'projecao', 'relatorios']) { await ir('financeiro/' + aba); }
  await ir('financeiro/geral'); t = await txt();
  ok((await p.locator('.graf').count()) >= 3 && t.includes('R$ 59,4 mil') && t.includes('R$ 26.965'), 'financeiro: gráficos, receita de R$ 59,4 mil e resultado do lote vendido');
  await ir('financeiro/lotes'); t = await txt();
  ok(t.includes('58.320') || t.includes('59.400'), 'financeiro por lote mostra a receita do lote vendido');
  await ir('financeiro/projecao'); t = await txt();
  ok(/Preço que empata/i.test(t) && t.includes('002'), 'projeção de venda do lote 002');
  await ir('financeiro/relatorios'); t = await txt();
  ok(t.includes('Pasto C') && /Demonstrativo/i.test(t), 'relatórios: comparativo por pasto e demonstrativo mês a mês');
  await ir('conta'); t = await txt();
  ok(/Registro de alterações|Correções e exclusões/i.test(t) && /Importar/i.test(t), 'conta: registro de alterações e importação de planilha');

  // perfil campo: sem financeiro, sem custos e sem valores em dinheiro
  const pc = await c.newPage();
  pc.on('pageerror', (e) => console.log('ERR campo', e.message));
  await pc.goto('http://localhost:8080/app/?demo&perfil=campo#painel'); await pc.waitForSelector('.tabbar');
  const tc = await pc.evaluate(() => document.body.innerText);
  await pc.evaluate(() => { location.hash = 'financeiro/geral'; }); await pc.waitForTimeout(300);
  const tf = await pc.evaluate(() => document.querySelector('.content').innerText);
  ok(!/R\$ ?\d/.test(tc) && !/R\$ ?\d/.test(tf) && !(await pc.locator('.graf').count()), 'perfil campo não vê valores nem o financeiro');
  await pc.close();

  await ir('painel');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('.hero [data-act=excel]')]);
  const arq = require('os').tmpdir() + '/lote-certo-teste.xlsx'; await dl.saveAs(arq);
  ok(fs.statSync(arq).size > 8000, 'planilha Excel baixada (' + fs.statSync(arq).size + ' bytes)');
  await b.close();
})().catch((e) => { console.log('ERRO NO TESTE', e.message.split('\n')[0]); process.exit(1); });
