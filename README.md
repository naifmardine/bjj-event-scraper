# bjj-event-scraper

Coleta datas de competições futuras de federações de jiu-jitsu e gera um
`data/events.json` versionado, consumido pelo app **BJJ Avatar**.

## Como funciona

Padrão **git-scraping**: um GitHub Action roda semanalmente, coleta os eventos,
valida e commita o `events.json` se mudou. O app lê esse JSON via fetch com ISR
(revalidação diária) — sem backend.

**Coleta HTTP-first**: cada fonte é batida por requisição HTTP direta no seu
endpoint JSON interno. Playwright (headless) existe só como *fallback* isolado
(`src/browser.ts`), caso uma fonte futura não exponha dados sem navegador. Hoje
**nenhuma fonte precisa de browser**.

## Fontes

| Fonte | Estratégia | Como entrega os dados |
|-------|-----------|------------------------|
| IBJJF | `http` | `GET /api/v1/events/calendar.json` (headers de XHR) → `infosite_events[]` |
| CBJJ | `http` | mesma API do IBJJF em `cbjj.com.br` (CMS compartilhado) |
| Smoothcomp | `http` | array `var events = [...]` embutido no HTML de `/en/events/upcoming`; filtra `location_country === 'BR'` |

Prioridade em dedup: `cbjj` > `ibjjf` > `smoothcomp` (federação oficial vence o agregador).

## Scripts

```bash
npm install
npm run scrape     # coleta as fontes e grava data/events.json
npm run validate   # valida o JSON (schema zod + datas futuras + sem duplicatas)
npm test           # testes de parse/datas/dedup com fixtures (offline)
npm run typecheck  # tsc --noEmit
npm run discover -- <url>   # Playwright: descobre endpoint JSON de uma fonte nova
```

## Adicionar uma fonte nova

1. Rode `npm run discover -- <url-da-fonte>` e capture as requisições de rede.
   Se houver endpoint JSON utilizável → adapter `strategy: 'http'`. Se não →
   `strategy: 'browser'` (usa `withPage` de `src/browser.ts`).
2. Crie `src/adapters/<fonte>.ts` implementando `SourceAdapter` (`fetchRaw` +  
   `parse` → `RawEvent[]`).
3. Registre em `src/adapters/registry.ts` com uma `priority`.
4. Adicione um fixture em `test/fixtures/` e um teste em `test/adapters.test.ts`.

## Schema de saída (`data/events.json`)

`ScrapedEvent[]` — estende o `BJJEvent` do app com proveniência
(`dateISO`, `source`, `sourceUrl`, `scrapedAt`). Ordenado por `dateISO`.

## Integração com o app

O app lê via `getEvents()` em `lib/data/activity.ts`, que combina as
competições do scraper com os eventos manuais da academia (graduações/open
mats) e faz fallback para o mock se o fetch falhar. Configure a env
`NEXT_PUBLIC_EVENTS_URL` apontando para o raw deste repo após o primeiro push.

## Ética

robots.txt respeitado por host · rate-limit ~1 req/2.5s · User-Agent
identificável · retry/backoff só em 5xx/timeout · merge não-destrutivo (uma
fonte que cai não zera o JSON).
