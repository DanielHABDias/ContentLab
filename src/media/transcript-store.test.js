import { expect, test } from 'vitest';
import { validWordTimings, wordsFromWhisper } from './transcript-store.js';

test('tokens com duração zero ou fora de ordem viram palavras válidas, sem perder a narração', () => {
  const json = { transcription: [
    { tokens: [{ text: ' Imagina', offsets: { from: 0, to: 400 } }, { text: ' você', offsets: { from: 400, to: 400 } }] },
    { tokens: [{ text: ' ser', offsets: { from: 380, to: 600 } }, { text: ' um', offsets: { from: 600, to: 700 } }, { text: '[_TT_]', offsets: { from: 700, to: 700 } }] },
  ] };
  const words = wordsFromWhisper(json);
  expect(words.map(word => word.text)).toEqual(['Imagina', 'você', 'ser', 'um']);
  expect(words[1]).toEqual({ text: 'você', start: 0.4, end: 0.42 });
  expect(words[2].start).toBe(0.4);
  expect(validWordTimings(words)).toBe(true);
});
