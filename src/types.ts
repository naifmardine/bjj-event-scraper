// Contrato compartilhado com o app BJJ Avatar.
// Espelha `lib/types.ts` do app — fonte da verdade do schema de saída.
// Mantenha `BJJEvent` e `EventType` idênticos ao app.

export type EventType = 'competition' | 'promotion' | 'open_mat' | 'seminar';

export interface BJJEvent {
  id: string;
  title: string;
  type: EventType;
  date: string; // display string PT-BR, e.g. "24 de Janeiro, 2026"
  location: string;
  ctaLabel: string;
  icon: string;
}

// Evento normalizado e versionado em data/events.json.
// Estende BJJEvent com proveniência. O app pode ignorar os campos extras
// ou usar `sourceUrl` como href do CTA.
export interface ScrapedEvent extends BJJEvent {
  dateISO: string; // "2026-01-24" — canônico p/ ordenar e dedup
  source: string; // "ibjjf" | "cbjj" | "smoothcomp"
  sourceUrl: string; // URL de detalhe/inscrição
  imageUrl?: string; // foto/capa real do evento (ex: Smoothcomp cover_image)
  accentColor?: string; // cor hex da federação p/ banner estilizado (ex: IBJJF logoBaseColor)
  scrapedAt: string; // ISO timestamp da coleta
}

// Estratégia de coleta de um adapter.
// 'http' é o default desejado (bate o endpoint JSON interno direto).
// 'browser' é fallback isolado: usa Playwright (browser.ts) só quando
// não há endpoint utilizável.
export type FetchStrategy = 'http' | 'browser';

// Evento cru, como sai de uma fonte — antes de normalizar data/dedup.
export interface RawEvent {
  title: string;
  rawDate: string; // texto como veio: "Jan 24, 2026" / "24/01/2026"
  location: string;
  url: string;
  typeHint?: string; // categoria da fonte, se houver
  imageUrl?: string; // capa real do evento, se a fonte fornecer
  accentColor?: string; // cor hex da federação, se a fonte fornecer
}

export interface SourceAdapter {
  name: string;
  strategy: FetchStrategy;
  /** Prioridade em dedup: maior vence em colisão (federação oficial > agregador). */
  priority: number;
  /** Coleta o payload bruto. Pode lançar — o orquestrador isola falhas por fonte. */
  fetchRaw(): Promise<unknown>;
  /** Transforma o bruto em eventos parciais. Não normaliza datas nem deduplica. */
  parse(raw: unknown): RawEvent[];
}
