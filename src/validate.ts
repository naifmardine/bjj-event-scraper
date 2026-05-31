// Valida data/events.json: schema zod + invariantes (sem datas passadas,
// sem duplicatas de id). Exit code != 0 falha o CI antes de publicar.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outputSchema } from './schema.js';
import { isPast } from './normalize/dates.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/events.json');

async function main() {
  const text = await readFile(OUTPUT, 'utf8');
  const json = JSON.parse(text);

  const parsed = outputSchema.safeParse(json);
  if (!parsed.success) {
    console.error('::error::Schema inválido em events.json:');
    console.error(parsed.error.issues.slice(0, 10));
    process.exit(1);
  }

  const events = parsed.data;
  const errors: string[] = [];

  const past = events.filter((e) => isPast(e.dateISO));
  if (past.length) errors.push(`${past.length} evento(s) com data passada`);

  const ids = new Set<string>();
  const dups = events.filter((e) => (ids.has(e.id) ? true : (ids.add(e.id), false)));
  if (dups.length) errors.push(`${dups.length} id(s) duplicado(s): ${dups.map((d) => d.id).join(', ')}`);

  if (errors.length) {
    console.error('::error::Validação falhou:\n - ' + errors.join('\n - '));
    process.exit(1);
  }

  console.log(`OK: ${events.length} eventos válidos, sem duplicatas, todos futuros.`);
}

main().catch((err) => {
  console.error('::error::', err);
  process.exit(1);
});
