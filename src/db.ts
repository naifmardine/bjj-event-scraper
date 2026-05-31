// Persistência no Supabase (Postgres). A DATABASE_URL vem do ambiente —
// no GitHub Actions via Secret, NUNCA de arquivo no repo. Se não estiver
// setada, o upsert é pulado (o events.json continua sendo gerado).
//
// `prepare: false` torna a conexão compatível com o pooler do Supabase
// (pgbouncer transaction mode), além da conexão direta.

import postgres from 'postgres';
import type { ScrapedEvent } from './types.js';

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida');
  return postgres(url, { ssl: 'require', prepare: false, max: 3, idle_timeout: 10 });
}

/** Cria a tabela se não existir (idempotente). Mantém histórico permanente. */
async function ensureSchema(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id           text PRIMARY KEY,
      title        text NOT NULL,
      type         text NOT NULL,
      date         text NOT NULL,
      date_iso     date NOT NULL,
      location     text NOT NULL,
      cta_label    text NOT NULL,
      icon         text NOT NULL,
      source       text NOT NULL,
      source_url   text NOT NULL,
      image_url    text,
      accent_color text,
      scraped_at   timestamptz NOT NULL,
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS events_date_iso_idx ON events (date_iso)`;
}

/**
 * Faz upsert dos eventos no Postgres (por id). Eventos passados não são
 * removidos — o banco é a memória permanente. Retorna a contagem upsertada.
 */
export async function upsertEvents(events: ScrapedEvent[]): Promise<number> {
  const sql = connect();
  try {
    await ensureSchema(sql);
    const rows = events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      date_iso: e.dateISO,
      location: e.location,
      cta_label: e.ctaLabel,
      icon: e.icon,
      source: e.source,
      source_url: e.sourceUrl,
      image_url: e.imageUrl ?? null,
      accent_color: e.accentColor ?? null,
      scraped_at: e.scrapedAt,
    }));

    // Upsert em lotes para não estourar parâmetros numa query só.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await sql`
        INSERT INTO events ${sql(
          chunk,
          'id', 'title', 'type', 'date', 'date_iso', 'location',
          'cta_label', 'icon', 'source', 'source_url', 'image_url',
          'accent_color', 'scraped_at',
        )}
        ON CONFLICT (id) DO UPDATE SET
          title        = EXCLUDED.title,
          type         = EXCLUDED.type,
          date         = EXCLUDED.date,
          date_iso     = EXCLUDED.date_iso,
          location     = EXCLUDED.location,
          cta_label    = EXCLUDED.cta_label,
          icon         = EXCLUDED.icon,
          source       = EXCLUDED.source,
          source_url   = EXCLUDED.source_url,
          image_url    = EXCLUDED.image_url,
          accent_color = EXCLUDED.accent_color,
          scraped_at   = EXCLUDED.scraped_at,
          updated_at   = now()
      `;
    }
    return rows.length;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
