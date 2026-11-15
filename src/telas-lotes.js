// Painel inicial e módulo Lotes (entrada de lote e lotes ativos).
import {
  store, S, M, $, esc, d2, n0, n1, n2, n3, rs, fmtGmd, gmdCls, num, icon, sexoPill, tagLote, toast, msgSalvo, erros,
  nomeFazenda, lotePorId, nomeLote, nomeDe, opcoes, opcoesLotes, ativos, campo, campoData, sel, seg, val, marcado, TELAS, hoje, soCampo, pct, confirmar,
} from "./base.js";
import { pesagensDoLote, dias, aquisicaoDe, cabEntrada, quebraDe } from "./calc.js";

const RACAS = ["Nelore", "Angus", "Brahman", "Senepol", "Tabapuã", "Guzerá", "Girolando", "Cruzado (Angus × Nelore)", "Mestiço"];
const AVISO_PESAGEM = 30; // dias sem pesagem para avisar no painel

// ------------------------------------------------------------ painel
TELAS.painel = {
  lista() {
    const m = M(), f = m.fazenda, h = hoje();
    const semPesar = m.ativos.filter((r) => dias(r.ref.data, h) > AVISO_PESAGEM);
    const evs = [
      ...S.db.lotes.map((l) => ({ data: l.dataEntrada, loteId: l.id, k: "ent", t: l.origemId ? "Apartação" : "Entrada", x: `${l.quantidade} cab. · ${n0(l.pesoEntrada)} kg` })),
      ...S.db.pesagens.map((p) => ({ data: p.data, loteId: p.loteId, k: "peso", t: "Pesagem", x: `${n0(p.peso)} kg/animal` })),
      ...S.db.sanidade.map((s) => ({ data: s.data, loteId: s.loteId, k: "san", t: s.tipo === "tratamento" ? "Tratamento" : "Protocolo", x: s.medId ? nomeDe("meds", s.medId, "medicamento") : s.procedimento || "" })),
      ...S.db.movs.filter((x) => !x.inicial).map((x) => ({ data: x.data, loteId: x.loteId, k: "pasto", t: "Mudança de pasto", x: "para " + nomeDe("pastos", x.pastoId, "sem pasto") })),
      ...S.db.saidas.map((s) => ({ data: s.data, loteId: s.loteId, k: "ent", t: "Saída", x: s.destino || "" })),
    ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
    const sc = soCampo();
    const xls = sc ? "" : `<button class="btn ghost sm" type="button" data-act="excel">${icon("excel")} Baixar planilha Excel</button>`;
    const em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const agenda = (S.db.agenda || []).filter((a) => !a.feito && a.data <= em7).sort((a, b) => a.data.localeCompare(b.data));
    const atrasadas = agenda.filter((a) => a.data < h).length;
    return `
    <section class="card hero"><div><span class="label">Controle de gado</span><h2>${esc(nomeFazenda())}</h2></div>
      <div class="meta"><span>Hoje, ${d2(h)}</span>${xls}</div></section>
    <section class="kpis">
      <div class="card kpi dark"><span class="label">Cabeças ativas</span><span class="v">${n0(f.cabecas)}</span><span class="s">${f.machos} machos · ${f.femeas} fêmeas</span></div>
      ${sc ? `<div class="card kpi dark"><span class="label">Pendências de sanidade</span><span class="v">${agenda.length}</span><span class="s">${atrasadas ? atrasadas + " em atraso" : "nos próximos 7 dias"}</span></div>`
      : `<div class="card kpi dark"><span class="label">Custo do dia da fazenda</span><span class="v">${rs(f.custoDia, 0)}</span><span class="s">${f.custoCabDia == null ? "sem lotes ativos" : rs(f.custoCabDia) + " por cabeça por dia"}</span></div>`}
      <div class="card kpi"><span class="label">Lotes ativos</span><span class="v">${f.lotesAtivos}</span><span class="s">${f.lotesEncerrados} ${f.lotesEncerrados === 1 ? "lote encerrado" : "lotes encerrados"}</span></div>
      <div class="card kpi"><span class="label">Peso médio estimado</span><span class="v">${f.pesoMedio == null ? "—" : n0(f.pesoMedio)} <small>kg</small></span><span class="s">média por cabeça · ${n0(f.pesoTotal)} kg no total</span></div>
      <div class="card kpi"><span class="label">GMD médio real</span><span class="v">${fmtGmd(f.gmdMedio)} <small>kg/dia</small></span><span class="s">última pesagem de cada lote</span></div>
      <div class="card kpi"><span class="label">Pastos</span><span class="v">${f.pastosOcupados}<small> ocupados</small></span><span class="s">${f.pastosVazios} ${f.pastosVazios === 1 ? "vazio" : "vazios"}</span></div>
      <div class="card kpi"><span class="label">Lotação média</span><span class="v">${f.uaMedia == null ? "—" : n2(f.uaMedia)} <small>UA/ha</small></span><span class="s">${f.lotacaoMedia == null ? "nos pastos ocupados" : n2(f.lotacaoMedia) + " cab/ha · 1 UA = 450 kg"}</span></div>
      <div class="card kpi"><span class="label">Sem pesagem há ${AVISO_PESAGEM}+ dias</span><span class="v">${semPesar.length}</span><span class="s">${semPesar.length ? semPesar.slice(0, 4).map((r) => esc(r.lote.numero)).join(", ") + (semPesar.length > 4 ? "…" : "") : "todos os lotes em dia"}</span></div>
      <div class="card kpi"><span class="label">Mortalidade</span><span class="v">${pct(f.mortalidade)}</span><span class="s">${f.mortes} ${f.mortes === 1 ? "cabeça perdida" : "cabeças perdidas"} no total</span></div>
      ${sc ? "" : `<div class="card kpi"><span class="label">Custo acumulado no rebanho</span><span class="v">${rs(m.fin.capital, 0)}</span><span class="s"><button class="link" type="button" data-act="ir" data-to="financeiro">Abrir o financeiro</button></span></div>
      <div class="card kpi"><span class="label">Pendências de sanidade</span><span class="v">${agenda.length}</span><span class="s">${agenda.length ? (atrasadas ? atrasadas + " em atraso" : "nos próximos 7 dias") : "nada agendado para a semana"}</span></div>`}
    </section>
    ${agenda.length ? `<section class="card"><div class="sec-h"><h3>Calendário sanitário</h3><button class="link" type="button" data-act="ir" data-to="sanidade/calendario">Ver o calendário</button></div>
      <div class="rows">${agenda.slice(0, 6).map((a) => `<div class="rowf pend"><span class="pill ${a.data < h ? "bad" : a.data === h ? "est" : ""}">${a.data < h ? "Atrasado" : a.data === h ? "Hoje" : d2(a.data)}</span><span style="flex:1;min-width:160px"><b>${esc(nomeLote(a.loteId))}</b> · ${esc(a.descricao || "Reforço")}${a.data < h ? ` <span class="note">era para ${d2(a.data)}</span>` : ""}</span>
        <button class="mini" type="button" data-feito="${a.id}">Marcar como feito</button></div>`).join("")}</div>
      ${agenda.length > 6 ? `<p class="note" style="margin-top:8px">E mais ${agenda.length - 6}.</p>` : ""}</section>` : ""}
    ${f.pastosAcima.length ? `<div class="banner bad"><span><b>${f.pastosAcima.length === 1 ? "1 pasto está" : f.pastosAcima.length + " pastos estão"} acima da capacidade:</b> ${f.pastosAcima.map((p) => `${esc(p.pasto.nome)} (${n2(p.ua)} de ${n2(p.capacidade)} UA/ha)`).join(", ")}.</span><button class="btn sm" type="button" data-act="ir" data-to="pasto/disposicao">Ver os pastos</button></div>` : ""}
    ${semPesar.length ? `<div class="banner"><span><b>${semPesar.length === 1 ? "1 lote está" : semPesar.length + " lotes estão"} há mais de ${AVISO_PESAGEM} dias sem pesagem.</b> O peso${sc ? "" : " e os custos de trato"} desses lotes estão só na estimativa.</span><button class="btn sm" type="button" data-act="ir" data-to="pesagem">Lançar pesagem</button></div>` : ""}
    ${m.ativos.length ? `
    <div class="grid2">
      <section class="card">
        <div class="sec-h"><h3>Lotes na fazenda</h3><button class="link" type="button" data-act="ir" data-to="lotes">Ver todos</button></div>
        <div class="tw"><table><thead><tr><th>Lote</th><th class="r">Cab.</th><th class="r">Peso est.</th>${sc ? "" : '<th class="r">Custo/dia</th>'}<th>Pasto</th></tr></thead><tbody>
        ${m.ativos.map((r) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td class="r">${r.lote.quantidade}</td><td class="r">${n0(r.peso)} kg</td>${sc ? "" : `<td class="r">${rs(r.hoje.total)}</td>`}<td>${esc(nomeDe("pastos", r.pastoId))}</td></tr>`).join("")}
        </tbody></table></div>
      </section>
      <section class="card">
        <div class="sec-h"><h3>Últimos lançamentos</h3></div>
        ${evs.length ? `<div class="timeline">${evs.map((e) => `<div class="ev"><span class="d">${d2(e.data)}</span><div><span class="tag ${e.k}">${e.t}</span> · <b>${esc(nomeLote(e.loteId))}</b><div class="x">${esc(e.x)}</div></div></div>`).join("")}</div>`
        : '<p class="empty">Nenhum lançamento ainda.</p>'}
      </section>
    </div>` : `
    <section class="card"><h3>Nenhum lote na fazenda</h3><p class="note" style="margin:8px 0 14px">Comece cadastrando os pastos e depois a entrada do primeiro lote.</p>
      ${sc ? "" : `<div class="actions"><button class="btn" type="button" data-act="ir" data-to="lotes/entrada">Cadastrar lote</button><button class="btn ghost" type="button" data-act="ir" data-to="pasto/cadastro">Cadastrar pastos</button></div>`}</section>`}
    ${S.modo === "nuvem" ? `<p class="note mob-only">Conectado como ${esc(S.usuario.email)} · <button class="link" type="button" data-act="sair">Sair</button></p>` : ""}`;
  },
  ligarLista() {
    document.querySelectorAll("[data-feito]").forEach((b) => { b.onclick = () => { store.gravar([{ tipo: "update", col: "agenda", id: b.dataset.feito, dados: { feito: true, feitoEm: hoje() }, semLog: true }]); toast("Marcado como feito."); }; });
  },
};

// ------------------------------------------------------------ formulário do lote (entrada, correção e apartação)
export function proximoNumero() {
  let melhor = null;
  for (const l of S.db.lotes) {
    if (l.origemId) continue;
    const m = /^(.*?)(\d+)$/.exec(l.numero || "");
    if (m && (!melhor || +m[2] > melhor.n)) melhor = { pre: m[1], n: +m[2], w: m[2].length };
  }
  return melhor ? melhor.pre + String(melhor.n + 1).padStart(melhor.w, "0") : "001";
}
export const listaRacas = () => [...new Set([...RACAS, ...S.db.lotes.map((l) => l.raca).filter(Boolean)])];
export const opcoesPasto = (v) => opcoes("pastos", v, S.db.pastos.length ? "Escolha o pasto" : "Nenhum pasto cadastrado");
export const opcoesDieta = (v) => opcoes("dietas", v, "Sem trato (só pasto)");

/** l: dados atuais do lote; x: { pastoId, piquete, dietaId } do início; derivado: sem os campos de compra. */
export function camposLote(l = {}, pfx = "e", x = {}, derivado = false) {
  return `
    <div class="fgrid">
      ${campo(pfx + "-num", "Número do lote", { v: l.numero ?? proximoNumero() })}
      ${campoData(pfx + "-data", "Data de entrada", l.dataEntrada)}
      ${campo(pfx + "-qtd", l.id && cabEntrada(l) !== l.quantidade ? "Cabeças que entraram" : "Quantidade de cabeças", { tipo: "number", modo: "numeric", passo: 1, v: l.id ? cabEntrada(l) : l.quantidade, ph: "0", hint: l.id && cabEntrada(l) !== l.quantidade ? `Hoje o lote tem ${l.quantidade}, por causa das mortes lançadas.` : "" })}
      ${seg(pfx + "-sexo", "Sexo", [["M", "Macho"], ["F", "Fêmea"]], l.sexo === "F" ? "F" : "M")}
      ${campo(pfx + "-peso", derivado ? "Peso médio de entrada (kg/cabeça)" : "Peso médio na chegada (kg/cabeça)", { tipo: "number", v: l.pesoEntrada, ph: "300", hint: derivado ? "" : "Pesado na fazenda. É a base do desempenho (GMD)." })}
      ${campo(pfx + "-pesot", "ou peso total do lote (kg)", { tipo: "number", v: l.pesoEntrada && l.quantidade ? Math.round(l.pesoEntrada * (l.id ? cabEntrada(l) : l.quantidade) * 10) / 10 : "", ph: "o sistema calcula o outro" })}
      ${derivado ? "" : `
      <div class="fsec"><span class="kicker">Compra</span></div>
      ${campo(pfx + "-ckg", "Custo por kg (R$/kg)", { tipo: "number", v: l.custoKg, ph: "11,50" })}
      ${campo(pfx + "-pcompra", "Peso médio de compra (kg/cabeça)", { tipo: "number", v: l.pesoCompra, ph: "opcional", hint: "Peso pago ao vendedor. Em branco, vale o peso de chegada." })}
      ${campo(pfx + "-orig", "Origem", { v: l.origem, ph: "Fornecedor, fazenda ou cidade" })}
      ${campo(pfx + "-com", "Comissão (R$, total do lote)", { tipo: "number", v: l.comissao, ph: "0" })}
      ${campo(pfx + "-fre", "Frete (R$, total do lote)", { tipo: "number", v: l.frete, ph: "0" })}
      ${campo(pfx + "-gta", "Número da GTA", { v: l.gta, ph: "opcional" })}
      ${campo(pfx + "-nf", "Número da nota fiscal", { v: l.nf, ph: "opcional" })}`}
      <div class="fsec"><span class="kicker">Animais</span></div>
      <div class="f"><label for="${pfx}-raca">Raça</label><input id="${pfx}-raca" list="${pfx}-racas" autocomplete="off" value="${esc(l.raca ?? "")}" placeholder="Ex.: Nelore"><datalist id="${pfx}-racas">${listaRacas().map((r) => `<option value="${esc(r)}">`).join("")}</datalist></div>
      ${campo(pfx + "-idade", "Idade (meses)", { tipo: "number", modo: "numeric", passo: 1, v: l.idadeMeses, ph: "opcional" })}
      <div class="fsec"><span class="kicker">Para onde vai</span></div>
      ${sel(pfx + "-pasto", "Pasto de destino", opcoesPasto(x.pastoId), { hint: S.db.pastos.length ? "" : "Cadastre os pastos em Manejo de pasto para o custo do pasto entrar na conta." })}
      ${campo(pfx + "-piq", "Piquete", { v: x.piquete, ph: "opcional" })}
      ${sel(pfx + "-dieta", "Trato", opcoesDieta(x.dietaId), { hint: "Recria confinada ou suplemento: escolha a dieta." })}
      ${campo(pfx + "-gmd", "GMD estimado (kg/dia)", { tipo: "number", v: l.gmdEst, ph: "0,800", hint: "Base do peso estimado entre as pesagens." })}
      ${campo(pfx + "-alvo", "Peso-alvo de saída (kg/cabeça)", { tipo: "number", v: l.pesoAlvo, ph: "opcional. Ex.: 540", hint: "O sistema prevê a data em que o lote chega nesse peso." })}
      <div class="f full"><label for="${pfx}-obs">Observações</label><textarea id="${pfx}-obs" rows="2" placeholder="Estado dos animais, combinado com o vendedor…">${esc(l.obs ?? "")}</textarea></div>
    </div>`;
}

/** Liga os dois campos de peso (médio e total) e a caixa do custo de aquisição. */
export function ligarCamposLote(form, pfx, caixa) {
  const g = (id) => $("#" + pfx + "-" + id, form);
  const conta = () => {
    if (!caixa) return;
    const q = num(g("qtd").value), pc = num(g("peso").value), ck = g("ckg") ? num(g("ckg").value) : null;
    if (!q || !pc || ck == null) { caixa.innerHTML = ""; return; }
    const pcomp = num(g("pcompra").value), p = pcomp || pc;
    const com = num(g("com").value) || 0, fr = num(g("fre").value) || 0;
    const tot = q * p * ck + com + fr;
    const quebra = pcomp ? ((pcomp - pc) / pcomp) * 100 : null;
    const alvo = num(g("alvo").value), gmd = num(g("gmd").value);
    caixa.innerHTML = `
      <div><span class="label">Peso ${pcomp ? "de compra" : "total"}</span><b>${n0(q * p)} kg</b>${quebra != null ? `<span class="note">chegou com ${n0(q * pc)} kg</span>` : ""}</div>
      ${quebra != null ? `<div><span class="label">Quebra no transporte</span><b class="${quebra > 0 ? "neg" : "pos"}">${n1(quebra)}%</b><span class="note">${n1(pcomp - pc)} kg por cabeça</span></div>` : `<div><span class="label">Por cabeça</span><b>${rs(tot / q)}</b></div>`}
      <div><span class="label">Por kg, com comissão e frete</span><b>${rs(tot / (q * pc))}</b><span class="note">${quebra != null ? "sobre o peso de chegada" : ""}</span></div>
      <div class="res"><span class="label">Custo de aquisição</span><b>${rs(tot)}</b></div>
      <span class="formula">${n0(q * p)} kg${pcomp ? " de compra" : ""} × ${rs(ck)} + comissão ${rs(com)} + frete ${rs(fr)}${alvo && gmd > 0 && alvo > pc ? ` · peso-alvo de ${n0(alvo)} kg em cerca de ${Math.ceil((alvo - pc) / gmd)} dias` : ""}</span>`;
  };
  const r1 = (v) => Math.round(v * 10) / 10;
  g("peso").addEventListener("input", () => { const q = num(g("qtd").value), p = num(g("peso").value); g("pesot").value = q && p ? r1(q * p) : ""; });
  g("pesot").addEventListener("input", () => { const q = num(g("qtd").value), t = num(g("pesot").value); if (q && t) g("peso").value = r1(t / q); });
  g("qtd").addEventListener("input", () => { const q = num(g("qtd").value), p = num(g("peso").value), t = num(g("pesot").value); if (q && p) g("pesot").value = r1(q * p); else if (q && t) g("peso").value = r1(t / q); });
  form.addEventListener("input", conta);
  conta();
}

export function lerLote(form, pfx, idAtual, derivado = false) {
  const v = (id) => ($("#" + pfx + "-" + id, form)?.value ?? "").trim();
  const dados = {
    numero: v("num").toUpperCase(),
    dataEntrada: v("data"),
    quantidade: num(v("qtd")),
    sexo: marcado(pfx + "-sexo"),
    idadeMeses: num(v("idade")),
    pesoEntrada: num(v("peso")),
    raca: v("raca"),
    gmdEst: num(v("gmd")),
    pesoAlvo: num(v("alvo")),
    obs: v("obs"),
  };
  if (!derivado) Object.assign(dados, { custoKg: num(v("ckg")), pesoCompra: num(v("pcompra")), comissao: num(v("com")) || 0, frete: num(v("fre")) || 0, origem: v("orig"), gta: v("gta"), nf: v("nf") });
  // Com mortes lançadas, o campo é o número de cabeças que ENTRARAM: o lote fica com esse número menos as mortes.
  const mortas = idAtual ? (S.db.mortes || []).filter((x) => x.loteId === idAtual).reduce((t, x) => t + (x.cabecas || 0), 0) : 0;
  const entraram = dados.quantidade;
  if (idAtual && entraram) { dados.qtdEntrada = entraram; dados.quantidade = entraram - mortas; }
  const extra = { pastoId: v("pasto") || null, piquete: v("piq"), dietaId: v("dieta") || null };
  const e = [];
  if (!dados.numero) e.push([pfx + "-num", "Informe o número do lote."]);
  else if (S.db.lotes.some((l) => l.ativo && l.numero.toUpperCase() === dados.numero && l.id !== idAtual)) e.push([pfx + "-num", `Já existe um lote ativo ${dados.numero}.`]);
  if (!dados.dataEntrada) e.push([pfx + "-data", "Informe a data de entrada."]);
  else if (dados.dataEntrada > hoje()) e.push([pfx + "-data", "A data de entrada não pode ser no futuro."]);
  if (!entraram || entraram < 1 || !Number.isInteger(entraram)) e.push([pfx + "-qtd", "Informe quantas cabeças (número inteiro)."]);
  else if (mortas && entraram <= mortas) e.push([pfx + "-qtd", `Este lote tem ${mortas} ${mortas === 1 ? "morte lançada" : "mortes lançadas"}. O número precisa ser maior.`]);
  if (!derivado && dados.pesoCompra != null && dados.pesoCompra <= 0) e.push([pfx + "-pcompra", "Informe o peso de compra ou deixe em branco."]);
  if (dados.pesoAlvo != null && dados.pesoAlvo <= 0) e.push([pfx + "-alvo", "Informe o peso-alvo ou deixe em branco."]);
  if (!dados.pesoEntrada || dados.pesoEntrada <= 0) e.push([pfx + "-peso", "Informe o peso de entrada."]);
  if (!derivado && (dados.custoKg == null || dados.custoKg < 0)) e.push([pfx + "-ckg", "Informe o custo por kg."]);
  if (!dados.raca) e.push([pfx + "-raca", "Informe a raça."]);
  if (S.db.pastos.length && !extra.pastoId) e.push([pfx + "-pasto", "Escolha o pasto."]);
  if (dados.gmdEst == null || dados.gmdEst < 0) e.push([pfx + "-gmd", "Informe o GMD estimado."]);
  if (idAtual && dados.dataEntrada) {
    const p = pesagensDoLote(S.db, idAtual);
    if (p.length && p[0].data <= dados.dataEntrada) e.push([pfx + "-data", `Já existe pesagem em ${d2(p[0].data)}. A entrada precisa ser antes dela.`]);
  }
  return { dados, extra, ok: erros(form, e) };
}

/** Operações para gravar um lote novo já no pasto e na dieta escolhidos. */
export function opsNovoLote(id, dados, extra) {
  return [
    { tipo: "set", col: "lotes", id, dados: { ...dados, ativo: true } },
    { tipo: "set", col: "movs", id: store.novoId(), dados: { loteId: id, data: dados.dataEntrada, pastoId: extra.pastoId, piquete: extra.piquete || "", inicial: true } },
    { tipo: "set", col: "tratos", id: store.novoId(), dados: { loteId: id, data: dados.dataEntrada, dietaId: extra.dietaId, inicial: true } },
  ];
}

// ------------------------------------------------------------ entrada de lote
TELAS["lotes/entrada"] = {
  form: () => `<form class="card" id="fEnt" novalidate>${camposLote()}
    <div class="calc" id="e-calc" aria-live="polite"></div>
    <div class="actions"><button class="btn" type="submit">Cadastrar lote</button><span class="note">O lote entra em Lotes ativos, já no pasto escolhido.</span></div></form>`,
  ligar() {
    const f = $("#fEnt");
    ligarCamposLote(f, "e", $("#e-calc"));
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const { dados, extra, ok } = lerLote(f, "e");
      if (!ok) return;
      store.gravar(opsNovoLote(store.novoId(), dados, extra));
      toast(`Lote ${dados.numero} cadastrado. ${msgSalvo()}`);
      location.hash = "lotes/ativos";
    };
  },
  lista: () => {
    const l = S.db.lotes.filter((x) => !x.origemId).sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada)).slice(0, 8);
    return `<section class="card"><div class="sec-h"><h3>Últimas entradas</h3></div>
    ${l.length ? `<div class="tw"><table><thead><tr><th>Lote</th><th>Data</th><th class="r">Cab.</th><th>Sexo</th><th>Raça</th><th>Origem</th><th class="r">Peso</th><th class="r">R$/kg</th><th class="r">Aquisição</th><th class="r">Quebra</th><th>Documentos</th></tr></thead><tbody>
    ${l.map((x) => `<tr class="click" data-act="lote" data-id="${x.id}"><td>${tagLote(x)}</td><td>${d2(x.dataEntrada)}</td><td class="r">${cabEntrada(x)}</td><td>${sexoPill(x.sexo)}</td><td>${esc(x.raca) || "—"}</td><td>${esc(x.origem) || "—"}</td><td class="r">${n0(x.pesoEntrada)} kg</td><td class="r">${x.custoKg == null ? "—" : n2(x.custoKg)}</td><td class="r">${x.custoKg == null ? "—" : rs(aquisicaoDe(x), 0)}</td><td class="r">${quebraDe(x) == null ? "—" : n1(quebraDe(x)) + "%"}</td><td>${esc([x.gta && "GTA " + x.gta, x.nf && "NF " + x.nf].filter(Boolean).join(" · ")) || "—"}</td></tr>`).join("")}
    </tbody></table></div>` : '<p class="empty">Nenhum lote cadastrado ainda.</p>'}</section>`;
  },
};

// ------------------------------------------------------------ lotes ativos
const pesoTag = (r) => (r.ref.origem === "pesagem" && r.ref.data === hoje() ? '<span class="pill m">balança</span>' : '<span class="pill est">estimado</span>');
const consumoTxt = (r) => (r.consumo ? `${n2(r.consumo.pv)}% PV${r.consumo.base === "ms" ? " MS" : ""}` : "pasto");

const alvoTxt = (r) => (!r.alvo ? "—" : r.alvo.falta <= 0 ? "no peso" : r.alvo.data ? d2(r.alvo.data) : "sem GMD");

TELAS["lotes/ativos"] = {
  lista() {
    const rows = M().ativos, sc = soCampo();
    if (!rows.length) return `<section class="card"><h3>Nenhum lote ativo</h3><p class="note" style="margin:8px 0 14px">${sc ? "Ainda não há lote cadastrado nesta fazenda." : "Cadastre um lote em Entrada de lote."}</p>${sc ? "" : '<div class="actions"><button class="btn" type="button" data-act="ir" data-to="lotes/entrada">Cadastrar lote</button></div>'}</section>`;
    return `
    <section class="card desk-only"><div class="tw"><table><thead><tr><th>Lote</th><th class="r">Cab.</th><th class="r">Dias</th><th class="r">Peso atual</th><th class="r">GMD est.</th><th class="r">GMD real</th>${sc ? "" : '<th class="r">Custo/dia</th><th class="r">Por cabeça</th><th class="r">Custo/@ produzida</th>'}<th class="r">Peso-alvo</th><th class="r">Consumo</th><th>Pasto</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td class="r">${r.cab}${r.mortes ? `<div class="note">${r.mortes} ${r.mortes === 1 ? "morte" : "mortes"}</div>` : ""}</td><td class="r">${r.dias}</td>
      <td class="r"><b>${n0(r.peso)} kg</b><div class="note">${r.ref.origem === "entrada" ? "sem pesagem" : "pesou " + d2(r.ref.data)}</div></td>
      <td class="r">${n3(r.gmdEst)}</td><td class="r ${gmdCls(r.gmdReal)}">${fmtGmd(r.gmdReal)}</td>
      ${sc ? "" : `<td class="r"><b>${rs(r.hoje.total)}</b></td><td class="r">${rs(r.hoje.total / r.cab)}</td>
      <td class="r">${r.custoArrobaProdEst == null ? "—" : rs(r.custoArrobaProdEst)}<div class="note">${r.arrobasProdEst > 0 ? n1(r.arrobasProdEst) + " @ est." : "sem ganho ainda"}</div></td>`}
      <td class="r">${r.alvo ? n0(r.alvo.peso) + " kg" : "—"}${r.alvo ? `<div class="note">${alvoTxt(r)}</div>` : ""}</td>
      <td class="r">${consumoTxt(r)}${r.consumo ? `<div class="note">${n1(r.consumo.kgCab)} kg/cab</div>` : ""}</td>
      <td>${esc(nomeDe("pastos", r.pastoId))}${r.piquete ? `<div class="note">${esc(r.piquete)}</div>` : ""}</td></tr>`).join("")}
    </tbody></table></div><p class="note" style="margin-top:10px">Peso atual, ${sc ? "" : "custo por dia, custo por arroba produzida, "}data do peso-alvo e consumo são estimados pelo sistema. Depois de uma pesagem, o peso da balança passa a valer.</p></section>
    <div class="lcards">${rows.map((r) => `<button type="button" class="card lcard" data-act="lote" data-id="${r.lote.id}">
      <div><div class="row">${tagLote(r.lote)}${sexoPill(r.lote.sexo)}</div><div class="sub" style="margin-top:6px">${r.cab} cabeças · ${r.dias} dias · ${esc(nomeDe("pastos", r.pastoId, "sem pasto"))}</div></div>
      <div><div class="big">${n0(r.peso)}<small> kg</small></div><div class="sub" style="text-align:right">${pesoTag(r)}</div></div>
      <div class="full">${sc ? "" : `<span>custo/dia ${rs(r.hoje.total)}</span><span>${rs(r.hoje.total / r.cab)}/cab</span>${r.custoArrobaProdEst == null ? "" : `<span>${rs(r.custoArrobaProdEst)}/@ prod.</span>`}`}<span>GMD est. ${n3(r.gmdEst)}</span><span>real <span class="${gmdCls(r.gmdReal)}">${fmtGmd(r.gmdReal)}</span></span><span>${consumoTxt(r)}</span>${r.alvo ? `<span>alvo ${n0(r.alvo.peso)} kg: ${alvoTxt(r)}</span>` : ""}</div>
    </button>`).join("")}</div>
    <p class="note">Toque num lote para ver ${sc ? "o histórico completo" : "custos, projeção de venda, histórico completo, corrigir dados ou excluir lançamentos"}.</p>`;
  },
};

// ------------------------------------------------------------ morte e perda
const CAUSAS = ["Doença", "Acidente", "Picada de cobra", "Raio", "Intoxicação", "Parto", "Roubo ou sumiço", "Causa desconhecida"];
const perdaDe = (x) => { const r = M().lote(x.loteId); return r && r.cabEntrada ? (r.total / r.cabEntrada) * (x.cabecas || 0) : 0; };

function calcMorte() {
  const box = $("#mo-calc");
  if (!box) return;
  const r = M().lote(val("mo-lote")), n = num(val("mo-qtd"));
  if (!r) { box.innerHTML = '<span class="formula">Nenhum lote ativo.</span>'; return; }
  if (!n) { box.innerHTML = `<span class="formula">${r.lote.numero} tem ${r.cab} cabeças hoje${r.mortes ? ` e ${r.mortes} ${r.mortes === 1 ? "morte lançada" : "mortes lançadas"}` : ""}. Informe quantas cabeças morreram ou se perderam.</span>`; return; }
  const depois = r.cab - n, taxa = r.cabEntrada ? ((r.mortes + n) / r.cabEntrada) * 100 : 0;
  box.innerHTML = `
    <div><span class="label">O lote fica com</span><b>${depois > 0 ? depois : "—"}</b><span class="note">de ${r.cabEntrada} que entraram</span></div>
    <div><span class="label">Mortalidade do lote</span><b>${n1(taxa)}%</b></div>
    <div><span class="label">Custo por cabeça passa a</span><b>${depois > 0 ? rs(r.total / depois) : "—"}</b><span class="note">era ${rs(r.total / r.cab)}</span></div>
    <div class="res"><span class="label">Perda estimada</span><b>${rs((r.total / r.cab) * n, 0)}</b><span class="note">custo já gasto nessas cabeças</span></div>
    <span class="formula">As cabeças saem do lote. O custo delas continua no lote e pesa nos animais que ficaram.</span>`;
}

TELAS["lotes/mortes"] = {
  form: () => `
    <form class="card" id="fMorte" novalidate>
      <div class="fgrid">
        ${sel("mo-lote", "Lote", opcoesLotes(ativos()))}
        ${campoData("mo-data", "Data")}
        ${campo("mo-qtd", "Cabeças", { tipo: "number", modo: "numeric", passo: 1, ph: "1" })}
        <div class="f"><label for="mo-causa">Causa</label><input id="mo-causa" list="mo-causas" autocomplete="off" placeholder="Ex.: Picada de cobra"><datalist id="mo-causas">${[...new Set([...CAUSAS, ...(S.db.mortes || []).map((x) => x.causa).filter(Boolean)])].map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
        ${campo("mo-obs", "Observações", { ph: "opcional", full: true })}
      </div>
      <div class="calc" id="mo-calc" aria-live="polite"></div>
      <div class="actions"><button class="btn earth" type="submit">Registrar morte ou perda</button><span class="note">Vale para morte, roubo ou animal sumido.</span></div>
    </form>`,
  atualizarForm() { const el = $("#mo-lote"); el.innerHTML = opcoesLotes(ativos(), el.value); calcMorte(); },
  ligar() {
    const f = $("#fMorte");
    f.addEventListener("input", calcMorte); f.addEventListener("change", calcMorte);
    calcMorte();
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const l = lotePorId(val("mo-lote")), data = val("mo-data"), n = num(val("mo-qtd")), causa = val("mo-causa");
      const e = [];
      if (!l) e.push(["mo-lote", "Escolha o lote."]);
      if (!data) e.push(["mo-data", "Informe a data."]);
      else if (data > hoje()) e.push(["mo-data", "A data não pode ser no futuro."]);
      else if (l && data < l.dataEntrada) e.push(["mo-data", `O lote entrou em ${d2(l.dataEntrada)}.`]);
      if (!n || n < 1 || !Number.isInteger(n)) e.push(["mo-qtd", "Informe quantas cabeças (número inteiro)."]);
      else if (l && n >= l.quantidade) e.push(["mo-qtd", `O lote tem ${l.quantidade} cabeças. Se o lote inteiro acabou, registre em Saída.`]);
      if (!causa) e.push(["mo-causa", "Informe a causa."]);
      if (!erros(f, e)) return;
      store.gravar([
        { tipo: "set", col: "mortes", id: store.novoId(), dados: { loteId: l.id, data, cabecas: n, causa, obs: val("mo-obs") } },
        { tipo: "update", col: "lotes", id: l.id, dados: { quantidade: l.quantidade - n, qtdEntrada: cabEntrada(l) }, semLog: true },
      ]);
      toast(`${n} ${n === 1 ? "cabeça baixada" : "cabeças baixadas"} do ${l.numero}. ${msgSalvo()}`);
      for (const id of ["mo-qtd", "mo-causa", "mo-obs"]) $("#" + id).value = "";
      calcMorte();
    };
  },
  lista() {
    const ms = [...(S.db.mortes || [])].sort((a, b) => b.data.localeCompare(a.data));
    const f = M().fazenda;
    if (!ms.length) return '<section class="card"><p class="empty">Nenhuma morte ou perda lançada.</p></section>';
    const causas = new Map();
    for (const x of ms) causas.set(x.causa || "Não informada", (causas.get(x.causa || "Não informada") || 0) + (x.cabecas || 0));
    const perda = ms.reduce((t, x) => t + perdaDe(x), 0);
    const porLote = M().lotes.filter((r) => r.mortes > 0).sort((a, b) => b.mortalidade - a.mortalidade);
    return `
    <section class="kpis">
      <div class="card kpi dark"><span class="label">Cabeças perdidas</span><span class="v">${f.mortes}</span><span class="s">desde o começo</span></div>
      <div class="card kpi"><span class="label">Mortalidade da fazenda</span><span class="v">${pct(f.mortalidade)}</span><span class="s">mortes ÷ cabeças que entraram</span></div>
      <div class="card kpi"><span class="label">Perda estimada</span><span class="v">${rs(perda, 0)}</span><span class="s">custo que ficou nos lotes</span></div>
      <div class="card kpi"><span class="label">Causa mais comum</span><span class="v" style="font-size:clamp(20px,11cqi,30px);white-space:normal;line-height:1">${esc([...causas.entries()].sort((a, b) => b[1] - a[1])[0][0])}</span><span class="s">${[...causas.entries()].sort((a, b) => b[1] - a[1])[0][1]} cabeças</span></div>
    </section>
    <section class="card"><div class="sec-h"><h3>Mortalidade por lote</h3></div>
      <div class="tw"><table><thead><tr><th>Lote</th><th class="r">Entraram</th><th class="r">Mortes</th><th class="r">Taxa</th><th class="r">Hoje</th></tr></thead><tbody>
      ${porLote.map((r) => `<tr class="click" data-act="lote" data-id="${r.lote.id}"><td>${tagLote(r.lote)}</td><td class="r">${r.cabEntrada}</td><td class="r">${r.mortes}</td><td class="r"><b>${n1(r.mortalidade)}%</b></td><td class="r">${r.lote.ativo ? r.cab : "—"}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><div class="sec-h"><h3>Mortes e perdas lançadas</h3><span class="note">${ms.length}</span></div>
      <div class="tw"><table><thead><tr><th>Data</th><th>Lote</th><th class="r">Cab.</th><th>Causa</th><th>Observações</th><th class="r">Perda est.</th><th></th></tr></thead><tbody>
      ${ms.map((x) => { const l = lotePorId(x.loteId); return `<tr><td>${d2(x.data)}</td><td>${tagLote(l)}</td><td class="r">${x.cabecas}</td><td>${esc(x.causa || "—")}</td><td class="wrap">${esc(x.obs || "—")}</td><td class="r">${rs(perdaDe(x), 0)}</td>
        <td>${l && l.ativo ? `<button class="mini danger" type="button" data-desfaz-morte="${x.id}" data-confirm="Confirmar: devolver as cabeças">Excluir</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div><p class="note" style="margin-top:10px">Excluir um lançamento devolve as cabeças para o lote. Só dá para excluir enquanto o lote está ativo.</p></section>`;
  },
  ligarLista() {
    document.querySelectorAll("[data-desfaz-morte]").forEach((b) => confirmar(b, () => {
      const x = (S.db.mortes || []).find((m) => m.id === b.dataset.desfazMorte), l = x && lotePorId(x.loteId);
      if (!x || !l) return;
      store.gravar([{ tipo: "delete", col: "mortes", id: x.id }, { tipo: "update", col: "lotes", id: l.id, dados: { quantidade: l.quantidade + (x.cabecas || 0) }, semLog: true }]);
      toast(`Lançamento excluído. ${l.numero} voltou a ter ${l.quantidade + (x.cabecas || 0)} cabeças.`);
    }));
  },
};

export { lotePorId };
