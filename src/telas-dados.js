// Importação de planilha Excel (lotes, pesagens e catálogos) e registro de alterações.
// Aparecem na tela Conta e fazendas.
import { store, S, $, esc, d2, n0, toast, msgSalvo, lotePorId, hoje, ui } from "./base.js";

// ------------------------------------------------------------ registro de alterações
const NOMES = { nome: "nome", numero: "número", dataEntrada: "data de entrada", quantidade: "cabeças", qtdEntrada: "cabeças que entraram", pesoEntrada: "peso de chegada", pesoCompra: "peso de compra",
  custoKg: "custo por kg", comissao: "comissão", frete: "frete", origem: "origem", raca: "raça", sexo: "sexo", idadeMeses: "idade", gmdEst: "GMD estimado", pesoAlvo: "peso-alvo", obs: "observações",
  gta: "GTA", nf: "nota fiscal", ativo: "situação", apartadoEm: "apartação", criterio: "critério", precos: "preço", versoes: "composição", area: "área", capim: "capim", piquetes: "piquetes",
  capacidade: "capacidade", carencia: "carência", ms: "matéria seca", rendReal: "rendimento real", pastoId: "pasto", piquete: "piquete", dietaId: "dieta", data: "data", peso: "peso", kg: "kg fornecido",
  sobra: "sobra", ate: "último mês", precoArroba: "preço da arroba", rendSaida: "rendimento de saída", rendEntrada: "rendimento de entrada", feito: "feito", inicial: "", loteId: "" };
export const camposLog = (campos) => String(campos || "").split(", ").map((c) => (c in NOMES ? NOMES[c] : c)).filter(Boolean).join(", ");
const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export function secaoLog() {
  const logs = [...(S.db.log || [])].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  return `<section class="card"><div class="sec-h"><h3>Registro de alterações</h3><span class="note">${logs.length} ${logs.length === 1 ? "correção ou exclusão" : "correções e exclusões"} nesta fazenda</span></div>
    <p class="note">Todo lançamento guarda quem lançou e quando: isso aparece no histórico de cada lote. Aqui ficam as correções e as exclusões, que não aparecem mais nas telas.</p>
    ${logs.length ? `<div class="tw" style="margin-top:10px"><table><thead><tr><th>Quando</th><th>Quem</th><th>O que fez</th><th>Lote</th><th>O que mudou</th></tr></thead><tbody>
    ${logs.slice(0, 60).map((x) => { const l = x.loteId ? lotePorId(x.loteId) : null; return `<tr${l ? ` class="click" data-act="lote" data-id="${l.id}"` : ""}><td>${quando(x.quando)}</td><td>${esc(x.quem || "—")}</td><td><span class="pill ${x.acao === "excluiu" ? "bad" : ""}">${x.acao === "excluiu" ? "Excluiu" : "Corrigiu"}</span> ${esc(x.oque || "")}${x.dataDoc ? " de " + d2(x.dataDoc) : ""}</td><td>${l ? esc(l.numero) : "—"}</td><td class="wrap">${esc(camposLog(x.campos)) || "—"}</td></tr>`; }).join("")}
    </tbody></table></div>${logs.length > 60 ? '<p class="note" style="margin-top:8px">Aparecem as 60 mais recentes. A planilha Excel traz todas.</p>' : ""}` : '<p class="empty" style="margin-top:8px">Nenhuma correção ou exclusão até agora.</p>'}
  </section>`;
}

// ------------------------------------------------------------ importação de planilha
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
// Para cada aba: o campo e os começos de título aceitos (sem acento, sem espaço).
const ABAS = {
  pastos: { titulos: ["pastos", "pasto"], cols: { nome: ["pasto", "nome"], area: ["area"], capim: ["capim", "especie"], custo: ["custo"], capacidade: ["capacidade"] },
    modelo: ["Pasto", "Área (ha)", "Capim", "Custo (R$ por hectare por ano)", "Capacidade (UA por hectare)"], exemplo: ["Pasto 1", 20, "Braquiária brizantha", 730, 1.5] },
  meds: { titulos: ["medicamentos", "medicamento"], cols: { nome: ["medicamento", "nome"], preco: ["preco"], ml: ["conteudo", "ml"], carencia: ["carencia"] },
    modelo: ["Medicamento", "Preço do frasco (R$)", "Conteúdo do frasco (ml)", "Carência para abate (dias)"], exemplo: ["Ivermectina 1%", 30, 50, 35] },
  ingredientes: { titulos: ["ingredientes", "ingrediente"], cols: { nome: ["ingrediente", "nome"], ms: ["materiaseca", "ms"], custo: ["custo", "preco"] },
    modelo: ["Ingrediente", "Matéria seca (%)", "Custo (R$ por tonelada)"], exemplo: ["Milho moído", 88, 1100] },
  lotes: { titulos: ["lotes", "lote", "entradas"], cols: { numero: ["lote", "numero"], data: ["data"], qtd: ["cabecas", "quantidade"], sexo: ["sexo"], raca: ["raca"], peso: ["pesodechegada", "pesomediodechegada", "pesodeentrada", "pesomediodeentrada", "peso"],
      pesoCompra: ["pesodecompra", "pesomediodecompra"], custoKg: ["custodokg", "custoporkg", "custokg"], comissao: ["comissao"], frete: ["frete"], origem: ["origem", "fornecedor"], gmd: ["gmd"], pasto: ["pasto"], alvo: ["pesoalvo"], gta: ["gta"], nf: ["notafiscal", "nf"] },
    modelo: ["Lote", "Data de entrada", "Cabeças", "Sexo", "Raça", "Peso de chegada (kg por cabeça)", "Peso de compra (kg por cabeça)", "Custo do kg (R$)", "Comissão (R$)", "Frete (R$)", "Origem", "GMD estimado (kg por dia)", "Pasto", "Peso-alvo (kg)", "GTA", "Nota fiscal"],
    exemplo: ["001", new Date(Date.UTC(2026, 0, 15)), 40, "Macho", "Nelore", 270, 276, 11.5, 1000, 1500, "Leilão de Araçatuba", 0.7, "Pasto 1", 540, "", ""] },
  pesagens: { titulos: ["pesagens", "pesagem"], cols: { numero: ["lote"], data: ["data"], peso: ["peso"] },
    modelo: ["Lote", "Data", "Peso médio (kg por cabeça)"], exemplo: ["001", new Date(Date.UTC(2026, 2, 15)), 312] },
};
const NOME_ABA = { pastos: "Pastos", meds: "Medicamentos", ingredientes: "Ingredientes", lotes: "Lotes", pesagens: "Pesagens" };

const texto = (v) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return v.result != null ? texto(v.result) : v.richText ? v.richText.map((t) => t.text).join("") : v.text != null ? String(v.text) : "";
  return String(v).trim();
};
const numero = (v) => {
  if (v != null && typeof v === "object" && !(v instanceof Date) && v.result != null) v = v.result;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = texto(v).replace(/[R$\s%]/g, "");
  if (!t) return null;
  const x = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(x) ? x : null;
};
const dataISO = (v) => {
  if (v != null && typeof v === "object" && !(v instanceof Date) && v.result != null) v = v.result;
  if (v instanceof Date) return Number.isNaN(+v) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const t = texto(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

/** Lê as abas conhecidas de uma planilha. Devolve { aba: [ { linha, campo: valor bruto } ] }. */
async function lerPlanilha(arquivo) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const out = {};
  wb.eachSheet((ws) => {
    const chave = Object.keys(ABAS).find((k) => ABAS[k].titulos.includes(norm(ws.name)));
    if (!chave || out[chave]) return;
    // A linha de títulos é a primeira (até a 6ª) em que aparece a coluna principal.
    const cols = ABAS[chave].cols, principal = Object.keys(cols)[0];
    let cab = 0, mapa = null;
    for (let r = 1; r <= Math.min(6, ws.rowCount) && !mapa; r++) {
      const m = {};
      ws.getRow(r).eachCell((cell, c) => {
        const t = norm(texto(cell.value));
        if (!t) return;
        // ganha o campo com o começo de título mais comprido que casa
        let melhor = null, tam = 0;
        for (const campo in cols) for (const ini of cols[campo]) if (t.startsWith(ini) && ini.length > tam && !(campo in m)) { melhor = campo; tam = ini.length; }
        if (melhor) m[melhor] = c;
      });
      if (m[principal]) { mapa = m; cab = r; }
    }
    if (!mapa) return;
    const linhas = [];
    for (let r = cab + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r), o = { linha: r };
      let tem = false;
      for (const campo in mapa) { const v = row.getCell(mapa[campo]).value; o[campo] = v; if (texto(v) !== "") tem = true; }
      if (tem) linhas.push(o);
    }
    out[chave] = linhas;
  });
  return out;
}

/** Confere tudo e monta as gravações. Nada é gravado aqui. */
function preparar(lido) {
  const db = S.db, ops = [], avisos = [], cont = { pastos: 0, meds: 0, ingredientes: 0, lotes: 0, pesagens: 0 };
  const h = hoje();
  const aviso = (aba, linha, msg) => avisos.push(`${NOME_ABA[aba]}, linha ${linha}: ${msg}`);
  const existe = (col, nome) => db[col].some((x) => norm(x.nome) === norm(nome));
  const novos = { pastos: new Map(), lotes: new Map() };

  for (const x of lido.pastos || []) {
    const nome = texto(x.nome), area = numero(x.area), custo = numero(x.custo);
    if (!nome) continue;
    if (existe("pastos", nome) || novos.pastos.has(norm(nome))) { aviso("pastos", x.linha, `${nome} já existe e foi pulado.`); continue; }
    if (!area || area <= 0) { aviso("pastos", x.linha, `${nome} está sem a área.`); continue; }
    const id = store.novoId();
    novos.pastos.set(norm(nome), id);
    ops.push({ tipo: "set", col: "pastos", id, dados: { nome, area, capim: texto(x.capim), piquetes: "", capacidade: numero(x.capacidade), precos: [{ desde: h, valor: custo || 0 }] } });
    cont.pastos++;
  }
  const vistos = new Set();
  for (const x of lido.meds || []) {
    const nome = texto(x.nome), preco = numero(x.preco), ml = numero(x.ml);
    if (!nome) continue;
    if (existe("meds", nome) || vistos.has("m" + norm(nome))) { aviso("meds", x.linha, `${nome} já existe e foi pulado.`); continue; }
    if (preco == null || !ml || ml <= 0) { aviso("meds", x.linha, `${nome} está sem o preço ou sem os ml do frasco.`); continue; }
    vistos.add("m" + norm(nome));
    ops.push({ tipo: "set", col: "meds", id: store.novoId(), dados: { nome, carencia: Math.round(numero(x.carencia) || 0) || null, precos: [{ desde: h, preco, ml }] } });
    cont.meds++;
  }
  for (const x of lido.ingredientes || []) {
    const nome = texto(x.nome), ms = numero(x.ms), custo = numero(x.custo);
    if (!nome) continue;
    if (existe("ingredientes", nome) || vistos.has("i" + norm(nome))) { aviso("ingredientes", x.linha, `${nome} já existe e foi pulado.`); continue; }
    if (!ms || ms <= 0 || ms > 100 || custo == null) { aviso("ingredientes", x.linha, `${nome} está sem a matéria seca ou sem o custo.`); continue; }
    vistos.add("i" + norm(nome));
    ops.push({ tipo: "set", col: "ingredientes", id: store.novoId(), dados: { nome, ms, precos: [{ desde: h, valor: custo }] } });
    cont.ingredientes++;
  }
  const pastoId = (nome) => (nome ? novos.pastos.get(norm(nome)) || (db.pastos.find((p) => norm(p.nome) === norm(nome)) || {}).id || null : null);
  for (const x of lido.lotes || []) {
    const num = texto(x.numero).toUpperCase(), data = dataISO(x.data), q = numero(x.qtd), peso = numero(x.peso);
    if (!num) continue;
    if (db.lotes.some((l) => l.numero.toUpperCase() === num) || novos.lotes.has(num)) { aviso("lotes", x.linha, `o lote ${num} já existe e foi pulado.`); continue; }
    if (!data) { aviso("lotes", x.linha, `o lote ${num} está sem data de entrada (use dia/mês/ano).`); continue; }
    if (data > h) { aviso("lotes", x.linha, `o lote ${num} tem data de entrada no futuro.`); continue; }
    if (!q || q < 1 || !Number.isInteger(q)) { aviso("lotes", x.linha, `o lote ${num} está sem a quantidade de cabeças.`); continue; }
    if (!peso || peso <= 0) { aviso("lotes", x.linha, `o lote ${num} está sem o peso de entrada.`); continue; }
    const nomePasto = texto(x.pasto), pid = pastoId(nomePasto);
    if (nomePasto && !pid) aviso("lotes", x.linha, `o pasto "${nomePasto}" do lote ${num} não existe. O lote entra sem pasto.`);
    const id = store.novoId(), ck = numero(x.custoKg);
    novos.lotes.set(num, { id, dataEntrada: data });
    ops.push(
      { tipo: "set", col: "lotes", id, dados: { numero: num, dataEntrada: data, quantidade: q, sexo: norm(texto(x.sexo)).startsWith("f") ? "F" : "M", raca: texto(x.raca), idadeMeses: null, pesoEntrada: peso,
        pesoCompra: numero(x.pesoCompra), custoKg: ck == null ? 0 : ck, comissao: numero(x.comissao) || 0, frete: numero(x.frete) || 0, origem: texto(x.origem), gmdEst: numero(x.gmd) || 0, pesoAlvo: numero(x.alvo),
        gta: texto(x.gta), nf: texto(x.nf), obs: "Importado da planilha.", ativo: true } },
      { tipo: "set", col: "movs", id: store.novoId(), dados: { loteId: id, data, pastoId: pid, piquete: "", inicial: true } },
      { tipo: "set", col: "tratos", id: store.novoId(), dados: { loteId: id, data, dietaId: null, inicial: true } },
    );
    if (ck == null) aviso("lotes", x.linha, `o lote ${num} está sem o custo do kg. Entrou com custo zero: corrija abrindo o lote.`);
    cont.lotes++;
  }
  const jaPesou = new Set(db.pesagens.map((p) => p.loteId + "|" + p.data));
  for (const x of lido.pesagens || []) {
    const num = texto(x.numero).toUpperCase(), data = dataISO(x.data), peso = numero(x.peso);
    if (!num) continue;
    const novo = novos.lotes.get(num), antigo = db.lotes.find((l) => l.numero.toUpperCase() === num && l.ativo) || db.lotes.find((l) => l.numero.toUpperCase() === num);
    const lote = novo || antigo;
    if (!lote) { aviso("pesagens", x.linha, `o lote ${num} não existe.`); continue; }
    if (!data || !peso || peso <= 0) { aviso("pesagens", x.linha, `a pesagem do lote ${num} está sem data ou sem peso.`); continue; }
    if (data > h || data <= lote.dataEntrada) { aviso("pesagens", x.linha, `a pesagem do lote ${num} em ${d2(data)} precisa ser depois da entrada e até hoje.`); continue; }
    if (jaPesou.has(lote.id + "|" + data)) { aviso("pesagens", x.linha, `o lote ${num} já tem pesagem em ${d2(data)}.`); continue; }
    jaPesou.add(lote.id + "|" + data);
    ops.push({ tipo: "set", col: "pesagens", id: store.novoId(), dados: { loteId: lote.id, data, peso } });
    cont.pesagens++;
  }
  return { ops, avisos, cont };
}

async function baixarModelo() {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  for (const k of ["lotes", "pesagens", "pastos", "meds", "ingredientes"]) {
    const ws = wb.addWorksheet(NOME_ABA[k]);
    ws.addRow(ABAS[k].modelo).font = { bold: true };
    ws.addRow(ABAS[k].exemplo).font = { italic: true, color: { argb: "FF777777" } };
    ws.columns.forEach((c, i) => { c.width = Math.max(14, String(ABAS[k].modelo[i]).length + 2); });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = "lote-certo-modelo-de-importacao.xlsx";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

let pronto = null; // { ops, avisos, cont, arquivo }

export function secaoImportar() {
  const p = pronto, total = p ? Object.values(p.cont).reduce((a, b) => a + b, 0) : 0;
  return `<section class="card" id="secImp"><div class="sec-h"><h3>Importar planilha</h3><span class="note">lotes, pesagens, pastos, medicamentos e ingredientes</span></div>
    <p class="note">Para começar sem digitar tudo de novo. Baixe o modelo, preencha as abas que quiser (a linha de exemplo em cinza pode ser apagada) e escolha o arquivo. Nada é gravado antes de você conferir e confirmar. O que já existe na fazenda com o mesmo nome ou número é pulado.</p>
    <div class="actions" style="margin-top:12px"><button class="btn ghost sm" type="button" id="impModelo">Baixar a planilha modelo</button>
      <label class="btn sm" for="impArq">Escolher a planilha preenchida</label><input id="impArq" type="file" accept=".xlsx" hidden></div>
    ${p ? `<div class="calc" style="margin-top:14px">
      <div><span class="label">Lotes</span><b>${p.cont.lotes}</b></div><div><span class="label">Pesagens</span><b>${p.cont.pesagens}</b></div>
      <div><span class="label">Pastos</span><b>${p.cont.pastos}</b></div><div><span class="label">Medicamentos e ingredientes</span><b>${p.cont.meds + p.cont.ingredientes}</b></div>
      <span class="formula">${esc(p.arquivo)} · ${total ? `${total} ${total === 1 ? "registro pronto" : "registros prontos"} para importar` : "nenhum registro novo para importar"}${p.avisos.length ? ` · ${p.avisos.length} ${p.avisos.length === 1 ? "aviso" : "avisos"}` : ""}</span></div>
      ${p.avisos.length ? `<div class="banner" style="margin-top:10px;display:block"><b>Confira antes de importar:</b><ul class="lista-avisos">${p.avisos.slice(0, 30).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>${p.avisos.length > 30 ? `<span class="note">E mais ${p.avisos.length - 30}.</span>` : ""}</div>` : ""}
      <div class="actions" style="margin-top:12px">${total ? `<button class="btn" type="button" id="impOk">Importar ${n0(total)} ${total === 1 ? "registro" : "registros"}</button>` : ""}<button class="btn ghost sm" type="button" id="impNao">Cancelar</button></div>` : ""}
  </section>`;
}

export function ligarImportar() {
  const bm = $("#impModelo");
  if (!bm) return;
  bm.onclick = async () => { bm.disabled = true; try { await baixarModelo(); } catch (e) { toast("Não foi possível gerar o modelo: " + e.message); } finally { bm.disabled = false; } };
  $("#impArq").onchange = async (ev) => {
    const arq = ev.target.files[0];
    if (!arq) return;
    try {
      const lido = await lerPlanilha(arq);
      if (!Object.keys(lido).length) { toast("Não achei nenhuma aba com o nome Lotes, Pesagens, Pastos, Medicamentos ou Ingredientes. Use a planilha modelo."); return; }
      pronto = { ...preparar(lido), arquivo: arq.name };
      ui.refazerLista();
      $("#secImp")?.scrollIntoView({ block: "nearest" });
    } catch (e) { toast("Não foi possível ler a planilha: " + e.message); }
  };
  const ok = $("#impOk");
  if (ok) ok.onclick = () => {
    const p = pronto;
    pronto = null;
    store.gravar(p.ops);
    const pl = (n, um, mais) => `${n} ${n === 1 ? um : mais}`;
    toast(`Importação concluída: ${pl(p.cont.lotes, "lote", "lotes")}, ${pl(p.cont.pesagens, "pesagem", "pesagens")}, ${pl(p.cont.pastos, "pasto", "pastos")}, ${pl(p.cont.meds, "medicamento", "medicamentos")} e ${pl(p.cont.ingredientes, "ingrediente", "ingredientes")}. ${msgSalvo()}`);
  };
  const nao = $("#impNao");
  if (nao) nao.onclick = () => { pronto = null; ui.refazerLista(); };
}
