# Modo composição: o vídeo como motion design

Esta é a forma principal de montar vídeos do canal. O vídeo inteiro é **uma composição Remotion** do kit de motion do plugin Diazverso (`skills/diazverso-motion/`), descrita por um **roteiro em beats**. Ele não é montado com clips colados numa timeline.

O kit cuida do visual:

- câmera sempre em movimento;
- palavras gigantes com aberração cromática;
- Nox com 8 expressões;
- cenas das obras em painéis HQ com zoom lento;
- números contando;
- listas em fichas;
- comparação com VS;
- grão, clarões e tremor nos impactos;
- legenda palavra a palavra;
- trilha que abaixa sob a voz;
- SFX em cada troca.

O ritmo segue as referências do canal: uma troca de informação a cada 1,5–3 s.

## Pelo MCP

1. `project_create`, depois `creative_write` (ideia, roteiro, embalagem), aprovando cada etapa.
2. `media_import_files`:
   - **cenas das obras** citadas, com direitos confirmados. Nomes de arquivo descritivos (`batman-1940.jpg`) fazem a imagem entrar quando a fala a cita;
   - a **trilha licenciada**, com `role: "music"`.
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

## O Nox e os Shorts

- **Aparte (`aparte`):** a cena da obra continua atrás e desfoca, e o Nox sobe pelo meio, da cintura para cima. Ele comenta em 1 a 4 tempos (`falas: [{ humor, icone, texto }]`), mudando de posição e de expressão, com um balão de ícone ou texto acima. No fim ele desce e o fundo volta nítido. O plano automático usa o aparte nas perguntas e comentários sobre o que está na tela, e o Nox de corpo inteiro só raramente.
- **Shorts 9:16:** todas as cenas têm layout próprio para 1080×1920. O conteúdo fica entre 12% e 72% da altura e a legenda acima da interface do Shorts. O teste real está em `npm run qa:motion -- --only=c`.

## Cena 3D

`paineis3d`: a câmera voa por 2 a 4 painéis com imagens da obra no espaço, com rótulo e conclusão. Quando o plano tem essa cena, o render liga o WebGL por software (`gl: "swangle"`), que funciona sem placa de vídeo e leva cerca de 4 s de render por segundo de cena. Use no máximo uma a cada ~30 s.

## Thumbnail

`thumbnails_generate` usa o mesmo kit (composição `DiazversoThumb`, 1280×720). Por padrão, a thumbnail é limpa: fundo preto ou branco e o personagem grande; um PNG com fundo transparente aparece como recorte. Cada variante A/B tem:

- `mediaId`: a obra, assunto dominante;
- `text`: até 4 palavras, com a palavra-chave entre `*asteriscos*`;
- `humor`: o Nox, opcional;
- opcionais: `background` (`preto`, `branco` ou `cena`), `side` (lado do texto), `tone` (cor de destaque), `badge` (selo) e `mediaIdB` (layout VS).

Sem variantes, as palavras de impacto dos títulos A e B viram o texto. Versões de 320 px ficam em `output/previas/` para conferir no tamanho do celular. A thumbnail antiga, com o título sobre um frame, continua disponível com `style: "simple"`.

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
  - `titulo`, `frase` e `nox`;
  - `evidencia`, `pagina` e `comparacao`;
  - `numero`, `ficha`, `formula` e `lista`;
  - `cta`;
  - `aparte` (o Nox comentando sobre a cena) e `paineis3d` (3D).
  - Props, exemplos e regras: `motion_kit`.
- **Humores do Nox:** `bravo`, `feliz`, `surpreso`, `tedio`, `confuso`, `piscada`, `determinado` e `triste`.
- **SFX:** `pop`, `tick`, `type`, `whoosh`, `swish`, `impact`, `sub`, `glitch`, `riser`, `ding`, `error` e `camera`.
- **Mídia:** referência `media:<id>`. Imagem ou vídeo (vídeo entra sem áudio); mídia com direitos pendentes é recusada.
- **Legenda:** `legenda: false` esconde a legenda naquele beat. Em `titulo` e `cta` ela já fica escondida.

## Verificação da entrega

No modo composição, o `verificacao.md` confere:

- **ritmo:** média e maior beat;
- **assunto ou Nox:** quantos beats mostram um ou outro;
- **mídias da obra:** quantas foram usadas;
- **legenda:** palavra a palavra;
- **trilha licenciada:** a sintetizada é rascunho;
- **render:** conferido com ffprobe;
- **itens de sempre:** direitos e aprovações.

## Atualizar o kit

O kit, o catálogo, o Nox sem olhos e os SFX vêm do plugin. Depois de mudar o plugin, rode `npm run scenes:diazverso`.

## Limites

- **Mídia:** o Content Lab não busca nem baixa cenas das obras. Escolher a mídia e confirmar os direitos é com você.
- **Plano automático:** é um ponto de partida. O resultado melhora quando o agente revisa as prévias e ajusta os beats.

O teste real é `npm run qa:motion`, com relatório em [QA_MOTION.md](QA_MOTION.md).
