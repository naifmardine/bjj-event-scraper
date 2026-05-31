// Ferramenta de descoberta: abre uma SPA com Playwright, captura todas as
// requisições de rede que parecem API (JSON/ajax/events) e imprime as
// candidatas. Use isto para achar o endpoint JSON interno de uma fonte
// nova e então migrar o adapter para strategy:'http'.
//
// Uso: npx tsx scripts/discover.ts <url> [seletorParaEsperar]
// Ex.:  npx tsx scripts/discover.ts https://smoothcomp.com/en/events/upcoming
//
// Dica: muitas SPAs só disparam o fetch ao filtrar/rolar. Após abrir,
// interaja manualmente — o script fica ouvindo por ~30s.

import { chromium } from 'playwright';

const API_RE = /(api|ajax|json|graphql|events|calendar|search)/i;

async function main() {
  const url = process.argv[2];
  const waitSelector = process.argv[3];
  if (!url) {
    console.error('Uso: tsx scripts/discover.ts <url> [seletor]');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false }); // visível p/ interagir
  const page = await browser.newPage();

  const seen = new Set<string>();
  page.on('response', async (res) => {
    const reqUrl = res.url();
    const ct = res.headers()['content-type'] ?? '';
    const isJson = ct.includes('application/json');
    if ((isJson || API_RE.test(reqUrl)) && !seen.has(reqUrl)) {
      seen.add(reqUrl);
      console.log(`\n[${res.status()}] ${res.request().method()} ${reqUrl}`);
      console.log(`  content-type: ${ct}`);
      if (isJson) {
        try {
          const body = await res.json();
          const preview = JSON.stringify(body).slice(0, 300);
          console.log(`  preview: ${preview}`);
        } catch {
          /* corpo não-JSON ou já consumido */
        }
      }
    }
  });

  console.log(`Abrindo ${url} ...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  // Checa se há __NEXT_DATA__ embutido (Next.js SSR → fetch puro resolve sem browser)
  const hasNextData = await page.$('script#__NEXT_DATA__');
  if (hasNextData) {
    console.log('\n⚡ Página tem <script id="__NEXT_DATA__"> — provável Next.js.');
    console.log('   Tente fetch + extração de __NEXT_DATA__ sem browser.');
  }

  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 15_000 }).catch(() => {});
  }

  console.log('\nOuvindo rede por 30s — interaja com a página (filtros, scroll)...');
  await page.waitForTimeout(30_000);

  await browser.close();
  console.log(`\nTotal de candidatos: ${seen.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
