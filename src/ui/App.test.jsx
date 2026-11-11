import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { listProjects: vi.fn(), openProject: vi.fn(), createProject: vi.fn(), chooseDirectory: vi.fn(), choosePackage: vi.fn(), importPackage: vi.fn(), runProjectAction: vi.fn() } }));

function realDetails(overrides = {}) {
  const ids = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];
  const project = { schema: 'contentlab-project-v1', id: 'meu_projeto', title: 'Meu projeto', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: ids.map((id, index) => ({ id, state: index ? 'pending' : 'active', revision: 0, approvedRevision: null, dependsOn: index ? [ids[index - 1]] : [] })), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [] }, creative: { brief: { thesis: '', audience: '', promise: '', notes: '' }, script: { hook: '', development: '', payoff: '', visual: '', sources: '' }, packaging: { titleA: '', titleB: '', description: '', tags: '', seo: '', thumbnailMediaId: null } }, ...overrides };
  return { project, path: '/tmp/meu_projeto', history: [{ id: 'one', type: 'project.created', revision: 1 }], card: { id: project.id, title: project.title, type: project.type, aspectRatio: project.aspectRatio, revision: project.revision, stage: 'brief', progress: 0, path: '/tmp/meu_projeto' } };
}

beforeEach(() => { vi.clearAllMocks(); localApi.listProjects.mockResolvedValue({ projects: [] }); localApi.chooseDirectory.mockResolvedValue({ path: null }); localApi.choosePackage.mockResolvedValue({ path: null }); });

test('primeira execução fica vazia e não injeta exemplos', async () => {
  render(<App/>); expect(await screen.findByText(/nenhum projeto recente/i)).toBeInTheDocument(); expect(screen.queryByText(/batman|omnitrix|heróis falham/i)).not.toBeInTheDocument();
});

test('cria projeto real pela API e abre o workflow', async () => {
  localApi.createProject.mockResolvedValue(realDetails()); render(<App/>); await screen.findByText(/nenhum projeto recente/i); fireEvent.click(screen.getByRole('button', { name: /novo projeto/i })); fireEvent.change(screen.getByPlaceholderText(/nome do projeto/i), { target: { value: 'Meu projeto' } }); fireEvent.click(screen.getByRole('button', { name: /criar projeto/i })); expect(await screen.findByRole('heading', { name: 'Meu projeto' })).toBeInTheDocument(); expect(localApi.createProject).toHaveBeenCalledWith(expect.objectContaining({ title: 'Meu projeto', type: 'long' }));
});

test('configurar persiste e continuar abre a etapa real', async () => {
  const details = realDetails(); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.runProjectAction.mockImplementation(async input => realDetails({ ...details.project, revision: 2, title: input.action.title || details.project.title })); render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i })); fireEvent.click(await screen.findByRole('button', { name: /configurar/i })); fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Projeto atualizado' } }); fireEvent.click(screen.getByRole('button', { name: /salvar/i })); await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ type: 'project.update', title: 'Projeto atualizado' }) }))); fireEvent.click(screen.getByRole('button', { name: /continuar/i })); expect(screen.getByRole('heading', { name: /conteúdo do projeto/i })).toBeInTheDocument(); expect(screen.getByRole('tab', { name: /brief/i })).toHaveAttribute('aria-selected', 'true');
});

test('aprovação usa operação persistente em vez de estado simulado', async () => {
  const details = realDetails(); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.runProjectAction.mockResolvedValue(realDetails({ ...details.project, revision: 2 })); render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i })); fireEvent.click(await screen.findByRole('button', { name: /aprovar etapa/i })); await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', baseRevision: 1, action: { type: 'stage.approve', stageId: 'brief', expectedRevision: 0 } }));
});
