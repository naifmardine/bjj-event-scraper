// Orquestrador. Roda cada adapter isolado (falha de um não derruba os outros),
// normaliza, faz merge NÃO-DESTRUTIVO (fonte que falha preserva seus eventos
// futuros do JSON anterior), deduplica, ordena por data e grava events.json.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScrapedEvent } from './types.js';
import { adapters, priorityBySource } from './adapters/registry.js';
import { normalizeEvents } from './normalize/index.js';
import { dedupe } from './normalize/dedup.js';
import { isPast } from './normalize/dates.js';
import { closeBrowser } from './browser.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/events.json');

async function loadPrevious(): Promise<ScrapedEvent[]> {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8')) as ScrapedEvent[];
  } catch {
    return [];
  }
}

async function main() {
  const scrapedAt = new Date().toISOString();
  const previous = await loadPrevious();
  const collected: ScrapedEvent[] = [];
  const failedSources = new Set<string>();
  let usedBrowser = false;

  for (const adapter of adapters) {
    try {
      if (adapter.strategy === 'browser') usedBrowser = true;
      const raw = await adapter.fetchRaw();
      const rawEvents = adapter.parse(raw);
      const normalized = normalizeEvents(rawEvents, { source: adapter.name, scrapedAt });

      // Alerta de regressão: tinha histórico futuro e agora veio vazio.
      const hadHistory = previous.some((e) => e.source === adapter.name);
      if (normalized.length === 0 && hadHistory) {
        console.error(
          `::warning::[${adapter.name}] retornou 0 eventos tendo histórico — possível quebra de layout/endpoint`,
        );
        failedSources.add(adapter.name);
      } else {
        console.log(`[${adapter.name}] ${normalized.length} eventos futuros`);
        collected.push(...normalized);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`::warning::[${adapter.name}] falhou: ${msg}`);
      failedSources.add(adapter.name);
    }
  }

  if (usedBrowser) await closeBrowser();

  // Merge não-destrutivo: para fontes que falharam, reaproveita os eventos
  // futuros do JSON anterior — evita zerar dados por uma queda pontual.
  const preservedSources = [...failedSources];
  for (const ev of previous) {
    if (preservedSources.includes(ev.source) && !isPast(ev.dateISO)) {
      collected.push(ev);
    }
  }

  // Aborta gravação se TUDO falhou — não sobrescreve com lista vazia.
  if (collected.length === 0) {
    console.error('::error::Nenhum evento coletado de nenhuma fonte. Mantendo events.json anterior.');
    process.exit(1);
  }

  const deduped = dedupe(collected, priorityBySource).sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO),
  );

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
  console.log(
    `\nGravado ${deduped.length} eventos em data/events.json` +
      (failedSources.size ? ` (fontes preservadas: ${preservedSources.join(', ')})` : ''),
  );
}

main().catch((err) => {
  console.error('::error::Falha fatal no scraper:', err);
  process.exit(1);
});
