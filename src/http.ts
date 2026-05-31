// Wrapper de HTTP para coleta HTTP-first.
// - User-Agent honesto e identificável (não finge browser).
// - Rate-limit por host (1 req a cada ~2.5s).
// - Retry com backoff exponencial só para 5xx/timeout/erro de rede.
// - 429 respeita Retry-After e desiste rápido.
// - robots.txt buscado e cacheado por host; respeita Disallow.

const USER_AGENT =
  'BJJAvatarBot/1.0 (+https://github.com/naif/bjj-event-scraper; jiu-jitsu event calendar)';

const MIN_INTERVAL_MS = 2500;
const MAX_RETRIES = 3;

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, RobotsRules>();

interface RobotsRules {
  disallow: string[];
}

interface HttpOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | undefined>;
  /** Espera resposta JSON (seta Accept e faz .json()). Default true. */
  json?: boolean;
  /** Pula a checagem de robots.txt (use só p/ buscar o próprio robots.txt). */
  skipRobots?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildUrl(url: string, params?: HttpOptions['params']): string {
  if (!params) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function rateLimit(host: string): Promise<void> {
  const last = lastRequestAt.get(host) ?? 0;
  const wait = MIN_INTERVAL_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function parseRobots(txt: string): RobotsRules {
  // Parser minimalista: coleta Disallow do bloco User-agent: * (e global).
  const lines = txt.split('\n').map((l) => l.replace(/#.*$/, '').trim());
  const disallow: string[] = [];
  let appliesToUs = true; // antes do primeiro User-agent, regras valem
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      appliesToUs = value === '*' || value.toLowerCase().includes('bjjavatarbot');
    } else if (key === 'disallow' && appliesToUs && value) {
      disallow.push(value);
    }
  }
  return { disallow };
}

async function getRobots(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: RobotsRules = { disallow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // Sem robots acessível → assume permitido.
  }
  robotsCache.set(origin, rules);
  return rules;
}

function isAllowed(rules: RobotsRules, pathname: string): boolean {
  return !rules.disallow.some((rule) => rule !== '' && pathname.startsWith(rule));
}

const isRetryable = (status: number) => status >= 500 || status === 408;

export async function httpGet<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const finalUrl = buildUrl(url, opts.params);
  const parsed = new URL(finalUrl);
  const wantJson = opts.json !== false;

  if (!opts.skipRobots) {
    const rules = await getRobots(parsed.origin);
    if (!isAllowed(rules, parsed.pathname)) {
      throw new Error(`robots.txt proíbe ${parsed.pathname} em ${parsed.origin}`);
    }
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await rateLimit(parsed.host);
    try {
      const res = await fetch(finalUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          ...(wantJson ? { Accept: 'application/json' } : {}),
          ...opts.headers,
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (res.status === 429) {
        // Teto no Retry-After: um valor absurdo (malicioso/bugado) não pode
        // travar o adapter por horas.
        const retryAfter = Math.min(Number(res.headers.get('retry-after')) || 30, 120);
        if (attempt < MAX_RETRIES) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new Error(`429 Too Many Requests em ${finalUrl}`);
      }

      if (!res.ok) {
        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 1000 + Math.floor(Math.random() * 500));
          continue;
        }
        throw new Error(`HTTP ${res.status} em ${finalUrl}`);
      }

      return (wantJson ? await res.json() : await res.text()) as T;
    } catch (err) {
      lastErr = err;
      const isAbort = err instanceof Error && err.name === 'TimeoutError';
      if (isAbort && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 1000 + Math.floor(Math.random() * 500));
        continue;
      }
      if (attempt >= MAX_RETRIES) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Falha ao buscar ${finalUrl}`);
}
