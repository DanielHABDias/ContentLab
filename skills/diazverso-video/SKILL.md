---
name: diazverso-video
description: Aplica identidade e escolhas editoriais do canal Diazverso às composições Content Lab, preservando voz natural, Nox, quadrinhos, legibilidade e edição de baixa interferência.
---


## Biblioteca oficial de cenas TSX (vigente desde 15/10/2026)
**Fonte canônica para reutilização:** [Custom Cenas Diasverso](https://drive.google.com/drive/folders/1yWogLK6bRWXunvdJxTHBMIqB4ibSN44f), README geral e README/TSX de cada subpasta. São **sete componentes oficialmente padronizados**: `ComicPageCTA`, `QuadroHQSobreCena`, `TextoBangersHalftone`, `PaginaHQCenas`, `LinhaDoTempoHQ`, `PersonagemEspiralLegenda` e `CaixinhaCTAHQ`. Ambos os formatos 16:9 e 9:16 usam os próprios layouts responsivos dos componentes; não transplantar proporções fixas.
**Regra prioritária:** a IA usa **somente esses TSX já aprovados por padrão** e escolhe a cena pela função narrativa. **Não criar novo TSX, variante, nem alterar o código dos sete** sem pedido **explícito** do criador; pedido genérico de edição não conta como autorização. Se um efeito não existir como prop, resolver por edição nativa ou consultar o criador. Isto substitui indicações antigas de criar TSX para toda cronologia/relação/câmera; exemplos do VD_0005 e SH_0005 são históricos, não catálogo atual.
**Uso:** `overlay` em QuadroHQSobreCena e CaixinhaCTAHQ; `replace` nos outros cinco. Copiar o TSX do Drive para `custom-scenes/` do projeto local e configurar `project://custom-scenes/...`, mapa de assets/fontes real e props exatas do README individual. Incluir indicação no guia de edição e no `edit_plan.json` com formatos, duração, camadas, transcrição e SFX absolutos. TSX **não reproduz sons**; reaplicar efeitos no JSON e validar render e mixagem. **Quadro HQ** usa Anton (frase) e Bangers (etiqueta); **Texto Bangers Halftone** possui letras brancas fixas, não alternância livre de cores. Novos modelos só mediante solicitação, com documentação, prévias e testes em ambos os formatos.

# Diazverso — Direção audiovisual no Content Lab

## Fonte de verdade
Antes de editar conteúdo do canal, consulte `DIAZVERSO_MASTER_CONTEXT.md` quando disponível no projeto do ChatGPT. A grafia oficial é **Diazverso**, sempre com Z. Este módulo é um perfil de marca; as mecânicas de composição, timeline e JSON vêm das skills Content Lab. Em conflito editorial, prevalece o pedido explícito atual, respeitada a identidade que o criador pediu preservar.

## Identidade editorial
Canal brasileiro de cultura geek, narrativo, interpretativo e opinativo, com foco principal em super-heróis (Marvel/DC) e possibilidade de outros temas. Priorize histórias e argumentos; não transformar vídeo em noticiário, resumo enciclopédico ou lista genérica.
- Texto narrado com pensamento encadeado, natural, conversacional e confiante; sem performance publicitária ou frases de efeito em sequência.
- Começo direto, sem apresentação genérica; desenvolvimento por causa, consequência, reação e opinião argumentada.
- A voz é o elemento humano principal; criador não aparece em câmera.
- Decupagem visual deve representar personagem, cena, acontecimento ou ideia mencionada, sempre que possível, sem induzir fatos errados ou spoilers antecipados.
- Não usar cortes e animações apenas para preencher silêncio. Duração da peça depende da tese, não de uma fórmula rígida.

## Montagem e motion
**Baseline: baixa interferência.** Se voz e imagem bastarem, corte simples. Use picos seletivos para hook, revelação, reação, comparação, virada e payoff. O aprendizado do vídeo @thejplabs é sobre direção de composição, coreografia e continuidade; não replicar cada movimento em todo vídeo.
- Texto curto e funcional. Palavras destacadas devem acrescentar ênfase real.
- Painéis de HQ, retículas e divisórias são linguagem visual possível, nunca obrigação que dificulte a leitura.
- Zoom, glitch, transição e SFX só com propósito; evitar especialmente whoosh repetido, poluição visual e música competindo com voz.
- Nox é marca/reação/humor; não inserir em toda cena. Respeitar o personagem oficial: capuz preto, rosto sem traços, olhos amarelos grandes e glitch dimensional azul/vermelho controlado; nunca redesenhá-lo.
- Paleta derivada de preto, azul elétrico, vermelho vivo e amarelo, com branco/cinzas auxiliares. Bangers e Anton para funções de destaque; respeitar referência visual aprovada antes de qualquer descrição textual.

## Direção de arte preferida — HQ editorial simples e consistente
O acabamento limpo do Content Lab Studio é uma referência técnica histórica, **não** o estilo dominante do Diazverso. Para novos vídeos, a linguagem de quadrinhos prevalece: caixas retangulares de narrador, molduras, halftone, papel e Bangers, equilibrados com cenas reais, imagens em movimento e grandes frases Anton. Evitar UI genérica, excesso de cards e TSX apenas decorativo.
- **Fundos:** variar conforme o beat entre off-white, cinza-gelo, cinza-azulado, carvão, preto, azul profundo ou gradiente sutil. Evitar usar sempre o mesmo fundo preto ou sempre papel; selecionar fundo por legibilidade/atmosfera.
- **Caixas e painéis:** priorizar moldura de HQ e caixa de narrador com retângulo principal branco/creme, texto escuro, etiqueta amarela menor acima e sombra preta. Painéis de UI arredondados só se o assunto exigir; evitar linguagem de aplicativo como padrão.
- **Tipografia:** sans-serif de UI com acabamento próximo a Inter para narrativas explicativas e texto secundário, desde que esteja disponível no projeto; **Anton** como título de impacto, **Bangers** para acento HQ deliberado. O CSS do Studio lista fontes do sistema, inclusive nomes da Apple, mas não acompanha um arquivo de fonte Apple nem autoriza sua redistribuição.
- **Hierarquia editorial:** título grande em carvão/white; frase auxiliar em cinza com contraste legível, como o contraste entre “Crie cena por cena.” e “Sem complicar.” no Studio. Palavras, textos, personagens e cards não precisam competir pela atenção.
- **Motion premium:** movimentos suaves, aceleração/desaceleração deliberadas, poucos pixels de deslocamento, entradas com escala/opacity moderadas, stagger por função, hold real e saída coerente. Um contraste forte pode ficar *parado* para ser compreendido; não converter elegância em animação constante.
- **Equilíbrio geek:** segmentos literais de filmes, quadrinhos e jogos seguem fundamentais. HQ/glitch/Nox aparecem como assinatura nos momentos certos, não em todos os cards. Cenas TSX servem para casos complexos, como cronologias, relações e universos.
Para especificações, delegar composição a `contentlab-composicao`, movimento a `contentlab-motion`, e TSX a `contentlab-cenas-tsx`. Manter a **baixa interferência** como baseline narrativo, mas sem impedir cenas elaboradas quando elas explicam melhor.

## Cenas complexas com Content Lab
Quando uma explicação do Diazverso exigir cronologia, relações ou tipografia especial, consultar primeiro os sete componentes aprovados e reutilizá-los, sem gerar um arquivo novo sem autorização explícita. Pedir ao ChatGPT esse arquivo com a composição pronta para o formato e os tempos, baixar/salvar manualmente no `custom-scenes/` do projeto e integrar por `customComponent.module` em vez de despejar a lógica no `edit_plan.json`. Para economizar tokens, pedir o TSX uma vez e depois só pequenos patches e `props`/fragmentos JSON.

Não usar TSX apenas porque está disponível. O padrão Diazverso continua sendo **baixa interferência**, com B-roll narrativo real e cortes simples sempre que suficientes. SVGs, cards e linhas podem nascer do código; cenas de filmes, Nox e imagens autorais continuam sendo assets reais em `customComponent.assets`. Não redesenhar Nox. O site não importa automaticamente arquivos criados pelo ChatGPT; o TSX local renderiza sem configuração extra, mas continua sendo código executável sem sandbox e exige projeto confiável.

## Checagens aprendidas com VD_0005
- Em perguntas narradas rapidamente, agrupe a tipografia em unidades de pensamento legíveis; não force uma troca por palavra. Se a pergunta termina com um personagem, o PNG pode substituir a palavra, mas enquadre o corpo/cabeça dentro da área segura e confira a prévia com a câmera efetiva.
- Nox deve ter presença visual clara nas cenas pixeladas sem encobrir as legendas Bangers nem os textos laterais. Ajuste escala por composição e inspecione os momentos de zoom; não amplie todas as aparições cegamente.
- Sobre papel branco, use tipografia escura. Capas e páginas de HQ são elementos de composição, não backgrounds; alinhe seu centro visual ao centro do quadro durante o hold, inclusive após a animação de entrada.
- Em carrosséis de argumentos, quando houver uma cena real imediatamente anterior ou subjacente, mantenha-a visível porém escurecida atrás das palavras; evite tampa preta 100% opaca se isso eliminar contexto visual. A placa de texto deve continuar contrastada.
- Em painéis conectados por linhas, desenhe o caminho na frente dos cartões quando a leitura pedir continuidade, mas fora da região das etiquetas e rostos. A linha não deve parecer escondida pela caixa.
- Use TSX para substituir cartões de texto quando uma trajetória, relação causal ou câmera pelo mesmo plano ajudar a explicar a tese. Teste os beats com `transcript.words`; preserve os clipes reais, Nox e CTAs. O VD_0005 usa `PerguntaAbertura`, `ConflitoCentral` e `OutraRazao` como exemplos, não como moldes obrigatórios para todo vídeo.
- Transições `blur_*` do Content Lab ocupam o começo da cena seguinte. O whoosh limpo deve soar no **meio audível** dessa janela: calcule o `at` a partir do início da cena entrante e da duração real do SFX após o trim das bordas. Confira o blur em quadros intermediários, não apenas na lista de efeitos.
- Uma cama instrumental discreta pode iniciar em `-26 dB` com ducking da narração, fade-in/out e ajuste após escuta. Não incluir música como padrão automático: respeite o pedido do vídeo e deixe voz e efeitos mais claros.

## Packaging e formatos
O título, thumbnail e o conteúdo devem fazer promessas consistentes. Para vídeos verticais, recomponha painéis/legendas respeitando margens; para horizontal, preserve leitura e fluxo do olhar. Verifique a escrita Diazverso em qualquer elemento público. Não inferir aceitação estética sem render inspecionado.

## Roteamento
Carregue `skills/contentlab-direcao/SKILL.md` como entrada geral e os módulos de composição, motion, timeline, contrato e revisão conforme a tarefa. Este perfil modifica decisões estéticas; não altera por conta própria campos de schema. Se houver arquivo de identidade oficial mais recente, ele prevalece.

## Não confundir
Este perfil não é, por definição, a skill de GSB. Mantenha os dois perfis independentes salvo se o usuário documentar explicitamente que se referem à mesma configuração.

## Preferência de produção aprovada em 15/10/2026 — montagem acima de motion complexo

A preferência antiga por **muitos TSX explicativos** foi REVOGADA. O padrão é edição simples e bem feita: trechos variados da obra quando pertinentes (cenas podem prosseguir sem corresponder literalmente a cada palavra), ilustrações completas com pan/zoom sempre em movimento, PNGs com entrada + balanço suave + saída e SFX apropriados, cortes secos, transições tradicionais, caixas de narrador HQ e Anton para pontos fortes. Evitar repetir a mesma tomada mais que o necessário e não revelar spoilers no desenvolvimento; exceção de introdução só se aprovada.

Usar um **conjunto pequeno de TSX 16:9 reutilizáveis** no vídeo longo, não uma cena sofisticada por frase. Vocabulário visual: halftone/papel, molduras/painéis que surgem e recebem personagens, balanço discreto, Avengers nos TSX quando houver arquivo de fonte verificado; Bangers nas caixas/lettering HQ e legendas, Anton grande para frases fortes (fundo sólido ou clipe escurecido). Os sete TSX da biblioteca oficial já existem e selecionam automaticamente o layout por resolução; nos longos usar sua composição horizontal específica. Uma textura visual recorrente do Diazverso pode ser imagem transparente/sobreposição estável do editor, **não** um TSX novo por repetição nem marca-d’água do canal. Não criar overlay que oculte a cena.

**Longos:** imagens inteiras não ficam imóveis; movimento suave de zoom-in/out ou pan com imagem dimensionada MAIOR que a janela para não revelar bordas pretas ou vazias. Filmes/séries/animações recebem filtro de TV/CRT em overlay mantendo a proporção original; jogos NÃO recebem esse filtro por padrão. Nox grande em opinião, leve balanço e legenda especial abaixo. CTAs novas de HQ podem entrar no canto superior direito com caixa branca/amarela, whoosh na entrada/saída, ícone de inscrição/like/sino, clique visual + click sonoro e hold legível de **pelo menos 5 segundos**. Preservar CTAs Nox existentes. Identificação de capítulos com Bangers só em vídeos que CONTAM a história de jogos capítulo a capítulo; aparece SOBRE uma cena real tocando áudio original, que depois é interrompido para retomar o vídeo — não uma cartela solta.

**Shorts:** abertura com gancho e explosão Minecraft sobreposta, riser metálico para tensão, whoosh + blur direcional na virada, música só após a virada. Legendas obrigatórias Bangers um pouco abaixo do centro, com contorno fino e sombra, nas áreas seguras. Desenvolvimento baseado sobretudo em cenas reais, artes completas com pan/zoom, poucos overlays HQ e ocasionais PNGs/palavras fortes. Referências do SH_0005 aprovadas: apenas o visual de hook/caixas/tipografia do `DiazversoHQEditorial.tsx` (remover linha amarela inferior do hook) e `ComicPageCTA.tsx` para a CTA com thumbnail/título variáveis; outros testes do SH_0005 não são presets aprovados nem devem ser copiados automaticamente.

**Sincronismo de informação:** objeto, pessoa ou termo focal deve estar legível até o fim da palavra correspondente, idealmente já no início. Dar hold para leitura, sem revelar spoilers antes da narração. VD_0005 já concluído permanece intocado; seus TSX são referências técnicas históricas, NÃO uma meta de densidade de motion.

## Som obrigatório em motion autoral e auditoria Diazverso

Nos próximos vídeos, todo beat com movimento/entrada/saída editorial intencional, incluindo TSX, câmera, texto, camadas e transição, exige SFX **durante a animação** ou som embutido equivalente verificado. A duração do efeito pode ser menor ou maior que o movimento; o ataque audível/pico perceptivo deve coincidir com a região central do gesto, nunca antes da animação nem automaticamente no primeiro frame. Se a cauda é longa demais para o próximo beat, encurtar usando o contrato `config.duration` + `fadeOut` (suave), sem alterar tempos de fala ou ritmo da cena. Para deslocamentos, slides e transições usar whooshes variados do acervo; para aparições/ícones/clicks usar pop/bling/click; sino pede bell. Metallic riser é APENAS tensão/acúmulo dramático, NUNCA som de slide. Evitar repetição automática e duplicidade com áudio do Nox/CTA. Áudio de fundo contínuo não substitui automaticamente a ação sonora de uma revelação; preservar a voz como foco.

Antes do render automático, aplicar `contentlab-revisao` + `diazverso-revisao-edicao` (skill irmã no Drive) como bloqueio de qualidade. Depois do render, ouvir o MP4 e revisar novamente os eventos, a clareza das palavras, Nox, CRT, assets, mix e coerência narrativa. Não aprovar um vídeo só com JSON válido.


## Governança de exemplos e música

- Este perfil de marca prevalece sobre exemplos antigos de motion que tratavam TSX complexos como prioridade. Mecânicas genéricas de ContentLab continuam válidas, mas não determinam a estética ou densidade do Diazverso. Evitar balões de fala e onomatopeias como padrão; preferir caixas retangulares e halftone.
- Não modificar retroativamente o VD_0005 concluído. As referências `VD0005_REUSABLE_REVIEW.md` e `MOTION_TECHNIQUES.md` são repertório opcional, não checklist.
- Shorts: trilhas de preferência encontradas no Drive/NoCopyright/Muito usadas no YouTube: Bully Main Theme, Bully Walk Theme, L's Theme A, Kuroi Light, GTA IV Theme, GTA San Andreas Opening Intro e GTA V **Welcome to Los Santos** (NÃO confundir com GTA V Pause Menu). São opções de gosto pessoal, **não** liberação jurídica; verificar copyright, atribuição e disponibilidade antes de publicar.
- As decisões editoriais desta revisão foram incorporadas nesta própria skill e na orquestradora `diazverso-criacao-video`. O documento temporário de consolidação foi excluído a pedido do criador; não referenciá-lo como fonte ativa. Não alterar o Master Context automaticamente.
