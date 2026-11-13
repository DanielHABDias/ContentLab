/** Somente testes: saída explícita de um transcritor simulado, com tempos determinísticos. */
export const fakeWordTranscriber = async () => ({ transcribe: async (_file, { onProgress }) => {
  onProgress({ phase: 'Transcrição simulada', percent: 100 });
  return { model: 'whisper-large-v3', language: 'pt', srt: '1\n00:00:00,000 --> 00:00:00,800\nFala de teste.\n', json: { transcription: [
    { text: 'Fala de teste.', offsets: { from: 0, to: 800 }, tokens: [
      { text: ' Fala', offsets: { from: 0, to: 300 } },
      { text: ' de', offsets: { from: 300, to: 450 } },
      { text: ' teste.', offsets: { from: 450, to: 800 } },
    ] },
  ] } };
} });
