---
name: contentlab-packaging
description: Desenvolver ou revisar título e thumbnail como uma promessa única para um vídeo, incluindo alternativas e JSON do Studio de Thumbnails.
---

# Título e thumbnail

Comece pelo assunto, público, evidência disponível e recompensa real do vídeo. Título e imagem devem complementar-se, não repetir a mesma informação nem prometer algo ausente. Instruções explícitas do usuário e fatos verificáveis prevalecem; métodos externos bem fundamentados substituem preferências antigas, não contratos do aplicativo nem regras oficiais da plataforma.

Explore mecanismos distintos (pergunta, contraste, consequência, descoberta) antes de polir palavras. Quando alternativas forem solicitadas, compare conceitos completos e entregue os mais fortes com a diferença de promessa explicada. Não chamar uma versão de vencedora sem teste. Evite capitalização excessiva, termos vagos e abertura desperdiçada com contexto dispensável. Comprimento é um teste de legibilidade e truncamento, não fórmula de CTR.

Na thumbnail, escolha um foco, uma emoção ou conflito pertinente e poucos elementos. Texto curto é um ponto de partida, não quota. Pode não haver texto. Personagem no meio da palavra, elenco numeroso, luzes e texturas são opções, nunca obrigações. Prefira texto sólido separado do rosto quando a sobreposição prejudicar a leitura. Pesquise imagens pela ação e expressão necessárias; não invente imagens, direitos, transparência ou qualidade. Não baixe/instale ferramentas pagas nem publique sem autorização.

Para gerar JSON, ler `docs/THUMBNAIL_STUDIO.md`: `version:1` é independente do plano de vídeo; assets reais incorporados, formatos e camadas corretos. `title.mode` permite split/front/behind/outline; `align`, `width`, `x/y` controlam a composição. Não usar campos imaginários. Preservar JSON aprovado e personagens acima dos fundos. Escolher contorno legível, não necessariamente fino. Exportar Full HD/4K nativo.

Revisar a imagem real em tamanho final e reduzida (aproximadamente 160 px de largura): leitura, rosto, contraste, número de focos e coerência com o gancho. Comparar variantes com o mesmo contexto; não atribuir nota fictícia de performance. Testes A/B da plataforma podem ser inconclusivos e não se resumem a CTR. Separar hipótese de resultado observado.

Referências metodológicas: [yt-package](https://github.com/Jakeschincariol/youtube-agent-skill), [thumbnail workflow](https://github.com/hassancs91/claude-youtube-editor), [orientações oficiais](https://support.google.com/youtube/answer/12340300). Não alegar execução dos scripts dessas referências se não foram executados. Consulte as regras atuais ao publicar/testar.
