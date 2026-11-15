// Sanidade: protocolo (lote inteiro), tratamento (doença) e catálogo de medicamentos com preço por data.
import {
  store, S, M, $, $$, esc, d2, n0, n1, n2, rs, num, tagLote, toast, msgSalvo, erros, ativos, lotePorId, nomeDe, ordenados, porId,
  opcoesLotes, opcoes, campo, campoData, sel, seg, val, marcado, confirmar, histPrecos, comPreco, TELAS, hoje, soCampo, nomeLote,
} from "./base.js";
import { precoMl, vigente, nDia, isoDia, dias } from "./calc.js";

const custoSan = (s) => (s.medId ? (s.ml || 0) * precoMl(porId("meds", s.medId), s.data) : 0);
const opcoesMed = (v) => opcoes("meds", v, S.db.meds.length ? "Escolha o medicamento" : "Nenhum medicamento cadastrado");
const semMeds = () => `<div class="banner"><span><b>Cadastre os medicamentos primeiro.</b> O custo da aplicação sai do preço do frasco.</span><button class="btn sm" type="button" data-act="ir" data-to="sanidade/medicamentos">Cadastrar medicamento</button></div>`;
const nomeSan = (s) => (s.medId ? nomeDe("meds", s.medId, "(medicamento excluído)") : s.procedimento || "Manejo");
const mlSan = (s) => (s.ml != null ? s.ml : s.doseMl != null ? s.doseMl * (lotePorId(s.loteId)?.quantidade || 0) : null);

function atualizarLotes(id) {
  const el = $("#" + id);
  if (el) el.innerHTML = opcoesLotes(ativos(), el.value);
}

/** Custo sanitário por lote ativo, separando protocolo e tratamento. */
function resumoPorLote() {
  if (soCampo()) return "";
  const linhas = M().ativos.map((r) => {
    const san = S.db.sanidade.filter((s) => s.loteId === r.lote.id);
    const pro = san.filter((s) => s.tipo !== "tratamento").reduce((t, s) => t + custoSan(s), 0);
    const tra = san.filter((s) => s.tipo === "tratamento").reduce((t, s) => t + custoSan(s), 0);
    return { r, pro, tra, tot: pro + tra };
  }).filter((x) => x.tot > 0);
  if (!linhas.length) return "";
  return `<section class="card"><div class="sec-h"><h3>Custo sanitário por lote</h3><span class="note">lotes ativos</span></div>
  <div class="tw"><table><thead><tr><th>Lote</th><th class="r">Protocolo</th><th class="r">Tratamento</th><th class="r">Total</th><th class="r">Por cabeça</th></tr></thead><tbody>
  ${linhas.map((x) => `<tr class="click" data-act="lote" data-id="${x.r.lote.id}"><td>${tagLote(x.r.lote)}</td><td class="r">${rs(x.pro)}</td><td class="r">${rs(x.tra)}</td><td class="r"><b>${rs(x.tot)}</b></td><td class="r">${rs(x.tot / x.r.lote.quantidade)}</td></tr>`).join("")}
  </tbody></table></div></section>`;
}

function historico(tipo) {
  const lista = S.db.sanidade.filter((s) => (tipo === "tratamento" ? s.tipo === "tratamento" : s.tipo !== "tratamento")).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 80);
  if (!lista.length) return `<section class="card"><p class="empty">Nenhum ${tipo === "tratamento" ? "tratamento" : "protocolo"} lançado ainda.</p></section>`;
  const trat = tipo === "tratamento";
  return `<section class="card"><div class="sec-h"><h3>${trat ? "Tratamentos lançados" : "Protocolos lançados"}</h3><span class="note">toque na linha para abrir o lote</span></div>
  <div class="tw"><table><thead><tr><th>Data</th><th>Lote</th>${trat ? "<th>Doença</th>" : ""}<th>Medicamento</th><th class="r">ml</th>${trat ? '<th class="r">Animais</th>' : '<th class="r">ml/cab</th>'}${soCampo() ? "" : '<th class="r">Custo</th>'}<th>Carência até</th></tr></thead><tbody>
  ${lista.map((s) => {
    const l = lotePorId(s.loteId), ml = mlSan(s), c = custoSan(s);
    return `<tr class="click" data-act="lote" data-id="${s.loteId}"><td>${d2(s.data)}</td><td>${tagLote(l)}</td>${trat ? `<td>${esc(s.doenca || "—")}</td>` : ""}<td>${esc(nomeSan(s))}</td><td class="r">${ml == null ? "—" : n1(ml)}</td>
      <td class="r">${trat ? (s.animais || "—") : (s.mlCab != null ? n1(s.mlCab) : s.doseMl != null ? n1(s.doseMl) : l && ml != null && l.quantidade ? n1(ml / l.quantidade) : "—")}</td>${soCampo() ? "" : `<td class="r">${s.medId ? rs(c) : "—"}</td>`}<td>${carAte(s)}</td></tr>`;
  }).join("")}
  </tbody></table></div><p class="note" style="margin-top:10px">Para apagar um lançamento, abra o lote e use Excluir no histórico.</p></section>`;
}

const carAte = (s) => { const m = s.medId ? porId("meds", s.medId) : null; if (!m || !(m.carencia > 0)) return "—"; const d = isoDia(nDia(s.data) + m.carencia); return d > hoje() ? `<span class="pill est">${d2(d)}</span>` : d2(d); };

// ------------------------------------------------------------ protocolo
let nLinhas = 1;
const linhaMed = (i) => `<div class="rowf" data-linha="${i}">${sel("s-med-" + i, i ? "Outro medicamento" : "Medicamento", opcoesMed())}${campo("s-ml-" + i, "Quantidade (ml)", { tipo: "number", ph: "5" })}</div>`;

function calcProtocolo() {
  const box = $("#s-calc");
  if (!box) return;
  const l = lotePorId(val("s-lote")), data = val("s-data") || hoje(), porCab = marcado("s-modo") !== "tot";
  let ml = 0, custo = 0, n = 0, maiorCar = 0;
  for (let i = 0; i < nLinhas; i++) {
    const med = porId("meds", val("s-med-" + i)), q = num(val("s-ml-" + i));
    if (!med || !q || !l) continue;
    if (med.carencia > maiorCar) maiorCar = med.carencia;
    const tot = porCab ? q * l.quantidade : q;
    ml += tot; custo += tot * precoMl(med, data); n++;
  }
  if (!l || !n) { box.innerHTML = '<span class="formula">Escolha o lote, o medicamento e a quantidade para ver o custo.</span>'; return; }
  box.innerHTML = `
    <div><span class="label">Total aplicado</span><b>${n1(ml)} ml</b><span class="note">${l.quantidade} cabeças</span></div>
    ${soCampo() ? "" : `<div><span class="label">Custo por cabeça</span><b>${rs(custo / l.quantidade)}</b></div>
    <div class="res"><span class="label">Custo do protocolo</span><b>${rs(custo)}</b><span class="note">entra no custo do lote</span></div>`}
    ${maiorCar ? `<div><span class="label">Carência para abate</span><b>${d2(isoDia(nDia(data) + maiorCar))}</b><span class="note">${maiorCar} dias depois da aplicação</span></div>` : ""}
    <span class="formula">${soCampo() ? "" : `Custo = ml total × preço por ml que valia em ${d2(data)}.`}</span>`;
}

TELAS["sanidade/protocolo"] = {
  form: () => {
    nLinhas = 1;
    return `${S.db.meds.length ? "" : semMeds()}
    <form class="card" id="fSan" novalidate>
      <div class="fgrid">
        ${sel("s-lote", "Lote", opcoesLotes(ativos()))}
        ${campoData("s-data", "Data da aplicação")}
        ${seg("s-modo", "A quantidade é", [["cab", "ml por cabeça"], ["tot", "ml no lote todo"]], "cab")}
        ${campo("s-ref", "Agendar reforço daqui a (dias)", { tipo: "number", modo: "numeric", passo: 1, ph: "opcional. Ex.: 30", hint: "Aparece como pendência no painel na data." })}
      </div>
      <div class="rows" id="s-linhas">${linhaMed(0)}</div>
      <div class="actions" style="margin-top:8px"><button class="btn ghost sm" type="button" id="s-mais">Adicionar outro medicamento</button></div>
      <div class="calc" id="s-calc" aria-live="polite"></div>
      <div class="actions"><button class="btn" type="submit">Salvar protocolo</button><span class="note">Protocolo é o manejo feito no lote inteiro: vacina, vermífugo, entrada.</span></div>
    </form>`;
  },
  atualizarForm() {
    atualizarLotes("s-lote");
    for (let i = 0; i < nLinhas; i++) { const el = $("#s-med-" + i); if (el) el.innerHTML = opcoesMed(el.value); }
    calcProtocolo();
  },
  ligar() {
    const f = $("#fSan");
    f.addEventListener("input", calcProtocolo);
    f.addEventListener("change", calcProtocolo);
    $("#s-mais").onclick = () => { $("#s-linhas").insertAdjacentHTML("beforeend", linhaMed(nLinhas++)); };
    calcProtocolo();
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const l = lotePorId(val("s-lote")), data = val("s-data"), porCab = marcado("s-modo") !== "tot";
      const e = [], itens = [];
      if (!l) e.push(["s-lote", "Escolha o lote."]);
      if (!data) e.push(["s-data", "Informe a data."]);
      else if (data > hoje()) e.push(["s-data", "A data não pode ser no futuro."]);
      else if (l && data < l.dataEntrada) e.push(["s-data", `O lote entrou em ${d2(l.dataEntrada)}.`]);
      for (let i = 0; i < nLinhas; i++) {
        const medId = val("s-med-" + i), q = num(val("s-ml-" + i));
        if (!medId && !q && i > 0) continue;
        if (!medId) e.push(["s-med-" + i, "Escolha o medicamento."]);
        if (!q || q <= 0) e.push(["s-ml-" + i, "Informe a quantidade em ml."]);
        if (medId && q > 0 && l) itens.push({ medId, ml: porCab ? q * l.quantidade : q, mlCab: porCab ? q : q / l.quantidade });
      }
      const ref = num(val("s-ref"));
      if (ref != null && (ref < 1 || !Number.isInteger(ref))) e.push(["s-ref", "Informe os dias (número inteiro) ou deixe em branco."]);
      if (!erros(f, e)) return;
      let custo = 0;
      const ops = itens.map((it) => {
        const dados = { loteId: l.id, data, tipo: "protocolo", ...it };
        custo += custoSan(dados);
        return { tipo: "set", col: "sanidade", id: store.novoId(), dados };
      });
      const reforco = ref ? isoDia(nDia(data) + ref) : null;
      if (reforco) ops.push({ tipo: "set", col: "agenda", id: store.novoId(), dados: { loteId: l.id, data: reforco, descricao: "Reforço: " + itens.map((it) => nomeDe("meds", it.medId)).join(" + "), feito: false } });
      store.gravar(ops);
      toast(`Protocolo do ${l.numero} salvo${soCampo() ? "" : ": " + rs(custo)}.${reforco ? " Reforço agendado para " + d2(reforco) + "." : ""} ${msgSalvo()}`);
      $("#s-ref").value = "";
      nLinhas = 1;
      $("#s-linhas").innerHTML = linhaMed(0);
      calcProtocolo();
    };
  },
  lista: () => resumoPorLote() + historico("protocolo"),
};

// ------------------------------------------------------------ tratamento
function calcTratamento() {
  const box = $("#t-calc");
  if (!box) return;
  const l = lotePorId(val("t-lote")), med = porId("meds", val("t-med")), ml = num(val("t-ml")), data = val("t-data") || hoje(), an = num(val("t-an"));
  if (!l || !med || !ml) { box.innerHTML = '<span class="formula">Escolha o lote, o medicamento e a quantidade para ver o custo.</span>'; return; }
  const c = ml * precoMl(med, data);
  box.innerHTML = `
    ${soCampo() ? "" : `<div><span class="label">Preço na data</span><b>${rs(precoMl(med, data))}/ml</b></div>
    <div><span class="label">${an ? "Por animal tratado" : "Por cabeça do lote"}</span><b>${rs(c / (an || l.quantidade))}</b></div>
    <div class="res"><span class="label">Custo do tratamento</span><b>${rs(c)}</b><span class="note">entra no custo do lote inteiro</span></div>`}
    ${med.carencia > 0 ? `<div><span class="label">Carência para abate</span><b>${d2(isoDia(nDia(data) + med.carencia))}</b><span class="note">${med.carencia} dias · vale para o lote inteiro</span></div>` : ""}
    <span class="formula">${soCampo() ? `${n1(ml)} ml de ${esc(med.nome)}.` : `Custo = ${n1(ml)} ml × preço por ml que valia em ${d2(data)}.`}</span>`;
}

TELAS["sanidade/tratamento"] = {
  form: () => `${S.db.meds.length ? "" : semMeds()}
    <form class="card" id="fTrat" novalidate>
      <div class="fgrid">
        ${sel("t-lote", "Lote", opcoesLotes(ativos()))}
        ${campoData("t-data", "Data do tratamento")}
        <div class="f"><label for="t-doenca">Doença tratada</label><input id="t-doenca" type="text" autocomplete="off" list="t-doencas" placeholder="Ex.: Pneumonia"><datalist id="t-doencas">${[...new Set(S.db.sanidade.map((s) => s.doenca).filter(Boolean))].map((d) => `<option value="${esc(d)}">`).join("")}</datalist></div>
        ${sel("t-med", "Medicamento", opcoesMed())}
        ${campo("t-ml", "Quantidade aplicada (ml no total)", { tipo: "number", ph: "20" })}
        ${campo("t-an", "Animais tratados", { tipo: "number", modo: "numeric", passo: 1, ph: "opcional" })}
      </div>
      <div class="calc" id="t-calc" aria-live="polite"></div>
      <div class="actions"><button class="btn" type="submit">Salvar tratamento</button><span class="note">Tratamento é o remédio dado para animal doente.</span></div>
    </form>`,
  atualizarForm() {
    atualizarLotes("t-lote");
    const el = $("#t-med"); if (el) el.innerHTML = opcoesMed(el.value);
    calcTratamento();
  },
  ligar() {
    const f = $("#fTrat");
    f.addEventListener("input", calcTratamento);
    f.addEventListener("change", calcTratamento);
    calcTratamento();
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const l = lotePorId(val("t-lote")), data = val("t-data"), doenca = val("t-doenca"), medId = val("t-med"), ml = num(val("t-ml")), an = num(val("t-an"));
      const e = [];
      if (!l) e.push(["t-lote", "Escolha o lote."]);
      if (!data) e.push(["t-data", "Informe a data."]);
      else if (data > hoje()) e.push(["t-data", "A data não pode ser no futuro."]);
      else if (l && data < l.dataEntrada) e.push(["t-data", `O lote entrou em ${d2(l.dataEntrada)}.`]);
      if (!doenca) e.push(["t-doenca", "Informe a doença tratada."]);
      if (!medId) e.push(["t-med", "Escolha o medicamento."]);
      if (!ml || ml <= 0) e.push(["t-ml", "Informe a quantidade em ml."]);
      if (an != null && l && (an <= 0 || an > l.quantidade)) e.push(["t-an", `O lote tem ${l.quantidade} cabeças.`]);
      if (!erros(f, e)) return;
      const dados = { loteId: l.id, data, tipo: "tratamento", doenca, medId, ml, animais: an || null };
      store.gravar([{ tipo: "set", col: "sanidade", id: store.novoId(), dados }]);
      toast(`Tratamento do ${l.numero} salvo${soCampo() ? "" : ": " + rs(custoSan(dados))}. ${msgSalvo()}`);
      for (const id of ["t-doenca", "t-ml", "t-an"]) $("#" + id).value = "";
      calcTratamento();
    };
  },
  lista() {
    const cont = new Map();
    for (const s of S.db.sanidade) {
      if (s.tipo !== "tratamento" || !s.doenca) continue;
      const k = s.doenca.trim().toLowerCase(), x = cont.get(k) || { nome: s.doenca.trim(), n: 0, animais: 0, custo: 0 };
      x.n++; x.animais += s.animais || 0; x.custo += custoSan(s);
      cont.set(k, x);
    }
    const top = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    return (top.length ? `<section class="card"><div class="sec-h"><h3>Doenças mais tratadas</h3></div>
      <div class="tw"><table><thead><tr><th>Doença</th><th class="r">Tratamentos</th><th class="r">Animais</th>${soCampo() ? "" : '<th class="r">Custo</th>'}</tr></thead><tbody>
      ${top.map((x) => `<tr><td>${esc(x.nome)}</td><td class="r">${x.n}</td><td class="r">${x.animais || "—"}</td>${soCampo() ? "" : `<td class="r">${rs(x.custo)}</td>`}</tr>`).join("")}</tbody></table></div></section>` : "") + historico("tratamento");
  },
};

// ------------------------------------------------------------ calendário sanitário
TELAS["sanidade/calendario"] = {
  form: () => `
    <form class="card" id="fAg" novalidate>
      <h3>Agendar manejo</h3>
      <div class="fgrid">
        ${sel("ag-lote", "Lote", opcoesLotes(ativos()))}
        ${campo("ag-data", "Data prevista", { tipo: "date", v: isoDia(nDia(hoje()) + 30) })}
        ${campo("ag-desc", "O que fazer", { ph: "Ex.: Reforço da vacina de clostridiose", full: true })}
      </div>
      <div class="actions"><button class="btn" type="submit">Agendar</button><span class="note">Na data, aparece como pendência no painel. O reforço também pode ser agendado direto no Protocolo.</span></div>
    </form>`,
  atualizarForm() { atualizarLotes("ag-lote"); },
  ligar() {
    $("#fAg").onsubmit = (ev) => {
      ev.preventDefault();
      const f = ev.target, l = lotePorId(val("ag-lote")), data = val("ag-data"), descricao = val("ag-desc");
      const e = [];
      if (!l) e.push(["ag-lote", "Escolha o lote."]);
      if (!data) e.push(["ag-data", "Informe a data."]);
      if (!descricao) e.push(["ag-desc", "Informe o que fazer."]);
      if (!erros(f, e)) return;
      store.gravar([{ tipo: "set", col: "agenda", id: store.novoId(), dados: { loteId: l.id, data, descricao, feito: false } }]);
      toast(`Agendado para ${d2(data)}. ${msgSalvo()}`);
      $("#ag-desc").value = "";
    };
  },
  lista() {
    const h = hoje(), ag = [...(S.db.agenda || [])];
    const pend = ag.filter((a) => !a.feito).sort((a, b) => a.data.localeCompare(b.data));
    const feitos = ag.filter((a) => a.feito).sort((a, b) => String(b.feitoEm || b.data).localeCompare(String(a.feitoEm || a.data))).slice(0, 30);
    const quando = (a) => { const d = dias(h, a.data); return d < 0 ? `<span class="pill bad">Atrasado ${-d} ${d === -1 ? "dia" : "dias"}</span>` : d === 0 ? '<span class="pill est">Hoje</span>' : `<span class="pill">em ${d} ${d === 1 ? "dia" : "dias"}</span>`; };
    // Lotes ainda em carência
    const car = [];
    for (const r of M().ativos) {
      let pior = null;
      for (const x of S.db.sanidade) {
        if (x.loteId !== r.lote.id || !x.medId) continue;
        const m = porId("meds", x.medId);
        if (!m || !(m.carencia > 0)) continue;
        const livre = isoDia(nDia(x.data) + m.carencia);
        if (livre > h && (!pior || livre > pior.livre)) pior = { livre, med: m.nome, aplicado: x.data };
      }
      if (pior) car.push({ r, ...pior });
    }
    return `
    <section class="card"><div class="sec-h"><h3>Pendências</h3><span class="note">${pend.length}</span></div>
    ${pend.length ? `<div class="rows">${pend.map((a) => `<div class="rowf pend">${quando(a)}<span style="flex:1;min-width:170px"><b>${esc(nomeLote(a.loteId))}</b> · ${esc(a.descricao || "Reforço")} <span class="note">${d2(a.data)}</span></span>
      <button class="btn ghost sm" type="button" data-feito="${a.id}">Marcar como feito</button><button class="mini danger" type="button" data-excluir-ag="${a.id}" data-confirm="Confirmar exclusão">Excluir</button></div>`).join("")}</div>
      <p class="note" style="margin-top:10px">Marcar como feito só tira da lista. Para o custo entrar no lote, lance a aplicação em Protocolo.</p>` : '<p class="empty">Nada agendado.</p>'}</section>
    ${car.length ? `<section class="card"><div class="sec-h"><h3>Lotes em carência para abate</h3><span class="note">${car.length}</span></div>
      <div class="tw"><table><thead><tr><th>Lote</th><th>Medicamento</th><th>Aplicado em</th><th>Liberado em</th><th class="r">Faltam</th></tr></thead><tbody>
      ${car.sort((a, b) => a.livre.localeCompare(b.livre)).map((c) => `<tr class="click" data-act="lote" data-id="${c.r.lote.id}"><td>${tagLote(c.r.lote)}</td><td>${esc(c.med)}</td><td>${d2(c.aplicado)}</td><td><b>${d2(c.livre)}</b></td><td class="r">${dias(h, c.livre)} dias</td></tr>`).join("")}</tbody></table></div></section>` : ""}
    ${feitos.length ? `<section class="card"><div class="sec-h"><h3>Feitos</h3></div><div class="tw"><table><thead><tr><th>Previsto</th><th>Lote</th><th>O que era</th><th>Feito em</th></tr></thead><tbody>
      ${feitos.map((a) => `<tr><td>${d2(a.data)}</td><td>${tagLote(lotePorId(a.loteId))}</td><td class="wrap">${esc(a.descricao || "")}</td><td>${d2(a.feitoEm)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}`;
  },
  ligarLista() {
    $$("[data-feito]").forEach((b) => { b.onclick = () => { store.gravar([{ tipo: "update", col: "agenda", id: b.dataset.feito, dados: { feito: true, feitoEm: hoje() }, semLog: true }]); toast("Marcado como feito."); }; });
    $$("[data-excluir-ag]").forEach((b) => confirmar(b, () => { store.gravar([{ tipo: "delete", col: "agenda", id: b.dataset.excluirAg }]); toast("Agendamento excluído."); }));
  },
};

// ------------------------------------------------------------ catálogo de medicamentos
const fmtPrecoMed = (p) => `${rs(p.preco)} por ${n0(p.ml)} ml = ${rs(p.ml > 0 ? p.preco / p.ml : 0)}/ml`;

TELAS["sanidade/medicamentos"] = {
  form: () => `
    <form class="card" id="fMed" novalidate>
      <h3>Novo medicamento</h3>
      <div class="fgrid">
        ${campo("md-nome", "Nome do medicamento", { ph: "Ex.: Ivermectina 1%" })}
        ${campo("md-preco", "Preço do frasco (R$)", { tipo: "number", ph: "30" })}
        ${campo("md-ml", "Conteúdo do frasco (ml)", { tipo: "number", ph: "50" })}
        ${campo("md-car", "Carência para abate (dias)", { tipo: "number", modo: "numeric", passo: 1, ph: "opcional. Ex.: 35", hint: "Está na bula. O sistema avisa na saída para abate." })}
      </div>
      <p class="note" id="md-conta"></p>
      <div class="actions"><button class="btn" type="submit">Cadastrar medicamento</button></div>
    </form>`,
  ligar() {
    const conta = () => {
      const p = num(val("md-preco")), ml = num(val("md-ml"));
      $("#md-conta").textContent = p != null && ml > 0 ? `Custo por ml: ${rs(p)} ÷ ${n0(ml)} ml = ${rs(p / ml)} por ml.` : "";
    };
    $("#fMed").oninput = conta;
    $("#fMed").onsubmit = (ev) => {
      ev.preventDefault();
      const f = ev.target, nome = val("md-nome"), preco = num(val("md-preco")), ml = num(val("md-ml"));
      const e = [];
      if (!nome) e.push(["md-nome", "Informe o nome."]);
      else if (S.db.meds.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) e.push(["md-nome", "Já existe um medicamento com esse nome."]);
      if (preco == null || preco < 0) e.push(["md-preco", "Informe o preço do frasco."]);
      if (!ml || ml <= 0) e.push(["md-ml", "Informe quantos ml vêm no frasco."]);
      if (!erros(f, e)) return;
      store.gravar([{ tipo: "set", col: "meds", id: store.novoId(), dados: { nome, carencia: Math.round(num(val("md-car")) || 0) || null, precos: [{ desde: hoje(), preco, ml }] } }]);
      toast(`${nome} cadastrado. ${msgSalvo()}`);
      f.reset(); conta();
    };
  },
  lista() {
    const ms = ordenados("meds");
    if (!ms.length) return '<section class="card"><p class="empty">Nenhum medicamento cadastrado ainda.</p></section>';
    return `<section class="card"><div class="sec-h"><h3>Medicamentos cadastrados</h3><span class="note">${ms.length}</span></div>
    <div class="rows">${ms.map((m) => {
      const v = vigente(m.precos, hoje());
      return `<div class="item"><div class="ih"><div><b>${esc(m.nome)}</b><div class="note">${v ? `frasco de ${n0(v.ml)} ml por ${rs(v.preco)}` : "sem preço"} · ${m.carencia > 0 ? `carência de ${m.carencia} dias para abate` : "sem carência informada"}</div></div>
        <div style="text-align:right"><span class="mono">${rs(precoMl(m, hoje()))}/ml</span></div></div>
        ${histPrecos(m.precos, fmtPrecoMed)}
        <details class="mais"><summary>Lançar preço novo, corrigir o nome ou a carência</summary>
          <form class="rowf" data-preco="${m.id}" novalidate>
            ${campo("mp-p-" + m.id, "Novo preço do frasco (R$)", { tipo: "number" })}${campo("mp-m-" + m.id, "Conteúdo (ml)", { tipo: "number", v: v ? v.ml : "" })}${campoData("mp-d-" + m.id, "Vale a partir de")}
            <button class="btn ghost sm" type="submit">Salvar preço novo</button></form>
          <p class="note" style="margin:8px 0">O preço novo vale só da data informada em diante. O que foi aplicado antes continua com o preço antigo.</p>
          <form class="rowf" data-edit="${m.id}" novalidate>
            ${campo("me-n-" + m.id, "Nome", { v: m.nome })}${campo("me-c-" + m.id, "Carência para abate (dias)", { tipo: "number", modo: "numeric", passo: 1, v: m.carencia })}
            <button class="btn ghost sm" type="submit">Salvar cadastro</button>
            <button class="mini danger" type="button" data-excluir="${m.id}" data-confirm="Confirmar exclusão">Excluir medicamento</button></form>
        </details></div>`;
    }).join("")}</div></section>`;
  },
  ligarLista() {
    $$("form[data-preco]").forEach((f) => {
      f.onsubmit = (ev) => {
        ev.preventDefault();
        const id = f.dataset.preco, m = porId("meds", id), p = num(val("mp-p-" + id)), ml = num(val("mp-m-" + id)), d = val("mp-d-" + id);
        const e = [];
        if (p == null || p < 0) e.push(["mp-p-" + id, "Informe o preço."]);
        if (!ml || ml <= 0) e.push(["mp-m-" + id, "Informe os ml do frasco."]);
        if (!d) e.push(["mp-d-" + id, "Informe a data."]);
        if (!erros(f, e)) return;
        store.gravar([{ tipo: "update", col: "meds", id, dados: { precos: comPreco(m.precos, { desde: d, preco: p, ml }) } }]);
        toast(`${m.nome}: ${rs(p / ml)}/ml a partir de ${d2(d)}.`);
      };
    });
    $$("form[data-edit]").forEach((f) => {
      f.onsubmit = (ev) => {
        ev.preventDefault();
        const id = f.dataset.edit, nome = val("me-n-" + id);
        if (!erros(f, nome ? [] : [["me-n-" + id, "Informe o nome."]])) return;
        store.gravar([{ tipo: "update", col: "meds", id, dados: { nome, carencia: Math.round(num(val("me-c-" + id)) || 0) || null } }]);
        toast("Cadastro do medicamento atualizado.");
      };
    });
    $$("[data-excluir]").forEach((b) => confirmar(b, () => {
      const id = b.dataset.excluir;
      if (S.db.sanidade.some((s) => s.medId === id)) { toast("Este medicamento já foi usado em lançamentos e não pode ser excluído."); return; }
      store.gravar([{ tipo: "delete", col: "meds", id }]);
      toast("Medicamento excluído.");
    }));
  },
};
