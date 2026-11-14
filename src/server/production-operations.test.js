import { expect, test } from 'vitest';
import { captionChunks, defaultVariants, headline, singleVariant } from './production-operations.js';
import { packagingVariants } from '../core/workflow.js';

test('chamada do slide corta em palavra inteira e legenda não deixa palavra sozinha', () => {
  expect(headline('Frase curta. Outra.', 80)).toBe('Frase curta.');
  const long = headline('Além disso, um neurotransmissor chamado noradrenalina, essencial para fixar lembranças, cai ao mínimo enquanto sonhamos.', 80);
  expect(long.endsWith('…')).toBe(true); expect(long.length).toBeLessThanOrEqual(81); expect(long).not.toMatch(/\s\S{1,3}…$/);
  const chunks = captionChunks('O mel tem pouquíssima água e é ácido, então bactérias não conseguem sobreviver nele.');
  expect(chunks.every(chunk => chunk.length >= 14)).toBe(true);
  expect(chunks.join(' ').replaceAll('\n', ' ')).toContain('sobreviver nele.');
});

test('Short não tem teste A/B: um título e uma thumbnail (A); vídeo longo segue com A e B', () => {
  const short = { type: 'short' }; const long = { type: 'long' };
  expect(packagingVariants(short)).toEqual(['A']); expect(packagingVariants(long)).toEqual(['A', 'B']);
  const pair = [{ label: 'A', text: 'UM' }, { label: 'B', text: 'DOIS' }];
  expect(singleVariant(short, defaultVariants(short, pair))).toEqual([{ label: 'A', text: 'UM' }]);
  expect(singleVariant(long, defaultVariants(long, pair))).toEqual(pair);
  expect(singleVariant(short, [{ text: 'SÓ' }])).toEqual([{ label: 'A', text: 'SÓ' }]);
  expect(() => singleVariant(short, [{ label: 'B', text: 'B' }])).toThrow(/Short não tem teste A\/B/);
  expect(() => singleVariant(short, pair)).toThrow(/Short não tem teste A\/B/);
});
