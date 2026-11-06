# Trilhas sonoras — compositor musical do Content Lab

O Content Lab usa **um único formato de JSON musical**. A partitura define a música que deve ser tocada: faixas, instrumentos, notas MIDI, ritmo, acordes programados como notas, clipes, seções e automação. Não há campo de versão nem suporte ao formato musical anterior. **Não criar arquivos de backup** (por exemplo, extensões .old ou .bak); alterações devem acontecer nos arquivos canônicos.

## Por que um instrumento pode soar artificial?

Uma guitarra não pode ser simulada convincentemente apenas trocando a forma de onda de um oscilador. O compositor usa duas rotas sonoras distintas:

1. **Instrumentos realmente sampleados (CC0):** piano de verdade (coleção Meta Piano), violão de aço (Meta Steel Guitar), violão de nylon (Meta Nylon Guitar). São gravações originais da Meta Open Sound, licenciadas CC0, sem crédito obrigatório. O motor escolhe a gravação pela **nota e camada de intensidade**, decodifica OGG, agenda o som com ganho/decay e exporta o resultado em WAV. A opção "Guitarra com distorção" aplica distorção a um **violão de aço gravado**, não equivale a uma guitarra elétrica captada de amplificador.
2. **Instrumentos ainda sintetizados:** subgrave, 808, baixo eletrônico, pad, cordas sintéticas, sintetizador, cavaquinho e percussões. São sons eletrônicos úteis para arranjos experimentais, **não** substitutos fiéis de instrumentos acústicos ou percussão de estúdio.

**Fonte e licença:** https://github.com/facebookincubator/Meta-open-sound — consulte o README, o catálogo de licenças e os manifests oficiais. O Content Lab **não utiliza o Oculus Audio Pack**, pois exige atribuição. Somente as coleções instrumentais explicitamente CC0 estão permitidas neste fluxo.

**Como carregar as gravações:** ao clicar em **Ouvir 30 segundos** ou **Gerar WAV completo**, o aplicativo identifica quais gravações são exigidas pelas notas do trecho, busca os arquivos OGG oficiais uma vez, armazena-os no cache local de áudio sob `.contentlab/music-instruments/` e os reutiliza nas próximas renderizações. No **primeiro uso é necessário acesso à internet**. O Content Lab indica um erro caso não seja possível baixar ou decodificar a gravação: ele **não substitui silenciosamente um instrumento real por um som artificial**. A conexão local da aplicação deve estar acessível para a rota `/api/music/sample`.

O áudio final é renderizado a **48 kHz, estéreo, WAV PCM de 16 bits**. Para áudio mais sofisticado, grave outras fontes licenciadas externamente, use instrumentos virtuais em DAW e importe o WAV de volta ao fluxo de edição. O MIDI multifaixa permite essa etapa sem alterar as notas.

## Como compor uma música nova na interface

1. Abra **Trilhas sonoras**. Selecione um ponto de partida (cinematográfico, lo-fi, funk brasileiro instrumental, rock ou pagode) e clique em **Carregar arranjo do estilo**. Antes de substituí-lo, use **Baixar JSON** caso precise guardar uma composição aprovada — **um arquivo de composição exportado pelo usuário não é backup automático de código**.
2. Ajuste título, duração (5–900 segundos), BPM (40–240), seed e volume. A seed organiza a síntese e variações deliberadas; o arranjo depende das **notas reais**, não de uma palavra indicando gênero.
3. Em **Instrumentos e padrões musicais**, escolha **piano gravado CC0** ou **violão de aço/nylon gravado CC0** quando desejar esses timbres. Edite nome/volume/mute de cada faixa; **+ Nova faixa** adiciona uma faixa com suas próprias notas.
4. Abra **Editar padrão**. Edite os parâmetros de cada nota: `beat` (posição relativa ao clipe), `durationBeats`, `pitch` (altura MIDI) e `velocity` (intensidade do toque). **+ Nota** adiciona notas. Use o JSON para compor clipes diferentes por introdução, estrofe, refrão, respiro e final.
5. No gráfico grande, a linha **azul controla volume** e a **laranja tracejada controla a intensidade geral**. Arraste círculos, dê duplo clique para criar um nó, pressione Delete/Backspace para removê-lo. Isso **não** escreve melodia: composição está nas faixas e clipes.
6. Clique **Ouvir 30 segundos** para renderizar e testar um trecho. Primeiro teste timbres em notas isoladas e acompanhe o carregamento da biblioteca. Ouça começo, desenvolvimento e final **antes** de gerar 7 minutos.
7. Clique **Gerar WAV completo** e **Baixar WAV** para exportar a música realmente renderizada. O arquivo precisa ser importado manualmente na edição do vídeo. Use **Exportar MIDI multifaixa** para trabalhar em instrumentos virtuais ou DAW sem perder notas e ritmo.

## Contrato único do JSON musical

Um JSON musical é um objeto com:

- `title`: nome não vazio de até 120 caracteres.
- `durationSeconds`: duração em segundos, 5–900.
- `bpm`: andamento, 40–240; `beatsPerBar`: batidas por compasso, inteiro 1–12.
- `seed`: inteiro 0–2147483647; `masterVolume`: 0–1.
- `style`: rótulo opcional para ajudar a identificar o arranjo, **não gera música**.
- `automation`: entre 2 e 64 nós ordenados por segundo, começando em 0 e terminando em `durationSeconds`; cada nó tem `{time,volume,intensity}` com níveis 0–1.
- `tracks`: entre 1 e 32 faixas. Cada faixa tem `id`, `name`, `instrument`, `gain` (0–1), `pan` (−1 a 1, opcional), `muted` (booleano, opcional), arrays `notes` e `clips`.
- `notes`: eventos `{beat,durationBeats,pitch,velocity}`. `beat` é posição musical absoluta quando está diretamente na faixa; `durationBeats` entre 0,015 e 64; `pitch` inteiro MIDI 24–108; `velocity` 0,001–1.
- `clips`: blocos `{startBeat,lengthBeats,repeats,notes}`; dentro do clipe, `beat` da nota é relativo ao início do bloco. `lengthBeats` entre 0,125 e 256; `repeats` inteiro 1–2000. Até 128 clipes por faixa, 512 notas por clipe, 3000 notas diretas por faixa e 30.000 eventos sonoros ativos.

Exemplo **atual** (sem nenhum campo de versão):

```json
{
  "title": "Motivo instrumental original",
  "durationSeconds": 24,
  "bpm": 80,
  "beatsPerBar": 4,
  "seed": 251,
  "style": "cinematic",
  "masterVolume": 0.75,
  "automation": [
    {"time": 0, "volume": 0.6, "intensity": 0.3},
    {"time": 18, "volume": 0.7, "intensity": 0.5},
    {"time": 24, "volume": 0, "intensity": 0.2}
  ],
  "tracks": [
    {
      "id": "piano",
      "name": "Piano gravado",
      "instrument": "piano",
      "gain": 0.78,
      "pan": 0,
      "muted": false,
      "notes": [],
      "clips": [
        {
          "startBeat": 0,
          "lengthBeats": 8,
          "repeats": 4,
          "notes": [
            {"beat": 0, "durationBeats": 1.6, "pitch": 60, "velocity": 0.66},
            {"beat": 3, "durationBeats": 1.2, "pitch": 63, "velocity": 0.48},
            {"beat": 6, "durationBeats": 1.5, "pitch": 55, "velocity": 0.55}
          ]
        }
      ]
    }
  ]
}
```

**Instrumentos admitidos:** `piano`, `guitar` (violão de aço), `steel-guitar` (violão de aço), `nylon-guitar`, `distorted-guitar` (violão gravado com distorção digital), além de `custom-synth`, `sub-bass`, `808`, `bass`, `electric-piano`, `pad`, `strings`, `organ`, `synth-lead`, `pluck`, `cavaquinho`, `flute`, `brass` e os instrumentos de percussão `kick`, `snare`, `hat`, `clap`, `shaker`, `tom`, `surdo`, `pandeiro`, `tamborim`, `rim`, `cowbell`. As opções não marcadas como gravadas são sintetizadas.

Um instrumento tonal sintetizado pode usar `sound:{wave,cutoff,attack,release,amp,layerWave,layerGain,detune}` para alterar sua síntese. Isso não altera os dados do arquivo original dos instrumentos gravados.

## Testar o Carnificina sem gerar o mesmo loop

Use o exemplo [Carnificina — Peso e Sombra](../music/examples/carnificina-peso-e-sombra.json). Ele foi concebido para 457 segundos e possui cinco faixas, várias frases de piano, subgrave e camadas diferentes. Copie todo o arquivo em **JSON musical** e clique em **Aplicar JSON**. **Não use JSONs sem faixas e notas**: não são reconhecidos pelo contrato atual.

Teste janelas de prévia a partir de 0, 120, 260 e 390 segundos. Confira (1) que o piano toca com gravação real, (2) que mudanças em `pitch` alteram a altura, (3) que adicionar/excluir notas altera o áudio e (4) que ritmos diferentes produzem arranjos diferentes. Somente depois gere WAV integral. O exemplo é um estudo instrumental, não uma trilha avaliada ou aprovada por escuta.

## Testes e limites técnicos

- `music/src/model.ts`: validação apenas do JSON atual e exemplos musicais.
- `music/src/arrange.ts`: conversão de faixas e clipes em eventos de áudio.
- `music/src/samples.ts`: seleção de notas gravadas, camadas de dinâmica e carregamento/decodificação.
- `server/music-samples.mjs`: download controlado e cache de gravações CC0, sem baixar repositórios completos, sem arquivos .old e sem dependência de CDN no segundo uso.
- `music/src/synth.ts`: sintetização de pads/percussões e reprodução de amostras reais.
- `music/src/midi.ts` e `music/src/wav.ts`: exportação dos formatos MIDI e WAV.
- `frontend/static/music-studio.js`: UI de faixas, JSON, prévia e render.

A licença CC0 do material fonte não significa que todas as bibliotecas da internet sejam CC0. Não adicionar amostras de origem incerta. Atrasos na primeira renderização são esperados por download e decodificação de gravações; sem internet, o cache precisa já conter os samples necessários.

**Portas abertas para evolução:** bateria gravada CC0, guitarra elétrica realmente sampleada, cavaquinho real, importação de bibliotecas SF2/SFZ licenciadas, mixer/efeitos por faixa e edição piano roll mais completa. Não afirmar que esses recursos já existem no Content Lab.

**Qualidade só pode ser aprovada após escuta real** do WAV (inclusive junto à narração). Passar no schema ou gerar arquivo MIDI não prova bom som. Não há conversão automática de JSON antigo nem testes de compatibilidade com ele.
