// Sonda temporária: o que o site do Indicador do Boi DATAGRO publica. Não grava nada.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const urls = ["https://www.indicadordoboi.com.br/pt-br", "https://www.indicadordoboi.com.br/", "https://www.indicadordoboi.com.br/robots.txt"];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": UA, "accept-language": "pt-BR" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log("\n==", u, r.status, r.url, t.length);
    const txt = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    console.log(txt.slice(0, 3000));
    for (const m of t.matchAll(/(?:src|href)="([^"]+)"/g)) if (!/\.(css|png|svg|ico|woff2?)(\?|$)/.test(m[1])) console.log("REF", m[1]);
    for (const m of t.matchAll(/fetch\(|axios|\/api\/[^"' ]+|\.json[^"' ]*/g)) console.log("API", m[0]);
  } catch (e) { console.log("\n==", u, "ERRO", e.message); }
}
