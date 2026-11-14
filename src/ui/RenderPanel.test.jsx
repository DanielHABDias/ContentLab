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
