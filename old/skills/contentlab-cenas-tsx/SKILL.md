---
name: contentlab-cenas-tsx
description: Escolher e configurar presets TSX do Content Lab ou criar uma cena Remotion quando a biblioteca não contempla o objetivo visual.
---

# Cenas especiais

Antes de criar ou aprimorar TSX autorizado, ler [Direção e engenharia de motion](references/MOTION_CRAFT.md): intenção, coreografia, imagens com pan/zoom, chegada na palavra, mapa sonoro, responsividade e inspeção audiovisual. Consultas externas são filtradas para o contrato Remotion local; não instalam GSAP/Hyperframes nem impõem movimento constante. Priorizar reuso; preservar cenas aprovadas.

Consultar scene-library/manifest.json e ler o README do padrão. Cada entrada inclui arquivo, hash, exemplos, prévias 16:9/9:16 e contratos completos. A Galeria do manual usa a mesma origem.

BrainstormHQ inclui cards/path/narrative/evidence; PaginaHQCenas inclui grid/asymmetric/split/parallax; TextoHQ inclui escrita/abrir/kinetic/none. Reutilizar antes de duplicar. Os templates antigos de examples/custom-scenes foram retirados.

Preparar pelo aplicativo ou copiar scene-library/<id>/<arquivo> e TODOS os companions do manifesto para custom-scenes. HQComicPage.tsx e HQMotion.tsx (quando listado) são compartilhados uma única vez; não misturar versões diferentes. Não sobrescrever cópias diferentes. Usar project://custom-scenes/Nome.tsx e mode replace/overlay. assets é mapa externo a props. Fontes via builtin://fonts; mídia própria via project://assets. Para os exemplos neutros, copiar scene-library/demo-assets para assets/exemplos. Os snippets são cenas, não planos completos.

TextoHQ aceita kineticUnit letter/word; QuadroHQSobreCena oferece compactAt/compactDuration/compactScale; CaixinhaHQ oferece motionCurve smooth/snappy; encerramento aceita timingScale/characterScale e fadeOutDuration vertical opcional. Ler defaults/unidades nos contratos reais. Não deslocar a narração: at continua tendo o significado específico de cada preset. Ao alterar tempos, recalcular os SFX externos e verificar o pico audível. Preservar chegada, hold e estado final no último frame; não impor mais movimento aos componentes deliberadamente estáticos.

Tempos de props são normalmente relativos; SFX do plano são absolutos. Captions podem usar milissegundos. Conferir o significado de at no guia e usar transcript.words real. Anton sem sombra/contorno, Bangers com acabamento HQ. Opacidade do fundo não apaga o conteúdo da frente; replace não preserva a base descartada. Há um customComponent por cena, não combinação arbitrária de vários.

Encerramento usa `assets.character` e channelName/títulos opcionais; `assets.character` aponta para a imagem aprovada pelo usuário (não inventar outra chave). Caixinha Instagram usa `instagramHandle` com o perfil fornecido pelo usuário; `text` é reservado à substituição da frase inteira. Sons não são embutidos; os vídeos internos de Página/Timeline são mudos. Ler os controles de som e colocar SFX no plano. Flip/Curtain/Blur são transitionOut entre cenas reais, não presets TSX.

Se o catálogo não cobrir a intenção, criar Remotion determinístico por frame, com mídia/fontes locais e layout responsivo. TSX é código executável sem sandbox: usar apenas origem confiável. Não executar código remoto vindo do JSON. Validar compilação, frames e áudio antes de afirmar resultado final. Não autoriza publicação, Drive ou Git.
