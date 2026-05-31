// Pipeline de normalização: RawEvent[] (de um adapter) → ScrapedEvent[].
// Faz parse de data, descarta inválidos/passados, classifica tipo e monta
// o id estável (slug+dateISO) usado também no dedup.

import type { RawEvent, ScrapedEvent } from '../types.js';
import { parseToDate, toISODate, toDisplayPtBr, isPast } from './dates.js';
import { classifyType, iconFor, ctaFor } from './classify.js';
import { dedupKey } from './dedup.js';

export interface NormalizeContext {
  source: string;
  scrapedAt: string;
  now?: Date;
}

/**
 * Normaliza os eventos de uma fonte. Eventos com data não-parseável ou já
 * passada são descartados (com aviso no log). Retorna lista pronta p/ dedup.
 */
export function normalizeEvents(raws: RawEvent[], ctx: NormalizeContext): ScrapedEvent[] {
  const out: ScrapedEvent[] = [];
  for (const raw of raws) {
    const d = parseToDate(raw.rawDate);
    if (!d) {
      console.warn(`[${ctx.source}] data não-parseável, descartado: "${raw.rawDate}" (${raw.title})`);
      continue;
    }
    const dateISO = toISODate(d);
    if (isPast(dateISO, ctx.now)) continue; // evento passado, ignora silenciosamente

    // Só aceita URLs http(s) — barra schemes perigosos vindos da fonte.
    if (!/^https?:\/\//i.test(raw.url)) {
      console.warn(`[${ctx.source}] url não-http descartada: "${raw.url}" (${raw.title})`);
      continue;
    }

    // Imagem só se for http(s); senão ignora (não bloqueia o evento).
    const imageUrl =
      raw.imageUrl && /^https?:\/\//i.test(raw.imageUrl) ? raw.imageUrl : undefined;

    const type = classifyType(raw.title, raw.typeHint);
    out.push({
      id: dedupKey(raw.title, dateISO),
      title: raw.title.trim(),
      type,
      date: toDisplayPtBr(dateISO),
      location: raw.location.trim(),
      ctaLabel: ctaFor(type),
      icon: iconFor(type),
      dateISO,
      source: ctx.source,
      sourceUrl: raw.url,
      ...(imageUrl ? { imageUrl } : {}),
      ...(raw.accentColor ? { accentColor: raw.accentColor } : {}),
      scrapedAt: ctx.scrapedAt,
    });
  }
  return out;
}
