import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { localApi } from './local-api.js';
import { FinalResult, MotionPanel, beatSummary } from './MotionStudio.jsx';

vi.mock('./local-api.js', () => ({ localApi: { productionOutputs: vi.fn(), revealOutput: vi.fn() } }));

const outputs = { previews: [{ name: 'previas/previa-00105.png', second: 10.5, modifiedAt: '2026-11-13T20:00:00Z' }], renders: [{ name: 'knull-r119.mp4', modifiedAt: '2026-11-13T21:00:00Z' }, { name: 'knull-r116.mp4', modifiedAt: '2026-11-13T20:30:00Z' }], thumbnails: [{ name: 'thumbnails/thumbnail-A.png' }], delivery: false };
const details = {
  path: '/p',
  project: { revision: 3, media: [{ id: 'm1', role: 'music', name: 'trilha.mp3' }, { id: 't1', role: 'thumbnail', name: 'Thumbnail A' }], creative: { packaging: { thumbnailA: 't1' } },
    motion: { music: { mediaId: 'm1' }, beats: [{ id: 'b1', scene: 'titulo', at: 0, duration: 2, props: { palavras: ['GAIOLA.'] } }, { id: 'b2', scene: 'evidencia', at: 2, duration: 6, props: { midia: 'media:v', som: true, rotulo: 'VENOM 3' } }, { id: 'b3', scene: 'telafinal', at: 8, duration: 15, props: {} }] } },
};
beforeEach(() => { vi.resetAllMocks(); localApi.productionOutputs.mockResolvedValue(outputs); localApi.revealOutput.mockResolvedValue({}); });

test('a Edição no modo composição mostra o plano, as prévias e o vídeo final para quem acompanha', async () => {
  render(<MotionPanel details={details}/>);
  expect(screen.getByText('Vídeo montado pela IA')).toBeInTheDocument();
  expect(screen.getByText('0:23')).toBeInTheDocument();
  expect(await screen.findByAltText('Prévia em 0:11')).toHaveAttribute('src', expect.stringContaining('previa-00105.png'));
  expect(screen.getByLabelText('Vídeo final')).toHaveAttribute('src', expect.stringContaining('knull-r119.mp4'));
  expect(screen.getByText('Versões anteriores (1)')).toBeInTheDocument();
  expect(screen.getByAltText('Thumbnail A')).toBeInTheDocument();
  expect(screen.getByText('trilha.mp3')).toBeInTheDocument();
});

test('o resultado final abre as pastas do vídeo e das thumbnails', async () => {
  render(<FinalResult details={details}/>);
  (await screen.findByRole('button', { name: /Abrir pasta das thumbnails/ })).click();
  await waitFor(() => expect(localApi.revealOutput).toHaveBeenCalledWith('/p', 'thumbnails'));
  screen.getByRole('button', { name: /Abrir pasta do vídeo/ }).click();
  await waitFor(() => expect(localApi.revealOutput).toHaveBeenCalledWith('/p', 'output'));
});

test('o resumo do beat diz o que aparece na tela', () => {
  expect(beatSummary(details.project.motion.beats[0])).toBe('GAIOLA.');
  expect(beatSummary(details.project.motion.beats[1])).toBe('VENOM 3 · com o áudio original');
});
