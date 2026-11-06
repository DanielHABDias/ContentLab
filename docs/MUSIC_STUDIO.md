# Trilhas sonoras — Content Lab

Nova aba **Trilhas sonoras**: compositor procedural instrumental, com JSON editável. Não é geração por modelo de IA a partir de texto. Um assistente de IA pode produzir o JSON no formato abaixo, e o motor converte os dados em harmonia, baixo, melodia e percussão sintetizados em Web Audio.

## Funcionamento

- Duração exata de 5 a 900 segundos; tempo musical 45 a 130 BPM.
- Três modos harmônicos (tenso, acolhedor, melancólico) e melodia discreta, equilibrada ou desligada.
- A **seed** altera deterministamente as variações de fraseado e ritmo.
- **Volume** e **tensão** são pontos distintos em \`automation\`, ambos entre 0 e 1. Valores são interpolados linearmente; a tensão modifica a densidade e dinâmica do arranjo. O volume é aplicado ao mixer principal.
- \`melodyNotes\` opcional substitui a melodia automática por notas MIDI explícitas: \`time\` e \`duration\` em segundos, \`pitch\` inteiro (36–96) e \`velocity\` 0–1.
- **Ouvir 30 segundos** renderiza apenas a introdução com a automação correspondente. **Gerar WAV completo** renderiza a duração integral.
- A exportação é WAV estéreo PCM 16-bit, 32 kHz, local ao navegador. Baixe e importe no fluxo de áudio existente do Content Lab.
- A versão inicial não salva automaticamente na pasta do projeto, não possui análise semântica do roteiro, não usa uma API de IA e não produz samples orquestrais realistas. A duração máxima e o tempo de renderização dependem da memória e do processador do navegador.

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
