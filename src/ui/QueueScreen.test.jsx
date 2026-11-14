import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { QueueScreen } from './QueueScreen.jsx';
import { localApi } from './local-api.js';
vi.mock('./local-api.js', () => ({ localApi: { processingQueue: vi.fn(), clearProcessingHistory: vi.fn(), cancelProcessingJob: vi.fn(), cancelProcessingQueue: vi.fn(), retryRender: vi.fn(), revealRender: vi.fn() } }));

test('shows mixed jobs, cancellation controls and clears only the finished history', async () => {
  const running = { id: 'render_one', kind: 'render', label: 'Render One', projectTitle: 'Vídeo um', projectPath: '/one', state: 'running', progress: .4 };
  const queued = { id: 'job_two', kind: 'transcription', label: 'Transcrição', projectTitle: 'Vídeo dois', projectPath: '/two', state: 'queued', queuePosition: 1 };
  const failed = { id: 'job_failed', kind: 'voice.generate', label: 'Voz', projectTitle: 'Vídeo três', state: 'failed', error: 'Falha na geração' };
  let jobs = [running, queued, failed]; localApi.processingQueue.mockImplementation(async () => ({ jobs }));
  localApi.clearProcessingHistory.mockImplementation(async () => { jobs = jobs.filter(job => ['queued', 'running'].includes(job.state)); });
  render(<QueueScreen onOpenProject={vi.fn()}/>);
  expect(await screen.findByText('Vídeo dois')).toBeInTheDocument(); expect(screen.getByText('Aguardando · posição 1')).toBeInTheDocument();
  expect(screen.getByText('Falha na geração')).toBeInTheDocument(); expect(screen.getAllByRole('button', { name: 'Cancelar trabalho' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }));
  await waitFor(() => expect(screen.queryByText('Falha na geração')).not.toBeInTheDocument());
  expect(screen.getByText('Vídeo um')).toBeInTheDocument(); expect(screen.getByText('Vídeo dois')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar todos' })); await waitFor(() => expect(localApi.cancelProcessingQueue).toHaveBeenCalledTimes(1));
});
