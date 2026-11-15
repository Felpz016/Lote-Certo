// Índices: arroba e milho na bolsa B3, dólar do Banco Central, notícias do agro e o que isso significa
// para a fazenda aberta. Os números vêm do documento publico/indices, que um robô atualiza todo dia
// (scripts/indices.mjs). Nada aqui é inventado: sem dado novo, a tela mostra o último real, com a data dele.
import { S, M, $, $$, esc, d2, n0, n1, n2, n3, pct, soCampo, store, toast, msgSalvo, TELAS, ui } from "./base.js";
import { projecao, vigente } from "./calc.js";
import { COR, linha } from "./graficos.js";

// Preço de mercado é informação pública: aparece até para o perfil campo (por isso não usa rs()).
const real = (v, c = 2) => (v == null ? "—" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }));
const realK = (v) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; return s + (a >= 1e6 ? real(a / 1e6, 2) + " mi" : a >= 1e4 ? real(a / 1e3, a >= 1e5 ? 0 : 1) + " mil" : real(a, 0)); };
const varTxt = (v) => (v == null ? "" : `<span class="var ${v > 0.005 ? "sobe" : v < -0.005 ? "desce" : ""}">${v > 0.005 ? "▲" : v < -0.005 ? "▼" : "■"} ${n1(Math.abs(v))}%</span>`);
const quando = (iso) => {
  const t = new Date(iso), h = new Date(), dd = Math.round((new Date(h.toDateString()) - new Date(t.toDateString())) / 864e5);
  const hr = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return dd === 0 ? `hoje, ${hr}` : dd === 1 ? `ontem, ${hr}` : t.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

let qual = "arroba";   // cotação do gráfico
let dias = 30;         // período do gráfico
let tema = "tudo";     // filtro das notícias
const TEMAS = [["tudo", "Tudo"], ["mercado", "Mercado"], ["sanidade", "Sanidade"], ["insumos", "Insumos"], ["clima", "Clima"], ["politica", "Crédito e governo"]];
const temaDe = (n) => (n.temas || []).map((t) => (t === "credito" ? "politica" : t === "confinamento" || t === "reposicao" ? "insumos" : t === "exportacao" ? "mercado" : t));

/** Assuntos que pesam para esta fazenda, tirados dos próprios lançamentos, com o motivo. */
function interesses() {
  const db = S.db, m = new Map();
  if (db.dietas.length) { m.set("confinamento", "você usa trato"); m.set("insumos", "você compra ração"); }
  if ((db.agenda || []).some((a) => !a.feito) || db.meds.length) m.set("sanidade", "sanidade do rebanho");
  if (db.pastos.length) m.set("clima", "seus pastos");
  if (db.lotes.some((l) => l.ativo && !l.origemId)) m.set("reposicao", "você compra gado");
  return m;
}

function paraFazenda(ix) {
  const m = M(), cot = Object.fromEntries((ix.cotacoes || []).map((c) => [c.k, c]));
  const arroba = cot.arroba?.valor, itens = [];
  if (!arroba) return "";
  if (m.ativos.length) {
    const valorHoje = m.fin.arrobasAtivas * arroba, valorSim = m.fin.valorRebanho, dif = valorHoje - valorSim;
    const ps = m.ativos.map((r) => ({ r, p: projecao(r, arroba) }));
    const lucro = ps.filter((x) => x.p.resultado >= 0), tot = ps.reduce((s, x) => s + x.p.resultado, 0);
    itens.push(`<div class="ix-item"><span class="label">Seu rebanho a ${real(arroba)}</span><b>${realK(valorHoje)}</b>
      <span class="note">${n0(m.fin.arrobasAtivas)} @ estimadas nos ${m.ativos.length} lotes ativos. ${Math.abs(dif) < 1 ? "É o mesmo preço da sua simulação." : `${dif > 0 ? "Vale" : "Vale"} ${realK(Math.abs(dif))} ${dif > 0 ? "a mais" : "a menos"} que no preço da sua simulação (${real(m.cfg.precoArroba, 0)}).`}</span></div>`);
    itens.push(`<div class="ix-item"><span class="label">Resultado esperado com a arroba de hoje</span><b class="${tot >= 0 ? "pos" : "neg"}">${realK(tot)}</b>
      <span class="note">${lucro.length} de ${ps.length} lotes dão lucro vendendo na data do peso-alvo.${ps.filter((x) => x.p.resultado < 0).length ? " No vermelho: " + ps.filter((x) => x.p.resultado < 0).map((x) => `${esc(x.r.lote.numero)} (empata a ${real(x.p.equilibrio, 0)})`).join(", ") + "." : ""}</span></div>`);
    const prontos = m.ativos.filter((r) => r.alvo && r.alvo.falta <= 0);
    if (prontos.length) itens.push(`<div class="ix-item"><span class="label">Já no peso-alvo</span><b>${prontos.length} ${prontos.length === 1 ? "lote" : "lotes"}</b><span class="note">${prontos.map((r) => esc(r.lote.numero)).join(", ")}: com a arroba a ${real(arroba)}, vale cotar com o frigorífico.</span></div>`);
  }
  const curva = ix.curva || [];
  if (m.ativos.length && curva.length) {
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const mesDe = (iso) => `${MES[+iso.slice(5, 7) - 1]}/${iso.slice(2, 4)}`;
    const ls = m.ativos.filter((r) => r.alvo && r.alvo.data && r.alvo.falta > 0)
      .map((r) => ({ r, c: curva.find((c) => c.mes === mesDe(r.alvo.data)) })).filter((x) => x.c)
      .map((x) => ({ ...x, p: projecao(x.r, x.c.v) }));
    if (ls.length) {
      const tot = ls.reduce((s, x) => s + x.p.resultado, 0);
      itens.push(`<div class="ix-item"><span class="label">Pela B3, no mês em que ficam prontos</span><b class="${tot >= 0 ? "pos" : "neg"}">${realK(tot)}</b>
        <span class="note">${ls.slice(0, 4).map((x) => `${esc(x.r.lote.numero)}: ${x.c.mes} a ${real(x.c.v, 0)}, ${x.p.resultado >= 0 ? "lucro" : "prejuízo"} de ${realK(Math.abs(x.p.resultado))}`).join("; ")}${ls.length > 4 ? `; e mais ${ls.length - 4}` : ""}. É o preço que a bolsa paga hoje pela arroba entregue naquele mês.</span></div>`);
    }
  }
  if (cot.bezerro) {
    const troca = (arroba * 18) / cot.bezerro.valor;
    itens.push(`<div class="ix-item"><span class="label">Reposição</span><b>${n2(troca)} bezerros</b><span class="note">é o que um boi gordo de 18 @ compra hoje (bezerro a ${real(cot.bezerro.valor, 0)} em ${esc(cot.bezerro.praca)}). Acima de 2, a troca está boa para quem recria.</span></div>`);
  }
  const milhoIng = S.db.ingredientes.find((i) => /milho/i.test(i.nome) && !/silagem/i.test(i.nome));
  if (cot.milho && milhoIng) {
    const v = vigente(milhoIng.precos, m.hoje), mercadoT = (cot.milho.valor / 60) * 1000;
    if (v) {
      const dif = ((v.valor - mercadoT) / mercadoT) * 100;
      itens.push(`<div class="ix-item"><span class="label">Milho do seu trato</span><b>${Math.abs(dif) < 3 ? "No preço" : dif > 0 ? n0(dif) + "% acima" : n0(-dif) + "% abaixo"}</b><span class="note">Você paga ${real(v.valor, 0)} por tonelada em ${esc(milhoIng.nome)}; o mercado está em ${real(mercadoT, 0)} (${real(cot.milho.valor)} a saca).</span></div>`);
    }
  }
  const simular = Math.abs(arroba - m.cfg.precoArroba) >= 0.5 && S.perfil !== "campo";
  return `<section class="card ix-voce"><div class="sec-h"><h3>Para a sua fazenda hoje</h3><span class="note">contas feitas com os seus lotes e o preço de hoje</span></div>
    <div class="ix-grid">${itens.join("") || '<p class="empty">Cadastre lotes para ver o que o preço de hoje significa para você.</p>'}</div>
    ${simular ? `<div class="actions" style="margin-top:12px"><button class="btn ghost sm" type="button" id="ixUsar">Usar ${real(arroba)} nas simulações</button><span class="note">Troca o preço da arroba da Projeção e do valor do rebanho.</span></div>` : ""}</section>`;
}

TELAS["indices"] = {
  lista() {
    const ix = S.indices;
    if (ix === undefined) return '<div class="loading">Buscando os índices…</div>';
    if (!ix || !(ix.cotacoes || []).length) return `<section class="card"><h3>Índices ainda não chegaram</h3><p class="note" style="margin-top:8px">Os preços e as notícias são atualizados todo dia de manhã. Se o aparelho estiver sem internet, eles aparecem assim que a conexão voltar.</p></section>`;
    const cots = ix.cotacoes, c = cots.find((x) => x.k === qual) || cots[0];
    const serie = c.serie.slice(-Math.round(dias * 5 / 7));
    const velho = (Date.now() - new Date(ix.atualizadoEm)) / 36e5 > 30;
    const quer = interesses();
    const nots = (ix.noticias || []).filter((n) => tema === "tudo" || temaDe(n).includes(tema));
    const fmtC = (x, v) => (x.unidade === "R$" ? real(v, x.dec ?? 3) : real(v, x.dec ?? 2));
    return `
    ${ix.demo ? `<div class="banner"><span><b>Teste local.</b> Estes são os índices reais de ${d2(ix.atualizadoEm.slice(0, 10))}, guardados para o modo de demonstração.</span></div>` : ""}
    ${velho && !ix.demo ? `<div class="banner"><span>Os índices são de ${d2(ix.atualizadoEm.slice(0, 10))}. O aparelho pode estar sem internet.</span></div>` : ""}
    <div class="fin-top"><span class="note">Atualizado ${quando(ix.atualizadoEm)} · preços do último pregão divulgado${(() => { const d = cots.map((x) => x.data).filter(Boolean).sort().pop(); return d ? ` (${d2(d).slice(0, 5)})` : ""; })()}</span></div>
    <section class="ix-cots">${cots.map((x) => `<button type="button" class="card ix-cot${x.k === c.k ? " on" : ""}" data-cot="${x.k}" aria-pressed="${x.k === c.k}">
      <span class="label">${esc(x.nome)}</span><span class="v">${fmtC(x, x.valor)}</span>
      <span class="s">${esc(x.unidade)} · ${esc(x.praca)}</span><span class="s">${x.var1d == null ? "" : varTxt(x.var1d) + " no dia"}${x.var1d != null && x.var30d != null ? " · " : ""}${x.var30d == null ? "" : varTxt(x.var30d) + " em 30 dias"}</span></button>`).join("")}</section>

    <div class="grid2">
      <section class="card"><div class="sec-h"><div><h3>${esc(c.nome)}</h3><span class="note">${esc(c.unidade)} · ${esc(c.praca)} · fonte: ${esc(c.fonte)}</span></div>
        <div class="seg mini" role="group" aria-label="Período">${[[30, "30 dias"], [60, "60 dias"], [90, "90 dias"]].map(([v, l]) => `<input type="radio" name="ixDias" id="ixDias-${v}" value="${v}" ${v === dias ? "checked" : ""}><label for="ixDias-${v}">${l}</label>`).join("")}</div></div>
        ${serie.length >= 2 ? linha({ dados: serie.map((p) => ({ rot: d2(p.d).slice(0, 5), v: p.v })), fmt: (v) => fmtC(c, v), nome: `${c.nome}, últimos ${dias} dias`, cor: COR.receita, rotulo: c.unidade, altura: 220, doZero: false })
          : `<p class="empty ix-forma">O gráfico vai se formando a cada pregão. Por enquanto há o preço de ${d2(c.data)}: <b>${fmtC(c, c.valor)}</b>.</p>`}
        <details class="mais tabela"><summary>Ver os números</summary><div class="tw"><table><thead><tr><th>Data</th><th class="r">${esc(c.unidade)}</th><th class="r">Variação</th></tr></thead><tbody>
          ${serie.map((p, i) => ({ ...p, vr: i ? ((p.v - serie[i - 1].v) / serie[i - 1].v) * 100 : null })).reverse().map((p) => `<tr><td>${d2(p.d)}</td><td class="r">${fmtC(c, p.v)}</td><td class="r">${p.vr == null ? "—" : varTxt(p.vr)}</td></tr>`).join("")}</tbody></table></div></details>
      </section>
      ${(ix.curva || []).length ? `<section class="card"><div class="sec-h"><div><h3>Boi gordo na B3 por vencimento</h3><span class="note">pregão de ${d2(ix.curvaData)} · último negócio de cada mês</span></div></div>
        <div class="tw"><table class="compacta"><thead><tr><th>Entrega em</th><th class="r">R$/@</th><th class="r">No dia</th></tr></thead><tbody>
        ${ix.curva.map((x) => `<tr><td>${esc(x.mes)}</td><td class="r"><b>${real(x.v)}</b></td><td class="r">${x.var == null ? "—" : varTxt(x.var)}</td></tr>`).join("")}</tbody></table></div>
        <p class="note" style="margin-top:8px">Quanto a bolsa paga hoje pela arroba entregue em cada mês. Serve de referência para planejar a venda.</p>
      </section>` : ""}
    </div>
    ${(ix.pracas || []).length ? `<section class="card"><div class="sec-h"><div><h3>Arroba por praça</h3><span class="note">${esc(ix.pracasFonte || "")}${ix.pracasData ? ` · ${d2(ix.pracasData)}` : ""}</span></div></div>
      <div class="tw"><table class="compacta"><thead><tr><th>Praça</th><th class="r">R$/@ à vista</th></tr></thead><tbody>
      ${ix.pracas.map((p) => `<tr><td>${esc(p.praca)}</td><td class="r"><b>${real(p.boi)}</b></td></tr>`).join("")}</tbody></table></div></section>` : ""}

    ${soCampo() ? "" : paraFazenda(ix)}

    <section class="card"><div class="sec-h"><div><h3>Notícias do agro</h3><span class="note">as mais importantes dos últimos dias, escolhidas todo dia de manhã</span></div></div>
      <div class="ix-temas" role="group" aria-label="Assunto">${TEMAS.map(([k, l]) => `<button type="button" class="chip${k === tema ? " on" : ""}" data-tema="${k}" aria-pressed="${k === tema}">${l}</button>`).join("")}</div>
      <div class="ix-nots">${nots.map((n) => { const liga = soCampo() ? null : (n.temas || []).map((t) => quer.get(t)).find(Boolean); return `<article class="ix-not">
        <div class="ix-meta"><span>${esc(n.fonte)}</span><span>${quando(n.data)}</span>${liga ? `<span class="pill m">Para você: ${liga}</span>` : ""}</div>
        <h4>${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>` : esc(n.titulo)}</h4>
        ${n.resumo ? `<p>${esc(n.resumo)}</p>` : ""}</article>`; }).join("") || '<p class="empty">Nenhuma notícia desse assunto nos últimos dias.</p>'}</div>
    </section>`;
  },
  ligarLista() {
    $$("[data-cot]").forEach((b) => { b.onclick = () => { qual = b.dataset.cot; ui.refazerLista(); }; });
    $$("input[name=ixDias]").forEach((el) => { el.onchange = () => { dias = +el.value; ui.refazerLista(); }; });
    $$("[data-tema]").forEach((b) => { b.onclick = () => { tema = b.dataset.tema; ui.refazerLista(); }; });
    const u = $("#ixUsar");
    if (u) u.onclick = () => {
      const v = S.indices.cotacoes.find((x) => x.k === "arroba").valor;
      store.gravar([{ tipo: "merge", col: "config", id: "geral", dados: { precoArroba: Math.round(v * 100) / 100 } }]);
      toast(`Simulações agora usam ${real(v)} por arroba. ${msgSalvo()}`);
    };
  },
};
