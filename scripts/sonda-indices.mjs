// Sonda temporária: mostra o que a B3 publica do boi gordo. Não grava nada em lugar nenhum.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const r = await fetch("https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/BGI", { headers: { "user-agent": UA } });
const j = await r.json();
console.log("status", r.status, "msg", JSON.stringify(j.Msg), "chaves", Object.keys(j));
const fut = j.Scty.filter((s) => s.mkt?.cd !== "FOPT");
console.log("futuros:", fut.length, "de", j.Scty.length);
fut.forEach((s) => console.log(JSON.stringify(s)));
for (const u of ["https://cotacao.b3.com.br/mds/api/v1/DailyFluctuationHistory/BGIX26", "https://cotacao.b3.com.br/mds/api/v1/InstrumentQuotation/BGIX26", "https://cotacao.b3.com.br/mds/api/v1/DerivativeQuotation/CCM"]) {
  try { const x = await fetch(u, { headers: { "user-agent": UA } }); const t = await x.text(); console.log("\n==", u, x.status, t.length); console.log(t.slice(0, 2500)); } catch (e) { console.log(u, "ERRO", e.message); }
}
