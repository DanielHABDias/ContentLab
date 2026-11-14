# Modo composição: o vídeo como motion design

Esta é a forma principal de montar vídeos no Content Lab. O vídeo inteiro é **uma composição Remotion** do kit de motion do próprio Content Lab (`src/motion/kit/`), descrita por um **roteiro em beats**. Ele não é montado com clips colados numa timeline.

O kit cuida do visual:

- câmera sempre em movimento;
- palavras gigantes com aberração cromática;
- personagem do projeto em poses de stop motion (se o projeto tiver um);
- cenas das obras em painéis HQ com zoom lento;
- números contando;
- listas em fichas;
- comparação com VS;
- grão, clarões e tremor nos impactos;
- legenda palavra a palavra;
- trilha que abaixa sob a voz;
- SFX em cada troca.

O ritmo padrão é uma troca de informação a cada 1,5–3 s.

## Pelo MCP

1. `project_create`, depois `creative_write` (ideia, roteiro, embalagem), aprovando cada etapa.
2. `media_import_files`:
   - **cenas das obras** citadas, com direitos confirmados. Nomes de arquivo descritivos (`batman-1940.jpg`) fazem a imagem entrar quando a fala a cita;
   - a **trilha licenciada**, com `role: "music"`.
   - opcional: o **personagem** com `character_import` (veja abaixo).
3. `narration_generate` e `narration_assemble`, cada um com `job_wait`.
4. `narration_transcribe` com `job_wait`: tempos de cada palavra, para os beats e a legenda.
5. `motion_plan_auto`: gera os beats e grava no projeto. Devolve um resumo (beats, média, cenas, mídias) e avisos.
6. `motion_preview`: um PNG por beat em `output/previas/`. Abra as imagens e confira o que aparece em cada beat.
7. `motion_kit` e `motion_plan_set`: o agente ajusta os beats, por exemplo:
   - mais cenas da obra onde a fala cita algo;
   - uma `formula` no princípio;
   - uma `lista` na aplicação;
   - uma `comparacao` no contraponto.
8. `render_start` com `job_wait`. O render reconhece o modo composição sozinho e normaliza o áudio para cerca de −14 LUFS, com limitador de pico.
9. `deliverable_build`.

**Vídeo sem narração** (só texto, som e música): escreva os beats direto em `motion_plan_set` com `narration: false`. Os tempos seguem a música, com tempos de 0,5 s a 120 BPM.

Para voltar à timeline de clips, use `motion_plan_set` com `plan: null`. Na interface, use Produção assistida → *Montar em motion (composição)*.

## Como o plano monta o vídeo

- **A cena da obra é a base.** Metade das evidências entra sozinha, em tela cheia (`cheia: true`); a outra metade ganha painel, rótulo e fundo.
- **Variação:** fundos e cores nunca se repetem de um beat para o outro.
- **O personagem em opinião e humor (`aparte`), só com personagem no projeto:**
  - a cena desfoca e o personagem aparece inteiro, subindo pela borda de baixo, com as pernas fora do quadro;
  - cada fala (`falas: [{ pose, humor, icone, texto }]`) troca a pose de uma vez, em stop motion, com balão de ícone ou texto;
  - cada pose é um PNG pronto do pacote do personagem (gesto e expressão já desenhados); `<pose>-b`, `-c`… são variantes sorteadas. O kit não desenha expressões: `humor` escolhe a pose pelo tom;
  - enquanto o personagem fala, a pose troca a cada ~0,85 s (até 5 por beat): a primeira no tom da frase (pergunta, piada, erro…), as seguintes em tons vizinhos, sem repetir em seguida; o balão fica até a próxima fala com ícone ou texto;
  - frases de emoção (piada, erro, tristeza, vitória, discordância, surpresa, opinião) chamam o aparte por cima da cena;
  - todas as poses do catálogo aparecem ao longo do vídeo: o plano prefere a que ainda não apareceu e, no fim, troca repetidas pelas que faltam. `motion_plan_auto` devolve `poses.posesFaltando` e avisa no vídeo longo.
- **Extras por cima da cena** (`extras` no beat):
  - **caixinhas HQ** que não precisam ser faladas: inscrição perto de 20%, like perto de 55% e "minha opinião, tá?" nas frases opinativas;
  - **recortes PNG:** uma mídia com `recorte` no nome (ex.: `recorte-moeda.png`) entra por cima do beat em que é citada, em vez de virar cena.
- **Sem personagem:** o plano não gera `aparte` nem a cena `personagem`, e nenhum beat leva `humor`.
- **Shorts 9:16:** todas as cenas têm layout próprio. O teste real é `npm run qa:motion -- --only=c`.

## Personagem do projeto

Um projeto pode ter **um personagem** (mascote, apresentador desenhado). Ele entra como mídia do projeto, com direitos confirmados, pela mesma operação na interface (Mídias → *Importar personagem*), no MCP (`character_import`) e na CLI (`character.inspect <pasta>` para validar; `character.import <pedido.json>` com o app aberto).

O pacote é uma pasta com os PNGs das poses e um `catalogo.json` (na pasta ou em `poses/`):

```json
{ "nome": "Meu personagem",
  "tons": { "pergunta": "pergunta, dúvida", "piada": "ironia" },
  "poses": {
    "pensando": { "arquivos": ["pensando.png", "pensando-b.png"], "gesto": "Mão no queixo", "tons": ["pergunta"] },
    "rindo": { "arquivos": ["rindo.png"], "gesto": "Rindo", "tons": ["piada"] } } }
```

- Cada pose vira mídia com papel `character`; o catálogo fica em `project.character` (contrato `contentlab-character-v1`). `dryRun: true` só valida.
- Importar de novo troca o personagem; as poses antigas saem do projeto. Remover a mídia de uma pose tira o arquivo do catálogo.
- O plano automático lê os tons das poses: troca a pose a cada ~0,85 s de fala, passa por todas e liga frase de emoção ao aparte.
- Tons que o plano reconhece: `abertura`, `base`, `explicacao`, `enfase`, `opiniao`, `piada`, `pergunta`, `surpresa`, `discordancia`, `ressalva`, `bastidor`, `erro`, `tristeza`, `descoberta`, `aprovacao` e `vitoria`.

## Cena 3D

`paineis3d`: a câmera voa por 2 a 4 painéis com imagens da obra no espaço, com rótulo e conclusão. Quando o plano tem essa cena, o render liga o WebGL por software (`gl: "swangle"`), que funciona sem placa de vídeo e leva cerca de 4 s de render por segundo de cena. Use no máximo uma a cada ~30 s.

## Thumbnail

`thumbnails_generate` usa o mesmo kit (composição `KitThumb`, 1280×720; 1080×1920 no Short, com o layout `palavra` diagramado na vertical). Por padrão, a thumbnail é limpa: fundo preto ou branco e o personagem grande; um PNG com fundo transparente aparece como recorte. Cada variante A/B tem:

- `mediaId`: a obra, assunto dominante;
- `text`: até 4 palavras, com a palavra-chave entre `*asteriscos*`;
- `humor`: o personagem do projeto na pose desse humor, opcional;
- opcionais: `background` (`preto`, `branco` ou `cena`), `side` (lado do texto), `tone` (cor de destaque), `badge` (selo) e `mediaIdB` (layout VS).

O Short não tem teste A/B: um título e uma thumbnail, a A (pedir a B num Short é recusado). Sem variantes, as palavras de impacto dos títulos viram o texto. Versões de 320 px ficam em `output/previas/` para conferir no tamanho do celular. A thumbnail antiga, com o título sobre um frame, continua disponível com `style: "simple"`.

## Roteiro em beats (`contentlab-motion-v1`)

```json
{ "narration": true, "captions": true, "music": { "volume": 0.5, "duck": 0.25 },
  "beats": [
    { "id": "b001", "scene": "titulo", "at": 0, "duration": 2.4, "props": { "palavras": ["IMAGINA", "UM HERÓI", "QUE NUNCA PERDE."] }, "sfx": [{ "name": "impact", "at": 0, "volume": 0.8 }] },
    { "id": "b002", "scene": "evidencia", "at": 2.4, "duration": 2.8, "props": { "midia": "media:<id>", "rotulo": "BATMAN #1 (1940)", "humor": "surpreso" }, "flash": false }
  ] }
```

- **Ordem:** os beats ficam em ordem e contíguos.
- **Cenas:**
  - `titulo`, `frase` e `personagem` (o personagem do projeto em destaque);
  - `evidencia`, `pagina` e `comparacao`;
  - `numero`, `ficha`, `formula` e `lista`;
  - `cta`;
  - `aparte` (o personagem comentando sobre a cena) e `paineis3d` (3D).
  - Planos antigos com a cena `nox` são lidos como `personagem` (migração do contrato).
  - Props, exemplos e regras: `motion_kit`.
- **Humores** (escolhem a pose do personagem pelo tom): `bravo`, `feliz`, `surpreso`, `tedio`, `confuso`, `piscada`, `determinado` e `triste`.
- **SFX:** os nomes vêm da lista `sfx` do catálogo do kit (hoje `pop`, `tick`, `type`, `whoosh`, `swish`, `impact`, `sub`, `glitch`, `riser`, `ding`, `error` e `camera`). Inclui também `clique`, `sino`, `explosao`, `tapa`, `tapa-eco`, `whoosh-rapido` e `whoosh-lento` (Freesound em CC0, pelo Openverse). O plano automático alterna `whoosh`, `swish` e `whoosh-rapido` nos cortes, põe `clique` no clique das caixinhas e `tapa` (ou `tapa-eco`, no máximo a cada 90 s) nas piadas do personagem. Cada som cai no quadro do evento da tela. Som novo entra como `assets/kit/sfx/<nome>.wav` mais o nome na lista `sfx` de `src/motion/kit/catalog.json`, com origem e licença em `licenses/THIRD_PARTY.md`.
- **Mídia:** referência `media:<id>`. Imagem ou vídeo (vídeo entra sem áudio); mídia com direitos pendentes é recusada.
- **Metadados:** o render final passa por `src/render/clean-metadata.js`: cópia de stream sem recodificar, sem etiquetas do contêiner, capítulos embutidos e SEI do x264, com `faststart`.
- **Legenda:** nos Shorts (9:16) ela fica o tempo todo; no vídeo longo (16:9) o plano automático deixa só no gancho (primeiros 6 s) e nos apartes do personagem, com `legenda: false` nos outros beats. `legenda: false` esconde a legenda num beat; em `titulo` e `cta` ela já fica escondida.

## Verificação da entrega

No modo composição, o `verificacao.md` confere:

- **ritmo:** média e maior beat;
- **assunto ou personagem:** quantos beats mostram um ou outro;
- **mídias da obra:** quantas foram usadas;
- **legenda:** palavra a palavra;
- **trilha licenciada:** a sintetizada é rascunho;
- **render:** conferido com ffprobe;
- **itens de sempre:** direitos e aprovações.

## Atualizar o kit

O kit é código do Content Lab: cenas em `src/motion/kit/`, catálogo em `src/motion/kit/catalog.json` e arquivos (fonte Anton, SFX, página HQ, ícones) em `assets/kit/`. A aba **Documentação** toca as cenas de exemplo e os fundos ao vivo (`@remotion/player`), com seletor de cor. Mudou uma cena: rode `npm run check` e `npm run qa:motion`.

## Limites

- **Mídia:** o Content Lab não busca nem baixa cenas das obras. Escolher a mídia e confirmar os direitos é com você.
- **Plano automático:** é um ponto de partida. O resultado melhora quando o agente revisa as prévias e ajusta os beats.
