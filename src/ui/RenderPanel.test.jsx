import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RenderPanel } from './RenderPanel.jsx';
import { localApi } from './local-api.js';
vi.mock('./local-api.js', () => ({ localApi: { renderJobs: vi.fn(), renderPresets: vi.fn() } }));
test('shows visible render percentage and updates progress without reloading', async () => {
  const job = { id: 'r', state: 'running', progress: .42, phase: 'Renderizando a composição', attempt: 1 };
  localApi.renderPresets.mockResolvedValue({ presets: [] });
  localApi.renderJobs.mockResolvedValueOnce({ jobs: [job] }).mockResolvedValue({ jobs: [{ ...job, state: 'completed', progress: 1, phase: 'Concluído', output: '/video.mp4' }] });
  render(<RenderPanel projectPath="/project"/>);
  expect(await screen.findByText('Renderizando · 42%')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  await waitFor(() => expect(screen.getByText('Concluído · 100%')).toBeInTheDocument(), { timeout: 2500 });
  expect(screen.getByRole('button', { name: 'Mostrar arquivo' })).toBeInTheDocument();
});

test('project panel shows only the running render or the most recent result', async () => {
  localApi.renderPresets.mockResolvedValue({ presets: [] });
  localApi.renderJobs.mockResolvedValue({ jobs: [
    { id: 'queued', state: 'queued', progress: 0, phase: 'Aguardando', attempt: 1 },
    { id: 'running', state: 'running', progress: .2, phase: 'Trabalho atual', attempt: 1 },
    { id: 'old', state: 'failed', progress: 0, phase: 'Erro antigo', attempt: 1 },
  ] });
  render(<RenderPanel projectPath="/another-project"/>);
  expect(await screen.findByText('Renderizando · 20%')).toBeInTheDocument();
  expect(screen.queryByText(/Erro antigo/)).not.toBeInTheDocument(); expect(screen.queryByText('Na fila · 0%')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver fila de processamento' })).toBeInTheDocument();
});
