// Índices de exemplo, usados só no modo demonstração (os números são fictícios).
// No sistema de verdade eles vêm do documento publico/indices, que o robô diário grava.
import { hojeISO, nDia, isoDia } from "./calc.js";

export function indicesExemplo() {
  const H = nDia(hojeISO()), d = (n) => isoDia(H - n);
  // série de 90 dias que sobe devagar, com ondas, para o gráfico
  const serie = (base, amp, tend, n = 90, dec = 2) => Array.from({ length: n }, (_, i) => {
    const k = n - 1 - i;
    const v = base - tend * (k / n) + amp * Math.sin(k / 6) + (amp / 2) * Math.sin(k / 2.3);
    return { d: d(k), v: Math.round(v * 10 ** dec) / 10 ** dec };
  }).filter((x) => { const s = new Date(x.d + "T12:00:00").getDay(); return s !== 0 && s !== 6; });
  const arroba = serie(326.4, 3.2, 14), bezerro = serie(2985, 28, 120, 90, 0), milho = serie(71.8, 1.1, -3), soja = serie(138.5, 1.8, 6), dolar = serie(5.42, 0.05, 0.08, 90, 3);
  const cot = (k, nome, praca, unidade, s, fonte, dec = 2) => {
    const ult = s[s.length - 1], ant = s[s.length - 2], mes = s[Math.max(0, s.length - 22)];
    return { k, nome, praca, unidade, valor: ult.v, data: ult.d, var1d: ((ult.v - ant.v) / ant.v) * 100, var30d: ((ult.v - mes.v) / mes.v) * 100, serie: s, fonte, dec };
  };
  const hora = (n, h) => `${d(n)}T${String(h).padStart(2, "0")}:00:00-03:00`;
  return {
    exemplo: true,
    atualizadoEm: `${d(0)}T07:05:00-03:00`,
    cotacoes: [
      cot("arroba", "Boi gordo", "Indicador São Paulo", "R$/@", arroba, "CEPEA/Esalq"),
      cot("bezerro", "Bezerro", "Mato Grosso do Sul", "R$/cabeça", bezerro, "CEPEA/Esalq", 0),
      cot("milho", "Milho", "Campinas (SP)", "R$/saca 60 kg", milho, "CEPEA/Esalq"),
      cot("soja", "Soja", "Paranaguá (PR)", "R$/saca 60 kg", soja, "CEPEA/Esalq"),
      cot("dolar", "Dólar", "comercial", "R$", dolar, "Banco Central", 3),
    ],
    pracas: [
      { praca: "SP", boi: 326, vaca: 301, novilha: 314 },
      { praca: "MS (Campo Grande)", boi: 315, vaca: 292, novilha: 303 },
      { praca: "MT (Cuiabá)", boi: 306, vaca: 285, novilha: 295 },
      { praca: "GO (Goiânia)", boi: 314, vaca: 290, novilha: 302 },
      { praca: "MG (Triângulo)", boi: 318, vaca: 294, novilha: 306 },
      { praca: "PR (Noroeste)", boi: 320, vaca: 297, novilha: 309 },
      { praca: "TO (Araguaína)", boi: 302, vaca: 280, novilha: 291 },
      { praca: "PA (Marabá)", boi: 298, vaca: 276, novilha: 287 },
    ],
    pracasFonte: "Scot Consultoria, à vista, sem Funrural",
    noticias: [
      { titulo: "Arroba do boi sobe pela terceira semana com escalas curtas nos frigoríficos", fonte: "Canal Rural", data: hora(0, 6), temas: ["mercado", "pecuaria"], resumo: "Com a oferta de boiada terminada mais apertada na entressafra, as indústrias de São Paulo trabalham com escalas de quatro a cinco dias e pagam mais para completar os abates." },
      { titulo: "China renova habilitação de mais seis frigoríficos brasileiros para exportar carne bovina", fonte: "Globo Rural", data: hora(0, 5), temas: ["exportacao", "mercado"], resumo: "Com as novas plantas, sobe para 48 o número de unidades autorizadas. Exportação de novembro caminha para recorde em volume." },
      { titulo: "Milho recua em Campinas com chegada da safrinha armazenada ao mercado", fonte: "Notícias Agrícolas", data: hora(1, 18), temas: ["insumos", "mercado"], resumo: "Produtores que guardaram o grão começam a vender para abrir espaço nos armazéns. Bom momento para quem compra milho para o trato." },
      { titulo: "Ministério confirma calendário da vacinação contra brucelose em fêmeas de 3 a 8 meses", fonte: "Portal DBO", data: hora(1, 14), temas: ["sanidade"], resumo: "A vacinação segue obrigatória nas bezerras e deve ser feita por veterinário cadastrado. Prazo para comprovar vai até o fim do semestre." },
      { titulo: "Chuva volta ao Centro-Oeste e pastagens começam a rebrotar", fonte: "Canal Rural", data: hora(1, 9), temas: ["clima", "pecuaria"], resumo: "Volumes acima de 40 mm na semana em Goiás e Mato Grosso do Sul. Pecuaristas podem programar a volta do gado do confinamento para o pasto." },
      { titulo: "Reposição: bezerro fica mais caro e relação de troca piora para o recriador", fonte: "Scot Consultoria", data: hora(2, 16), temas: ["mercado", "reposicao"], resumo: "Um boi gordo de 18 arrobas compra hoje cerca de 1,9 bezerro em Mato Grosso do Sul, contra 2,1 há um ano." },
      { titulo: "Crédito rural: bancos liberam linha de custeio pecuário com juros controlados", fonte: "Globo Rural", data: hora(2, 11), temas: ["credito", "politica"], resumo: "Linha do Plano Safra para custeio de engorda e compra de animais tem limite por produtor e exige cadastro ambiental rural em dia." },
      { titulo: "Confinamento: custo da diária cai com milho e farelo mais baratos", fonte: "Portal DBO", data: hora(3, 10), temas: ["confinamento", "insumos"], resumo: "Levantamento com confinadores aponta diária média abaixo do mesmo período do ano passado, o que melhora a margem de quem trava a arroba." },
      { titulo: "Febre aftosa: Brasil mantém status de livre sem vacinação e reforça trânsito com GTA", fonte: "Notícias Agrícolas", data: hora(3, 8), temas: ["sanidade", "politica"], resumo: "Fiscalização nas barreiras foi ampliada. Animais sem GTA ou com GTA vencida podem ser apreendidos." },
      { titulo: "Mercado futuro da arroba aponta alta para o primeiro trimestre", fonte: "Canal Rural", data: hora(4, 17), temas: ["mercado"], resumo: "Contratos para março negociados na B3 acima do preço à vista indicam que o mercado espera oferta curta até a próxima safra de capim." },
    ],
  };
}
