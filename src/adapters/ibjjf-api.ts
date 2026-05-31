// Factory para IBJJF e CBJJ — compartilham o mesmo CMS (Rails) e a mesma
// API interna: GET /api/v1/events/calendar.json (exige headers de XHR).
// Resposta: { infosite_events: [{ name, year, month, startDay, intervalDays,
//   local, city, status, pageUrl, ... }] }. Datas vêm como year + month
// (abreviação EN no IBJJF, PT no CBJJ) + startDay → montamos ISO direto.

import { httpGet } from '../http.js';
import type { SourceAdapter, RawEvent } from '../types.js';

// Mapa bilíngue (EN + PT) de abreviação de mês → número. Lowercase.
const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02', fev: '02',
  mar: '03',
  apr: '04', abr: '04',
  may: '05', mai: '05',
  jun: '06',
  jul: '07',
  aug: '08', ago: '08',
  sep: '09', set: '09',
  oct: '10', out: '10',
  nov: '11',
  dec: '12', dez: '12',
};

interface InfositeEvent {
  name?: string;
  year?: number;
  month?: string;
  startDay?: number;
  local?: string | null;
  city?: string | null;
  status?: string;
  pageUrl?: string | null;
  logoBaseColor?: string | null; // cor hex do evento/federação
}

interface CalendarResponse {
  infosite_events?: InfositeEvent[];
}

function monthToNum(month: string | undefined): string | null {
  if (!month) return null;
  return MONTHS[month.trim().slice(0, 3).toLowerCase()] ?? null;
}

export function createIbjjfApiAdapter(opts: {
  name: string;
  baseUrl: string; // ex.: "https://ibjjf.com"
  priority: number;
}): SourceAdapter {
  const { name, baseUrl, priority } = opts;
  return {
    name,
    strategy: 'http',
    priority,
    async fetchRaw() {
      return httpGet<CalendarResponse>(`${baseUrl}/api/v1/events/calendar.json`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Referer: `${baseUrl}/events/calendar`,
        },
      });
    },
    parse(raw): RawEvent[] {
      const data = raw as CalendarResponse;
      const events = data.infosite_events ?? [];
      const out: RawEvent[] = [];
      for (const e of events) {
        if (e.status === 'finished') continue; // já aconteceu
        const mm = monthToNum(e.month);
        // Valida tipos e ranges dos campos externos antes de montar a data.
        if (!mm || !e.name) continue;
        if (typeof e.year !== 'number' || e.year < 2020 || e.year > 2100) continue;
        if (typeof e.startDay !== 'number' || e.startDay < 1 || e.startDay > 31) continue;
        const day = String(e.startDay).padStart(2, '0');
        const accentColor =
          typeof e.logoBaseColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.logoBaseColor)
            ? e.logoBaseColor
            : undefined;
        out.push({
          title: e.name,
          rawDate: `${e.year}-${mm}-${day}`,
          location: [e.local, e.city].filter(Boolean).join(', '),
          url: e.pageUrl ? `${baseUrl}${e.pageUrl}` : `${baseUrl}/events/calendar`,
          typeHint: 'competition',
          accentColor,
        });
      }
      return out;
    },
  };
}
