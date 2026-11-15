// Sonda temporária: testa de quais fontes o robô consegue ler. Não grava nada em lugar nenhum.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const hoje = new Date(), ini = new Date(Date.now() - 100 * 864e5);
const us = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
const fontes = [
  ["cepea-boi", "https://www.cepea.org.br/br/indicador/boi-gordo.aspx"],
  ["cepea-widget", "https://www.cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=400px&corfundo=dbd6b2&cortexto=333333&corlinha=ede7bf&id_indicador%5B%5D=2&id_indicador%5B%5D=8&id_indicador%5B%5D=77&id_indicador%5B%5D=92"],
  ["na-boi", "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/boi-gordo-indicador-esalq-bmf"],
  ["na-boi-geral", "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo"],
  ["na-milho", "https://www.noticiasagricolas.com.br/cotacoes/milho/indicador-cepea-esalq-milho"],
  ["na-soja", "https://www.noticiasagricolas.com.br/cotacoes/soja/soja-indicador-cepea-esalq-porto-paranagua"],
  ["na-milho-geral", "https://www.noticiasagricolas.com.br/cotacoes/milho"],
  ["na-soja-geral", "https://www.noticiasagricolas.com.br/cotacoes/soja"],
  ["scot", "https://www.scotconsultoria.com.br/cotacoes/boi-gordo/"],
  ["bcb-ptax", `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@a,dataFinalCotacao=@b)?@a='${us(ini)}'&@b='${us(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`],
  ["bcb-sgs", "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/5?formato=json"],
  ["rss-canalrural", "https://www.canalrural.com.br/feed/"],
  ["rss-canalrural-pec", "https://www.canalrural.com.br/pecuaria/feed/"],
  ["rss-g1", "https://g1.globo.com/rss/g1/economia/agronegocios/"],
  ["rss-na", "https://www.noticiasagricolas.com.br/rss/noticias.xml"],
  ["rss-dbo", "https://www.portaldbo.com.br/feed/"],
  ["rss-beefpoint", "https://www.beefpoint.com.br/feed/"],
  ["rss-agrolink", "https://www.agrolink.com.br/rss/noticias.xml"],
  ["rss-girodoboi", "https://www.girodoboi.com.br/feed/"],
  ["rss-compre", "https://www.comprerural.com/feed/"],
  ["rss-cnn", "https://www.cnnbrasil.com.br/agro/feed/"],
  ["rss-google", "https://news.google.com/rss/search?q=pecu%C3%A1ria+OR+%22boi+gordo%22+OR+arroba+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419"],
];
for (const [nome, url] of fontes) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml,application/json;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    const txt = /8859|latin/i.test(ct) ? buf.toString("latin1") : buf.toString("utf8");
    console.log(`\n===== ${nome} · ${r.status} · ${ct} · ${buf.length} bytes · ${r.url}`);
    if (!r.ok) { console.log(txt.slice(0, 200).replace(/\s+/g, " ")); continue; }
    if (nome.startsWith("rss")) {
      const itens = [...txt.matchAll(/<item[\s\S]*?<\/item>/g)].slice(0, 2).map((m) => m[0].replace(/\s+/g, " ").slice(0, 700));
      console.log("itens:", (txt.match(/<item/g) || []).length); itens.forEach((i) => console.log("  ", i));
    } else if (nome.startsWith("bcb")) console.log(txt.slice(0, 400));
    else {
      const tabelas = [...txt.matchAll(/<table[\s\S]*?<\/table>/g)];
      console.log("tabelas:", tabelas.length, "· title:", (txt.match(/<title>([^<]*)/) || [])[1]);
      tabelas.slice(0, nome === "scot" || nome.includes("geral") ? 6 : 2).forEach((t, i) => console.log(`  [t${i}]`, t[0].replace(/<script[\s\S]*?<\/script>/g, "").replace(/\s+/g, " ").slice(0, nome === "scot" ? 1500 : 900)));
      if (!tabelas.length) console.log(txt.replace(/\s+/g, " ").slice(0, 1200));
      const links = [...new Set([...txt.matchAll(/href="(\/cotacoes\/[^"#]+)"/g)].map((m) => m[1]))];
      if (nome.includes("geral")) console.log("  links:", links.slice(0, 60).join(" "));
    }
  } catch (e) { console.log(`\n===== ${nome} · ERRO ${e.name}: ${e.message} ${e.cause ? e.cause.code || e.cause.message : ""}`); }
}
