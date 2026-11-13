import { expect, test } from 'vitest';
import { editScript, scriptChapters, scriptChaptersSchema, scriptMarkdown } from './script.js';
import { scenesFromScript } from '../audio/narration-service.js';
import { missingStageArtifacts } from './workflow.js';

const script = () => ({ sources: 'Fonte da obra', chapters: [
  { id: 'origin', title: 'Origem — não ler', blocks: [
    { id: 'speech', type: 'narration', title: 'Rótulo não falado', text: 'O alienígena não criou Cletus. [capa da obra]' },
    { id: 'clip', type: 'scene', title: 'Filme', text: 'Transformação, 4–6 s. Som original sem narrador.' },
    { id: 'camera', type: 'direction', title: '', text: 'Aproximar a capa.' },
  ] },
  { id: 'ending', title: 'Conclusão', blocks: [{ id: 'payoff', type: 'narration', title: '', text: 'Ele já tinha escolhido.' }] },
] });

test('voz lê só narração; títulos, cenas, direção e fontes ficam no roteiro exportado', () => {
  const scenes = scenesFromScript(script());
  expect(scenes.map(scene => scene.text)).toEqual(['O alienígena não criou Cletus.', 'Ele já tinha escolhido.']);
  expect(scenes.map(scene => scene.id)).toEqual(['speech', 'payoff']);
  expect(scenes[0].chapterTitle).toBe('Origem — não ler');
  const markdown = scriptMarkdown(script());
  expect(markdown).toContain('Transformação, 4–6 s. Som original sem narrador.');
  expect(markdown).toContain('Aproximar a capa.');
  expect(markdown).toContain('Fonte da obra');
});

test('mover entre capítulos e renomear preserva IDs de takes e não altera a entrada', () => {
  const initial = script();
  const result = editScript(initial, [
    { op: 'block.move', blockId: 'speech', chapterId: 'ending', beforeId: 'payoff' },
    { op: 'chapter.move', chapterId: 'ending', beforeId: 'origin' },
    { op: 'chapter.update', chapterId: 'ending', title: 'A consequência' },
  ]);
  expect(scenesFromScript(result).map(scene => scene.id)).toEqual(['speech', 'payoff']);
  expect(initial.chapters[0].blocks).toHaveLength(3);
  expect(() => editScript(initial, [{ op: 'block.remove', blockId: 'speech' }, { op: 'block.move', blockId: 'clip', chapterId: 'missing' }])).toThrow(/Capítulo desconhecido/);
  expect(initial.chapters[0].blocks).toHaveLength(3);
  expect(() => scriptChaptersSchema.parse([...initial.chapters, initial.chapters[0]])).toThrow(/ID repetido/);
});

test('primeira edição de roteiro antigo preserva fala, fontes, direção e IDs; vazio não ressuscita texto antigo', () => {
  const old = { hook: 'Oi.', development: 'Primeira fala.\n\nSegunda fala.', payoff: 'Fim.', visual: 'Câmera.', sources: 'Fonte.' };
  const converted = { ...old, chapters: scriptChapters(old) };
  expect(scenesFromScript(converted).map(scene => [scene.id, scene.text])).toEqual(scenesFromScript(old).map(scene => [scene.id, scene.text]));
  expect(scriptMarkdown(converted)).toContain('Câmera.');
  expect(scenesFromScript({ ...old, chapters: [] })).toEqual([]);
  const project = { creative: { script: { chapters: [] } }, timeline: { tracks: [] } };
  expect(missingStageArtifacts(project, 'script')).toEqual(['bloco de roteiro']);
  project.creative.script = script();
  expect(missingStageArtifacts(project, 'script')).toEqual([]);
});
