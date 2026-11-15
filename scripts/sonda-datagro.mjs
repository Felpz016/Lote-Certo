// Sonda temporária: o que a DATAGRO publica do indicador do boi. Não grava nada.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const urls = [
  "https://www.datagro.com/", "https://www.datagro.com/pt/", "https://portal.datagro.com/", "https://www.datagro.com/pt/boi",
  "https://beefpoint.com.br/indicador-do-boi-datagro-boletim-de-12-novembro-2026/",
  "https://beefpoint.com.br/tag/indicador-do-boi-datagro/feed/", "https://beefpoint.com.br/?s=indicador+do+boi+datagro&feed=rss2",
  "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/indicador-do-boi-datagro",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": UA, "accept-language": "pt-BR" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log("\n==", u, r.status, r.url, t.length);
    const txt = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const i = txt.search(/indicador|boi/i);
    console.log(txt.slice(Math.max(0, i - 200), i + 1500));
    for (const m of t.matchAll(/<img[^>]+src="([^"]+)"/g)) if (/datagro|boletim|indicador/i.test(m[1])) console.log("IMG", m[1]);
    for (const m of t.matchAll(/href="([^"]+)"/g)) if (/api|indicador|boi|cotac|termos|terms|licen/i.test(m[1])) console.log("LINK", m[1]);
  } catch (e) { console.log("\n==", u, "ERRO", e.message); }
}
