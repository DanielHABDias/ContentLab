import { expect, test } from 'vitest';
import { deleteSelection, editDuration, editedTime, selectSegments, sourceTime, takeSegments, validateSegments } from './audio-edits.js';

test('exclui erros sucessivos fechando os espaços e mapeia o resultado ao original', () => {
  const first = deleteSelection([{ start: 0, end: 10 }], 2, 4);
  expect(first).toEqual([{ start: 0, end: 2 }, { start: 4, end: 10 }]);
  const second = deleteSelection(first, 1, 3);
  expect(second).toEqual([{ start: 0, end: 1 }, { start: 5, end: 10 }]);
  expect(editDuration(second)).toBe(6);
  expect(sourceTime(second, 1)).toBe(5);
  expect(editedTime(second, 7)).toBe(3);
  expect(selectSegments(second, 0.5, 2)).toEqual([{ start: 0.5, end: 1 }, { start: 5, end: 6 }]);
  expect(takeSegments({ trim: { start: 2, end: 8 }, durationSeconds: 10 })).toEqual([{ start: 2, end: 8 }]);
});

test('rejeita intervalos sobrepostos, fora do arquivo, vazios ou sem números finitos', () => {
  for (const value of [[], [{ start: -1, end: 1 }], [{ start: 0, end: Infinity }], [{ start: 2, end: 3 }, { start: 1, end: 4 }], [{ start: 0, end: 11 }], [{ start: 0, end: 0.05 }]]) expect(() => validateSegments(value, 10)).toThrow();
  expect(validateSegments([{ start: 0, end: 1 }, { start: 2, end: 3 }], 10)).toHaveLength(2);
});
