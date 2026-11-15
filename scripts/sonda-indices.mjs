// Sonda temporária: testa de quais fontes o robô consegue ler. Não grava nada em lugar nenhum.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const fontes = ["boi-gordo", "vaca-gorda", "novilha", "reposicao", "bezerro", "milho", "soja", "mercado-futuro", "boi-gordo/?ref=smn", ""].map((p) => ["scot-" + (p || "raiz"), "https://www.scotconsultoria.com.br/cotacoes/" + p + (p && !p.includes("?") ? "/" : "")]);
fontes.push(["ipea", "http://www.ipeadata.gov.br/api/odata4/Metadados?$filter=contains(SERNOME,'boi')&$select=SERCODIGO,SERNOME,SERMAXDATA"]);
fontes.push(["b3", "https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/BGI"]);
fontes.push(["hgbrasil", "https://api.hgbrasil.com/finance?format=json"]);
const ent = (s) => s.replace(/&nbsp;/g, " ").replace(/&[a-z]+;/gi, "~").replace(/<sup>.*?<\/sup>/g, "");
for (const [nome, url] of fontes) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const txt = Buffer.from(await r.arrayBuffer()).toString("utf8");
    console.log(`\n===== ${nome} · ${r.status} · ${txt.length} · ${r.url}`);
    if (!nome.startsWith("scot")) { console.log(txt.slice(0, 1500)); continue; }
    if (!r.ok) continue;
    if (nome === "scot-raiz" || nome === "scot-boi-gordo") console.log("links:", [...new Set([...txt.matchAll(/href="([^"]*\/cotacoes\/[^"#]*)"/g)].map((m) => m[1]))].join(" "));
    for (const [i, t] of [...txt.matchAll(/<table[\s\S]*?<\/table>/g)].entries()) {
      const linhas = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((l) => [...l[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => ent(c[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).join(" | "));
      console.log(`  [tabela ${i}] ${linhas.length} linhas`); linhas.slice(0, 45).forEach((l) => console.log("    " + l.slice(0, 220)));
    }
  } catch (e) { console.log(`\n===== ${nome} · ERRO ${e.name}: ${e.message} ${e.cause ? e.cause.code || e.cause.message : ""}`); }
}
