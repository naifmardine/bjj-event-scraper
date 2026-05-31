// Singleton lazy do Playwright. Só importa/inicia o chromium quando
// um adapter de strategy 'browser' realmente precisa — adapters HTTP
// nunca pagam o custo de subir um navegador.

import type { Browser, Page } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

const USER_AGENT =
  'BJJAvatarBot/1.0 (+https://github.com/naif/bjj-event-scraper; jiu-jitsu event calendar)';

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import('playwright').then(({ chromium }) =>
      chromium.launch({ headless: true }),
    );
  }
  return browserPromise;
}

/** Abre uma página configurada, executa `fn` e garante o fechamento do contexto. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** Fecha o navegador, se aberto. Chamar ao fim do pipeline. */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
