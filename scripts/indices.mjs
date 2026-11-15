// Robô diário dos Índices do mercado. Roda pelo GitHub Actions (workflow "Índices do dia"), de manhã.
// 1. Busca as cotações e as notícias do agro em fontes públicas.
// 2. Grava tudo num documento só, publico/indices, que todo assinante lê. O documento do dia anterior é
//    trocado pelo novo, então nada se acumula. As séries dos gráficos guardam só os últimos 130 pregões.
// 3. Limpa o registro de alterações: apaga as linhas com mais de 1 ano (pedido do usuário).
// Se uma fonte falhar, o robô mantém o último dado real dela, com a data dele. Nunca inventa número.
//   SECO=1   não grava nada, só mostra o que conseguiu buscar (para teste).
import { readFileSync } from "node:fs";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SECO = process.env.SECO === "1";
const MAX_SERIE = 130, DIAS_NOTICIA = 4, MAX_NOTICIAS = 24, DIAS_LOG = 365;

async function baixar(url, tipo = "text") {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml,application/json;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
  return tipo === "json" ? r.json() : r.text();
}
const ENT = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ccedil: "ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", agrave: "à", acirc: "â", ecirc: "ê", ocirc: "ô", Aacute: "Á", Eacute: "É", Ccedil: "Ç", ordm: "º", ordf: "ª", ndash: "–", mdash: "—", hellip: "…", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’" };
const limpar = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<sup>[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m).replace(/\s+/g, " ").trim();
const numBr = (s) => { const m = String(s).match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/); return m ? parseFloat(m[0].replace(/\./g, "").replace(",", ".")) : null; };
const dataBr = (s) => { const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const tabelas = (html) => [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((t) => [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((l) => [...l[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => limpar(c[1]))));
const log = (...a) => console.log(...a);

// ------------------------------------------------------------ cotações
/** Dólar comercial (venda), série do Banco Central. */
async function dolar() {
  const j = await baixar("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/130?formato=json", "json");
  return j.map((x) => ({ d: dataBr(x.data), v: +x.valor })).filter((x) => x.d && x.v > 0);
}

/** Arroba por praça (Scot Consultoria): devolve { data, pracas: [{ praca, boi, vaca, novilha }] }. */
async function scotPracas() {
  const html = await baixar("https://www.scotconsultoria.com.br/cotacoes/boi-gordo/");
  const ts = tabelas(html);
  const t = ts.find((x) => x.some((l) => /mercado f.sico/i.test(l.join(" "))));
  if (!t) throw new Error("tabela do mercado físico não encontrada");
  const data = dataBr(t.map((l) => l.join(" ")).join(" "));
  const pracas = [];
  for (const l of t) {
    const nums = l.slice(1).map(numBr).filter((v) => v != null && v > 50 && v < 1000);
    if (l[0] && nums.length && !/boi gordo|pre.os|descontados|vista|funrural/i.test(l[0])) pracas.push({ praca: l[0], boi: nums[0] });
  }
  return { data, pracas, bruto: t };
}

/** Mantém a série guardada e junta o valor novo (um ponto por dia). */
function juntar(serieAntiga = [], novos = []) {
  const m = new Map(serieAntiga.map((p) => [p.d, p.v]));
  for (const p of novos) if (p.d && p.v != null) m.set(p.d, p.v);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-MAX_SERIE).map(([d, v]) => ({ d, v }));
}
function cotacao(base, serie) {
  if (!serie.length) return null;
  const ult = serie[serie.length - 1], ant = serie[serie.length - 2], mes = serie.find((p) => p.d >= isoMenos(ult.d, 30)) || serie[0];
  return { ...base, valor: ult.v, data: ult.d, var1d: ant ? ((ult.v - ant.v) / ant.v) * 100 : null, var30d: mes && mes !== ult ? ((ult.v - mes.v) / mes.v) * 100 : null, serie };
}
const isoMenos = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10);

// ------------------------------------------------------------ notícias
const FEEDS = [
  ["Canal Rural", "https://www.canalrural.com.br/pecuaria/feed/"],
  ["Canal Rural", "https://www.canalrural.com.br/feed/"],
  ["Giro do Boi", "https://girodoboi.canalrural.com.br/feed/"],
  ["g1 Agro", "https://g1.globo.com/rss/g1/economia/agronegocios/"],
  ["BeefPoint", "https://beefpoint.com.br/feed/"],
];
// Peso de cada assunto para quem cria gado de corte. O título vale o dobro do resumo.
const TEMAS = [
  ["mercado", 5, /arroba|boi gordo|pre[çc]o d[oa] (boi|arroba|bezerro|vaca)|cota[çc][ãa]o|escala[s]? de abate|frigor[íi]fico|mercado do boi|indicador|b3|mercado futuro/],
  ["exportacao", 4, /exporta|china|embarque|habilita|carne bovina/],
  ["sanidade", 4, /aftosa|brucelose|vacina|sanit[áa]ri|raiva|tuberculose|carrapato|verm[ií]f|doen[çc]a|gta|tristeza parasit/],
  ["reposicao", 4, /bezerr|reposi[çc][ãa]o|boi magro|garrote|desmama|rela[çc][ãa]o de troca/],
  ["confinamento", 3, /confina|di[áa]ria|semiconfina|tip\b|terminação intensiva/],
  ["insumos", 3, /milho|farelo|soja|ra[çc][ãa]o|suplement|sal mineral|fertiliz|ureia|silagem/],
  ["clima", 3, /chuva|seca|estiagem|geada|el ni[ñn]o|la ni[ñn]a|pastage|capim|clima/],
  ["credito", 3, /cr[ée]dito|plano safra|juros|financiamento|pronamp|seguro rural|d[íi]vida/],
  ["politica", 2, /minist[ée]rio|governo|lei\b|imposto|funrural|tribut|mapa\b/],
  ["pecuaria", 2, /pecu[áa]ri|bovino|gado|rebanho|nelore|angus|abate|novilh/],
];
const FORA = /su[íi]n|frango|ave[s]? |aves\b|leite|leiteir|caf[ée]\b|cana|algod|laranja|cacau|pescado|peixe|ovos?\b|hortali|flores|vinho|uva\b|banana/;

function itensRss(xml) {
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/g)].map((m) => {
    const it = m[0], tag = (t) => (it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`)) || [])[1];
    const resumo = limpar(tag("atom:subtitle") || tag("description")).replace(/^\s*(Leia mais|Continue lendo).*/i, "");
    return { titulo: limpar(tag("title")), link: limpar(tag("link")), data: new Date(limpar(tag("pubDate"))).toISOString(), resumo: resumo.slice(0, 280).replace(/\s\S*$/, resumo.length > 280 ? "…" : ""), cats: [...it.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((c) => limpar(c[1])).join(" ") };
  }).filter((n) => n.titulo && n.link && !Number.isNaN(Date.parse(n.data)));
}
const normal = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function pontuar(n, agora) {
  const tit = n.titulo.toLowerCase(), resto = (n.resumo + " " + n.cats).toLowerCase();
  let p = 0; const temas = [];
  for (const [k, peso, re] of TEMAS) {
    const t = re.test(tit), r = re.test(resto);
    if (t || r) { p += peso * (t ? 2 : 1); temas.push(k); }
  }
  if (FORA.test(tit) && !/boi|bovin|gado|arroba|pecu/.test(tit)) p -= 12;
  if (/v[oô]c[eê] viu|conhe[çc]a a hist[óo]ria|receita|curiosidade|famoso|vaca mais cara/i.test(tit)) p -= 6;
  const horas = (agora - Date.parse(n.data)) / 36e5;
  p -= horas / 12; // notícia de ontem perde 2 pontos para a de hoje
  return { ...n, pontos: Math.round(p * 10) / 10, temas };
}
async function noticias() {
  const agora = Date.now(), todas = [];
  for (const [fonte, url] of FEEDS) {
    try { const xs = itensRss(await baixar(url)); xs.forEach((x) => todas.push({ ...x, fonte })); log(`  ${fonte}: ${xs.length} notícias`); }
    catch (e) { log(`  ${fonte}: falhou (${e.message})`); }
  }
  // tira repetidas (mesmo link ou título quase igual) e as velhas
  const vistos = new Set(), unicas = [];
  for (const n of todas.sort((a, b) => b.data.localeCompare(a.data))) {
    const k = normal(n.titulo).replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 7).join(" ");
    if (vistos.has(n.link) || vistos.has(k)) continue;
    vistos.add(n.link); vistos.add(k);
    if ((agora - Date.parse(n.data)) / 864e5 <= DIAS_NOTICIA) unicas.push(n);
  }
  return unicas.map((n) => pontuar(n, agora)).filter((n) => n.pontos > 0 && n.temas.length)
    .sort((a, b) => b.pontos - a.pontos).slice(0, MAX_NOTICIAS)
    .map(({ cats, pontos, ...n }) => n);
}

// ------------------------------------------------------------ principal
const anterior = await (async () => {
  if (SECO) return {};
  const { db } = await banco();
  return (await db.doc("publico/indices").get()).data() || {};
})();
const velhas = Object.fromEntries((anterior.cotacoes || []).map((c) => [c.k, c]));
const falhas = [];
const tentar = async (nome, f) => { try { return await f(); } catch (e) { falhas.push(`${nome}: ${e.message}`); log(`! ${nome}: ${e.message}`); return null; } };

log("Cotações:");
const pr = await tentar("praças (Scot)", scotPracas);
if (pr) log(`  praças: ${pr.pracas.length} em ${pr.data}`, JSON.stringify(pr.pracas.slice(0, 4)));
const sp = pr && pr.pracas.find((p) => /s[ãa]o paulo|^sp\b/i.test(p.praca));
const serieArroba = juntar(velhas.arroba?.serie, sp && pr.data ? [{ d: pr.data, v: sp.boi }] : []);
const serieDolar = (await tentar("dólar (Banco Central)", dolar)) || velhas.dolar?.serie || [];
log(`  arroba SP: ${sp ? sp.boi : "—"} · dólar: ${serieDolar.length ? serieDolar[serieDolar.length - 1].v : "—"}`);

const cotacoes = [
  cotacao({ k: "arroba", nome: "Boi gordo", praca: "São Paulo, à vista", unidade: "R$/@", fonte: "Scot Consultoria", dec: 2 }, serieArroba),
  cotacao({ k: "dolar", nome: "Dólar", praca: "comercial, venda", unidade: "R$", fonte: "Banco Central", dec: 3 }, juntar(velhas.dolar?.serie, serieDolar)),
].filter(Boolean);

log("Notícias:");
const nots = (await tentar("notícias", noticias)) || [];
nots.slice(0, 8).forEach((n) => log(`  [${n.temas.join(",")}] ${n.titulo} (${n.fonte})`));

const doc = {
  atualizadoEm: new Date().toISOString(),
  cotacoes: cotacoes.length ? cotacoes : anterior.cotacoes || [],
  pracas: pr && pr.pracas.length ? pr.pracas : anterior.pracas || [],
  pracasData: pr && pr.pracas.length ? pr.data : anterior.pracasData || null,
  pracasFonte: "Scot Consultoria, boi gordo à vista, preço bruto",
  noticias: nots.length >= 4 ? nots : anterior.noticias || nots,
  falhas,
};
log(`Documento: ${JSON.stringify(doc).length} bytes, ${doc.cotacoes.length} cotações, ${doc.pracas.length} praças, ${doc.noticias.length} notícias.`);

if (SECO) { log("SECO=1: nada gravado."); process.exit(0); }
const { db } = await banco();
await db.doc("publico/indices").set(doc);
log("Gravado em publico/indices.");

// ------------------------------------------------------------ limpeza do registro de alterações
const corte = new Date(Date.now() - DIAS_LOG * 864e5).toISOString();
const velhos = await db.collectionGroup("log").where("quando", "<", corte).get();
let n = 0;
for (let i = 0; i < velhos.docs.length; i += 400) {
  const b = db.batch();
  velhos.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
  await b.commit(); n += Math.min(400, velhos.docs.length - i);
}
log(`Registro de alterações: ${n} linha(s) com mais de 1 ano apagada(s).`);
if (falhas.length) log(`Avisos: ${falhas.join(" · ")}`);

async function banco() {
  if (banco.c) return banco.c;
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: "demo-lote-certo" });
  else initializeApp({ credential: cert(JSON.parse(readFileSync(process.env.CHAVE, "utf8"))) });
  return (banco.c = { db: getFirestore() });
}
