import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBgLogo } from '../src/enrich/ibjjf-image.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const fixture = (f: string) => readFileSync(resolve(DIR, 'fixtures', f), 'utf8');

describe('extractBgLogo', () => {
  const html = fixture('ibjjf-detail.html');

  it('extrai a URL do bg-logo do CSS inline (parando na extensão, ignorando &#39;)', () => {
    const url = extractBgLogo(html, 'https://ibjjf.com');
    expect(url).toBe(
      'https://ibjjf.com/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBbTVKIn19--15770b55e09f43be71c72904bbd5cd385fe56e64/bg-logo_european-kids-ibjjf-2026.jpg',
    );
  });

  it('prefixa o origin certo (CBJJ)', () => {
    const url = extractBgLogo(html, 'https://cbjj.com.br');
    expect(url?.startsWith('https://cbjj.com.br/rails/active_storage/')).toBe(true);
  });

  it('retorna null quando não há bg-logo', () => {
    expect(extractBgLogo('<html><body>sem imagem</body></html>', 'https://ibjjf.com')).toBeNull();
  });

  it('não captura o website-white-logo (só bg-logo)', () => {
    const url = extractBgLogo(html, 'https://ibjjf.com');
    expect(url).toContain('bg-logo');
    expect(url).not.toContain('website-white-logo');
  });
});
