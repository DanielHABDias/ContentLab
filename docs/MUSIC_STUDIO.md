# Trilhas sonoras — Content Lab | Composição multifaixa (JSON v2)

O Content Lab **não deve tocar sempre a mesma música**. O primeiro compositor aceitava somente três modos harmônicos, progressões de acordes e padrões rítmicos fixos; suas curvas de volume e intensidade não eram um sistema de composição. Isso foi corrigido com o **JSON musical v2**, que descreve a partitura.

O motor agora lê **faixas independentes**, **instrumentos escolhidos**, **notas com alturas/durações/forças próprias**, **padrões em clipes**, **repetições** e **silêncios**. É possível escrever arranjos originais em estilos diferentes — cinematic, lo-fi, funk, rock, pagode ou outros — sem precisar se limitar a um único preset. Os presets são apenas exemplos editáveis, **não limitam o tipo de música possível**.

A síntese continua **local via Web Audio**, sem API paga. A exportação **MIDI multifaixa** permite carregar partituras em uma DAW e renderizar com instrumentos virtuais/SoundFonts de sua escolha. Os timbres internos são sintetizadores: um cavaquinho, uma guitarra distorcida ou um pandeiro sintetizado não soam necessariamente iguais a músicos reais gravados. Um arranjo correto não substitui timbres/sample libraries profissionais.

## Comece por aqui

1. Abra **Trilhas sonoras** na navegação do Content Lab.
2. Selecione um estilo inicial: **Cinematográfico sombrio**, **Lo-fi**, **Funk brasileiro instrumental**, **Rock instrumental** ou **Pagode instrumental**. Clique em **Carregar arranjo do estilo**. Isso inicia um projeto novo, substituindo o que estiver na tela; **Baixar JSON** antes se desejar preservar o trabalho anterior.
3. Informe título, duração (5–900 segundos), BPM (40–240 para v2), seed e volume geral. **Mudar BPM altera o tempo das notas em segundos**, mas não o número de beats de um padrão.
4. Em **Instrumentos e padrões musicais**, cada faixa possui seu próprio instrumento, volume e estado de silêncio (mute). Abra **Editar padrão** para ver as notas do primeiro clipe. Ajuste:
   - **Tempo (beat)** — quando a nota entra **dentro do clipe**;
   - **Duração** — por quantos beats a nota toca;
   - **Nota MIDI** — altura da nota (por exemplo, 60 = dó central);
   - **Força (%)** — velocidade/dinâmica em porcentagem.
5. Use **+ Nota** para acrescentar ao primeiro padrão. **+ Nova faixa** cria instrumento independente; use a seleção de instrumento e o JSON para alterar seu comportamento. Os clipes adicionais, notas avulsas, seções e repetições são totalmente editáveis no JSON (para o controle mais fino).
6. Edite o gráfico ampliado: **azul contínuo = volume**, **laranja tracejada = intensidade**. Arraste círculos, dê **duplo clique para adicionar ponto**, e **Delete/Backspace para remover** (exceto extremidades). No teclado, ↑/↓ ajustam 1%, ←/→ movem 0,1 segundo; Shift amplia.
7. O editor mantém JSON e controles visuais sincronizados. Se editar o texto do JSON diretamente, clique em **Aplicar JSON**; ele valida o contrato e só atualiza a composição quando estiver correto.
8. Escolha **Prévia a partir de** e clique em **Ouvir 30 segundos**, conferindo partes da música. Quando aprovado, clique **Gerar WAV completo** e **Baixar WAV**.
9. Para editar timbres em uma DAW, clique em **Exportar MIDI multifaixa**. O arquivo MIDI carrega notas, canais de instrumentos e eventos de bateria, mas **não** o som do sintetizador, os efeitos Web Audio nem o resultado da mixagem. O WAV é o áudio renderizado.

**Importante:** alterar notas ou automações invalida a prévia e o WAV antigo; renderize novamente. Baixar WAV não importa a trilha automaticamente no Editor de vídeo — a importação continua manual. A composição musical é independente de \`edit_plan.json\`.

## JSON v2 — contrato geral

\`\`\`json
{
  "schemaVersion": 2,
  "title": "Meu tema original",
  "durationSeconds": 30,
  "bpm": 112,
  "beatsPerBar": 4,
  "seed": 441,
  "style": "custom",
  "masterVolume": 0.7,
  "automation": [
    {"time": 0, "volume": 0.65, "intensity": 0.35},
    {"time": 27, "volume": 0.72, "intensity": 0.60},
    {"time": 30, "volume": 0, "intensity": 0.20}
  ],
  "tracks": [
    {
      "id": "theme",
      "name": "Motivo principal",
      "instrument": "piano",
      "gain": 0.7,
      "pan": 0,
      "muted": false,
      "notes": [
        {"beat": 0, "durationBeats": 1, "pitch": 60, "velocity": 0.75}
      ],
      "clips": [
        {
          "startBeat": 4,
          "lengthBeats": 4,
          "repeats": 10,
          "notes": [
            {"beat": 0, "durationBeats": 0.75, "pitch": 64, "velocity": 0.65},
            {"beat": 1.5, "durationBeats": 1, "pitch": 67, "velocity": 0.60},
            {"beat": 3, "durationBeats": 0.75, "pitch": 62, "velocity": 0.55}
          ]
        }
      ]
    },
    {
      "id": "drums",
      "name": "Bumbo sincopado",
      "instrument": "kick",
      "gain": 0.55,
      "pan": 0,
      "muted": false,
      "notes": [],
      "clips": [
        {
          "startBeat": 0,
          "lengthBeats": 4,
          "repeats": 14,
          "notes": [
            {"beat": 0, "durationBeats": 0.2, "pitch": 36, "velocity": 0.85},
            {"beat": 2.5, "durationBeats": 0.2, "pitch": 36, "velocity": 0.60}
          ]
        }
      ]
    }
  ]
}
\`\`\`

Neste exemplo, a segunda faixa já tem um **ritmo diferente** da primeira. Em \`tracks\`, novas notas, instrumentos ou clipes alteram **a composição que será tocada**, não somente seu volume. A duração é o limite real: clipes que se estendem para além dos 30 segundos são interrompidos no fim.

### Campos globais

| Campo | Valores | Significado |
| --- | --- | --- |
| \`schemaVersion\` | **2** | Ativa compositor multifaixa |
| \`title\` | texto não vazio de até 120 caracteres | Nome da composição |
| \`durationSeconds\` | 5–900 | Duração exata em segundos |
| \`bpm\` | 40–240 | Andamento musical |
| \`beatsPerBar\` | inteiro de 1–12 | Batidas por compasso (grade e metadados MIDI) |
| \`seed\` | inteiro 0–2147483647 | Semente para síntese procedural/revisões; **não define a melodia de v2** |
| \`style\` | texto opcional | Rótulo de organização, **não programa o arranjo** |
| \`masterVolume\` | 0–1 | Volume geral |
| \`automation\` | de 2 a 64 nós | Volume e intensidade no tempo |
| \`tracks\` | 1–32 faixas | A partitura completa |

A **musicalidade vem das notas**, dos instrumentos e da distribuição das faixas. O campo \`style\` é só metadado: digitar "funk" sem montar as notas de funk **não** converte magicamente um rock em funk.

### Faixas

Uma faixa contém:

- \`id\`: identificador único de 1–40 caracteres (letras, números, hífen ou sublinhado).
- \`name\`: texto não vazio de até 80 caracteres.
- \`instrument\`: nome de instrumento existente na paleta abaixo.
- \`gain\`: volume relativo de 0 a 1; \`pan\`: posição estéreo de −1 a 1 (opcional); \`muted\`: booleano (opcional).
- \`notes\`: notas avulsas, com \`beat\` absoluto desde o começo da música.
- \`clips\`: até 128 padrões por faixa. Cada clipe tem \`startBeat\` (instante absoluto em beats), \`lengthBeats\` (tamanho do padrão), \`repeats\` (repetições) e seu próprio array \`notes\`. Nessa lista, \`beat\` é **relativo ao início do clipe**, portanto a mesma sequência pode ser repetida em diferentes trechos.

**Exemplo de estrutura A/B:** introdução em \`startBeat:0\` com \`repeats:4\`, verso em \`startBeat:16\` com outra lista de notas, refrão em \`startBeat:48\` com ritmo, acordes e instrumentos próprios. Para silêncio, deixe uma faixa sem eventos naquele trecho, use \`muted\` para silenciar uma faixa inteira ou diminua \`gain\`.

Cada nota tem:

- \`beat\`: posição, número a partir de 0;
- \`durationBeats\`: duração musical entre 0,015 e 64 beats;
- \`pitch\`: altura MIDI inteira entre 24 e 108;
- \`velocity\`: força 0,001–1.

Em clipes, a nota **precisa caber no tamanho do padrão**. No total, o motor limita a 30.000 eventos ativos por composição para proteger a memória do navegador. Notas avulsas e clipes não têm obrigação de seguir qualquer progressão fixa.

### Instrumentos suportados no sintetizador

**Graves e teclados:** \`sub-bass\`, \`808\`, \`bass\`, \`piano\`, \`electric-piano\`, \`organ\`, \`pad\`, \`strings\`, \`synth-lead\`, \`pluck\`.

**Personalização:** escolha `instrument: "custom-synth"` e, opcionalmente, acrescente `sound: {"wave":"square","cutoff":600,"attack":0.02,"release":0.35,"layerWave":"sine","layerGain":0.2,"detune":-5,"amp":0.4}` na faixa. As ondas aceitas são `sine`, `triangle`, `square` e `sawtooth`; o filtro vai de 80 a 18.000 Hz, ataque de 0,001–3 s, cauda de 0,005–6 s, ganho da camada de 0–1, afinação de −1200 a +1200 cents e amplitude de 0–1. Assim, o mesmo padrão de notas pode produzir diferentes timbres por código.

**Cordas e solistas sintetizados:** \`guitar\`, \`distorted-guitar\`, \`cavaquinho\`, \`flute\`, \`brass\`.

**Percussão:** \`kick\`, \`snare\`, \`hat\`, \`clap\`, \`shaker\`, \`tom\`, \`surdo\`, \`pandeiro\`, \`tamborim\`, \`rim\`, \`cowbell\`.

O gerador v2 usa uma síntese própria para cada tipo e exporta MIDI com programas General MIDI aproximados, e canal de bateria. Isso **não é amostragem de instrumentos acústicos**, nem há biblioteca de kits externos embutida.

## O que torna os estilos realmente diferentes?

| Partida | BPM inicial | Diferenças reais nas notas e instrumentos |
| --- | ---: | --- |
| Cinematográfico sombrio | 68 | Drone subgrave, pulso 808 lento, piano espaçado, cordas sustentadas e percussão distante |
| Lo-fi | 76 | Acordes de piano elétrico, baixo redondo, bateria leve e frases melódicas espaçadas |
| Rock | 124 | Guitarra com simulação de distorção, acordes de quinta, baixo ritmado, bumbo/caixa no backbeat e solo de guitarra |
| Funk brasileiro | 150 | Padrão sincopado de bumbo estilo tamborzão, palmas, chimbal rápido, baixo 808 e hook sintetizado |
| Pagode | 96 | Cavaquinho sincopado, surdo, pandeiro, tamborim, baixo e linha melódica |

Em vídeos mais longos, os presets agora se **desenvolvem por seções**: padrões geram clipes separados com transposições musicais e pequenas mudanças de dinâmica e groove. Isso evita repetir literalmente a mesma sequência durante toda a duração. Essas variações são apenas uma primeira forma; para progressões complexas e mudanças de forma A/B/refrão, edite os clipes e a melodia por JSON.

Essas são **demonstrações iniciais**, não produções prontas nem substitutos completos de músicos ou DAWs. Para criar outro ritmo, faça seu próprio \`tracks[].clips[].notes\`. Para música sem bateria, remova/mute as faixas de percussão. Para rock com duas guitarras, adicione outra faixa. Para funk com percussão diferente, mova cada hit em beats.

## Como um agente deve compor pelo código

1. **Briefing:** objetivo, gênero, ritmo, compasso, tonalidade desejada, paleta, duration e referências estéticas (sem copiar melodia protegida).
2. **Motivo e harmonia:** construir 2–6 notas com desenho reconhecível; definir progressão (por exemplo, acordes diferentes em cada seção) e ritmo de cada parte **antes** de escrever o JSON.
3. **Forma:** desenhar uma estrutura com intro, seção A, B, virada, respiro e final, conforme a duração e a narração. Cada trecho pode ter seus próprios \`clips\`, instrumentação e notas.
4. **Programação:** criar faixas por função (baixo, harmonia, lead, percussão, textura). Definir \`pitch\`, \`beat\`, \`durationBeats\` e \`velocity\` explicitamente. Usar repetições quando musicalmente adequadas, não como único conteúdo de dez minutos.
5. **Arranjo e dinâmica:** \`automation[].volume\` e \`intensity\` continuam úteis para a curva geral, mas **não são instrumentos de composição**. Não tentar fabricar rock, pagode ou piano usando apenas volume.
6. **Validação:** verificar \`validateScore\`, limite de duração, número de notas, faixas e clipes. Testar o resultado por **prévia realmente renderizada** em abertura, seção intermediária e conclusão.
7. **Qualidade:** ouvir em solo e com voz, conferir repetições, métrica, harmonia e ganho; comparar versões e mudar somente o que não funcionou. Exportar MIDI se precisar de instrumentos reais via DAW/SoundFont licenciado.
8. **Entrega:** gerar o WAV completo; importar no projeto de vídeo manualmente; preservar o JSON editável. Declarar claramente \`JSON PREPARADO\`, \`ÁUDIO RENDERIZADO\`, \`ESCUTA VALIDADA\` somente se cada etapa ocorreu de fato.

### Sugestão para o Carnificina

Uma composição tensa e pesada exige **notas baixas e instrumentação adequada**, não um preset idêntico com o ganho aumentado. Comece com \`cinematic\`, altere os motivos de piano em \`tracks[].clips[].notes\`, escolha notas graves de \`sub-bass\`, espaçamentos longos e pulsos de \`808\`; ajuste as seções conforme acontecimentos do roteiro, sem importar melodias de filmes.


## Exemplo para teste — Carnificina (7:37)

O arquivo [`Carnificina — Peso e Sombra v2`](../music/examples/carnificina-peso-e-sombra-v2.json) contém uma **composição original instrumental de 457 segundos**, em 68 BPM, com cinco faixas programadas: subgrave, sintetizador grave customizável, piano sombrio, cordas e percussão esparsa. O piano apresenta **oito frases/seções diferentes** ao longo do vídeo, em vez de depender de uma progressão única repetida do começo ao fim. O exemplo é um primeiro estudo em sintetizador local e ainda precisa de avaliação auditiva/ajuste criativo.

Para testar, abra o JSON, copie todo o conteúdo para **Trilhas sonoras → JSON musical**, clique em **Aplicar JSON** e escute as prévias em 0, 120, 260 e 390 segundos antes de renderizar o WAV integral. **Não** use os JSONs anteriores com `mode`/`melody` para validar o novo motor: eles continuam na rota v1 por compatibilidade.

## Compatibilidade com o JSON v1

O app ainda **lê e renderiza** os JSONs antigos com \`mode\`, \`melody\` e \`melodyNotes\`, mesmo sem \`schemaVersion\`. Esses arquivos preservam o arranjador **legado**, com padrões fixos. Não são automaticamente convertidos em v2, porque isso alteraria a música previamente aprovada.

Para criar uma música realmente nova, selecione um estilo da lista e clique em **Carregar arranjo do estilo** (composições não salvas na interface são substituídas). Guarde a configuração anterior com **Baixar JSON** se quiser compará-la.

## Implementação e limitações

- \`music/src/model.ts\`: validação v1/v2 e exemplos de cinco estilos.
- \`music/src/arrange.ts\`: transforma notas e clipes em eventos musicais reais, preservando o arranjador legado apenas para v1.
- \`music/src/synth.ts\`: síntese por tipo de instrumento, mix, efeitos simples e renderização em OfflineAudioContext.
- \`music/src/midi.ts\`: exportação de MIDI Standard MIDI File, formato 1, com metrônomo/tempo, trilhas e notas/percussão.
- \`music/src/wav.ts\`: export WAV estéreo PCM 16-bit, 32 kHz.
- \`frontend/static/music/*.js\`: espelho dos fontes TypeScript para execução no navegador.
- \`frontend/static/music-studio.js\`: escolha de gêneros, edição das faixas e padrões, JSON, prévia, WAV e MIDI.
- \`frontend/static/music-automation.js\`: gráfico grande com drag, duplo clique e teclado.
- \`server/music-studio.test.mjs\`: validação das duas versões, diferenciação musical, notas próprias e MIDI.
- \`server/smoke-ui.mjs\`: smoke browser do compositor e a síntese.

**Limitações assumidas:** o motor ainda não oferece sampler de áudio próprio, samples de bateria de estúdio, gravação de instrumentos, SoundFonts dentro do Web Audio, efeitos avançados por faixa, piano roll completo para edição livre de todos os clipes, importação automática no projeto de vídeo ou DAW integrada. A paleta de instrumentos é sintetizada. Qualidade de pagode/rock/funk acústico realista requer timbres ou gravações adicionais; use MIDI e fontes autorizadas. O objetivo do v2 é **composição livre e editável**, não alegar que a síntese atual é universal ou profissional.

O v2 não usa serviços generativos pagos. Trilha e samples externos devem ter direitos verificados, e o áudio resultante precisa ser realmente ouvido e aprovado antes de uso.
