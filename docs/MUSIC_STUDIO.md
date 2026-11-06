# Trilhas sonoras — Content Lab

Nova aba **Trilhas sonoras**: compositor procedural instrumental, com JSON editável. Não é geração por modelo de IA a partir de texto. Um assistente de IA pode produzir o JSON no formato abaixo, e o motor converte os dados em harmonia, baixo, melodia e percussão sintetizados em Web Audio.

## Funcionamento

- Duração exata de 5 a 900 segundos; tempo musical 45 a 130 BPM.
- Três modos harmônicos (tenso, acolhedor, melancólico) e melodia discreta, equilibrada ou desligada.
- A **seed** altera deterministamente as variações de fraseado e ritmo.
- **Volume** e **tensão** são pontos distintos em \`automation\`, ambos entre 0 e 1. Valores são interpolados linearmente; a tensão modifica a densidade e dinâmica do arranjo. O volume é aplicado ao mixer principal.
- \`melodyNotes\` opcional substitui a melodia automática por notas MIDI explícitas: \`time\` e \`duration\` em segundos, \`pitch\` inteiro (36–96) e \`velocity\` 0–1.
- **Ouvir 30 segundos** renderiza a partir do segundo definido em "Prévia a partir de", com a automação e o trecho harmônico correspondentes. **Gerar WAV completo** renderiza a duração integral.
- A exportação é WAV estéreo PCM 16-bit, 32 kHz, local ao navegador. Baixe e importe no fluxo de áudio existente do Content Lab.
- A versão inicial não salva automaticamente na pasta do projeto, não possui análise semântica do roteiro, não usa uma API de IA e não produz samples orquestrais realistas. A duração máxima e o tempo de renderização dependem da memória e do processador do navegador.

## Tutorial: criar uma trilha e editar as curvas visualmente

1. Abra **Trilhas sonoras** no menu lateral. Preencha **Nome**, **Duração (5–900 s)**, **BPM (45–130)**, **Clima**, **Melodia**, **Seed** e **Volume geral**. O botão **Preset VD 008 · tensão** carrega uma proposta para suspense; **Nova variação** muda a seed sem descartar a estrutura do preset.
2. Use o **gráfico ampliado de 960 × 344 unidades SVG**, que ocupa a largura disponível da aba. Eixo X = segundos (marcas em minutos:segundos), eixo Y = valor de 0 a 100%.
3. **Azul contínuo = volume** da música; **laranja tracejado = tensão/intensidade** do arranjo. Tensão não é sinônimo de volume: pode haver um momento dramaticamente tenso com trilha baixa sob a narração.
4. **Arraste os círculos diretamente** para ajustar o nível. Nos nós intermediários, mover para a esquerda/direita altera o **tempo compartilhado** das duas curvas; o primeiro e o último têm tempo fixo em 0 e na duração total. Pontos não podem atravessar uns aos outros.
5. **Dê dois cliques no gráfico** para adicionar um ponto no segundo desejado. A curva mais próxima do clique recebe o nível escolhido; a outra recebe o valor interpolado nesse instante. Até **64 pontos** no total.
6. Para **remover um ponto**, selecione seu círculo e pressione **Delete** ou **Backspace**. Os pontos inicial/final não podem ser excluídos.
7. **Ajuste fino por teclado**: selecione o círculo com Tab e use ↑/↓ (1% por toque) ou ←/→ (0,1 s por toque nos pontos internos); com **Shift**, os passos sobem para 5% e 1 segundo. Os nós possuem rótulos acessíveis com tempo e percentual.
8. Todas as edições gráficas são refletidas no campo **JSON musical**. Se você colar ou alterar o JSON manualmente, pressione **Aplicar JSON**. A interface só aceitará o objeto se a validação passar.
9. Defina **Prévia a partir de (segundos)** e escolha **Ouvir 30 segundos** para conferir introdução, desenvolvimento ou clímax. Quando estiver satisfeito, clique em **Gerar WAV completo** e depois **Baixar WAV**. Use **Baixar JSON** para guardar o arranjo editável.

**Regra importante:** uma edição no gráfico ou nos campos invalida o áudio exportado anteriormente. Gere um novo WAV após ajustes. O gráfico edita o JSON musical, mas não modifica um WAV que já foi baixado.

## JSON musical: contrato e exemplo completos

O contrato atual é validado por `music/src/model.ts`. Não acrescentar campos inexistentes ou confundir este objeto com `edit_plan.json`.

| Propriedade | Valor aceito | Função |
| --- | --- | --- |
| `title` | texto não vazio, até 120 caracteres | Nome da trilha |
| `durationSeconds` | 5–900 segundos | Duração exata do áudio |
| `bpm` | 45–130 | Andamento |
| `seed` | inteiro de 0 a 2147483647 | Variação determinística |
| `mode` | `tense`, `warm`, `melancholic` | Harmonia do arranjo |
| `melody` | `sparse`, `balanced`, `none` | Melodia procedural |
| `masterVolume` | 0–1 | Ganho geral |
| `automation` | 2–64 nós `{time,volume,intensity}` | Curvas editáveis |
| `melodyNotes` | até 3000 notas `{time,duration,pitch,velocity}` | Melodia manual |

**Nós de automação:** `time` é o instante em segundos; deve crescer estritamente, sem duplicatas. O primeiro nó tem tempo 0 e o último tem tempo `durationSeconds`. `volume` e `intensity` estão entre 0 e 1 e interpolam linearmente. Os dois parâmetros pertencem ao **mesmo nó temporal**.

**Notas manuais:** `time` é o início em segundos; `duration` deve ficar entre 0,05 e 16 segundos; `pitch` é inteiro MIDI entre 36 e 96; `velocity` vai de 0,01 a 1. A nota deve terminar antes do final da música. Se `melodyNotes` não estiver vazio, **substitui toda a lead automática**, preservando harmonia, baixo e percussão. A qualidade do motivo, do fraseado e das pausas ainda depende da composição.

Exemplo válido, pronto para colar em **JSON musical** e clicar em **Aplicar JSON**:

```json
{
  "title": "Diazverso - Investigacao noturna",
  "durationSeconds": 90,
  "bpm": 74,
  "seed": 2048,
  "mode": "tense",
  "melody": "sparse",
  "masterVolume": 0.72,
  "automation": [
    {"time": 0, "volume": 0.22, "intensity": 0.12},
    {"time": 18, "volume": 0.27, "intensity": 0.25},
    {"time": 40, "volume": 0.28, "intensity": 0.51},
    {"time": 68, "volume": 0.34, "intensity": 0.82},
    {"time": 82, "volume": 0.26, "intensity": 0.35},
    {"time": 90, "volume": 0, "intensity": 0.10}
  ],
  "melodyNotes": []
}
```

Para assumir controle da melodia, substitua o array vazio por uma **frase original** (exemplo de estrutura, não uma música completa): `[{"time":4,"duration":0.45,"pitch":62,"velocity":0.36},{"time":4.8,"duration":0.7,"pitch":65,"velocity":0.33},{"time":6,"duration":0.6,"pitch":69,"velocity":0.38}]`. Esse conteúdo substituirá a lead procedural: o agente precisa construir as demais frases deliberadamente.

### Como um agente deve compor pelo JSON do Content Lab

- Ler a duração e a função narrativa do vídeo; mapear segundo por segundo os marcos essenciais (revelação, piada, queda de tensão, respiro), em vez de distribuir os nós somente por porcentagens.
- Definir centro tonal/harmonia e **motivo reconhecível**, desenvolvendo variações rítmicas e respostas; não entregar ruído ou notas aleatórias como se fossem uma música.
- Fixar `seed` durante revisões de volume, para manter comparações justas. Não aumentar `volume` só porque `intensity` aumentou.
- Trabalhar primeiro numa prévia curta; depois conferir trechos de abertura, desenvolvimento e clímax. Ouvir o solo e **sob a narração**, com volume/ducking que preserve a voz.
- Validar o JSON com o código atual, escutar realmente o WAV renderizado e revisar composição, funcionamento e adequação editorial. EarShot pode auxiliar no QA auditivo se estiver instalado. Se não foi ouvido/renderizado, declarar isso.
- `style`, `instruments`, `key`, `chords`, `swing`, `filters` e `soundFont` **não são campos suportados** pelo motor musical atual. São indicações de briefing ou propostas para evoluir o motor, nunca dados a inserir no objeto.

**Limites reais:** a renderização é local em WAV estéreo PCM 16-bit a 32 kHz. O áudio **não é salvo automaticamente** na pasta do projeto nem integrado ao editor de vídeo: baixe e importe manualmente a faixa no fluxo existente. Não há exportação MIDI ou stems, síntese realista por SoundFont, importação por IA de prompt ou interpretação automática do roteiro.


## Estrutura

\`music/src/model.ts\`: contrato JSON, preset e curvas.
\`music/src/arrange.ts\`: harmonia, melodia, baixo e bateria determinísticos.
\`music/src/synth.ts\`: grafo Web Audio e renderização offline.
\`music/src/wav.ts\`: codificador PCM WAV.
\`frontend/static/music/*.js\`: artefatos JavaScript compatíveis com navegador; devem permanecer idênticos aos fontes TypeScript (ver teste).
\`frontend/static/music-studio.js\`: controlador isolado da interface.
\`frontend/static/music-studio.css\`: estilos específicos.

A sintaxe dos fontes \`.ts\` é intencionalmente compatível com JavaScript ES2022; \`music/tsconfig.json\` permite verificar tipos por \`tsc --noEmit\` sem criar uma dependência de build no runtime.

## Exemplo — VD 008 Carnificina

Na aba, use **Preset VD 008 · tensão**, edite o tempo dos pontos da linha do tempo e as curvas. O arranjo utiliza uma sequência de acordes menores e dissonantes, notas melódicas espaçadas, baixo e bateria lo-fi. A tensão cresce ao longo das seções, com final mais silencioso.

Os arquivos WAV são criados por síntese, não são cópias de trilhas protegidas.
