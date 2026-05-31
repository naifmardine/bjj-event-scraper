// Enriquecimento de imagem para eventos IBJJF/CBJJ.
// A API do calendário não traz imagem por evento — só `logoBaseColor`. Mas a
// página de detalhe (pageUrl) tem a imagem do campeonato num CSS inline
// `background:url('/rails/active_storage/blobs/redirect/...bg-logo_<slug>.jpg')`.
// Aqui buscamos essa página e extraímos a URL da imagem.

import { httpGet } from '../http.js';

// Captura a 1ª URL de bg-logo do active_storage. Para na extensão para não
// engolir o `&#39;`/aspas/parêntese do CSS inline. Função pura → testável.
export function extractBgLogo(html: string, origin: string): string | null {
  const m = html.match(
    /\/rails\/active_storage\/blobs\/redirect\/[^"'&\s)]*bg-logo[^"'&\s)]*\.(?:jpg|jpeg|png|webp)/i,
  );
  return m ? origin + m[0] : null;
}

/**
 * Busca a página de detalhe do evento e devolve a URL da imagem do campeonato,
 * ou null se a página não tiver / falhar o parse. Lança em erro de rede (o
 * caller isola por evento).
 */
export async function fetchEventImage(sourceUrl: string): Promise<string | null> {
  const origin = new URL(sourceUrl).origin;
  const html = await httpGet<string>(sourceUrl, { json: false });
  return extractBgLogo(html, origin);
}
