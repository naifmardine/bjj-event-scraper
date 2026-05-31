import { describe, it, expect } from 'vitest';
import { parseToDate, toISODate, toDisplayPtBr, isPast } from '../src/normalize/dates.js';

describe('parseToDate', () => {
  it('parseia ISO', () => {
    expect(toISODate(parseToDate('2026-05-31')!)).toBe('2026-05-31');
  });
  it('parseia PT-BR por extenso', () => {
    expect(toISODate(parseToDate('24 de janeiro de 2026')!)).toBe('2026-01-24');
  });
  it('parseia EN abreviado', () => {
    expect(toISODate(parseToDate('Jan 24, 2026')!)).toBe('2026-01-24');
  });
  it('parseia dd/MM/yyyy', () => {
    expect(toISODate(parseToDate('31/05/2026')!)).toBe('2026-05-31');
  });
  it('retorna null em lixo', () => {
    expect(parseToDate('a definir')).toBeNull();
    expect(parseToDate('')).toBeNull();
  });
});

describe('toDisplayPtBr', () => {
  it('formata igual ao mock do app (mês com inicial maiúscula)', () => {
    expect(toDisplayPtBr('2026-01-24')).toBe('24 de Janeiro, 2026');
    expect(toDisplayPtBr('2026-06-05')).toBe('5 de Junho, 2026');
  });
});

describe('isPast', () => {
  const now = new Date('2026-05-31T12:00:00Z');
  it('detecta passado', () => {
    expect(isPast('2026-01-01', now)).toBe(true);
  });
  it('hoje não é passado', () => {
    expect(isPast('2026-05-31', now)).toBe(false);
  });
  it('futuro não é passado', () => {
    expect(isPast('2026-12-01', now)).toBe(false);
  });
});
