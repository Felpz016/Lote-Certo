// Testes de navegador do Lote Certo com o Playwright, no computador e no celular.
// Como rodar: veja testes/playwright/LEIA-ME.md.
// Por padrão os testes abrem o sistema local no modo demonstração (http://localhost:8080/app/?demo),
// que não usa banco nem conta: nada é gravado na nuvem. Só o arquivo 01-acesso tem um teste que
// lê (sem gravar nada) o endereço publicado.
const { defineConfig, devices } = require('@playwright/test');

const projetos = [
  { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
  { name: 'celular', use: { ...devices['Pixel 7'] } },
];
// iPhone (Safari) só quando pedido: precisa de "npx playwright install webkit" antes.
if (process.env.IPHONE) projetos.push({ name: 'iphone', use: { ...devices['iPhone 14'] } });

module.exports = defineConfig({
  testDir: './testes/playwright',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'testes/relatorio' }]],
  outputDir: 'testes/resultados',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    locale: 'pt-BR',
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: projetos,
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8080/app/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
