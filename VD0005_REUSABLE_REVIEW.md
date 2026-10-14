# VD_0005 → ContentLab: auditoria de reaproveitamento (13/10/2026)

**Escopo:** 21 arquivos `.tsx` presentes no `custom-scenes/` canônico do vídeo. A fonte utilizada na auditoria foi a pasta do projeto no Drive, não uma cópia hipotética do componente. **Não alterar** `VD_0005/edit_plan.json`, arquivos locais do vídeo, tempos nem áudio: o primeiro vídeo mantém a edição aprovada.

## Componentes efetivamente generalizados no repositório

Os novos exemplos vivem em `examples/custom-scenes/` do ContentLab e exigem cópia **explícita** para `<projeto>/custom-scenes/` se forem usados. Não são tipos novos de JSON nem automaticamente disponibilizados na interface:

| Novo componente | Base real no VD_0005 | Abstração reutilizável | Adaptar para cada novo vídeo |
| --- | --- | --- | --- |
| `NarrativePath.tsx` | `CicloDaFuga`, `PerguntaAbertura`, `OutraRazao`, `ConflitoCentral`, `LinhaDoLimite` | Câmera percorrendo beats, conexão de argumentos por SVG, tipografia e ponte visual contínua, aparência normal/HQ | `beats[{title,subtitle,at,accent,x,y}]`, duração, voz e SFX |
| `EvidenceConstellation.tsx` | `ConstelacaoFamilia`, `LegadoEmRede`, `ConflitoCentral` | Rede temporal de 2–5 personagens/ideias/indícios, portraits opcionais, conexões e foco progressivo com visão geral | `nodes[{key,label,caption,at,color}]`, `assets`, título |
| `PixelNotification.tsx` | Cards de CTA em `AberturaImpacto`, `CicloDaFuga`, `ArkhamEnquadramento` | Toast opcional em overlay com ícone, texto pixelado SVG próprio, barra de duração e saída | Texto, marca, ícone, início/duração, posição |
| `ComicMotionKit.tsx` | Painéis, divisão de ideias e traços de `AberturaImpacto`, `PerguntaMoral`, `DuasIdeias`, `VD05EditorialCore` | Linguagem editorial de HQ: quadros, gutters, tinta/desenho, balão, linhas de impacto, decisão em painéis | `variant`, frases, acentos, imagens opcionais, fontes fornecidas |

### Arquivos específicos que **não** foram copiados como presets globais

- `VD05EditorialCore.tsx`: contém oito variantes com textos e figuras do vídeo; **aproveitar a estrutura** mas não copiar literalmente o roteiro/rostos; oito wrappers (`DoisPrecos`, `LimiteDePoder`, `ContradicaoGameplay`, `CicloDaResponsabilidade`, `MarcasDaBarbara`, `PesoDaMemoria`, `BatmanOutroOlhar`, `RetornoDoCapuz`) são apenas entradas de configuração dependentes desse núcleo, não oito componentes independentes.
- `ArgumentosEmConflito.tsx`: prova de conceito de convergência de vários argumentos e materiais reais; extrair mecanismo de storyboard genérico quando houver mais um caso real, sem cristalizar tempos de narração.
- `ArkhamEnquadramento.tsx`: layout especializado para cenas e enquadramentos concretos; útil como lição de **composição editorial segura**, não promover um preset universal de ocultação de marca d'água.
- `LegadoEmRede`, `LinhaDoLimite`, `ConstelacaoFamilia`, `ConflitoCentral`, `PerguntaAbertura`, `PerguntaMoral`, `OutraRazao`, `DuasIdeias`: arquivos narrativos do VD_0005 permanecem no projeto; foram estudados para extrair movimentos e gramática visual, sem mover a implementação original.

## Futuro Diazverso: HQ em movimento sem se tornar um slideshow

**Direção proposta:** *quadrinho que ganha movimento* — quadros com molduras/gutters e composição editorial, não capas estáticas com um zoom em cada corte. O objetivo é ligar informação pela **continuidade da tinta, da máscara, da câmera e dos objetos**. A linguagem funciona para Marvel/DC/indies sem copiar paginação/tratamento de editoras específicas.

- **Quadros com profundidade 2.5D:** personagem, cenário, balão e primeiro plano independentes, com parallax discreto, perspectiva moderada e recortes verificados. Uma página achatada não gera profundidade real automaticamente.
- **Gutters como transições:** a divisória preta vira máscara/cortina; a borda de um quadro conduz a câmera até o próximo; um splash panel amplia uma revelação.
- **Tinta em movimento:** `strokeDashoffset` desenha um vínculo, balão ou contorno; tinta preta ganha preenchimento/cor quando a narração chega ao conceito.
- **Retícula/Halftone e papel:** texturas discretas como suporte, nunca sacrificando legibilidade ou fidelidade de cores/rostos das obras.
- **Tipografia de HQ:** Anton para impacto e Bangers para acento expressivo; carregadas de assets licenciados, sem cair em Arial como estilo intencional do canal. Pixel art só em elementos deliberadamente digitais (CTA/notificação); balões devem ter contraste e respiro.
- **Onomatopeia contextual:** POP, CRASH, BOOM ou palavras brasileiras quando servirem à ação (não stickers automáticos); entrada spring amortecida, linhas de velocidade e som coerente.
- **Narrativa via quadros:** antes/depois, causa/consequência, dilema de dois lados, árvore de personagens, quebra visual de uma regra; cada beat com foco e tempo para leitura.
- **Preservar footage real:** trechos de filme/game/HQ existentes devem aparecer quando forem evidência narrativa; não converter todo o conteúdo em ilustração procedural.
- **Ritmo:** grandes transformações em pontos de virada, hold em informação importante, silêncio visual após clímax. Sem aplicar todos os efeitos de uma vez.

### Possíveis cenas para um próximo roteiro (exemplos, não aplicação no VD_0005)

1. **Origem:** painel estreito com memória → linha de tinta atravessa a calha → splash panel da consequência.
2. **Conflito:** a câmera gira sutilmente entre dois quadros separados por um gutter espesso; um balão fica preso ao respectivo personagem.
3. **Legado:** close num herói → travelling por outras figuras numa constelação de painéis → visão geral da árvore.
4. **Revelação:** uma sombra ganha contorno por stroke draw, a máscara revela a imagem verificada e um lettering de impacto faz spring curto.

## Regras de publicação e QA

- Não copiar nomes, diálogos, frames ou imagens de Marvel/DC para a **biblioteca geral**; o template é agnóstico.
- `customComponent` continua limitado a `module`, `mode`, `props`, `assets` do schema existente; as novas variantes são **TSX**, não `transitionOut` nativo.
- Todos os `at` de beats são **locais à cena**; SFX no JSON são **absolutos**. A entrada visual termina até o fim da palavra e preferencialmente antes da primeira sílaba; dar hold suficiente.
- Garantir biblioteca de fontes realmente resolvida por `assets`; componentes sem fonte entregue usam fallback visual e devem ser revisados.
- Validado por inspeção do código e transpile sintático TypeScript. **Ainda não houve render de homologação nem testes de todas as variantes**, portanto não são presets de produção certificados.

## Estado de implementação

Quatro arquivos **criadas/instalados como exemplos de código no repositório ContentLab**. Reutilizáveis sob adaptação, **não** componentes globais automaticamente adicionados à UI. A pauta de motion de HQ é diretriz para produções seguintes, sem qualquer patch no vídeo fechado.