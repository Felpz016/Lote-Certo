// Gaveta do lote: situação de hoje, custos acumulados, histórico completo e correções.
import {
  store, S, M, $, $$, esc, d2, n0, n1, n2, n3, rs, fmtGmd, gmdCls, num, sexoPill, tagLote, toast, msgSalvo, erros,
  lotePorId, nomeDe, campo, confirmar, hoje, soCampo, pct,
} from "./base.js";
import { calcGmd, fechamento, projecao, CATEGORIAS, loteRaiz, quebraDe, cabEntrada, carenciasAbertas } from "./calc.js";
import { camposLote, ligarCamposLote, lerLote } from "./telas-lotes.js";

let drawer = null; // { loteId, editando }
export const drawerAberto = () => !!drawer;
export const drawerEditando = () => !!drawer && drawer.editando;
export function abrirLote(id) { drawer = { loteId: id, editando: false }; renderDrawer(); }
export function fecharLote() { drawer = null; $("#layer").innerHTML = ""; }

// Uma cor por tipo de custo, a mesma em todas as telas e gráficos.
export const CORES = { aquisicao: "#2a78d6", pasto: "#008300", trato: "#eda100", sanidade: "#e34948", fixos: "#6250d6", gerais: "#1baf7a" };

export function blocoCustos(c, total) {
  return `<div class="barra gap" role="img" aria-label="Divisão do custo: ${CATEGORIAS.filter(([k]) => c[k] > 0).map(([k, n]) => `${n} ${Math.round((c[k] / total) * 100)}%`).join(", ")}">${CATEGORIAS.map(([k, n]) => (c[k] > 0 ? `<i title="${n}: ${rs(c[k])}" style="width:${(c[k] / total) * 100}%;background:${CORES[k]}"></i>` : "")).join("")}</div>
  <div class="custos">${CATEGORIAS.map(([k, n]) => `<div><span class="label"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${CORES[k]};margin-right:5px"></i>${n}</span><b>${rs(c[k])}</b></div>`).join("")}
  <div class="tot" style="grid-column:1/-1"><span class="label">Custo total do lote</span><b style="font-size:20px">${rs(total)}</b></div></div>`;
}

export function blocoFechamento(r, s) {
  const f = fechamento(r, s);
  const cls = f.resultado == null ? "" : f.resultado >= 0 ? "pos" : "neg";
  return `<div class="calc">
    ${s.tipo === "abate" ? `<div><span class="label">Rendimento ${f.rend == null ? "" : f.rendReal ? "real" : "esperado"}</span><b>${f.rend == null ? "—" : n1(f.rend) + "%"}</b></div>
    <div><span class="label">Arrobas</span><b>${f.arrobas == null ? "—" : n1(f.arrobas) + " @"}</b></div>` : `<div><span class="label">Peso vivo total</span><b>${f.pesoTotal ? n0(f.pesoTotal) + " kg" : "—"}</b></div><div><span class="label">GMD do período</span><b>${fmtGmd(f.gmdPeriodo)}</b></div>`}
    <div><span class="label">Receita</span><b>${rs(f.receita, 0)}</b></div>
    <div><span class="label">Custo total</span><b>${rs(f.custoTotal, 0)}</b></div>
    <div><span class="label">Custo/dia com a compra</span><b>${rs(f.custoDia)}</b><span class="note">${rs(f.custoCabDia)} por cabeça</span></div>
    <div><span class="label">Custo/dia só produção</span><b>${rs(f.custoDiaProd)}</b><span class="note">${rs(f.custoCabDiaProd)} por cabeça</span></div>
    ${s.tipo === "abate" ? `<div><span class="label">GMD do período</span><b>${fmtGmd(f.gmdPeriodo)}</b></div>` : "<div></div>"}
    <div class="res"><span class="label">Resultado do lote</span><b class="${cls}">${rs(f.resultado, 0)}</b><span class="note">${f.resultadoCab == null ? "" : rs(f.resultadoCab) + " por cabeça"}</span></div>
    <span class="formula">${r.dias} dias na fazenda · ${s.tipo === "abate" ? "arrobas = peso vivo × rendimento ÷ 15" : "receita = peso vivo × R$/kg"} · resultado = receita − custo total</span>
    <div><span class="label">Arrobas produzidas</span><b>${f.arrobasProd == null ? "—" : n1(f.arrobasProd) + " @"}</b><span class="note">entrou com ${n1(f.arrobasEntrada)} @</span></div>
    <div><span class="label">Custo por @ produzida</span><b>${rs(f.custoArrobaProd)}</b><span class="note">sem a compra</span></div>
    <div><span class="label">Rentabilidade</span><b class="${cls}">${pct(f.rentab)}</b><span class="note">sobre o valor da compra</span></div>
    <div><span class="label">Rentabilidade ao mês</span><b class="${cls}">${pct(f.rentabMes, 2)}</b><span class="note">${f.meses == null ? "" : n1(f.meses) + " meses na fazenda"}</span></div>
    <span class="formula">Arrobas produzidas = (peso de saída × ${n1(f.rendProd)}% − peso de entrada × ${n1(r.cfg.rendEntrada)}%) ÷ 15 · custo por @ produzida = custo de produção ÷ arrobas produzidas · rentabilidade = resultado ÷ custo de aquisição</span>
  </div>`;
}

export function renderDrawer() {
  const l = drawer && lotePorId(drawer.loteId);
  if (!l) { fecharLote(); return; }
  const m = M(), r = m.lote(l.id), sai = r.saida;
  const db = S.db;
  const da = (col) => db[col].filter((x) => x.loteId === l.id);
  const pes = da("pesagens"), san = da("sanidade"), movs = da("movs"), tratos = da("tratos"), gmds = da("gmds"), mor = da("mortes");
  const sc = soCampo();
  const logs = (db.log || []).filter((x) => x.loteId === l.id).sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const por = (x) => (x && x.criadoPor ? `Lançado por ${x.criadoPor}${x.criadoEm ? " em " + quando(x.criadoEm) : ""}${x.atualizadoPor && x.atualizadoEm !== x.criadoEm ? ` · corrigido por ${x.atualizadoPor} em ${quando(x.atualizadoEm)}` : ""}` : "");
  const q0 = cabEntrada(l), quebra = quebraDe(l);
  const filhos = db.lotes.filter((x) => x.origemId === l.id);
  const pai = l.origemId ? lotePorId(l.origemId) : null;
  const ini = { mov: movs.find((x) => x.inicial), trato: tratos.find((x) => x.inicial) };

  const evs = [
    { k: "ent", data: l.dataEntrada, lab: pai ? "Apartação" : "Entrada", por: por(l), t: pai ? `Originado do lote ${pai.numero}${l.criterio ? ", critério: " + l.criterio : ""}` : `Entrada de ${q0} ${l.sexo === "M" ? "machos" : "fêmeas"}`,
      x: [`${q0} cab. · ${n0(l.pesoEntrada)} kg/cabeça${pai ? "" : " na chegada"}${l.raca ? " · " + l.raca : ""}${l.idadeMeses != null ? " · " + l.idadeMeses + " meses" : ""}`,
        quebra != null ? `Comprado com ${n0(l.pesoCompra)} kg/cabeça · quebra no transporte de ${n1(quebra)}%` : "",
        l.custoKg != null && !sc ? `${rs(l.custoKg)}/kg · comissão ${rs(l.comissao || 0)} · frete ${rs(l.frete || 0)}` : "",
        l.origem ? "Origem: " + l.origem : "", [l.gta && "GTA " + l.gta, l.nf && "NF " + l.nf].filter(Boolean).join(" · "),
        `GMD estimado ${n3(l.gmdEst || 0)} kg/dia${l.pesoAlvo ? " · peso-alvo " + n0(l.pesoAlvo) + " kg" : ""}`, l.obs ? "Obs.: " + l.obs : ""].filter(Boolean).join("\n") },
    ...mor.map((x) => ({ k: "san", lab: "Morte ou perda", data: x.data, por: por(x), t: `${x.cabecas} ${x.cabecas === 1 ? "cabeça" : "cabeças"} · ${x.causa || "causa não informada"}`, x: x.obs || "" })),
    ...movs.map((x) => ({ k: "pasto", lab: "Pasto", col: x.inicial ? null : "movs", id: x.id, data: x.data, t: (x.inicial ? "Entrou no " : "Mudou para ") + nomeDe("pastos", x.pastoId, "sem pasto"), x: x.piquete ? "Piquete " + x.piquete : "", por: por(x) })),
    ...tratos.filter((x) => !x.inicial || x.dietaId).map((x) => ({ k: "trato", lab: "Trato", col: x.inicial ? null : "tratos", id: x.id, data: x.data, t: x.dietaId ? "Dieta " + nomeDe("dietas", x.dietaId, "(excluída)") : "Sem trato (só pasto)", x: "", por: por(x) })),
    ...gmds.map((x) => ({ k: "peso", lab: "Ajuste de GMD", col: "gmds", id: x.id, data: x.data, t: `GMD estimado passa a ${n3(x.gmd)} kg/dia`, x: x.motivo || "", por: por(x) })),
    ...pes.map((p) => { const c = calcGmd(db, l, p); return { k: "peso", lab: "Pesagem", col: "pesagens", id: p.id, data: p.data, t: `${n1(p.peso)} kg/cabeça na balança`, x: `GMD real ${fmtGmd(c.gmd)} kg/dia em ${c.dias} dias`, por: por(p) }; }),
    ...san.map((s) => {
      const med = s.medId ? nomeDe("meds", s.medId, "(medicamento excluído)") : s.procedimento || "Manejo";
      return { k: "san", lab: s.tipo === "tratamento" ? "Tratamento" : "Protocolo", col: "sanidade", id: s.id, data: s.data, t: (s.doenca ? s.doenca + " · " : "") + med,
        por: por(s), x: [s.ml != null ? `${n1(s.ml)} ml no lote` : s.doseMl != null ? `${n1(s.doseMl)} ml por animal` : "", s.animais ? `${s.animais} animais tratados` : ""].filter(Boolean).join(" · ") };
    }),
    ...(l.apartadoEm ? [{ k: "ent", lab: "Apartação", data: l.apartadoEm, t: `Apartado em ${filhos.length} lotes${l.criterio ? ", critério: " + l.criterio : ""}`, x: filhos.map((f) => `${f.numero}: ${f.quantidade} cab.`).join("\n") }] : []),
    ...(sai ? [{ k: "ent", lab: "Saída", data: sai.data, t: sai.tipo === "abate" ? "Saída para abate" : sai.tipo === "vivo" ? "Venda viva" : `Saída · ${sai.motivo || ""}`, por: por(sai), x: [sai.destino, sai.peso ? n0(sai.peso) + " kg/cabeça" : "", sai.gta && "GTA " + sai.gta, sai.nf && "NF " + sai.nf, sai.obs].filter(Boolean).join(" · ") }] : []),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const podeExcluir = !pes.length && !san.length && !mor.length && !sai && !l.apartadoEm && !pai;
  const podeDesfazerApart = l.apartadoEm && filhos.every((f) => f.ativo && !["pesagens", "sanidade", "saidas", "mortes", "fornecimentos"].some((c) => db[c].some((x) => x.loteId === f.id)) && !db.lotes.some((x) => x.origemId === f.id));
  const situacao = l.ativo ? "Lote ativo" : l.apartadoEm ? "Lote apartado" : "Lote encerrado";

  let corpo;
  if (drawer.editando) {
    corpo = `<form class="card" id="fEdit" novalidate><h3>Corrigir dados do lote</h3>${camposLote(l, "ed", { pastoId: ini.mov?.pastoId, piquete: ini.mov?.piquete, dietaId: ini.trato?.dietaId }, !!pai)}
        <div class="calc" id="ed-calc"></div>
        <p class="note">Pasto e trato aqui são os do dia da entrada. Para trocar depois, use Mudança de pasto e Trato do dia.</p>
        <div class="actions"><button class="btn" type="submit">Salvar alterações</button><button class="btn ghost" type="button" id="cancelEdit">Cancelar</button></div></form>`;
  } else {
    corpo = `
      <div class="facts">
        <div><span class="label">Dias na fazenda</span><b>${r.dias}</b></div>
        <div><span class="label">${sai && sai.peso ? "Peso na saída" : l.ativo ? "Peso atual" : "Peso final"}</span><b>${n0(r.pesoFinal)} <small>kg${sai && sai.peso ? "" : " est."}</small></b></div>
        <div><span class="label">GMD est. · real</span><b>${n3(r.gmdEst)} <small class="${gmdCls(r.gmdReal)}">${fmtGmd(r.gmdReal)}</small></b></div>
        ${l.ativo ? `
        ${sc ? "" : `<div><span class="label">Custo de hoje</span><b>${rs(r.hoje.total, 0)} <small>${rs(r.hoje.total / l.quantidade)}/cab</small></b></div>`}
        <div><span class="label">Consumo</span><b>${r.consumo ? n2(r.consumo.pv) + "% <small>PV" + (r.consumo.base === "ms" ? " MS" : "") + " · " + n0(r.consumo.kgLote) + " kg/dia</small>" : "Pasto"}</b></div>
        <div><span class="label">Pasto</span><b style="font-size:20px">${esc(nomeDe("pastos", r.pastoId, "Sem pasto"))}</b></div>
        ${r.alvo ? `<div><span class="label">Peso-alvo ${n0(r.alvo.peso)} kg</span><b style="font-size:20px">${r.alvo.falta <= 0 ? "Chegou" : r.alvo.data ? d2(r.alvo.data) : "Sem previsão"}</b><small class="note">${r.alvo.falta <= 0 ? "já está no peso" : r.alvo.dias != null ? "em " + r.alvo.dias + " dias" : "GMD estimado zerado"}</small></div>` : ""}
        ${sc ? "" : `<div><span class="label">Custo por @ produzida</span><b>${r.custoArrobaProdEst == null ? "—" : rs(r.custoArrobaProdEst, 0)} <small>est.</small></b></div>`}` : ""}
        ${r.mortes ? `<div><span class="label">Mortalidade</span><b>${n1(r.mortalidade)}% <small>${r.mortes} de ${r.cabEntrada}</small></b></div>` : ""}
      </div>
      ${l.ativo && !sc ? `<p class="note">Custo de hoje: pasto ${rs(r.hoje.pasto)} · trato ${rs(r.hoje.trato)}${r.consumo && r.consumo.real ? " (fornecido de verdade)" : ""} · fixos ${rs(r.hoje.fixos)} · gerais ${rs(r.hoje.gerais)}</p>` : ""}
      ${(() => { const c = l.ativo ? carenciasAbertas(db, l, hoje()) : []; return c.length ? `<div class="banner"><span><b>Em carência para abate até ${d2(c[0].livre)}.</b> ${c.map((x) => `${esc(x.med)} aplicado em ${d2(x.aplicado)} (${x.carencia} dias)`).join(" · ")}</span></div>` : ""; })()}
      ${pai ? `<p class="note">Originado do lote <button class="link" type="button" data-act="lote" data-id="${pai.id}">${esc(pai.numero)}</button>. Os custos abaixo incluem a parte herdada dele, por cabeça. Entrada original em ${d2(loteRaiz(db, l).dataEntrada)}.</p>` : ""}
      ${filhos.length ? `<p class="note">Lotes derivados: ${filhos.map((f) => `<button class="link" type="button" data-act="lote" data-id="${f.id}">${esc(f.numero)}</button>`).join(" · ")}</p>` : ""}
      ${sc ? "" : `<section class="card"><div class="sec-h"><h3>Custo acumulado</h3><span class="note">${l.ativo ? "até ontem" : "até o encerramento"}</span></div>${blocoCustos(r.custos, r.total || 1)}</section>`}
      ${l.ativo && !sc ? (() => { const pj = projecao(r); return `<section class="card"><div class="sec-h"><h3>Projeção de venda</h3><button class="link" type="button" data-act="ir" data-to="financeiro/projecao">Mudar o preço</button></div>
        <div class="calc">
          <div><span class="label">Venda prevista</span><b>${pj.temAlvo ? d2(pj.data) : "Hoje"}</b><span class="note">${n0(pj.pesoVenda)} kg/cabeça${pj.temAlvo ? " · em " + pj.dias + " dias" : r.alvo ? "" : " · sem peso-alvo"}</span></div>
          <div><span class="label">Receita esperada</span><b>${rs(pj.receita, 0)}</b><span class="note">${n1(pj.arrobas)} @ a ${rs(pj.preco)}</span></div>
          <div><span class="label">Preço que empata</span><b>${rs(pj.equilibrio)}</b><span class="note">por arroba</span></div>
          <div class="res"><span class="label">Resultado esperado</span><b class="${pj.resultado >= 0 ? "pos" : "neg"}">${rs(pj.resultado, 0)}</b><span class="note">${rs(pj.resultadoCab)} por cabeça</span></div>
          <span class="formula">Rendimento de ${n1(pj.rend)}% · custo até a venda de ${rs(pj.custo, 0)} (o acumulado mais o custo de hoje repetido nos dias que faltam) · preço que empata = custo ÷ arrobas</span>
        </div></section>`; })() : ""}
      ${sai && sai.tipo && !sc ? `<section class="card"><div class="sec-h"><h3>Fechamento da saída</h3><span class="note">${d2(sai.data)}${sai.destino ? " · " + esc(sai.destino) : ""}</span></div>${blocoFechamento(r, sai)}
        ${sai.tipo === "abate" ? `<form class="rowf" id="fRend" novalidate style="margin-top:12px">${campo("rd-real", "Rendimento real de carcaça (%)", { tipo: "number", v: sai.rendReal, ph: "quando chegar o romaneio" })}<button class="btn ghost" type="submit">Salvar rendimento</button></form>` : ""}</section>` : ""}
      <div class="actions"${sc ? " hidden" : ""}>
        <button class="btn ghost sm" type="button" id="editLote">Corrigir dados do lote</button>
        ${sai ? '<button class="btn ghost sm" type="button" id="desfazSaida" data-confirm="Confirmar: voltar para ativos">Desfazer saída</button>' : ""}
        ${podeDesfazerApart ? '<button class="btn ghost sm" type="button" id="desfazApart" data-confirm="Confirmar: desfazer a apartação">Desfazer apartação</button>' : ""}
        ${podeExcluir ? '<button class="mini danger" type="button" id="excluiLote" data-confirm="Confirmar exclusão do lote">Excluir lote</button>' : ""}
      </div>
      <section class="card"><div class="sec-h"><h3>Histórico completo</h3></div><div class="timeline">
        ${evs.map((e) => `<div class="ev"><span class="d">${d2(e.data)}</span><div><span class="tag ${e.k}">${e.lab}</span><div class="t">${esc(e.t)}</div>${e.x ? `<div class="x">${esc(e.x)}</div>` : ""}${e.por ? `<div class="quem">${esc(e.por)}</div>` : ""}${e.col && !sc ? `<div class="acts"><button class="mini danger" type="button" data-del="${e.col}" data-id="${e.id}" data-confirm="Confirmar exclusão">Excluir</button></div>` : ""}</div></div>`).join("")}
      </div></section>
      ${logs.length ? `<section class="card"><div class="sec-h"><h3>Correções e exclusões</h3><span class="note">${logs.length}</span></div><div class="timeline">
        ${logs.slice(0, 40).map((x) => `<div class="ev"><span class="d">${quando(x.quando)}</span><div><span class="tag ${x.acao === "excluiu" ? "san" : "ent"}">${x.acao === "excluiu" ? "Excluiu" : "Corrigiu"}</span><div class="t">${esc(x.oque)}${x.dataDoc ? " de " + d2(x.dataDoc) : ""}</div><div class="quem">${esc(x.quem || "")}${x.campos ? " · mudou: " + esc(x.campos) : ""}</div></div></div>`).join("")}
      </div></section>` : ""}`;
  }

  $("#layer").innerHTML = `<div class="scrim" id="scrim"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Lote ${esc(l.numero)}">
    <div class="dh"><div><span class="kicker">${situacao}</span><h2>${esc(l.numero)}</h2><div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">${sexoPill(l.sexo)}<span class="note">${l.quantidade} cabeças${r.mortes ? ` (entraram ${r.cabEntrada})` : ""}${l.raca ? " · " + esc(l.raca) : ""} · entrou em ${d2(l.dataEntrada)}</span></div></div>
    <button class="btn ghost sm" type="button" id="fechaLote">Fechar</button></div>
    ${corpo}
  </aside>`;

  $("#scrim").onclick = fecharLote;
  $("#fechaLote").onclick = fecharLote;
  if (drawer.editando) {
    const f = $("#fEdit");
    ligarCamposLote(f, "ed", $("#ed-calc"));
    $("#cancelEdit").onclick = () => { drawer.editando = false; renderDrawer(); };
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const { dados, extra, ok } = lerLote(f, "ed", l.id, !!pai);
      if (!ok) return;
      drawer.editando = false;
      const ops = [{ tipo: "update", col: "lotes", id: l.id, dados }];
      const mv = { loteId: l.id, data: dados.dataEntrada, pastoId: extra.pastoId, piquete: extra.piquete || "", inicial: true };
      const tr = { loteId: l.id, data: dados.dataEntrada, dietaId: extra.dietaId, inicial: true };
      ops.push(ini.mov ? { tipo: "update", col: "movs", id: ini.mov.id, dados: mv } : { tipo: "set", col: "movs", id: store.novoId(), dados: mv });
      ops.push(ini.trato ? { tipo: "update", col: "tratos", id: ini.trato.id, dados: tr } : { tipo: "set", col: "tratos", id: store.novoId(), dados: tr });
      store.gravar(ops);
      toast(`Lote ${dados.numero} atualizado. ${msgSalvo()}`);
    };
    return;
  }
  $("#editLote").onclick = () => { drawer.editando = true; renderDrawer(); $("#ed-num").focus(); };
  const fr = $("#fRend");
  if (fr) fr.onsubmit = (ev) => {
    ev.preventDefault();
    const v = $("#rd-real").value.trim() === "" ? null : num($("#rd-real").value);
    if (!erros(fr, v != null && (v <= 0 || v > 100) ? [["rd-real", "Informe um percentual entre 1 e 100."]] : [])) return;
    store.gravar([{ tipo: "update", col: "saidas", id: sai.id, dados: { rendReal: v } }]);
    toast(v == null ? "Rendimento real apagado. Vale o esperado." : `Rendimento real de ${n1(v)}% salvo. ${msgSalvo()}`);
  };

  confirmar($("#desfazSaida"), () => {
    store.gravar([{ tipo: "delete", col: "saidas", id: sai.id }, { tipo: "update", col: "lotes", id: l.id, dados: { ativo: true } }]);
    toast(`Saída desfeita. ${l.numero} voltou para os lotes ativos.`);
  });
  confirmar($("#desfazApart"), () => {
    const ops = [{ tipo: "update", col: "lotes", id: l.id, dados: { ativo: true, apartadoEm: null, criterio: null } }];
    for (const f of filhos) {
      ops.push({ tipo: "delete", col: "lotes", id: f.id });
      for (const c of ["movs", "tratos", "gmds"]) db[c].filter((x) => x.loteId === f.id).forEach((x) => ops.push({ tipo: "delete", col: c, id: x.id }));
    }
    store.gravar(ops);
    toast(`Apartação desfeita. ${l.numero} voltou para os lotes ativos.`);
  });
  confirmar($("#excluiLote"), () => {
    const ops = [{ tipo: "delete", col: "lotes", id: l.id }];
    for (const c of ["movs", "tratos", "gmds"]) db[c].filter((x) => x.loteId === l.id).forEach((x) => ops.push({ tipo: "delete", col: c, id: x.id }));
    store.gravar(ops);
    fecharLote();
    toast(`Lote ${l.numero} excluído.`);
  });
  $$("[data-del]", $(".drawer")).forEach((b) => confirmar(b, () => {
    store.gravar([{ tipo: "delete", col: b.dataset.del, id: b.dataset.id }]);
    toast("Lançamento excluído.");
  }));
}

export { tagLote };
