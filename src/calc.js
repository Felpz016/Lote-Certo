// Contas do sistema. Funções puras: recebem os dados e devolvem números.
// Usadas pelas telas e pela planilha Excel, para as duas mostrarem sempre o mesmo resultado.
//
// Regras principais (ver o documento de requisitos):
//  - Preço com vigência: cada preço tem uma data de início e vale só dali para frente.
//    O custo de um lançamento usa o preço que valia na DATA do lançamento.
//  - Medido vence estimado: o peso da balança vira a referência; entre pesagens o peso é
//    estimado pelo GMD estimado do lote.
//  - Custos do lote = aquisição + pasto + trato + sanidade + custos fixos + custos gerais,
//    somados dia a dia. Lote derivado de apartação herda a parte dele (por cabeça) do lote de origem.

const DIA = 864e5;

export function hojeISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Número do dia (inteiro) de uma data "AAAA-MM-DD". */
export const nDia = (iso) => Math.floor(Date.parse(iso + "T12:00:00Z") / DIA);
export const isoDia = (n) => new Date(n * DIA).toISOString().slice(0, 10);

/** Dias entre duas datas "AAAA-MM-DD". */
export const dias = (de, ate) => nDia(ate) - nDia(de);

const porData = (a, b) => a.data.localeCompare(b.data) || String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""));
const mesDe = (iso) => iso.slice(0, 7);
function somaMes(chave, n) {
  const [a, m] = chave.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const diasNoMes = (chave) => { const [a, m] = chave.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

/** Preço em vigor numa data: o último com início até a data. Antes do primeiro preço, vale o primeiro. */
export function vigente(lista, data) {
  if (!lista || !lista.length) return null;
  const ord = [...lista].sort((a, b) => a.desde.localeCompare(b.desde));
  let v = ord[0];
  for (const p of ord) if (p.desde <= data) v = p;
  return v;
}

// ---------------------------------------------------------------- pesagens e GMD
export function pesagensDoLote(db, loteId) {
  return db.pesagens.filter((p) => p.loteId === loteId).sort(porData);
}

/** Referência de peso antes de uma data: a última pesagem antes dela, ou a entrada. */
export function referenciaAnterior(db, lote, data, ignorarId) {
  const p = pesagensDoLote(db, lote.id).filter((x) => x.data < data && x.id !== ignorarId);
  return p.length
    ? { peso: p[p.length - 1].peso, data: p[p.length - 1].data, tipo: "Última pesagem" }
    : { peso: lote.pesoEntrada, data: lote.dataEntrada, tipo: "Peso de entrada" };
}

/** GMD real = (peso novo − peso anterior) ÷ dias entre as datas. */
export function calcGmd(db, lote, pesagem) {
  const ref = referenciaAnterior(db, lote, pesagem.data, pesagem.id);
  const d = dias(ref.data, pesagem.data);
  const ganho = pesagem.peso - ref.peso;
  return { ref, dias: d, ganho, gmd: d > 0 ? ganho / d : null };
}

export function ultimoGmd(db, lote) {
  const p = pesagensDoLote(db, lote.id);
  return p.length ? calcGmd(db, lote, p[p.length - 1]).gmd : null;
}

/** GMD estimado em vigor numa data (o da entrada, ou o último ajuste até a data). */
export function gmdEstimadoEm(db, lote, data) {
  const aj = (db.gmds || []).filter((g) => g.loteId === lote.id && g.data <= data).sort(porData);
  return aj.length ? aj[aj.length - 1].gmd : (lote.gmdEst || 0);
}

/** Peso estimado numa data, a partir da última referência ANTES da data (pesagem ou entrada). */
export function pesoEstimadoEm(db, lote, data, ignorarId) {
  const ref = referenciaAnterior(db, lote, data, ignorarId);
  const aj = (db.gmds || []).filter((g) => g.loteId === lote.id).sort(porData);
  let peso = ref.peso;
  const fim = nDia(data);
  let i = 0, gmd = lote.gmdEst || 0;
  for (let d = nDia(ref.data) + 1; d <= fim; d++) {
    const iso = isoDia(d);
    while (i < aj.length && aj[i].data <= iso) gmd = aj[i++].gmd;
    peso += gmd;
  }
  return { peso, ref };
}

export function saidaDoLote(db, loteId) {
  return db.saidas.find((s) => s.loteId === loteId) || null;
}

/** Lote que deu origem a toda a cadeia de apartações. */
export function loteRaiz(db, lote) {
  let l = lote, n = 0;
  while (l && l.origemId && n++ < 50) {
    const pai = db.lotes.find((x) => x.id === l.origemId);
    if (!pai) break;
    l = pai;
  }
  return l;
}

/** Todos os lotes de onde este veio (o próprio primeiro, depois o pai, o avô…). */
export function linhagem(db, lote) {
  const out = [];
  let l = lote, n = 0;
  while (l && n++ < 50) { out.push(l); l = l.origemId ? db.lotes.find((x) => x.id === l.origemId) : null; }
  return out;
}

// ---------------------------------------------------------------- compra, parâmetros e sanidade
/** Cabeças que entraram no lote (antes de qualquer morte). */
export const cabEntrada = (l) => l.qtdEntrada ?? l.quantidade;
/** Custo de aquisição: usa o peso de COMPRA quando ele foi informado; senão, o de chegada. */
export const aquisicaoDe = (l) => (l.custoKg != null ? cabEntrada(l) * (l.pesoCompra || l.pesoEntrada) * l.custoKg + (l.comissao || 0) + (l.frete || 0) : 0);
/** Quebra no transporte, em % do peso de compra. */
export const quebraDe = (l) => (l.pesoCompra > 0 && l.pesoEntrada > 0 ? ((l.pesoCompra - l.pesoEntrada) / l.pesoCompra) * 100 : null);

/** Parâmetros da fazenda: rendimento de entrada e de saída (%) e preço de referência da arroba. */
export const CONFIG_PADRAO = { rendEntrada: 50, rendSaida: 52, precoArroba: 320 };
export function configDe(db) {
  const c = (db.config || []).find((x) => x.id === "geral") || {};
  const o = { ...CONFIG_PADRAO };
  for (const k in CONFIG_PADRAO) if (typeof c[k] === "number" && c[k] > 0) o[k] = c[k];
  return o;
}
export const UA_KG = 450;

/** Medicamentos ainda em carência numa data (olha também os lotes de origem). */
export function carenciasAbertas(db, lote, data) {
  const ids = new Set(linhagem(db, lote).map((l) => l.id));
  const out = [];
  for (const s of db.sanidade || []) {
    if (!ids.has(s.loteId) || !s.medId || s.data > data) continue;
    const med = (db.meds || []).find((m) => m.id === s.medId);
    if (!med || !(med.carencia > 0)) continue;
    const livre = isoDia(nDia(s.data) + med.carencia);
    if (livre > data) out.push({ med: med.nome, aplicado: s.data, carencia: med.carencia, livre, faltam: dias(data, livre) });
  }
  return out.sort((a, b) => b.livre.localeCompare(a.livre));
}

// ---------------------------------------------------------------- catálogos
/** R$ por ml de um medicamento numa data. */
export function precoMl(med, data) {
  const v = med && vigente(med.precos, data);
  return v && v.ml > 0 ? v.preco / v.ml : 0;
}

/** kg de matéria natural (o que vai no vagão) por cabeça por dia. Com a dieta em matéria seca,
 *  o consumo é % do peso vivo em MS e vira matéria natural dividindo pela % de MS da dieta. */
export function kgNatural(peso, pv, base, ms) {
  const k = (peso * pv) / 100;
  return base === "ms" && ms > 0 ? k / (ms / 100) : k;
}

/** Dieta numa data: % do peso vivo, custo por kg, % de matéria seca e os ingredientes com preço. */
export function dietaEm(db, dieta, data) {
  const v = dieta && vigente(dieta.versoes, data);
  if (!v) return null;
  let custoKg = 0, ms = 0;
  const base = v.base === "ms" ? "ms" : "mn";
  const itens = (v.itens || []).map((it) => {
    const ing = (db.ingredientes || []).find((x) => x.id === it.ingId);
    const p = ing ? vigente(ing.precos, data) : null;
    const rKg = p ? p.valor / 1000 : 0;
    custoKg += (it.pct / 100) * rKg;
    ms += (it.pct / 100) * (ing ? ing.ms || 0 : 0);
    return { ...it, nome: ing ? ing.nome : "(ingrediente excluído)", rKg, rT: p ? p.valor : 0, parte: (it.pct / 100) * rKg };
  });
  return { pv: v.pv || 0, base, custoKg, ms, itens, desde: v.desde };
}

// ---------------------------------------------------------------- modelo completo
const ZERO = () => ({ aquisicao: 0, pasto: 0, trato: 0, sanidade: 0, fixos: 0, gerais: 0 });
const somar = (a, b, k = 1) => { for (const c in a) a[c] += (b[c] || 0) * k; return a; };
export const totalDe = (c) => c.aquisicao + c.pasto + c.trato + c.sanidade + c.fixos + c.gerais;
export const CATEGORIAS = [["aquisicao", "Aquisição"], ["pasto", "Pasto"], ["trato", "Trato"], ["sanidade", "Sanidade"], ["fixos", "Custos fixos"], ["gerais", "Custos gerais"]];

function agrupar(lista, chave) {
  const m = new Map();
  for (const x of lista || []) { const k = x[chave]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  for (const v of m.values()) v.sort(porData);
  return m;
}
const comDia = (precos) => [...(precos || [])].sort((a, b) => a.desde.localeCompare(b.desde)).map((p) => ({ ...p, d: nDia(p.desde) }));
function vigN(lista, d) {
  if (!lista.length) return null;
  let v = lista[0];
  for (const p of lista) { if (p.d <= d) v = p; else break; }
  return v;
}
const mais = (o, k, v) => { o[k] = (o[k] || 0) + v; };

/**
 * Calcula tudo de uma vez para uma data ("hoje"): situação de cada lote, de cada pasto e da fazenda,
 * e o financeiro mês a mês (fin).
 * Devolve { lote(id), lotes, ativos, pastos, fazenda, resumoMes(chave), fin, cfg }.
 */
export function modelo(db, hoje = hojeISO()) {
  const H = nDia(hoje);
  const cfg = configDe(db);
  const porId = new Map(db.lotes.map((l) => [l.id, l]));
  const saidas = new Map(db.saidas.map((s) => [s.loteId, s]));
  const pesG = agrupar(db.pesagens, "loteId"), movG = agrupar(db.movs, "loteId"), traG = agrupar(db.tratos, "loteId");
  const gmdG = agrupar(db.gmds, "loteId"), sanG = agrupar(db.sanidade, "loteId"), morG = agrupar(db.mortes, "loteId");
  const forG = new Map();
  for (const f of db.fornecimentos || []) {
    if (!forG.has(f.loteId)) forG.set(f.loteId, new Map());
    forG.get(f.loteId).set(nDia(f.data), f);
  }

  const pastos = new Map((db.pastos || []).map((p) => [p.id, { ...p, precosN: comDia(p.precos) }]));
  const meds = new Map((db.meds || []).map((m) => [m.id, m]));
  const ings = new Map((db.ingredientes || []).map((i) => [i.id, { ...i, precosN: comDia(i.precos) }]));
  const dietas = new Map((db.dietas || []).map((x) => [x.id, { ...x, versoesN: comDia(x.versoes) }]));

  // Financeiro da fazenda, mês a mês.
  const meses = new Map();
  const mesFin = (chave) => {
    let x = meses.get(chave);
    if (!x) meses.set(chave, (x = { mes: chave, receita: 0, aquisicao: 0, pasto: 0, pastoOcioso: 0, trato: 0, tratoKg: 0, sanidade: 0, fixos: 0, gerais: 0, semRateio: 0,
      cabDias: 0, porDieta: {}, porIng: {}, porPasto: {}, porMed: {}, porDoenca: {}, sanProtocolo: 0, sanTratamento: 0, porCategoria: {}, porOrigem: {}, porDestino: {}, cabVendidas: 0, cabCompradas: 0, mortes: 0 }));
    return x;
  };
  const mesDoDia = (d) => isoDia(d).slice(0, 7);

  // Período de cada lote: do dia da entrada até a saída, a apartação ou hoje.
  const per = new Map();
  for (const l of db.lotes) {
    const ini = nDia(l.dataEntrada);
    const sai = saidas.get(l.id);
    const fimISO = sai ? sai.data : l.apartadoEm || null;
    const fim = Math.max(ini, fimISO ? nDia(fimISO) : H);
    // Cabeças em cada dia: as que entraram menos as mortes até o dia.
    const mor = (morG.get(l.id) || []).map((x) => ({ d: nDia(x.data), n: x.cabecas || 0 }));
    const q0 = cabEntrada(l);
    const cab = mor.length ? (d) => { let q = q0; for (const x of mor) if (x.d <= d) q -= x.n; return Math.max(0, q); } : () => q0;
    per.set(l.id, { ini, fim, encerrado: !!fimISO, sai, cab, mortes: mor.reduce((s, x) => s + x.n, 0) });
  }

  // Linha do tempo: valor em vigor em cada dia (pasto, dieta, GMD estimado).
  const cursor = (eventos) => {
    const ev = (eventos || []).map((e) => ({ e, d: nDia(e.data) }));
    let i = 0, atual = null;
    return (d) => { while (i < ev.length && ev[i].d <= d) atual = ev[i++].e; return atual; };
  };

  // 1ª passada: quantas cabeças em cada pasto e na fazenda, dia a dia.
  const cabPasto = new Map(), cabFaz = new Map();
  let D0 = H;
  for (const l of db.lotes) {
    const { ini, fim, encerrado, cab } = per.get(l.id);
    if (ini < D0) D0 = ini;
    const ultimo = encerrado ? fim - 1 : fim; // lote ativo conta também no dia de hoje
    const pastoEm = cursor(movG.get(l.id));
    for (let d = ini; d <= ultimo; d++) {
      const q = cab(d);
      cabFaz.set(d, (cabFaz.get(d) || 0) + q);
      const m = pastoEm(d);
      if (m && m.pastoId) {
        let mp = cabPasto.get(m.pastoId);
        if (!mp) cabPasto.set(m.pastoId, (mp = new Map()));
        mp.set(d, (mp.get(d) || 0) + q);
      }
    }
  }

  // Custos fixos e gerais por dia da fazenda, mês a mês.
  const cacheMes = new Map();
  function mensal(chave) {
    let r = cacheMes.get(chave);
    if (r) return r;
    let fixo = 0, geral = 0;
    const cat = {};
    for (const c of db.custos || []) {
      let v = 0;
      if (c.tipo === "fixo") {
        if (c.mes === chave || (c.recorrente && c.mes <= chave && (!c.ate || chave <= c.ate))) v = c.valor;
        fixo += v;
      } else {
        const m0 = mesDe(c.data), n = Math.max(1, c.meses || 1);
        if (chave >= m0 && chave < somaMes(m0, n)) v = c.valor / n;
        geral += v;
      }
      if (v) { const k = c.tipo === "fixo" ? c.categoria || "Outro" : "Custos gerais"; cat[k] = (cat[k] || 0) + v; }
    }
    const nd = diasNoMes(chave);
    r = { fixo, geral, fixoDia: fixo / nd, geralDia: geral / nd, dias: nd, categorias: cat };
    cacheMes.set(chave, r);
    return r;
  }
  const custoPastoDia = (p, d) => { const v = vigN(p.precosN, d); return v ? (v.valor * (p.area || 0)) / 365 : 0; };
  function dietaNoDia(dt, d) {
    const v = vigN(dt.versoesN, d);
    if (!v) return null;
    let custoKg = 0, ms = 0;
    const partes = [];
    for (const it of v.itens || []) {
      const ing = ings.get(it.ingId), p = ing ? vigN(ing.precosN, d) : null;
      const parte = p ? (it.pct / 100) * (p.valor / 1000) : 0;
      custoKg += parte;
      ms += (it.pct / 100) * (ing ? ing.ms || 0 : 0);
      partes.push([it.ingId, parte]);
    }
    return { pv: v.pv || 0, base: v.base === "ms" ? "ms" : "mn", ms, custoKg, partes };
  }

  // 2ª passada: cada lote, dia a dia.
  const res = new Map();
  for (const l of db.lotes) {
    const { ini, fim, encerrado, sai, cab, mortes } = per.get(l.id);
    const pastoEm = cursor(movG.get(l.id)), tratoEm = cursor(traG.get(l.id)), gmdEm = cursor(gmdG.get(l.id));
    const forn = forG.get(l.id);
    const pes = pesG.get(l.id) || [];
    const pesoNoDia = new Map(pes.map((p) => [nDia(p.data), p]));
    const proprio = ZERO();
    proprio.aquisicao = aquisicaoDe(l);
    if (l.custoKg != null && !l.origemId) {
      const mf = mesFin(l.dataEntrada.slice(0, 7));
      mf.aquisicao += proprio.aquisicao; mf.cabCompradas += cabEntrada(l);
      mais(mf.porOrigem, (l.origem || "").trim() || "Sem origem informada", proprio.aquisicao);
    }
    for (const s of sanG.get(l.id) || []) {
      if (!s.medId || !meds.has(s.medId)) continue;
      const med = meds.get(s.medId), c = (s.ml || 0) * precoMl(med, s.data);
      proprio.sanidade += c;
      const mf = mesFin(s.data.slice(0, 7));
      mf.sanidade += c; mais(mf.porMed, med.id, c);
      if (s.tipo === "tratamento") { mf.sanTratamento += c; mais(mf.porDoenca, (s.doenca || "").trim() || "Não informada", c); } else mf.sanProtocolo += c;
    }
    for (const x of morG.get(l.id) || []) mesFin(x.data.slice(0, 7)).mortes += x.cabecas || 0;
    let peso = l.pesoEntrada, ref = { peso: l.pesoEntrada, data: l.dataEntrada, origem: "entrada" };
    let gmdEst = l.gmdEst || 0, mov = null, tr = null, hojeC = { pasto: 0, trato: 0, fixos: 0, gerais: 0 }, cons = null;
    const diasPasto = {}, diasDieta = {};
    for (let d = ini; d <= fim; d++) {
      const aj = gmdEm(d);
      gmdEst = aj ? aj.gmd : (l.gmdEst || 0);
      const pd = pesoNoDia.get(d);
      if (pd) { peso = pd.peso; ref = { peso: pd.peso, data: pd.data, origem: "pesagem" }; }
      else if (d > ini) peso += gmdEst;
      if (d === fim && encerrado) break; // no dia em que saiu, o lote não custa mais
      const q = cab(d);
      mov = pastoEm(d); tr = tratoEm(d);
      const dia = { pasto: 0, trato: 0, fixos: 0, gerais: 0 };
      const p = mov && mov.pastoId ? pastos.get(mov.pastoId) : null;
      if (p) { const cp = cabPasto.get(p.id)?.get(d) || q; dia.pasto = cp ? (custoPastoDia(p, d) / cp) * q : 0; }
      cons = null;
      const dt = tr && tr.dietaId ? dietas.get(tr.dietaId) : null;
      let v = null, kgDia = 0;
      if (dt) {
        v = dietaNoDia(dt, d);
        if (v) {
          const kgCab = kgNatural(peso, v.pv, v.base, v.ms);
          const real = forn ? forn.get(d) : null;
          kgDia = real ? real.kg || 0 : kgCab * q;
          dia.trato = kgDia * v.custoKg;
          cons = { pv: v.pv, base: v.base, ms: v.ms, kgCab, kgLote: kgCab * q, kgMsCab: (kgCab * v.ms) / 100, custoKg: v.custoKg,
            real: real ? { kg: real.kg || 0, sobra: real.sobra || 0 } : null };
        }
      }
      const chave = mesDoDia(d);
      const m = mensal(chave), cf = cabFaz.get(d) || q;
      dia.fixos = cf ? (m.fixoDia / cf) * q : 0;
      dia.gerais = cf ? (m.geralDia / cf) * q : 0;
      if (d < fim) {
        somar(proprio, dia);
        mais(diasPasto, mov && mov.pastoId ? mov.pastoId : "", 1);
        mais(diasDieta, dt ? dt.id : "", 1);
        const mf = mesFin(chave);
        mf.cabDias += q;
        if (v) {
          mf.trato += dia.trato; mf.tratoKg += kgDia; mais(mf.porDieta, dt.id, dia.trato);
          for (const [ingId, parte] of v.partes) mais(mf.porIng, ingId, kgDia * parte);
        }
      } else hojeC = dia; // hoje ainda não entrou na soma
    }
    res.set(l.id, {
      lote: l, ini, fim, encerrado, saida: sai || null,
      cab: l.quantidade, cabEntrada: cabEntrada(l), mortes,
      peso, ref, gmdEst, gmdReal: ultimoGmd(db, l),
      pastoId: mov ? mov.pastoId : null, piquete: mov ? mov.piquete || "" : "", desdePasto: mov ? mov.data : null,
      dietaId: tr ? tr.dietaId || null : null, consumo: encerrado ? null : cons,
      hoje: { ...hojeC, total: hojeC.pasto + hojeC.trato + hojeC.fixos + hojeC.gerais },
      proprio, diasPasto, diasDieta, cfg,
    });
  }

  // Herança na apartação: o derivado leva a parte dele, por cabeça (custos, arrobas de entrada, dias em cada pasto e dieta).
  function herdar(id, pilha = 0) {
    const r = res.get(id);
    if (r.custos) return r;
    const c = somar(ZERO(), r.proprio);
    const dp = { ...r.diasPasto }, dd = { ...r.diasDieta };
    let arr = r.lote.origemId ? 0 : (r.cabEntrada * r.lote.pesoEntrada * cfg.rendEntrada) / 100 / 15;
    const pai = r.lote.origemId && pilha < 50 ? porId.get(r.lote.origemId) : null;
    if (pai && pai.quantidade > 0) {
      const rp = herdar(pai.id, pilha + 1), k = r.cabEntrada / pai.quantidade;
      somar(c, rp.custos, k);
      arr = rp.arrobasEntrada * k;
      for (const x in rp.diasPastoTot) mais(dp, x, rp.diasPastoTot[x]);
      for (const x in rp.diasDietaTot) mais(dd, x, rp.diasDietaTot[x]);
    } else if (r.lote.origemId) arr = (r.cabEntrada * r.lote.pesoEntrada * cfg.rendEntrada) / 100 / 15;
    r.custos = c; r.arrobasEntrada = arr; r.diasPastoTot = dp; r.diasDietaTot = dd;
    return r;
  }
  const principal = (o) => { let k = null, n = 0; for (const x in o) if (o[x] > n) { n = o[x]; k = x; } return k; };
  for (const [id, r] of res) {
    herdar(id);
    r.total = totalDe(r.custos);
    r.producao = r.total - r.custos.aquisicao;
    const raiz = loteRaiz(db, r.lote);
    r.raiz = raiz;
    r.dias = r.fim - nDia(raiz.dataEntrada);
    r.pesoFinal = r.saida && r.saida.peso ? r.saida.peso : r.peso;
    r.pastoPrincipal = principal(r.diasPastoTot);
    r.dietaPrincipal = principal(r.diasDietaTot);
    r.mortalidade = r.cabEntrada ? (r.mortes / r.cabEntrada) * 100 : 0;
    // Indicadores estimados do lote ativo, com o rendimento de saída de referência.
    r.arrobasEst = (r.cab * r.pesoFinal * cfg.rendSaida) / 100 / 15;
    r.arrobasProdEst = r.arrobasEst - r.arrobasEntrada;
    r.custoArrobaProdEst = r.arrobasProdEst > 0 ? r.producao / r.arrobasProdEst : null;
    r.gmdPeriodo = r.dias > 0 ? (r.pesoFinal - raiz.pesoEntrada) / r.dias : null;
    // Peso-alvo: data prevista = hoje + (peso-alvo − peso estimado) ÷ GMD estimado.
    r.alvo = null;
    if (r.lote.ativo && r.lote.pesoAlvo > 0) {
      const falta = r.lote.pesoAlvo - r.peso;
      const d = falta <= 0 ? 0 : r.gmdEst > 0 ? Math.ceil(falta / r.gmdEst) : null;
      r.alvo = { peso: r.lote.pesoAlvo, falta, dias: d, data: d == null ? null : isoDia(H + d) };
    }
  }

  const ordem = (a, b) => a.lote.numero.localeCompare(b.lote.numero, "pt-BR", { numeric: true });
  const todos = [...res.values()].sort(ordem);
  const ativos = todos.filter((r) => r.lote.ativo);

  // Pastos hoje, e o custo de cada pasto mês a mês (com ou sem gado).
  const infoPastos = [...pastos.values()].map((p) => {
    const aqui = ativos.filter((r) => r.pastoId === p.id);
    const cab = aqui.reduce((s, r) => s + r.cab, 0);
    const mp = cabPasto.get(p.id);
    let vazioHa = null;
    if (!cab && mp && mp.size) { const ult = Math.max(...mp.keys()); vazioHa = H - ult - 1; }
    let ocioso = 0;
    if (p.precosN.length) {
      const d0 = Math.min(p.precosN[0].d, mp && mp.size ? Math.min(...mp.keys()) : H);
      for (let d = d0; d < H; d++) {
        const c = custoPastoDia(p, d), usado = !!(mp && mp.get(d));
        const mf = mesFin(mesDoDia(d));
        mf.pasto += c; mais(mf.porPasto, p.id, c);
        if (!usado) { mf.pastoOcioso += c; if (d >= H - 365) ocioso += c; }
      }
    }
    const pesoVivo = aqui.reduce((s, r) => s + r.peso * r.cab, 0);
    const ua = p.area > 0 ? pesoVivo / UA_KG / p.area : null;
    return {
      pasto: p, lotes: aqui, cabecas: cab, lotacao: p.area > 0 ? cab / p.area : null, ua, uaTotal: pesoVivo / UA_KG,
      capacidade: p.capacidade > 0 ? p.capacidade : null, acima: p.capacidade > 0 && ua != null && ua > p.capacidade + 1e-9,
      custoDia: custoPastoDia(p, H), vazioHa, ocioso,
      desde: aqui.length ? aqui.map((r) => r.desdePasto).sort()[0] : null,
    };
  }).sort((a, b) => String(a.pasto.nome).localeCompare(String(b.pasto.nome), "pt-BR", { numeric: true }));

  // Custos fixos e gerais de cada mês (até ontem), rateados ou não.
  for (const c of db.custos || []) { const d = nDia((c.tipo === "fixo" ? c.mes : mesDe(c.data)) + "-01"); if (d < D0) D0 = d; }
  for (let d = D0; d < H; d++) {
    const chave = mesDoDia(d), m = mensal(chave), mf = mesFin(chave);
    mf.fixos += m.fixoDia; mf.gerais += m.geralDia;
    if (!cabFaz.get(d)) mf.semRateio += m.fixoDia + m.geralDia;
    for (const k in m.categorias) mais(mf.porCategoria, k, m.categorias[k] / m.dias);
  }

  // Receita das saídas.
  let entradas = 0;
  for (const l of db.lotes) if (!l.origemId) entradas += cabEntrada(l);
  const fechados = [];
  for (const s of db.saidas) {
    const r = res.get(s.loteId);
    if (!r || !s.tipo) continue;
    const f = fechamento(r, s);
    fechados.push({ r, s, f });
    if (f.receita != null) {
      const mf = mesFin(s.data.slice(0, 7));
      mf.receita += f.receita; mf.cabVendidas += s.quantidade || r.cab;
      mais(mf.porDestino, (s.destino || "").trim() || "Sem destino informado", f.receita);
    }
  }
  const mesAtual = hoje.slice(0, 7);
  mesFin(mesAtual);
  const chaves = [...meses.keys()].filter((k) => k <= mesAtual).sort();
  const listaMeses = [];
  if (chaves.length) for (let k = chaves[0]; k <= mesAtual; k = somaMes(k, 1)) {
    const x = mesFin(k);
    x.producao = x.pasto + x.trato + x.sanidade + x.fixos + x.gerais;
    x.despesa = x.producao + x.aquisicao;
    x.resultado = x.receita - x.despesa;
    listaMeses.push(x);
  }

  const cabecas = ativos.reduce((s, r) => s + r.cab, 0);
  const machos = ativos.filter((r) => r.lote.sexo === "M").reduce((s, r) => s + r.cab, 0);
  const pesoTotal = ativos.reduce((s, r) => s + r.peso * r.cab, 0);
  const comGmd = ativos.filter((r) => r.gmdReal != null);
  const cabGmd = comGmd.reduce((s, r) => s + r.cab, 0);
  const custoDia = ativos.reduce((s, r) => s + r.hoje.total, 0);
  const areaOcupada = infoPastos.filter((p) => p.cabecas).reduce((s, p) => s + (p.pasto.area || 0), 0);
  const cabEmPasto = infoPastos.reduce((s, p) => s + p.cabecas, 0);
  const uaEmPasto = infoPastos.reduce((s, p) => s + p.uaTotal, 0);
  const mortes = (db.mortes || []).reduce((s, x) => s + (x.cabecas || 0), 0);
  const capital = ativos.reduce((s, r) => s + r.total, 0);
  const arrobasAtivas = ativos.reduce((s, r) => s + r.arrobasEst, 0);

  /** Resumo de um mês: custos fixos e gerais e quanto ficou por cabeça por dia. */
  function resumoMes(chave) {
    const m = mensal(chave);
    const d0 = nDia(chave + "-01");
    let soma = 0, n = 0;
    for (let d = d0; d < d0 + m.dias && d <= H; d++) { const c = cabFaz.get(d); if (c) { soma += (m.fixoDia + m.geralDia) / c; n++; } }
    return { ...m, total: m.fixo + m.geral, cabDia: n ? soma / n : null };
  }

  return {
    hoje, cfg, lote: (id) => res.get(id) || null, lotes: todos, ativos, pastos: infoPastos, resumoMes,
    fin: { meses: listaMeses, fechados, capital, arrobasAtivas, valorRebanho: arrobasAtivas * cfg.precoArroba },
    fazenda: {
      cabecas, machos, femeas: cabecas - machos, lotesAtivos: ativos.length, lotesEncerrados: db.lotes.length - ativos.length,
      pesoTotal, pesoMedio: cabecas ? pesoTotal / cabecas : null,
      gmdMedio: cabGmd ? comGmd.reduce((s, r) => s + r.gmdReal * r.cab, 0) / cabGmd : null,
      custoDia, custoCabDia: cabecas ? custoDia / cabecas : null,
      pastosOcupados: infoPastos.filter((p) => p.cabecas).length, pastosVazios: infoPastos.filter((p) => !p.cabecas).length,
      lotacaoMedia: areaOcupada > 0 ? cabEmPasto / areaOcupada : null, uaMedia: areaOcupada > 0 ? uaEmPasto / areaOcupada : null,
      pastosAcima: infoPastos.filter((p) => p.acima),
      mortes, mortalidade: entradas ? (mortes / entradas) * 100 : 0,
    },
  };
}

/** Fechamento de uma saída (ou simulação): arrobas, receita, custo por dia, resultado,
 *  arrobas produzidas, custo por arroba produzida e rentabilidade. */
export function fechamento(r, s) {
  const cfg = r.cfg || CONFIG_PADRAO;
  const q = s.quantidade || r.cab || r.lote.quantidade;
  const pesoTotal = (s.peso || 0) * q;
  const rend = s.rendReal != null && s.rendReal !== "" ? Number(s.rendReal) : s.rendEsp != null && s.rendEsp !== "" ? Number(s.rendEsp) : null;
  let arrobas = null, receita = null;
  if (s.tipo === "abate") {
    if (rend != null && pesoTotal) arrobas = (pesoTotal * rend) / 100 / 15;
    if (arrobas != null && s.precoArroba) receita = arrobas * s.precoArroba;
  } else if (s.tipo === "vivo") {
    if (pesoTotal && s.precoKg) receita = pesoTotal * s.precoKg;
  }
  const d = r.dias;
  const producao = r.total - r.custos.aquisicao;
  // Arrobas produzidas = (peso de saída × rendimento de saída − peso de entrada × rendimento de entrada) ÷ 15.
  const rendProd = rend != null ? rend : cfg.rendSaida;
  const arrobasSaida = pesoTotal ? (pesoTotal * rendProd) / 100 / 15 : null;
  const arrobasProd = arrobasSaida != null && r.arrobasEntrada != null ? arrobasSaida - r.arrobasEntrada : null;
  const resultado = receita != null ? receita - r.total : null;
  const rentab = resultado != null && r.custos.aquisicao > 0 ? (resultado / r.custos.aquisicao) * 100 : null;
  const mesesFaz = d > 0 ? d / 30.4375 : null;
  return {
    pesoTotal, rend, rendReal: s.rendReal != null && s.rendReal !== "", arrobas, receita,
    custoTotal: r.total, custoDia: d > 0 ? r.total / d : null, custoDiaProd: d > 0 ? producao / d : null,
    custoCabDia: d > 0 && q ? r.total / d / q : null, custoCabDiaProd: d > 0 && q ? producao / d / q : null,
    resultado, resultadoCab: resultado != null && q ? resultado / q : null,
    gmdPeriodo: d > 0 && s.peso ? (s.peso - r.raiz.pesoEntrada) / d : null,
    producao, arrobasEntrada: r.arrobasEntrada, arrobasProd, rendProd,
    custoArrobaProd: arrobasProd > 0 ? producao / arrobasProd : null,
    rentab, rentabMes: rentab != null && mesesFaz ? rentab / mesesFaz : null, meses: mesesFaz,
    margem: receita ? (resultado / receita) * 100 : null,
  };
}

/** Projeção de venda de um lote ativo: na data do peso-alvo (ou hoje, sem alvo), com um preço de arroba.
 *  O custo até a data é o acumulado + o custo de hoje repetido nos dias que faltam (aproximação). */
export function projecao(r, preco, rend) {
  const cfg = r.cfg || CONFIG_PADRAO;
  const p = preco > 0 ? preco : cfg.precoArroba, rd = rend > 0 ? rend : cfg.rendSaida;
  const temAlvo = r.alvo && r.alvo.dias != null && r.alvo.falta > 0;
  const diasFalta = temAlvo ? r.alvo.dias : 0;
  const pesoVenda = temAlvo ? r.alvo.peso : r.peso;
  const custo = r.total + r.hoje.total * (diasFalta + 1);
  const arrobas = (r.cab * pesoVenda * rd) / 100 / 15;
  const receita = arrobas * p;
  const resultado = receita - custo;
  const diasTot = r.dias + diasFalta;
  const rentab = r.custos.aquisicao > 0 ? (resultado / r.custos.aquisicao) * 100 : null;
  const arrobasProd = arrobas - r.arrobasEntrada;
  return {
    preco: p, rend: rd, temAlvo, semData: !!(r.alvo && r.alvo.dias == null), dias: diasFalta, data: temAlvo ? r.alvo.data : r.fim != null ? isoDia(r.fim) : null, pesoVenda,
    custo, arrobas, receita, resultado, resultadoCab: r.cab ? resultado / r.cab : null,
    equilibrio: arrobas > 0 ? custo / arrobas : null,
    rentab, rentabMes: rentab != null && diasTot > 0 ? rentab / (diasTot / 30.4375) : null,
    arrobasProd, custoArrobaProd: arrobasProd > 0 ? (custo - r.custos.aquisicao) / arrobasProd : null,
  };
}

/** Compara o desempenho por pasto, fornecedor, raça ou dieta (cada lote entra no grupo onde passou mais dias). */
export function comparativo(m, db, dim) {
  const nomeDe = (col, id, falta) => (db[col] || []).find((x) => x.id === id)?.nome ?? falta;
  const grupoDe = (r) => {
    if (dim === "pasto") return r.pastoPrincipal ? nomeDe("pastos", r.pastoPrincipal, "Pasto excluído") : "Sem pasto";
    if (dim === "dieta") return r.dietaPrincipal ? nomeDe("dietas", r.dietaPrincipal, "Dieta excluída") : "Só pasto, sem trato";
    if (dim === "raca") return (r.lote.raca || "").trim() || "Sem raça informada";
    return (r.raiz.origem || "").trim() || "Sem origem informada";
  };
  const g = new Map();
  for (const r of m.lotes) {
    if (r.lote.apartadoEm) continue; // os custos e o gado passaram para os lotes derivados
    const k = grupoDe(r);
    let x = g.get(k);
    if (!x) g.set(k, (x = { nome: k, lotes: 0, cab: 0, gmdS: 0, gmdP: 0, prod: 0, arr: 0, res: 0, resCab: 0, vendidos: 0, dias: 0 }));
    const f = r.saida && r.saida.tipo ? fechamento(r, r.saida) : null;
    const q = r.saida ? r.saida.quantidade || r.cab : r.cab;
    x.lotes++; x.cab += q; x.dias += r.dias * q;
    const gmd = f ? f.gmdPeriodo : r.gmdPeriodo;
    if (gmd != null) { x.gmdS += gmd * q; x.gmdP += q; }
    const arr = f ? f.arrobasProd : r.arrobasProdEst;
    if (arr > 0) { x.arr += arr; x.prod += r.producao; }
    if (f && f.resultado != null) { x.res += f.resultado; x.resCab += q; x.vendidos++; }
  }
  return [...g.values()].map((x) => ({ ...x, gmd: x.gmdP ? x.gmdS / x.gmdP : null, custoArroba: x.arr > 0 ? x.prod / x.arr : null, resultadoCab: x.resCab ? x.res / x.resCab : null, diasMedio: x.cab ? x.dias / x.cab : null }))
    .sort((a, b) => (b.gmd ?? -1) - (a.gmd ?? -1));
}
