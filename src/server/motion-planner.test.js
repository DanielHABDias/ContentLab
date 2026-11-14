import { expect, test } from 'vitest';
import { alignWindows } from './motion-planner.js';

const words = (text, start = 0, step = 0.5) => text.split(' ').map((word, i) => ({ text: word, start: start + i * step, end: start + i * step + 0.4 }));

test('alinha o início de cada trecho do roteiro pelas palavras reais da narração', () => {
  const said = [...words('Imagina você ser um deus.', 0), ...words('Mas eu vou ser justo, o começo é apelão.', 20), ...words('O nome do dragão é Grendel.', 50)];
  const windows = [
    { scene: { id: 'a', text: 'Imagina você ser um deus.' }, start: 0, length: 10 },
    { scene: { id: 'b', text: 'Mas eu vou ser justo, o começo é apelão.' }, start: 10, length: 15 },
    { scene: { id: 'c', text: 'O nome do dragão é Grendel.' }, start: 25, length: 30 },
  ];
  const aligned = alignWindows(windows, said);
  expect(aligned.map(window => window.start)).toEqual([0, 20, 50]);
  expect(aligned[1].length).toBe(30);
});

test('sem achar as palavras, mantém a estimativa', () => {
  const windows = [{ scene: { id: 'a', text: 'Um dois três' }, start: 0, length: 5 }, { scene: { id: 'b', text: 'Quatro cinco seis' }, start: 5, length: 5 }];
  expect(alignWindows(windows, words('nada a ver aqui', 0)).map(window => window.start)).toEqual([0, 5]);
});

test('tolera uma palavra diferente no começo do trecho', () => {
  const said = [...words('Primeiro trecho aqui.', 0), ...words('Ninguém está dizendo que ele é fraco.', 30)];
  const windows = [{ scene: { id: 'a', text: 'Primeiro trecho aqui.' }, start: 0, length: 10 }, { scene: { id: 'b', text: 'Ninguém tá dizendo que ele é fraco.' }, start: 10, length: 10 }];
  expect(alignWindows(windows, said)[1].start).toBe(30);
});
