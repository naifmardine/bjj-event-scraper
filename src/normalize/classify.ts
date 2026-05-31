// Heurística para classificar um RawEvent em EventType + ícone + label de CTA.
// Federações publicam majoritariamente competições; default é 'competition'.

import type { EventType } from '../types.js';

const ICON_BY_TYPE: Record<EventType, string> = {
  competition: '🏆',
  promotion: '🥋',
  open_mat: '🤝',
  seminar: '📚',
};

const CTA_BY_TYPE: Record<EventType, string> = {
  competition: 'Ver Detalhes',
  promotion: 'Ver Detalhes',
  open_mat: 'Participar',
  seminar: 'Saiba Mais',
};

/** Mapeia um possível `typeHint` da fonte ou o título para um EventType. */
export function classifyType(title: string, typeHint?: string): EventType {
  const hint = (typeHint ?? '').toLowerCase();
  const t = title.toLowerCase();

  if (/(seminar|seminário|workshop)/.test(hint + ' ' + t)) return 'seminar';
  if (/(open ?mat|treino aberto)/.test(hint + ' ' + t)) return 'open_mat';
  if (/(gradua|promotion|belt)/.test(hint + ' ' + t)) return 'promotion';
  // championship, open, cup, copa, campeonato, taça, gp, trials...
  return 'competition';
}

export function iconFor(type: EventType): string {
  return ICON_BY_TYPE[type];
}

export function ctaFor(type: EventType): string {
  return CTA_BY_TYPE[type];
}
