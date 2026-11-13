import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NarrationReader, NarrationReaderLink } from './NarrationReader.jsx';
import { App } from './App.jsx';
import { scenesFromScript } from '../audio/narration-service.js';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ OFFLINE_EVENT: 'offline', localApi: { narration: vi.fn(), openProject: vi.fn() } }));
const script = { chapters: [
  { id: 'one', title: 'Origem', blocks: [{ id: 'spoken', type: 'narration', title: 'Título interno', text: 'Esta é a fala. [pausa]' }, { id: 'visual', type: 'scene', text: 'Cena exclusiva.' }] },
  { id: 'two', title: 'Conclusão', blocks: [{ id: 'end', type: 'narration', text: 'Até a próxima.' }, { id: 'note', type: 'direction', text: 'Direção exclusiva.' }] },
], sources: 'Fonte exclusiva.' };
beforeEach(() => {
  vi.resetAllMocks();
  localApi.openProject.mockResolvedValue({ project: { title: 'Meu vídeo' } });
  localApi.narration.mockResolvedValue({ scenes: scenesFromScript(script) });
});
afterEach(() => { window.history.replaceState({}, '', '/'); });

test('rota independente mostra só falas por capítulo, com controle de tamanho e navegação', async () => {
  window.history.replaceState({}, '', '/?view=narration-script&project=%2Fp');
  render(<App/>);
  expect(await screen.findByText('Meu vídeo')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Origem' })).getByText('Esta é a fala.')).toBeInTheDocument();
  expect(screen.getByText('Até a próxima.')).toBeInTheDocument();
  for (const text of ['Cena exclusiva.', 'Direção exclusiva.', 'Fonte exclusiva.', 'Título interno', '[pausa]']) expect(screen.queryByText(text)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Conclusão' })).toHaveAttribute('href', '#chapter-1');
  expect(screen.queryByRole('button', { name: /microfone/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar texto' }));
  expect(screen.getByLabelText('Tamanho do texto')).toHaveTextContent('30 px');
  fireEvent.click(screen.getByRole('button', { name: 'Diminuir texto' }));
  expect(screen.getByLabelText('Tamanho do texto')).toHaveTextContent('28 px');
});

test('atualização é explícita e preserva a leitura quando falha; permite tentar novamente', async () => {
  render(<NarrationReader projectPath="/p"/>);
  await screen.findByText('Esta é a fala.');
  localApi.narration.mockRejectedValueOnce(new Error('Servidor indisponível'));
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar roteiro' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível');
  expect(screen.getByText('Esta é a fala.')).toBeInTheDocument();
  localApi.narration.mockResolvedValue({ scenes: [{ id: 'legacy', section: 'hook', text: 'Texto revisado.', label: 'Abertura 1' }] });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar roteiro' }));
  expect(await screen.findByText('Texto revisado.')).toBeInTheDocument();
  expect(screen.queryByText('Esta é a fala.')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Abertura' })).toBeInTheDocument();
});

test('projeto ausente não chama o servidor; roteiro vazio é explicado', async () => {
  const view = render(<NarrationReader/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Abra o roteiro pela etapa Narração');
  expect(localApi.narration).not.toHaveBeenCalled();
  view.unmount();
  localApi.narration.mockResolvedValue({ scenes: [] });
  render(<NarrationReader projectPath="/p"/>);
  expect(await screen.findByText('O roteiro ainda não tem texto para narrar.')).toBeInTheDocument();
});

test('link preserva pastas com espaços e caracteres especiais em uma aba separada', () => {
  render(<NarrationReaderLink projectPath="/Meus vídeos/Herói & vilão #1"/>);
  const link = screen.getByRole('link');
  expect(new URL(link.href).searchParams.get('project')).toBe('/Meus vídeos/Herói & vilão #1');
  expect(link).toHaveAttribute('target', '_blank');
});
