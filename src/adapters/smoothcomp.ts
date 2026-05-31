// Smoothcomp serve a lista de eventos como um array JSON embutido no HTML
// (`var events = [...]`). Não precisa de browser: fetch do HTML + extração
// do array. Filtra eventos do Brasil (location_country === 'BR') e não
// encerrados — o app é voltado ao público brasileiro.

import { httpGet } from '../http.js';
import type { SourceAdapter, RawEvent } from '../types.js';

const UPCOMING_URL = 'https://smoothcomp.com/en/events/upcoming';
const COUNTRY = 'BR';

interface SmoothcompEvent {
  title?: string;
  startdate?: string; // "2026-05-31"
  location_city?: string;
  location_country?: string;
  location_country_human?: string;
  url?: string;
  cover_image?: string; // capa real do evento
  eventEnded?: boolean;
}

/**
 * Extrai o array `var events = [...]` do HTML por balanceamento de colchetes
 * (ignora colchetes dentro de strings). Exportado p/ teste com fixtures.
 */
export function extractEventsArray(html: string): SmoothcompEvent[] {
  const marker = 'var events = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const start = idx + marker.length;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let k = start; k < html.length; k++) {
    const c = html[k];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        end = k + 1;
        break;
      }
    }
  }
  if (end === -1) return [];
  try {
    const parsed = JSON.parse(html.slice(start, end));
    return Array.isArray(parsed) ? (parsed as SmoothcompEvent[]) : [];
  } catch {
    // HTML malformado ou estrutura mudou — não deixa o JSON.parse derrubar a fonte.
    console.warn('[smoothcomp] falha ao parsear o array var events (layout mudou?)');
    return [];
  }
}

export const smoothcompAdapter: SourceAdapter = {
  name: 'smoothcomp',
  strategy: 'http',
  priority: 1, // agregador: perde p/ federação oficial em colisão de dedup
  async fetchRaw() {
    return httpGet<string>(UPCOMING_URL, { json: false });
  },
  parse(raw): RawEvent[] {
    const html = raw as string;
    const events = extractEventsArray(html);
    const out: RawEvent[] = [];
    for (const e of events) {
      if (e.eventEnded) continue;
      if (e.location_country !== COUNTRY) continue;
      if (typeof e.title !== 'string' || typeof e.startdate !== 'string' || typeof e.url !== 'string') {
        continue; // campos externos com tipo inesperado — descarta
      }
      out.push({
        title: e.title,
        rawDate: e.startdate,
        location: [e.location_city, e.location_country_human].filter(Boolean).join(', '),
        url: e.url,
        typeHint: 'competition',
        imageUrl: typeof e.cover_image === 'string' ? e.cover_image : undefined,
      });
    }
    return out;
  },
};
