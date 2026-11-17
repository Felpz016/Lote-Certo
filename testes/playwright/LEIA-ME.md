# Testes de navegador (Playwright)

Testes automáticos do sistema, rodando no **computador** (Chrome 1366×800) e no **celular** (Pixel 7 emulado).
Opcional: **iPhone** (Safari emulado), ligando `IPHONE=1`.

Os testes abrem o sistema local no **modo demonstração** (`/app/?demo`): não usam banco, não precisam de conta e
não gravam nada na nuvem. Cada teste começa com o navegador limpo. A única exceção é um teste do `01-acesso` que
só abre a página publicada e confere o botão de entrar (marcado com `@producao`).

## Como rodar

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez (webkit também, se for testar o iPhone)
npm run teste                      # computador e celular
npm run teste:pc                   # só computador
npm run teste:celular              # só celular
npx playwright test --grep-invert @producao   # sem abrir o endereço publicado
IPHONE=1 npx playwright test --project=iphone # iPhone
npm run teste:relatorio            # abre o relatório com prints e vídeos das falhas
```

O Playwright sobe o `npm run dev` sozinho (ou usa o que já estiver rodando em http://localhost:8080).
Os scripts antigos `fluxo-demo.js` (fluxo inteiro em um só teste) e `e2e.js` (login, assinatura e regras do banco,
com os emuladores do Firebase) continuam valendo.

## Casos de teste

Todos rodam nos dois tamanhos. Os marcados com (celular) só fazem sentido no celular.

| Arquivo | Caso | O que confere |
|---|---|---|
| 01-acesso | Tela de entrada | Sem login aparece "Entrar com Google" e nenhum dado. |
| | Site de vendas | Abre e tem link para o sistema. |
| | Modo demonstração | Abre o Painel da Fazenda Boa Vista. |
| | Endereço publicado | lote-certo-2ec77.web.app/app/ mostra o botão de entrar (só leitura). |
| 02-navegacao | Layout | Computador: menu lateral. Celular: barra de baixo com 4 áreas + "Mais". |
| | Todas as áreas | Abre as 10 áreas pelo menu, como a pessoa faz. |
| | Abas | Trocar de aba em Lotes muda a tela. |
| | Largura (celular) | Nenhuma área rola para o lado. |
| | "Mais" (celular) | Abre com Conta e Excel e fecha ao tocar fora. |
| 03-lotes | Fazenda nova | Começa sem lotes. |
| | Entrada | 10 × 300 kg × R$ 10 + 500 + 500 = R$ 31.000; lote 001 nos ativos e na gaveta. |
| | Validação | Data no futuro, sem cabeças, sem peso e sem raça são recusados. |
| | Compra, alvo, capacidade e morte | Aquisição R$ 62.000 e quebra 3,2%; previsão do peso-alvo em 80 dias; aviso de pasto acima da capacidade; morte de 1 em 20 = 5,0% sem tirar custo. |
| 04-pasto | Cadastro | Pasto A e Pasto B aparecem. |
| | Mudança de pasto | Pasto antigo fica "Vazio há 3 dias". |
| 05-pesagem | Pesagem | Estimado 306,0 kg, balança 309, GMD real 1,500. |
| | Abas | Ajuste de GMD e Apartação abrem. |
| 06-sanidade | Medicamento | R$ 30 / 50 ml = R$ 0,60/ml; preço novo futuro não muda o atual. |
| | Protocolo e tratamento | 5 ml × 10 cab = R$ 30,00; tratamento R$ 6,00; gaveta soma R$ 36,00. |
| | Calendário | Manejo atrasado aparece no Painel. |
| 07-trato | Dieta | 90% recusada ("Tem que dar 100%"); com 100% custa R$ 1,100/kg. |
| | Trato do dia | 31 kg de MS, 35 kg no vagão, 3,5 kg de farelo. |
| | Fornecimento real | 100 kg × R$ 1,100 = R$ 110,00. |
| 08-custos | Fixo | Vaqueiro lançado. |
| | Geral | R$ 36.000 em 12 meses = R$ 3.000,00 por mês. |
| 09-saida | Fechamento | 194,4 @ e R$ 58.320; dois custos por dia; histórico pede rendimento real; com 55% vira 198,0 @; lote sai do Painel. |
| 10-financeiro | Geral e por lote | 3+ gráficos, receita R$ 59,4 mil, R$ 59.400 no lote. |
| | Projeção e relatórios | Preço que empata do lote 001; comparativo por pasto e demonstrativo. |
| | Perfil campo | Sem financeiro, sem Excel e sem nenhum valor em R$. |
| 11-indices | Cotações | Arroba 402,15, vencimentos, 8+ notícias e "Para a sua fazenda hoje". |
| | Dólar e filtro | Gráfico do dólar com a fonte; filtro de notícias por assunto. |
| | Perfil campo | Vê os preços, não vê as contas da fazenda. |
| 12-excel | Pelo painel | Baixa o .xlsx e confere as abas (Resumo, Lotes, Entradas, Saídas, Pesagens, Sanidade, Trato, Custos). |
| | Pelo menu | Igual, pelo menu lateral (computador) ou "Mais" (celular). |
| 13-conta | Duas fazendas | Cria outra, ela começa vazia, volta para a primeira (seletor no computador, tela da conta no celular). |
| | Nome repetido | Recusado. |
| | Recarregar | Lançamentos continuam depois de recarregar a página. |
| | Importação e registro | Aparecem na tela da conta. |

Todo teste também falha se a página tiver qualquer erro de JavaScript.
