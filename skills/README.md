# Skills do Content Lab

## Planejamento editorial

- `contentlab-pesquisa`: temas, perguntas reais e evidências; separar oportunidade de popularidade absoluta.
- `contentlab-packaging`: título e thumbnail complementares, conceitos alternativos e leitura reduzida.
- `contentlab-roteiro`: gancho coerente com a promessa, desenvolvimento, recompensa e CTA pertinente.
- `contentlab-metadados`: descrições, capítulos do render final, tags e links verificados.

Esses módulos são genéricos, incluídos no ZIP oficial e roteados pela direção. Métodos externos fundamentados podem substituir preferências antigas, mas não fatos, instruções explícitas, contratos técnicos ou regras oficiais. Não representam garantia de CTR/retenção nem autorização de publicação. Preferências de canal e horários ficam em perfis externos.

A entrada é contentlab-direcao. Módulos: contentlab-composicao, contentlab-motion, contentlab-cenas-tsx, contentlab-timeline-audio, contentlab-contrato e contentlab-revisao. O QA é dividido em quatro passes: `contentlab-revisor-json-tecnico` para contrato e enquadramento previsto, `contentlab-revisor-abertura` para os primeiros 30 segundos dos vídeos longos, `contentlab-revisor-visual-movimento` para pixels e fluidez e `contentlab-revisor-audio-sincronizacao` para voz, música e SFX. A revisão geral consolida os resultados e bloqueia a entrega diante de `CORRIGIR` ou de evidência não verificada. A skill ZIP inclui esses módulos, os mesmos manuais gerados do site e a biblioteca scene-library com guias, exemplos e prévias. Perfis editoriais externos são opcionais e não fazem parte do padrão público.

Projeto universal, restauração/reload, downloads opcionais por projeto e armazenamento de thumbnails são descritos na entrada. O módulo timeline-áudio distingue transcrição avulsa (tempos da fonte, destino exclusivo, sem alterar o projeto) de narração oficial (finalidade explícita e confirmação), e cobre gravação, tomadas, geração Qwen e tratamento local. O módulo revisão contém os critérios de isolamento. O ZIP oficial é gerado pela aba Documentação a partir destas fontes; não manter uma cópia manual divergente.

Para escolher um preset, consulte a Galeria de cenas especiais e o manifesto antes de criar novo código. A instalação copia uma versão local para custom-scenes e não modifica o plano nem inicia render. TSX é código executável de origem confiável, sem sandbox.

Para thumbnails, a mesma entrada encaminha a `docs/THUMBNAIL_STUDIO.md`, incluída no ZIP. O projeto de imagem (`version: 1`, imagens incorporadas) é independente do edit_plan.json de vídeo; não exige áudio/transcrição. O guia documenta camadas, fundos HQ, inversão, contorno fino, versões e parâmetros. Preferências de canal permanecem externas.

A direção atual inclui Full HD/4K, JPG/PNG/WebP, luzes laterais independentes (`background.sideLights`), entrelinha do título (`title.lineHeight`) e foto centralizada (`photoFit`). Fundos/texturas ficam atrás de todos os personagens; secundários são opacos por padrão. A skill orienta partir das referências e assets reais, sem transformar uma identidade pessoal em regra pública. O ZIP baixado na documentação utiliza essa mesma fonte, sem manual paralelo.
