import { expect, test } from 'vitest';
import { captionChunks, headline } from './production-operations.js';

test('chamada do slide corta em palavra inteira e legenda não deixa palavra sozinha', () => {
  expect(headline('Frase curta. Outra.', 80)).toBe('Frase curta.');
  const long = headline('Além disso, um neurotransmissor chamado noradrenalina, essencial para fixar lembranças, cai ao mínimo enquanto sonhamos.', 80);
  expect(long.endsWith('…')).toBe(true); expect(long.length).toBeLessThanOrEqual(81); expect(long).not.toMatch(/\s\S{1,3}…$/);
  const chunks = captionChunks('O mel tem pouquíssima água e é ácido, então bactérias não conseguem sobreviver nele.');
  expect(chunks.every(chunk => chunk.length >= 14)).toBe(true);
  expect(chunks.join(' ').replaceAll('\n', ' ')).toContain('sobreviver nele.');
});
