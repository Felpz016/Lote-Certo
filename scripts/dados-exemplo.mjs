// Coloca (ou apaga) os dados de exemplo na conta do administrador do Lote Certo.
// Roda pelo GitHub Actions (workflow "Dados de exemplo"), com a chave do Firebase.
//   ACAO=preencher  apaga TODAS as fazendas da conta e cria a "Fazenda Boa Vista (exemplo)"
//   ACAO=adicionar  NÃO apaga nada da conta: só cria (ou refaz) a fazenda de exemplo e,
//                   se a assinatura da conta não estiver ativa, ativa sem prazo
//   ACAO=apagar     apaga só as fazendas marcadas como exemplo
// EMAIL_CONTA escolhe a conta. Não mexe em membros, convites nem em outras contas.
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { exemplo } from "../src/exemplo.js";

const acao = process.env.ACAO;
const email = String(process.env.EMAIL_CONTA || "").trim().toLowerCase();
if (!["preencher", "adicionar", "apagar"].includes(acao) || !email) throw new Error("Informe ACAO e EMAIL_CONTA.");

// Com FIRESTORE_EMULATOR_HOST (teste no computador) usa os emuladores, sem chave.
if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: "demo-lote-certo" });
else initializeApp({ credential: cert(JSON.parse(readFileSync(process.env.CHAVE, "utf8"))) });
const fs = getFirestore();
const uid = (await getAuth().getUserByEmail(email)).uid;
console.log(`Conta: ${email.replace(/^(.{3}).*@/, "$1…@")}`);

const fazendas = fs.collection(`contas/${uid}/fazendas`);
const lista = (await fazendas.get()).docs;
const apagar = acao === "preencher" ? lista : lista.filter((d) => d.get("exemplo") === true);
if (acao === "adicionar") console.log(`A conta tem ${lista.length} fazenda(s); só a de exemplo é refeita.`);
for (const d of apagar) {
  await fs.recursiveDelete(d.ref);
  console.log(`Apagada: ${d.get("nome")}`);
}
console.log(`${apagar.length} fazenda(s) apagada(s).`);

if (acao === "adicionar") {
  const ass = fs.doc(`assinaturas/${uid}`);
  const a = (await ass.get()).data();
  const ativa = a && a.ativa === true && (!a.ate || a.ate.toMillis() > Date.now());
  if (ativa) console.log("Assinatura já ativa.");
  else {
    await ass.set({ ativa: true, ate: null, obs: "Administrador", atualizadoEm: new Date().toISOString(), atualizadoPor: "dados-exemplo" });
    console.log("Assinatura ativada (sem prazo).");
  }
}

if (acao !== "apagar") {
  const agora = new Date().toISOString();
  const faz = fazendas.doc("exemplo");
  await faz.set({ nome: "Fazenda Boa Vista (exemplo)", exemplo: true, criadoEm: agora, atualizadoEm: agora });
  const dados = exemplo();
  const w = fs.bulkWriter();
  let n = 0;
  for (const [col, docs] of Object.entries(dados)) {
    for (const { id, ...resto } of docs) {
      const limpo = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined));
      w.set(faz.collection(col).doc(id), { ...limpo, criadoEm: agora, atualizadoEm: agora });
      n++;
    }
  }
  await w.close();
  console.log(`Fazenda de exemplo criada com ${n} lançamentos.`);
}
