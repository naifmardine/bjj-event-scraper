// Deduplicação entre fontes. Um mesmo campeonato pode aparecer no site da
// federação E no Smoothcomp. Chave = título normalizado + dateISO. Em
// colisão, mantém a entrada de maior `priority` (federação oficial > agregador).

import type { ScrapedEvent } from '../types.js';

/** Normaliza um título p/ comparação: minúsculo, sem acento, sem pontuação. */
export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function dedupKey(title: string, dateISO: string): string {
  return `${slugifyTitle(title)}|${dateISO}`;
}

/**
 * Recebe eventos com prioridade de fonte e devolve sem duplicatas.
 * @param events eventos já normalizados (com dateISO e id)
 * @param priorityBySource mapa source → prioridade (maior vence)
 */
export function dedupe(
  events: ScrapedEvent[],
  priorityBySource: Record<string, number>,
): ScrapedEvent[] {
  const byKey = new Map<string, ScrapedEvent>();
  for (const ev of events) {
    const key = dedupKey(ev.title, ev.dateISO);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ev);
      continue;
    }
    const pNew = priorityBySource[ev.source] ?? 0;
    const pOld = priorityBySource[existing.source] ?? 0;
    if (pNew > pOld) byKey.set(key, ev);
  }
  return [...byKey.values()];
}
