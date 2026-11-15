// Gráficos do sistema, feitos em HTML e CSS (sem biblioteca, para funcionar sem internet).
// Regras: barra fina com a ponta arredondada, um espaço de 2px entre os pedaços, legenda sempre que há
// mais de uma série, valor ao passar o mouse ou tocar, e a tabela com os mesmos números logo abaixo.
import { esc, rsK } from "./base.js";

// Cores por papel. As seis de custo são as mesmas da gaveta do lote (drawer.js).
export const COR = {
  aquisicao: "#2a78d6", pasto: "#008300", trato: "#eda100", sanidade: "#e34948", fixos: "#6250d6", gerais: "#1baf7a",
  receita: "#2a78d6", despesa: "#eb6834", neutro: "#58645B", bom: "#2F8A4A", ruim: "#B23C2A",
};

/** Teto "redondo" para o eixo: 1, 2, 2,5 ou 5 vezes uma potência de 10. */
export function teto(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const k of [1, 2, 2.5, 5, 10]) if (v <= k * p) return k * p;
  return 10 * p;
}
const dica = (linhas) => esc(linhas.filter(Boolean).join("|"));
/** No eixo o "R$" sai, para o número caber no celular. */
const curto = (t) => String(t).replace("R$ ", "");
const eixoY = (max, fmt, n = 4) => Array.from({ length: n + 1 }, (_, i) => `<span style="bottom:${(i / n) * 100}%">${curto(fmt((max * i) / n))}</span>`).join("");
const grade = (n = 4) => Array.from({ length: n + 1 }, (_, i) => `<i style="bottom:${(i / n) * 100}%"></i>`).join("");
/** Rótulos do eixo X: no celular aparece só um a cada tantos, contando a partir do último. */
function eixoX(rotulos) {
  const n = rotulos.length, passo = Math.max(1, Math.ceil(n / 6));
  return `<div class="g-x">${rotulos.map((r, i) => `<span class="${(n - 1 - i) % passo === 0 ? "" : "opt"}">${esc(r)}</span>`).join("")}</div>`;
}
export const legenda = (series) => `<div class="g-leg">${series.map((s) => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}${s.valor != null ? ` <b>${s.valor}</b>` : ""}</span>`).join("")}</div>`;

/** Colunas empilhadas. dados: [{ rot, v: { chave: valor } }], series: [{ k, nome, cor }]. */
export function colunasEmpilhadas({ dados, series, fmt = rsK, altura = 220, nome = "Gráfico" }) {
  const tot = (d) => series.reduce((s, x) => s + Math.max(0, d.v[x.k] || 0), 0);
  const max = teto(Math.max(...dados.map(tot), 0));
  return `<div class="graf" style="--h:${altura}px" role="img" aria-label="${esc(nome)}. Os números estão na tabela logo abaixo.">
    ${legenda(series)}
    <div class="g-corpo"><div class="g-y">${eixoY(max, fmt)}</div>
      <div class="g-plot">${grade()}<div class="g-cols">${dados.map((d) => {
        const t = tot(d), usados = series.filter((x) => d.v[x.k] > 0);
        return `<div class="g-col" tabindex="0" data-tip="${dica([d.rot, ...usados.map((x) => `${x.nome}: ${fmt(d.v[x.k])}`), usados.length > 1 ? `Total: ${fmt(t)}` : ""])}">
          <div class="g-pilha" style="height:${(t / max) * 100}%">${usados.map((x) => `<i style="flex:${d.v[x.k]} 0 0;background:${x.cor}"></i>`).join("")}</div></div>`;
      }).join("")}</div></div></div>
    ${eixoX(dados.map((d) => d.rot))}
  </div>`;
}

/** Colunas lado a lado (poucas séries). dados: [{ rot, v: { chave: valor } }]. */
export function colunasAgrupadas({ dados, series, fmt = rsK, altura = 220, nome = "Gráfico" }) {
  const max = teto(Math.max(...dados.flatMap((d) => series.map((x) => d.v[x.k] || 0)), 0));
  return `<div class="graf" style="--h:${altura}px" role="img" aria-label="${esc(nome)}. Os números estão na tabela logo abaixo.">
    ${legenda(series)}
    <div class="g-corpo"><div class="g-y">${eixoY(max, fmt)}</div>
      <div class="g-plot">${grade()}<div class="g-cols">${dados.map((d) => `<div class="g-col par" tabindex="0" data-tip="${dica([d.rot, ...series.map((x) => `${x.nome}: ${fmt(d.v[x.k] || 0)}`)])}">
          ${series.map((x) => `<div class="g-pilha" style="height:${(Math.max(0, d.v[x.k] || 0) / max) * 100}%"><i style="flex:1;background:${x.cor}"></i></div>`).join("")}</div>`).join("")}</div></div></div>
    ${eixoX(dados.map((d) => d.rot))}
  </div>`;
}

/** Colunas para cima (lucro) e para baixo (prejuízo), a partir da linha do zero. dados: [{ rot, v }]. */
export function colunasSaldo({ dados, fmt = rsK, altura = 200, nome = "Gráfico", rotulo = "Resultado" }) {
  const pos = teto(Math.max(...dados.map((d) => d.v), 0)), neg = Math.min(...dados.map((d) => d.v), 0) < 0 ? teto(-Math.min(...dados.map((d) => d.v))) : 0;
  const faixa = pos + neg, zero = (neg / faixa) * 100;
  return `<div class="graf" style="--h:${altura}px" role="img" aria-label="${esc(nome)}. Os números estão na tabela logo abaixo.">
    <div class="g-leg"><span><i style="background:${COR.bom}"></i>Acima de zero: sobrou</span><span><i style="background:${COR.ruim}"></i>Abaixo de zero: faltou</span></div>
    <div class="g-corpo"><div class="g-y"><span style="bottom:100%">${curto(fmt(pos))}</span><span style="bottom:${zero}%">0</span>${neg ? `<span style="bottom:0">${curto(fmt(-neg))}</span>` : ""}</div>
      <div class="g-plot"><i style="bottom:100%"></i><i class="zero" style="bottom:${zero}%"></i>${neg ? '<i style="bottom:0"></i>' : ""}<div class="g-cols">${dados.map((d) => `<div class="g-col" tabindex="0" data-tip="${dica([d.rot, `${rotulo}: ${fmt(d.v)}`])}">
          ${d.v ? `<div class="g-saldo ${d.v >= 0 ? "up" : "down"}" style="${d.v >= 0 ? `bottom:${zero}%` : `top:${100 - zero}%`};height:${(Math.abs(d.v) / faixa) * 100}%;background:${d.v >= 0 ? COR.bom : COR.ruim}"></div>` : ""}</div>`).join("")}</div></div></div>
    ${eixoX(dados.map((d) => d.rot))}
  </div>`;
}

/** Linha de uma série só. dados: [{ rot, v }] (v nulo vira falha na linha). */
export function linha({ dados, fmt = rsK, altura = 200, nome = "Gráfico", cor = COR.neutro, rotulo = "", doZero = true }) {
  const vs = dados.map((d) => d.v).filter((v) => v != null);
  if (vs.length < 2) return '<p class="empty">Ainda não há meses suficientes para desenhar a linha.</p>';
  // Preço não precisa partir do zero: o eixo pega uma faixa redonda em volta dos valores (4 divisões).
  let lo = 0, max = teto(Math.max(...vs));
  if (!doZero) {
    const a = Math.min(...vs), b = Math.max(...vs), bruto = (b - a || Math.abs(b) * 0.02 || 1) / 3, p = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= bruto);
    lo = Math.floor(a / passo) * passo; max = lo + passo * 4;
    if (max < b) max = lo + passo * 5;
  }
  const n = dados.length, pos = (v) => ((v - lo) / (max - lo)) * 100;
  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v) => 100 - pos(v);
  let caminho = "", aberto = false;
  dados.forEach((d, i) => { if (d.v == null) { aberto = false; return; } caminho += `${aberto ? "L" : "M"}${x(i).toFixed(2)} ${y(d.v).toFixed(2)} `; aberto = true; });
  const ult = dados.map((d, i) => ({ ...d, i })).filter((d) => d.v != null).pop();
  return `<div class="graf linha" style="--h:${altura}px" role="img" aria-label="${esc(nome)}. Os números estão na tabela logo abaixo.">
    <div class="g-corpo"><div class="g-y">${Array.from({ length: 5 }, (_, i) => `<span style="bottom:${i * 25}%">${curto(fmt(lo + ((max - lo) * i) / 4))}</span>`).join("")}</div>
      <div class="g-plot">${grade()}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${caminho}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
        ${dados.map((d, i) => (d.v == null ? "" : `<b class="g-pt${d === dados[ult.i] ? " fim" : ""}" tabindex="0" style="left:${x(i)}%;bottom:${pos(d.v)}%;--c:${cor}" data-tip="${dica([d.rot, `${rotulo}: ${fmt(d.v)}`])}"></b>`)).join("")}
        <span class="g-fim" style="left:${x(ult.i)}%;bottom:${pos(ult.v)}%">${fmt(ult.v)}</span></div></div>
    <div class="g-x linha">${dados.map((d, i) => `<span class="${(n - 1 - i) % Math.max(1, Math.ceil(n / 6)) === 0 ? "" : "opt"}">${esc(d.rot)}</span>`).join("")}</div>
  </div>`;
}

/** Barras deitadas, uma por item, com o valor na ponta. itens: [{ nome, v, sub, cor }]. ref: linha de referência. */
export function barras({ itens, fmt = rsK, cor = COR.neutro, ref = null, vazio = "Nada no período." }) {
  if (!itens.length) return `<p class="empty">${vazio}</p>`;
  const max = Math.max(...itens.map((i) => Math.abs(i.v)), ref ? ref.v : 0) || 1;
  return `<div class="g-barras">${ref ? `<div class="g-leg"><span><i class="traco"></i>${esc(ref.nome)}: <b>${fmt(ref.v)}</b></span></div>` : ""}
    ${itens.map((i) => `<div class="g-b" tabindex="0" data-tip="${dica([i.nome, fmt(i.v), i.sub])}"><span class="n">${esc(i.nome)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>
      <span class="t">${ref ? `<u style="left:${(ref.v / max) * 100}%"></u>` : ""}<i style="width:${(Math.abs(i.v) / max) * 100}%;background:${i.cor || cor}"></i></span><span class="v">${fmt(i.v)}</span></div>`).join("")}</div>`;
}

/** Um todo dividido em partes (barra alta com a % dentro quando cabe) e a legenda com os valores. */
export function partes({ itens, fmt = rsK, nome = "Divisão" }) {
  const tot = itens.reduce((s, i) => s + Math.max(0, i.v), 0);
  if (!tot) return '<p class="empty">Nada no período.</p>';
  const us = itens.filter((i) => i.v > 0);
  return `<div class="g-partes" role="img" aria-label="${esc(nome)}: ${us.map((i) => `${i.nome} ${Math.round((i.v / tot) * 100)}%`).join(", ")}">
    ${us.map((i) => { const p = (i.v / tot) * 100; return `<i tabindex="0" style="flex:${i.v} 0 0;background:${i.cor};color:${i.claro ? "#14201A" : "#fff"}" data-tip="${dica([i.nome, fmt(i.v), Math.round(p) + "% do total"])}">${p >= 9 ? Math.round(p) + "%" : ""}</i>`; }).join("")}</div>
    ${legenda(us.map((i) => ({ nome: i.nome, cor: i.cor, valor: fmt(i.v) })))}`;
}

// ------------------------------------------------------------ balão com o valor (mouse, teclado e toque)
let balao = null;
function mostrar(el) {
  if (!balao) { balao = document.createElement("div"); balao.className = "g-tip"; balao.setAttribute("role", "tooltip"); document.body.append(balao); }
  const [t, ...l] = el.dataset.tip.split("|");
  balao.innerHTML = `<b>${esc(t)}</b>${l.map((x) => `<span>${esc(x)}</span>`).join("")}`;
  balao.hidden = false;
  const r = el.getBoundingClientRect(), w = balao.offsetWidth, h = balao.offsetHeight;
  const x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  const y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
  balao.style.left = x + scrollX + "px"; balao.style.top = y + scrollY + "px";
}
const esconder = () => { if (balao) balao.hidden = true; };
document.addEventListener("pointerover", (e) => { const el = e.target.closest?.("[data-tip]"); if (el) mostrar(el); else esconder(); });
document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-tip]"); if (el) mostrar(el); else esconder(); });
document.addEventListener("scroll", esconder, true);
addEventListener("hashchange", esconder);
