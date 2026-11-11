# Formato e perfis

`.contentlab` contém `contentlab-manifest.json` e blobs SHA-256 deduplicados. O manifesto v1 mapeia caminhos lógicos para hash, tamanho e modo. A restauração verifica tudo antes da escrita.

Perfis sugeridos:

- Completo: manifesto, versões, histórico, roteiro, packaging, thumbnails, legendas, timeline, componentes e mídia necessária.
- Enxuto: arquivos autorais e mídias referenciadas; omite caches e intermediários reproduzíveis.
- Entrega: render final, títulos A/B, descrição, tags, thumbnail aprovada e legendas; prefira ZIP quando o receptor não usa Content Lab.

O vídeo final e intermediários são opcionais. Nunca recomprima mídia com perdas para fingir melhor compactação.
