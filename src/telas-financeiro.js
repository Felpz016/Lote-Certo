// Financeiro: o dinheiro da fazenda em todas as áreas, com gráficos, projeção de venda e relatórios.
// Todos os números saem de calc.js (modelo.fin e fechamento), os mesmos da gaveta do lote e da planilha.
import {
  store, S, M, $, $$, esc, d2, n0, n1, n2, n3, rs, rsK, pct, num, mesBr, fmtGmd, tagLote, toast, msgSalvo, erros, nomeDe, campo, val, TELAS, ui, cfg,
} from "./base.js";
import { projecao, CATEGORIAS, comparativo } from "./calc.js";
import { COR, colunasEmpilhadas, colunasAgrupadas, colunasSaldo, linha, barras, partes } from "./graficos.js";

const mesCurto = (k) => { const [a, m] = k.split("-"); return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1]}/${a.slice(2)}`; };
const PROD = CATEGORIAS.filter(([k]) => k !== "aquisicao");
const SERIES = (comCompra) => (comCompra ? CATEGORIAS : PROD).map(([k, nome]) => ({ k, nome, cor: COR[k] }));

let periodo = 12;       // meses mostrados (0 = tudo)
let comCompra = false;  // a compra de gado entra no gráfico de despesa?
let dimensao = "pasto"; // comparativo dos relatórios

const seletor = () => `<div class="filtros"><label for="finPer">Período</label><select id="finPer" class="selmini">
  ${[[3, "Últimos 3 meses"], [6, "Últimos 6 meses"], [12, "Últimos 12 meses"], [24, "Últimos 24 meses"], [0, "Desde o começo"]].map(([v, l]) => `<option value="${v}" ${v === periodo ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
function ligarSeletor() {
  const s = $("#finPer");
  if (s) s.onchange = () => { periodo = +s.value; ui.refazerLista(); };
}
/** Os meses do período escolhido e a soma deles. */
function recorte() {
  const todos = M().fin.meses, ms = periodo ? todos.slice(-periodo) : todos;
  const t = { receita: 0, aquisicao: 0, pasto: 0, pastoOcioso: 0, trato: 0, tratoKg: 0, sanidade: 0, fixos: 0, gerais: 0, semRateio: 0, producao: 0, despesa: 0, resultado: 0, cabDias: 0,
    sanProtocolo: 0, sanTratamento: 0, cabVendidas: 0, cabCompradas: 0, mortes: 0, porDieta: {}, porIng: {}, porPasto: {}, porMed: {}, porDoenca: {}, porCategoria: {}, porOrigem: {}, porDestino: {} };
  for (const m of ms) for (const k in t) {
    if (typeof t[k] === "number") t[k] += m[k] || 0;
    else for (const x in m[k]) t[k][x] = (t[k][x] || 0) + m[k][x];
  }
  const de = ms.length ? ms[0].mes : null;
  const fechados = M().fin.fechados.filter((x) => x.f.resultado != null && (!de || x.s.data.slice(0, 7) >= de));
  return { ms, t, de, fechados };
}
const vazio = () => `<section class="card"><h3>Ainda não há o que mostrar</h3><p class="note" style="margin:8px 0 14px">O financeiro aparece sozinho conforme você lança lotes, pastos, trato, sanidade, custos e saídas.</p><div class="actions"><button class="btn" type="button" data-act="ir" data-to="lotes/entrada">Cadastrar lote</button></div></section>`;
const tabela = (resumo, html) => `<details class="mais tabela"><summary>${resumo}</summary><div class="tw">${html}</div></details>`;
const ordenar = (o, nome = (k) => k) => Object.entries(o).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ nome: nome(k), v }));

// ------------------------------------------------------------ visão geral
TELAS["financeiro/geral"] = {
  lista() {
    const m = M(), f = m.fazenda;
    if (!S.db.lotes.length && !S.db.custos.length) return vazio();
    const { ms, t, fechados } = recorte();
    const resLotes = fechados.reduce((s, x) => s + x.f.resultado, 0), recLotes = fechados.reduce((s, x) => s + x.f.receita, 0);
    const arrProd = fechados.reduce((s, x) => s + (x.f.arrobasProd || 0), 0), prodLotes = fechados.reduce((s, x) => s + x.f.producao, 0);
    const cabDia = t.cabDias ? t.producao / t.cabDias : null;
    const txt = periodo ? `nos últimos ${periodo} meses` : "desde o começo";
    const series = SERIES(comCompra);
    const dadosDesp = ms.map((x) => ({ rot: mesCurto(x.mes), v: x }));
    const latente = m.fin.valorRebanho - m.fin.capital;
    return `
    <div class="fin-top">${seletor()}<span class="note">Despesa conta até ontem. Os custos fixos e gerais entram inteiros, mesmo nos dias sem gado.</span></div>
    <section class="kpis">
      <div class="card kpi dark"><span class="label">Resultado dos lotes vendidos</span><span class="v">${rs(resLotes, 0)}</span><span class="s">${fechados.length} ${fechados.length === 1 ? "lote" : "lotes"} ${txt}${recLotes ? " · margem de " + pct((resLotes / recLotes) * 100) : ""}</span></div>
      <div class="card kpi dark"><span class="label">Custo do dia da fazenda</span><span class="v">${rs(f.custoDia, 0)}</span><span class="s">${f.custoCabDia == null ? "sem lotes ativos" : rs(f.custoCabDia) + " por cabeça por dia"}</span></div>
      <div class="card kpi"><span class="label">Receita</span><span class="v">${rsK(t.receita)}</span><span class="s">${n0(t.cabVendidas)} cabeças vendidas ${txt}</span></div>
      <div class="card kpi"><span class="label">Despesa</span><span class="v">${rsK(t.despesa)}</span><span class="s">produção ${rsK(t.producao)} · compra de gado ${rsK(t.aquisicao)}</span></div>
      <div class="card kpi"><span class="label">Saldo do período</span><span class="v ${t.resultado >= 0 ? "pos" : "neg"}">${rsK(t.resultado)}</span><span class="s">receita menos despesa, pelo mês em que aconteceu</span></div>
      <div class="card kpi"><span class="label">Custo acumulado no rebanho</span><span class="v">${rsK(m.fin.capital)}</span><span class="s">o que já foi gasto ${f.lotesAtivos === 1 ? "no lote ativo" : `nos ${f.lotesAtivos} lotes ativos`}</span></div>
      <div class="card kpi"><span class="label">Valor do rebanho hoje</span><span class="v">${rsK(m.fin.valorRebanho)}</span><span class="s">${n0(m.fin.arrobasAtivas)} @ a ${rs(m.cfg.precoArroba, 0)} · ${latente >= 0 ? "sobra" : "falta"} ${rsK(Math.abs(latente))}</span></div>
      <div class="card kpi"><span class="label">Custo por @ produzida</span><span class="v">${arrProd > 0 ? rs(prodLotes / arrProd, 0) : "—"}</span><span class="s">${arrProd > 0 ? `${n0(arrProd)} @ produzidas nos lotes vendidos` : "sem lote vendido no período"}</span></div>
    </section>

    <section class="card"><div class="sec-h"><h3>Despesa por mês</h3>
      <div class="seg mini" role="group" aria-label="O que entra no gráfico"><input type="radio" name="finCompra" id="finCompra-0" value="0" ${comCompra ? "" : "checked"}><label for="finCompra-0">Só produção</label><input type="radio" name="finCompra" id="finCompra-1" value="1" ${comCompra ? "checked" : ""}><label for="finCompra-1">Com a compra de gado</label></div></div>
      ${colunasEmpilhadas({ dados: dadosDesp, series, nome: "Despesa por mês, por tipo de custo" })}
      ${tabela("Ver os números da despesa por mês", `<table><thead><tr><th>Mês</th>${series.map((s) => `<th class="r">${s.nome}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>
        ${[...ms].reverse().map((x) => `<tr><td>${mesBr(x.mes)}</td>${series.map((s) => `<td class="r">${rs(x[s.k], 0)}</td>`).join("")}<td class="r"><b>${rs(comCompra ? x.despesa : x.producao, 0)}</b></td></tr>`).join("")}
        </tbody><tfoot><tr><td>Total</td>${series.map((s) => `<td class="r">${rs(t[s.k], 0)}</td>`).join("")}<td class="r">${rs(comCompra ? t.despesa : t.producao, 0)}</td></tr></tfoot></table>`)}
    </section>

    <div class="grid2 igual">
      <section class="card"><div class="sec-h"><h3>Receita e despesa</h3><span class="note">despesa com a compra de gado</span></div>
        ${colunasAgrupadas({ dados: ms.map((x) => ({ rot: mesCurto(x.mes), v: x })), series: [{ k: "receita", nome: "Receita", cor: COR.receita }, { k: "despesa", nome: "Despesa", cor: COR.despesa }], nome: "Receita e despesa por mês" })}
      </section>
      <section class="card"><div class="sec-h"><h3>Saldo de cada mês</h3><span class="note">receita menos despesa</span></div>
        ${colunasSaldo({ dados: ms.map((x) => ({ rot: mesCurto(x.mes), v: x.resultado })), nome: "Saldo de cada mês", rotulo: "Saldo" })}
      </section>
    </div>
    <section class="card">${tabela("Ver os números de receita, despesa e saldo", `<table><thead><tr><th>Mês</th><th class="r">Receita</th><th class="r">Despesa</th><th class="r">Saldo</th><th class="r">Saldo acumulado</th></tr></thead><tbody>
      ${(() => { let ac = 0; return ms.map((x) => { ac += x.resultado; return `<tr><td>${mesBr(x.mes)}</td><td class="r">${rs(x.receita, 0)}</td><td class="r">${rs(x.despesa, 0)}</td><td class="r"><b class="${x.resultado >= 0 ? "pos" : "neg"}">${rs(x.resultado, 0)}</b></td><td class="r">${rs(ac, 0)}</td></tr>`; }).reverse().join(""); })()}
      </tbody></table>`)}
      <p class="note" style="margin-top:8px">O saldo do mês junta o que entrou das vendas e o que saiu naquele mês. Num mês de compra de gado ele fica negativo, e o retorno aparece no mês da venda. Para ver o lucro de cada lote, abra Por lote.</p></section>

    <div class="grid2 igual">
      <section class="card"><div class="sec-h"><h3>Para onde foi o dinheiro</h3><span class="note">${txt}</span></div>
        ${partes({ itens: CATEGORIAS.map(([k, nome]) => ({ nome, v: t[k], cor: COR[k], claro: k === "trato" || k === "gerais" })), nome: "Divisão da despesa" })}
        <p class="note" style="margin-top:10px">Custo de produção (sem a compra): <b>${rs(t.producao, 0)}</b>${t.pastoOcioso > 1 ? ` · pasto vazio: ${rs(t.pastoOcioso, 0)}` : ""}${t.semRateio > 1 ? ` · custos fixos em dias sem gado: ${rs(t.semRateio, 0)}` : ""}</p>
      </section>
      <section class="card"><div class="sec-h"><h3>Custo de produção por cabeça por dia</h3><span class="note">${cabDia == null ? "" : "média do período: " + rs(cabDia)}</span></div>
        ${linha({ dados: ms.map((x) => ({ rot: mesCurto(x.mes), v: x.cabDias ? x.producao / x.cabDias : null })), fmt: (v) => rs(v), nome: "Custo de produção por cabeça por dia, mês a mês", cor: COR.fixos, rotulo: "Por cabeça por dia" })}
        ${tabela("Ver os números", `<table><thead><tr><th>Mês</th><th class="r">Custo de produção</th><th class="r">Cabeças × dias</th><th class="r">Por cabeça por dia</th></tr></thead><tbody>
          ${[...ms].reverse().map((x) => `<tr><td>${mesBr(x.mes)}</td><td class="r">${rs(x.producao, 0)}</td><td class="r">${n0(x.cabDias)}</td><td class="r">${x.cabDias ? rs(x.producao / x.cabDias) : "—"}</td></tr>`).join("")}</tbody></table>`)}
      </section>
    </div>`;
  },
  ligarLista() {
    ligarSeletor();
    $$("input[name=finCompra]").forEach((el) => { el.onchange = () => { comCompra = el.value === "1"; ui.refazerLista(); }; });
  },
};

// ------------------------------------------------------------ por lote
TELAS["financeiro/lotes"] = {
  lista() {
    const m = M();
    const folhas = m.lotes.filter((r) => !r.lote.apartadoEm);
    if (!folhas.length) return vazio();
    const vend = m.fin.fechados.filter((x) => x.f.resultado != null).sort((a, b) => b.s.data.localeCompare(a.s.data));
    const ativos = m.ativos;
    return `
    ${vend.length ? `<section class="card"><div class="sec-h"><h3>Resultado de cada lote vendido</h3><span class="note">receita menos tudo o que o lote custou</span></div>
      ${barras({ itens: vend.map((x) => ({ nome: "Lote " + x.r.lote.numero, sub: `${d2(x.s.data)} · ${x.s.quantidade || x.r.cab} cab.`, v: x.f.resultado, cor: x.f.resultado >= 0 ? COR.bom : COR.ruim })) })}
      <div class="tw" style="margin-top:14px"><table><thead><tr><th>Lote</th><th>Saída</th><th class="r">Cab.</th><th class="r">Dias</th><th class="r">Receita</th><th class="r">Compra</th><th class="r">Produção</th><th class="r">Resultado</th><th class="r">Por cabeça</th><th class="r">Margem</th><th class="r">@ produzidas</th><th class="r">Custo/@ prod.</th><th class="r">Rentab.</th><th class="r">Ao mês</th></tr></thead><tbody>
      ${vend.map(({ r, s, f }) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td>${d2(s.data)}</td><td class="r">${s.quantidade || r.cab}</td><td class="r">${r.dias}</td><td class="r">${rs(f.receita, 0)}</td><td class="r">${rs(r.custos.aquisicao, 0)}</td><td class="r">${rs(f.producao, 0)}</td>
        <td class="r"><b class="${f.resultado >= 0 ? "pos" : "neg"}">${rs(f.resultado, 0)}</b></td><td class="r">${rs(f.resultadoCab, 0)}</td><td class="r">${pct(f.margem)}</td><td class="r">${f.arrobasProd == null ? "—" : n1(f.arrobasProd)}</td><td class="r">${rs(f.custoArrobaProd)}</td><td class="r">${pct(f.rentab)}</td><td class="r">${pct(f.rentabMes, 2)}</td></tr>`).join("")}
      </tbody></table></div></section>` : ""}
    ${ativos.length ? `<section class="card"><div class="sec-h"><h3>Custo dos lotes ativos</h3><span class="note">acumulado até ontem</span></div>
      <div class="g-leg">${CATEGORIAS.map(([k, n]) => `<span><i style="background:${COR[k]}"></i>${n}</span>`).join("")}</div>
      <div class="g-barras">${(() => { const max = Math.max(...ativos.map((r) => r.total)) || 1; return ativos.map((r) => `<div class="g-b" tabindex="0" data-tip="${esc(["Lote " + r.lote.numero, ...CATEGORIAS.filter(([k]) => r.custos[k] > 0).map(([k, n]) => `${n}: ${rsK(r.custos[k])}`), "Total: " + rsK(r.total)].join("|"))}">
        <span class="n">Lote ${esc(r.lote.numero)}<small>${r.cab} cab. · ${r.dias} dias</small></span><span class="t"><span class="pilha" style="width:${(r.total / max) * 100}%">${CATEGORIAS.map(([k]) => (r.custos[k] > 0 ? `<i style="flex:${r.custos[k]} 0 0;background:${COR[k]}"></i>` : "")).join("")}</span></span><span class="v">${rsK(r.total)}</span></div>`).join(""); })()}</div>
      <div class="tw" style="margin-top:14px"><table><thead><tr><th>Lote</th><th class="r">Cab.</th><th class="r">Dias</th>${CATEGORIAS.map(([, n]) => `<th class="r">${n}</th>`).join("")}<th class="r">Total</th><th class="r">Por cabeça</th><th class="r">Produção/cab/dia</th><th class="r">Custo/@ prod.</th></tr></thead><tbody>
      ${ativos.map((r) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td class="r">${r.cab}</td><td class="r">${r.dias}</td>${CATEGORIAS.map(([k]) => `<td class="r">${rs(r.custos[k], 0)}</td>`).join("")}<td class="r"><b>${rs(r.total, 0)}</b></td><td class="r">${rs(r.total / r.cab, 0)}</td><td class="r">${r.dias > 0 ? rs(r.producao / r.dias / r.cab) : "—"}</td><td class="r">${rs(r.custoArrobaProdEst)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td class="r">${ativos.reduce((s, r) => s + r.cab, 0)}</td><td></td>${CATEGORIAS.map(([k]) => `<td class="r">${rs(ativos.reduce((s, r) => s + r.custos[k], 0), 0)}</td>`).join("")}<td class="r">${rs(m.fin.capital, 0)}</td><td></td><td></td><td></td></tr></tfoot></table></div>
      <p class="note" style="margin-top:10px">Custo por arroba produzida dos lotes ativos é estimado: usa o peso estimado e o rendimento de ${n1(m.cfg.rendSaida)}%. Toque num lote para ver a projeção de venda dele.</p></section>` : ""}`;
  },
};

// ------------------------------------------------------------ por área
const bloco = (titulo, total, sub, corpo) => `<section class="card area"><div class="sec-h"><div><h3>${titulo}</h3><span class="note">${sub}</span></div><b class="area-tot">${total}</b></div>${corpo}</section>`;

TELAS["financeiro/areas"] = {
  lista() {
    const m = M();
    if (!S.db.lotes.length && !S.db.custos.length) return vazio();
    const { t, fechados } = recorte();
    const txt = periodo ? `últimos ${periodo} meses` : "desde o começo";
    const perdaMortes = (S.db.mortes || []).reduce((s, x) => { const r = m.lote(x.loteId); return s + (r && r.cabEntrada ? (r.total / r.cabEntrada) * (x.cabecas || 0) : 0); }, 0);
    const saldoGerais = S.db.custos.filter((c) => c.tipo === "geral").reduce((s, c) => { const n = Math.max(1, c.meses || 1); let pass = 0; const m0 = c.data.slice(0, 7), at = m.hoje.slice(0, 7); for (let i = 0; i < n; i++) { const [a, mm] = m0.split("-").map(Number), tt = a * 12 + mm - 1 + i; if (`${Math.floor(tt / 12)}-${String((tt % 12) + 1).padStart(2, "0")}` <= at) pass++; } return s + (c.valor * (n - pass)) / n; }, 0);
    const recLotes = fechados.reduce((s, x) => s + x.f.receita, 0), arrVend = fechados.reduce((s, x) => s + (x.f.arrobas || 0), 0);
    const kgComprado = S.db.lotes.filter((l) => !l.origemId && l.custoKg != null && (!recorte().de || l.dataEntrada.slice(0, 7) >= recorte().de)).reduce((s, l) => s + (l.qtdEntrada ?? l.quantidade) * (l.pesoCompra || l.pesoEntrada), 0);
    return `
    <div class="fin-top">${seletor()}<span class="note">Cada área mostra quanto custou no período e onde o dinheiro foi parar.</span></div>
    <div class="grid2 igual">
      ${bloco("Compra de gado", rs(t.aquisicao, 0), `${n0(t.cabCompradas)} cabeças · ${kgComprado ? rs(t.aquisicao / kgComprado) + " por kg, com comissão e frete" : txt}`,
        `<h4 class="g-sub">Por fornecedor ou origem</h4>${barras({ itens: ordenar(t.porOrigem), cor: COR.aquisicao, vazio: "Nenhuma compra no período." })}`)}
      ${bloco("Vendas", rs(t.receita, 0), `${n0(t.cabVendidas)} cabeças${arrVend ? ` · ${rs(fechados.filter((x) => x.f.arrobas).reduce((s, x) => s + x.f.receita, 0) / arrVend)} por arroba, em média` : ""}`,
        `<h4 class="g-sub">Por destino ou comprador</h4>${barras({ itens: ordenar(t.porDestino), cor: COR.receita, vazio: "Nenhuma venda no período." })}
        ${recLotes ? `<p class="note" style="margin-top:8px">Resultado dos lotes vendidos no período: <b>${rs(fechados.reduce((s, x) => s + x.f.resultado, 0), 0)}</b>.</p>` : ""}`)}
      ${bloco("Pasto", rs(t.pasto, 0), `${t.pasto ? pct((t.pastoOcioso / t.pasto) * 100, 0) : "0%"} do custo foi de pasto vazio`,
        `<h4 class="g-sub">Por pasto</h4>${barras({ itens: ordenar(t.porPasto, (k) => nomeDe("pastos", k, "Pasto excluído")).map((x) => { const p = m.pastos.find((y) => y.pasto.nome === x.nome); return { ...x, sub: p ? `${n1(p.pasto.area)} ha` : "" }; }), cor: COR.pasto })}
        ${t.pastoOcioso > 1 ? `<p class="note" style="margin-top:8px">Pasto vazio no período: <b>${rs(t.pastoOcioso, 0)}</b>. É custo que nenhum lote pagou.</p>` : ""}`)}
      ${bloco("Trato", rs(t.trato, 0), `${n0(t.tratoKg / 1000)} toneladas no cocho${t.tratoKg ? " · " + rs(t.trato / t.tratoKg, 3) + " por kg" : ""}`,
        `<h4 class="g-sub">Por dieta</h4>${barras({ itens: ordenar(t.porDieta, (k) => nomeDe("dietas", k, "Dieta excluída")), cor: COR.trato, vazio: "Nenhum lote com dieta no período." })}
        <h4 class="g-sub">Por ingrediente</h4>${barras({ itens: ordenar(t.porIng, (k) => nomeDe("ingredientes", k, "Ingrediente excluído")), cor: COR.trato, vazio: "—" })}`)}
      ${bloco("Sanidade", rs(t.sanidade, 0), `protocolo ${rs(t.sanProtocolo, 0)} · tratamento ${rs(t.sanTratamento, 0)}`,
        `<h4 class="g-sub">Por medicamento</h4>${barras({ itens: ordenar(t.porMed, (k) => nomeDe("meds", k, "Medicamento excluído")), cor: COR.sanidade, vazio: "Nenhuma aplicação no período." })}
        ${Object.keys(t.porDoenca).length ? `<h4 class="g-sub">Tratamentos por doença</h4>${barras({ itens: ordenar(t.porDoenca), cor: COR.sanidade })}` : ""}`)}
      ${bloco("Custos fixos e gerais", rs(t.fixos + t.gerais, 0), `fixos ${rs(t.fixos, 0)} · gerais ${rs(t.gerais, 0)}`,
        `<h4 class="g-sub">Por categoria</h4>${barras({ itens: ordenar(t.porCategoria), cor: COR.fixos, vazio: "Nenhum custo fixo ou geral no período." })}
        <p class="note" style="margin-top:8px">${saldoGerais > 1 ? `Ainda faltam <b>${rs(saldoGerais, 0)}</b> de custos gerais para diluir nos próximos meses. ` : ""}${t.semRateio > 1 ? `${rs(t.semRateio, 0)} caíram em dias sem gado na fazenda e não entraram em nenhum lote.` : ""}</p>`)}
      ${bloco("Morte e perda", rs(perdaMortes, 0), `${m.fazenda.mortes} ${m.fazenda.mortes === 1 ? "cabeça" : "cabeças"} desde o começo · mortalidade de ${pct(m.fazenda.mortalidade)}`,
        `${barras({ itens: m.lotes.filter((r) => r.mortes > 0).map((r) => ({ nome: "Lote " + r.lote.numero, sub: `${r.mortes} de ${r.cabEntrada} cabeças`, v: (r.total / r.cabEntrada) * r.mortes })).sort((a, b) => b.v - a.v), cor: COR.ruim, vazio: "Nenhuma morte ou perda lançada." })}
        <p class="note" style="margin-top:8px">Perda estimada: o custo por cabeça do lote vezes as cabeças perdidas. Esse valor já está dentro do custo dos lotes.</p>`)}
      ${bloco("Resumo do período", rs(t.despesa, 0), `despesa total · ${txt}`,
        `${barras({ itens: CATEGORIAS.map(([k, nome]) => ({ nome, v: t[k], cor: COR[k] })).filter((x) => x.v > 0.005) })}
        <p class="note" style="margin-top:8px">Receita de <b>${rs(t.receita, 0)}</b> e saldo de <b class="${t.resultado >= 0 ? "pos" : "neg"}">${rs(t.resultado, 0)}</b> no período.</p>`)}
    </div>`;
  },
  ligarLista: ligarSeletor,
};

// ------------------------------------------------------------ projeção de venda
TELAS["financeiro/projecao"] = {
  form: () => {
    const c = cfg();
    return `<form class="card" id="fCfg" novalidate>
      <h3>Parâmetros da fazenda</h3>
      <div class="fgrid c3">
        ${campo("cf-arroba", "Preço da arroba para simular (R$/@)", { tipo: "number", v: c.precoArroba })}
        ${campo("cf-rsai", "Rendimento de carcaça na saída (%)", { tipo: "number", v: c.rendSaida })}
        ${campo("cf-rent", "Rendimento de carcaça na entrada (%)", { tipo: "number", v: c.rendEntrada, hint: "Usado nas arrobas produzidas. O padrão do mercado é 50%." })}
      </div>
      <div class="actions"><button class="btn" type="submit">Salvar e simular</button><span class="note">Mude o preço para ver o resultado de cada lote na data do peso-alvo.</span></div>
    </form>`;
  },
  ligar() {
    $("#fCfg").onsubmit = (ev) => {
      ev.preventDefault();
      const f = ev.target, p = num(val("cf-arroba")), rsai = num(val("cf-rsai")), rent = num(val("cf-rent"));
      const e = [];
      if (!p || p <= 0) e.push(["cf-arroba", "Informe o preço da arroba."]);
      if (!rsai || rsai <= 0 || rsai > 100) e.push(["cf-rsai", "Informe um percentual entre 1 e 100."]);
      if (!rent || rent <= 0 || rent > 100) e.push(["cf-rent", "Informe um percentual entre 1 e 100."]);
      if (!erros(f, e)) return;
      store.gravar([{ tipo: "merge", col: "config", id: "geral", dados: { precoArroba: p, rendSaida: rsai, rendEntrada: rent } }]);
      toast(`Parâmetros salvos. ${msgSalvo()}`);
    };
  },
  lista() {
    const m = M(), c = m.cfg;
    if (!m.ativos.length) return '<section class="card"><p class="empty">Nenhum lote ativo para projetar.</p></section>';
    const ps = m.ativos.map((r) => ({ r, p: projecao(r) }));
    const tot = ps.reduce((s, x) => ({ custo: s.custo + x.p.custo, receita: s.receita + x.p.receita, resultado: s.resultado + x.p.resultado, arrobas: s.arrobas + x.p.arrobas }), { custo: 0, receita: 0, resultado: 0, arrobas: 0 });
    const semAlvo = ps.filter((x) => !x.r.alvo);
    return `
    <section class="kpis">
      <div class="card kpi dark"><span class="label">Resultado esperado</span><span class="v">${rsK(tot.resultado)}</span><span class="s">${ps.length === 1 ? "do lote ativo" : `dos ${ps.length} lotes ativos`}, a ${rs(c.precoArroba, 0)} por arroba</span></div>
      <div class="card kpi"><span class="label">Receita esperada</span><span class="v">${rsK(tot.receita)}</span><span class="s">${n0(tot.arrobas)} arrobas com ${n1(c.rendSaida)}% de rendimento</span></div>
      <div class="card kpi"><span class="label">Custo até a venda</span><span class="v">${rsK(tot.custo)}</span><span class="s">o acumulado mais os dias que faltam</span></div>
      <div class="card kpi"><span class="label">Preço que empata</span><span class="v">${tot.arrobas ? rs(tot.custo / tot.arrobas, 0) : "—"}</span><span class="s">por arroba, na média da fazenda</span></div>
    </section>
    <section class="card"><div class="sec-h"><h3>Preço da arroba que empata cada lote</h3><span class="note">abaixo da linha, o lote dá lucro no preço simulado</span></div>
      ${barras({ itens: ps.map(({ r, p }) => ({ nome: "Lote " + r.lote.numero, sub: p.temAlvo ? `venda em ${d2(p.data)}` : "vendendo hoje", v: p.equilibrio, cor: p.equilibrio <= c.precoArroba ? COR.bom : COR.ruim })), fmt: (v) => rs(v), ref: { nome: "Preço simulado", v: c.precoArroba } })}
    </section>
    <section class="card"><div class="sec-h"><h3>Projeção por lote</h3><span class="note">toque na linha para abrir o lote</span></div>
      <div class="tw"><table><thead><tr><th>Lote</th><th class="r">Cab.</th><th class="r">Peso hoje</th><th class="r">Peso de venda</th><th>Venda prevista</th><th class="r">Arrobas</th><th class="r">Custo até lá</th><th class="r">Receita</th><th class="r">Resultado</th><th class="r">Por cabeça</th><th class="r">Preço que empata</th><th class="r">Rentab. ao mês</th></tr></thead><tbody>
      ${ps.map(({ r, p }) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td class="r">${r.cab}</td><td class="r">${n0(r.peso)} kg</td><td class="r">${n0(p.pesoVenda)} kg</td>
        <td>${p.temAlvo ? `${d2(p.data)}<div class="note">em ${p.dias} dias</div>` : p.semData ? '<span class="pill est">GMD zerado</span>' : r.alvo ? '<span class="pill m">já no peso</span>' : '<span class="pill">sem peso-alvo</span>'}</td>
        <td class="r">${n1(p.arrobas)}</td><td class="r">${rs(p.custo, 0)}</td><td class="r">${rs(p.receita, 0)}</td><td class="r"><b class="${p.resultado >= 0 ? "pos" : "neg"}">${rs(p.resultado, 0)}</b></td><td class="r">${rs(p.resultadoCab, 0)}</td><td class="r"><b>${rs(p.equilibrio)}</b></td><td class="r">${pct(p.rentabMes, 2)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td class="r">${m.fazenda.cabecas}</td><td></td><td></td><td></td><td class="r">${n1(tot.arrobas)}</td><td class="r">${rs(tot.custo, 0)}</td><td class="r">${rs(tot.receita, 0)}</td><td class="r">${rs(tot.resultado, 0)}</td><td></td><td class="r">${tot.arrobas ? rs(tot.custo / tot.arrobas) : "—"}</td><td></td></tr></tfoot></table></div>
      <p class="note" style="margin-top:10px">Data prevista = hoje + (peso-alvo − peso estimado) ÷ GMD estimado. O custo até a venda repete o custo de hoje nos dias que faltam, então é uma aproximação. Preço que empata = custo até a venda ÷ arrobas.${semAlvo.length ? ` Sem peso-alvo (simulados vendendo hoje): ${semAlvo.map((x) => esc(x.r.lote.numero)).join(", ")}. Para informar, abra o lote e toque em Corrigir dados do lote.` : ""}</p></section>`;
  },
};

// ------------------------------------------------------------ relatórios
const DIMS = [["pasto", "Pasto"], ["fornecedor", "Fornecedor"], ["raca", "Raça"], ["dieta", "Dieta"]];
TELAS["financeiro/relatorios"] = {
  lista() {
    const m = M();
    if (!S.db.lotes.length) return vazio();
    const linhas = comparativo(m, S.db, dimensao), nomeDim = DIMS.find((d) => d[0] === dimensao)[1].toLowerCase();
    const ms = m.fin.meses, t = ms.reduce((s, x) => { for (const k of ["receita", "aquisicao", "pasto", "trato", "sanidade", "fixos", "gerais", "despesa", "resultado"]) s[k] = (s[k] || 0) + x[k]; return s; }, {});
    return `
    <div class="actions imprimir-fora"><button class="btn" type="button" data-act="excel">Baixar tudo em Excel</button><button class="btn ghost" type="button" id="finPrint">Imprimir ou salvar em PDF</button><span class="note">A planilha leva o financeiro mês a mês, o resultado por lote e os comparativos.</span></div>
    <section class="card"><div class="sec-h"><h3>Onde o gado rende mais</h3>
      <div class="seg mini imprimir-fora" role="group" aria-label="Comparar por">${DIMS.map(([k, l]) => `<input type="radio" name="finDim" id="finDim-${k}" value="${k}" ${k === dimensao ? "checked" : ""}><label for="finDim-${k}">${l}</label>`).join("")}</div></div>
      <h4 class="g-sub">GMD do período por ${nomeDim} (kg por cabeça por dia)</h4>
      ${barras({ itens: linhas.filter((x) => x.gmd != null).map((x) => ({ nome: x.nome, sub: `${x.lotes} ${x.lotes === 1 ? "lote" : "lotes"} · ${n0(x.cab)} cab.`, v: x.gmd })), fmt: (v) => n3(v), cor: COR.pasto, vazio: "Ainda não há lotes para comparar." })}
      <div class="tw" style="margin-top:14px"><table><thead><tr><th>${DIMS.find((d) => d[0] === dimensao)[1]}</th><th class="r">Lotes</th><th class="r">Cabeças</th><th class="r">Dias médios</th><th class="r">GMD do período</th><th class="r">Custo/@ produzida</th><th class="r">Lotes vendidos</th><th class="r">Resultado</th><th class="r">Resultado/cab</th></tr></thead><tbody>
      ${linhas.map((x) => `<tr><td class="wrap"><b>${esc(x.nome)}</b></td><td class="r">${x.lotes}</td><td class="r">${n0(x.cab)}</td><td class="r">${n0(x.diasMedio)}</td><td class="r">${fmtGmd(x.gmd)}</td><td class="r">${rs(x.custoArroba)}</td><td class="r">${x.vendidos}</td><td class="r">${x.vendidos ? `<b class="${x.res >= 0 ? "pos" : "neg"}">${rs(x.res, 0)}</b>` : "—"}</td><td class="r">${rs(x.resultadoCab, 0)}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="note" style="margin-top:10px">${dimensao === "pasto" || dimensao === "dieta" ? `Cada lote entra ${dimensao === "pasto" ? "no pasto" : "na dieta"} em que passou mais dias. ` : ""}Lotes ativos entram com o peso estimado e o custo por arroba estimado. O resultado conta só os lotes vendidos.</p>
    </section>
    <section class="card"><div class="sec-h"><h3>Demonstrativo mês a mês</h3><span class="note">${ms.length} ${ms.length === 1 ? "mês" : "meses"} · despesa até ontem</span></div>
      <div class="tw"><table><thead><tr><th>Mês</th><th class="r">Receita</th>${CATEGORIAS.map(([, n]) => `<th class="r">${n}</th>`).join("")}<th class="r">Despesa total</th><th class="r">Saldo</th></tr></thead><tbody>
      ${[...ms].reverse().map((x) => `<tr><td>${mesBr(x.mes)}</td><td class="r">${rs(x.receita, 0)}</td>${CATEGORIAS.map(([k]) => `<td class="r">${rs(x[k], 0)}</td>`).join("")}<td class="r">${rs(x.despesa, 0)}</td><td class="r"><b class="${x.resultado >= 0 ? "pos" : "neg"}">${rs(x.resultado, 0)}</b></td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td class="r">${rs(t.receita, 0)}</td>${CATEGORIAS.map(([k]) => `<td class="r">${rs(t[k], 0)}</td>`).join("")}<td class="r">${rs(t.despesa, 0)}</td><td class="r">${rs(t.resultado, 0)}</td></tr></tfoot></table></div>
    </section>`;
  },
  ligarLista() {
    $$("input[name=finDim]").forEach((el) => { el.onchange = () => { dimensao = el.value; ui.refazerLista(); }; });
    const b = $("#finPrint");
    if (b) b.onclick = () => window.print();
  },
};
