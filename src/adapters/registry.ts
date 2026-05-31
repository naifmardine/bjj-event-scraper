// Adapters ativos. Prioridade maior vence em colisão de dedup:
// federações oficiais (IBJJF/CBJJ) > agregador (Smoothcomp).

import type { SourceAdapter } from '../types.js';
import { createIbjjfApiAdapter } from './ibjjf-api.js';
import { smoothcompAdapter } from './smoothcomp.js';

export const adapters: SourceAdapter[] = [
  createIbjjfApiAdapter({ name: 'cbjj', baseUrl: 'https://cbjj.com.br', priority: 3 }),
  createIbjjfApiAdapter({ name: 'ibjjf', baseUrl: 'https://ibjjf.com', priority: 2 }),
  smoothcompAdapter,
];

/** Mapa source → prioridade, derivado dos adapters. Usado no dedup. */
export const priorityBySource: Record<string, number> = Object.fromEntries(
  adapters.map((a) => [a.name, a.priority]),
);
