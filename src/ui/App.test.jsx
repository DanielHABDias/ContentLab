import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { listProjects: vi.fn(), openProject: vi.fn(), createProject: vi.fn(), chooseDirectory: vi.fn(), choosePackage: vi.fn(), chooseMedia: vi.fn(), importPackage: vi.fn(), importMedia: vi.fn(), runProjectAction: vi.fn(), forgetProject: vi.fn(), revealProject: vi.fn(), renameProject: vi.fn(), changeProjectId: vi.fn(), duplicateProject: vi.fn(), exportProject: vi.fn(), deleteProject: vi.fn(), restoreProject: vi.fn(), projectActivities: vi.fn(), cancelProjectActivities: vi.fn(), setupStatus: vi.fn(), setupJobs: vi.fn(), setupInstall: vi.fn(), setupPause: vi.fn(), setupResume: vi.fn(), setupCancel: vi.fn(), setupOnboarding: vi.fn() } }));

function setupStatus(overrides = {}) {
  const items = [
    { id: 'ffmpeg', label: 'FFmpeg', group: 'essential', kind: 'system', required: true, ready: true, detected: 'ffmpeg 6' },
    { id: 'zenity', label: 'Diálogo nativo (zenity)', group: 'essential', kind: 'system', required: true, ready: true, detected: '4.0' },
    { id: 'whisper-large-v3', label: 'Pesos Whisper large-v3', group: 'ai', kind: 'download', required: false, ready: false, installable: true, consent: true, downloadBytes: 3095033483, license: 'MIT', origin: 'https://huggingface.co/ggerganov/whisper.cpp', version: 'ggml-large-v3' },
    { id: 'chatterbox-pt-br', label: 'Chatterbox PT-BR', group: 'ai', kind: 'manual', required: false, ready: false, installable: false, manualSteps: 'Prepare o ambiente manualmente.' },
  ];
  return { platform: { os: 'linux', arch: 'x64', distro: 'Zorin OS 18', packageManager: 'apt' }, toolsDirectory: '/app/.tools', freeBytes: 80 * 1024 ** 3, essentialsReady: true, onboarding: { completedAt: null, dismissedAt: null }, items, jobs: [], ...overrides };
}

function realDetails(overrides = {}) {
  const ids = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];
  const project = { schema: 'contentlab-project-v1', id: 'meu_projeto', title: 'Meu projeto', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: ids.map((id, index) => ({ id, state: index ? 'pending' : 'active', revision: 0, approvedRevision: null, dependsOn: index ? [ids[index - 1]] : [] })), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [] }, creative: { brief: { thesis: '', audience: '', promise: '', notes: '' }, script: { hook: '', development: '', payoff: '', visual: '', sources: '' }, packaging: { titleA: '', titleB: '', description: '', tags: '', seo: '', thumbnailMediaId: null } }, ...overrides };
  return { project, path: '/tmp/meu_projeto', history: [{ id: 'one', type: 'project.created', revision: 1 }], card: { id: project.id, title: project.title, type: project.type, aspectRatio: project.aspectRatio, revision: project.revision, stage: 'brief', progress: 0, path: '/tmp/meu_projeto' } };
}

beforeEach(() => { vi.clearAllMocks(); localApi.setupStatus.mockResolvedValue(setupStatus({ onboarding: { completedAt: '2026-11-11T00:00:00Z', dismissedAt: null } })); localApi.listProjects.mockResolvedValue({ projects: [] }); localApi.chooseDirectory.mockResolvedValue({ path: null }); localApi.choosePackage.mockResolvedValue({ path: null }); });

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

function cardWith(overrides = {}) { return { ...realDetails().card, status: 'ready', sizeBytes: 2048, modifiedAt: '2026-11-10T10:00:00Z', openedAt: '2026-11-11T10:00:00Z', ...overrides }; }
async function openMenu(item) { fireEvent.click(await screen.findByRole('button', { name: /ações de meu projeto/i })); fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item })); }

test('cartão mostra tamanho e datas; remover de Recentes só chama o registro', async () => {
  localApi.listProjects.mockResolvedValue({ projects: [cardWith()] }); localApi.forgetProject.mockResolvedValue({ removed: 1 });
  render(<App/>); expect(await screen.findByText(/2 KB · modificado/)).toBeInTheDocument();
  await openMenu(/remover de recentes/i);
  await waitFor(() => expect(localApi.forgetProject).toHaveBeenCalledWith('/tmp/meu_projeto'));
  expect(localApi.deleteProject).not.toHaveBeenCalled();
  expect(await screen.findByText(/a pasta continua em \/tmp\/meu_projeto/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /abrir meu projeto/i })).not.toBeInTheDocument();
});

test('excluir exige o ID exato, remove o cartão e permite desfazer pela lixeira', async () => {
  const card = cardWith(); localApi.listProjects.mockResolvedValue({ projects: [card] });
  localApi.deleteProject.mockResolvedValue({ id: 'meu_projeto', title: 'Meu projeto', path: card.path, deleted: true, method: 'trash', restorable: true });
  localApi.restoreProject.mockResolvedValue({ ...realDetails(), card });
  render(<App/>); await openMenu(/excluir projeto/i);
  const dialog = screen.getByRole('alertdialog', { name: /excluir projeto/i });
  expect(within(dialog).getByText('/tmp/meu_projeto')).toBeInTheDocument();
  const submit = within(dialog).getByRole('button', { name: /mover para a lixeira/i });
  expect(submit).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/para confirmar/i), { target: { value: 'meu_projet' } }); expect(submit).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/para confirmar/i), { target: { value: 'meu_projeto' } }); fireEvent.click(submit);
  await waitFor(() => expect(localApi.deleteProject).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', confirmation: 'meu_projeto', mode: 'trash' }));
  expect(await screen.findByText(/movido para a lixeira/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /abrir meu projeto/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /desfazer/i }));
  expect(await screen.findByRole('button', { name: /abrir meu projeto/i })).toBeInTheDocument();
  expect(localApi.restoreProject).toHaveBeenCalledWith('/tmp/meu_projeto');
});

test('exclusão com render ativo oferece cancelar e não fecha em falso sucesso', async () => {
  localApi.listProjects.mockResolvedValue({ projects: [cardWith()] });
  localApi.deleteProject.mockRejectedValue(Object.assign(new Error('ocupado'), { code: 'PROJECT_BUSY', details: { activities: [{ kind: 'render', cancellable: true }] } }));
  localApi.cancelProjectActivities.mockResolvedValue({ cancelled: 1, remaining: 0 }); localApi.projectActivities.mockResolvedValue({ activities: [] });
  render(<App/>); await openMenu(/excluir projeto/i);
  fireEvent.change(screen.getByLabelText(/para confirmar/i), { target: { value: 'meu_projeto' } }); fireEvent.click(screen.getByRole('button', { name: /mover para a lixeira/i }));
  expect(await screen.findByText(/operações em andamento neste projeto: render/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /cancelar operações/i }));
  await waitFor(() => expect(localApi.cancelProjectActivities).toHaveBeenCalledWith('/tmp/meu_projeto'));
  expect(await screen.findByRole('button', { name: /mover para a lixeira/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /abrir meu projeto/i })).toBeInTheDocument();
});

test('sem lixeira, exclusão permanente exige segunda confirmação', async () => {
  localApi.listProjects.mockResolvedValue({ projects: [cardWith()] });
  localApi.deleteProject.mockRejectedValueOnce(Object.assign(new Error('Lixeira indisponível'), { code: 'TRASH_UNAVAILABLE' })).mockResolvedValueOnce({ id: 'meu_projeto', title: 'Meu projeto', path: '/tmp/meu_projeto', deleted: true, method: 'permanent', restorable: false });
  render(<App/>); await openMenu(/excluir projeto/i);
  fireEvent.change(screen.getByLabelText(/para confirmar/i), { target: { value: 'meu_projeto' } }); fireEvent.click(screen.getByRole('button', { name: /mover para a lixeira/i }));
  const permanent = await screen.findByRole('button', { name: /excluir permanentemente/i });
  expect(screen.getByRole('button', { name: /exportar backup/i })).toBeInTheDocument();
  expect(permanent).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/excluir permanentemente/i), { target: { value: 'EXCLUIR meu_projeto' } }); fireEvent.click(permanent);
  await waitFor(() => expect(localApi.deleteProject).toHaveBeenLastCalledWith({ path: '/tmp/meu_projeto', confirmation: 'meu_projeto', mode: 'permanent', permanentConfirmation: 'EXCLUIR meu_projeto', backupPath: null }));
  expect(await screen.findByText(/excluído permanentemente/i)).toBeInTheDocument();
});

test('projeto ausente não abre e só permite remover dos Recentes', async () => {
  localApi.listProjects.mockResolvedValue({ projects: [{ id: 'meu_projeto', title: 'Meu projeto', path: '/sumiu/meu_projeto', status: 'missing', problem: 'Pasta não encontrada' }] });
  render(<App/>); expect(await screen.findByText(/pasta não encontrada/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /abrir meu projeto/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /ações de meu projeto/i }));
  const menu = screen.getByRole('menu');
  expect(within(menu).getByRole('menuitem', { name: /excluir/i })).toBeDisabled();
  expect(within(menu).getByRole('menuitem', { name: /remover de recentes/i })).toBeEnabled();
  fireEvent.keyDown(menu, { key: 'Escape' }); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('renomear muda só o título sem trocar o ID', async () => {
  const card = cardWith(); localApi.listProjects.mockResolvedValue({ projects: [card] });
  localApi.renameProject.mockResolvedValue({ ...realDetails({ title: 'Novo nome', revision: 2 }), card: { ...card, title: 'Novo nome', revision: 2 } });
  render(<App/>); await openMenu(/renomear/i);
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo nome' } }); fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(localApi.renameProject).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', baseRevision: 1, title: 'Novo nome' }));
  expect(localApi.changeProjectId).not.toHaveBeenCalled();
  expect(await screen.findByRole('button', { name: /abrir novo nome/i })).toBeInTheDocument();
});

test('exportar usa a pasta escolhida e cancelar o seletor não exporta', async () => {
  localApi.listProjects.mockResolvedValue({ projects: [cardWith()] }); localApi.exportProject.mockResolvedValue({ path: '/backups/meu_projeto-r1.zip' });
  render(<App/>); await openMenu(/exportar zip/i);
  await waitFor(() => expect(localApi.chooseDirectory).toHaveBeenCalled()); expect(localApi.exportProject).not.toHaveBeenCalled();
  localApi.chooseDirectory.mockResolvedValue({ path: '/backups' }); await openMenu(/exportar zip/i);
  expect(await screen.findByText('Exportado: /backups/meu_projeto-r1.zip')).toBeInTheDocument();
  expect(localApi.exportProject).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', outputDirectory: '/backups', format: 'zip' });
});

test('primeira execução abre o assistente; “Agora não” é salvo e volta aos projetos', async () => {
  localApi.setupStatus.mockResolvedValue(setupStatus()); localApi.setupOnboarding.mockResolvedValue({});
  render(<App/>); expect(await screen.findByRole('heading', { name: /prepare seu computador/i })).toBeInTheDocument();
  expect(screen.getByText(/essenciais prontos/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /agora não/i }));
  await waitFor(() => expect(localApi.setupOnboarding).toHaveBeenCalledWith('dismissed'));
  expect(await screen.findByRole('heading', { name: /projetos locais/i })).toBeInTheDocument();
  expect(localApi.setupInstall).not.toHaveBeenCalled();
});

test('instalar recursos de IA exige seleção e consentimento com tamanho e licença', async () => {
  localApi.setupStatus.mockResolvedValue(setupStatus()); localApi.setupInstall.mockResolvedValue([]);
  render(<App/>); await screen.findByRole('heading', { name: /prepare seu computador/i });
  const install = screen.getByRole('button', { name: /instalar recursos de ia/i }); expect(install).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/pesos whisper large-v3/i));
  expect(screen.getByText(/antes de baixar/i).closest('p').textContent).toMatch(/2,9 GB.*MIT/);
  expect(install).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/autorizo o download/i)); fireEvent.click(install);
  await waitFor(() => expect(localApi.setupInstall).toHaveBeenCalledWith({ ids: ['whisper-large-v3'], consent: ['whisper-large-v3'] }));
  expect(screen.queryByLabelText(/chatterbox/i)).not.toBeInTheDocument();
  expect(screen.getByText(/prepare o ambiente manualmente/i)).toBeInTheDocument();
});

test('essenciais ausentes mostram o comando do sistema e bloqueiam “Começar a usar”', async () => {
  const status = setupStatus({ essentialsReady: false }); status.items[1] = { ...status.items[1], ready: false, systemCommand: 'sudo apt install zenity' };
  localApi.setupStatus.mockResolvedValue(status);
  render(<App/>); await screen.findByRole('heading', { name: /prepare seu computador/i });
  expect(screen.getByRole('button', { name: /começar a usar/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /instalar essenciais/i }));
  expect(screen.getAllByText('sudo apt install zenity').length).toBeGreaterThan(0);
});

test('download pausado oferece retomar e falha oferece tentar novamente', async () => {
  const status = setupStatus({ onboarding: { completedAt: 'x', dismissedAt: null }, jobs: [{ id: 'j1', itemId: 'whisper-large-v3', label: 'Pesos Whisper large-v3', state: 'paused', phase: 'Pausado; o progresso foi preservado', received: 100, total: 1000 }] });
  localApi.setupStatus.mockResolvedValue(status); localApi.setupResume.mockResolvedValue({});
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /dependências/i }));
  expect(await screen.findByText(/progresso foi preservado/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /retomar/i }));
  await waitFor(() => expect(localApi.setupResume).toHaveBeenCalledWith({ jobId: 'j1' }));
});

function stageAt(activeId) {
  const ids = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];
  const index = ids.indexOf(activeId);
  return ids.map((id, position) => ({ id, state: position < index ? 'approved' : position === index ? 'active' : 'pending', revision: 1, approvedRevision: position < index ? 1 : null, dependsOn: position ? [ids[position - 1]] : [] }));
}
function gatedSetup(ready) {
  const base = setupStatus({ onboarding: { completedAt: 'x', dismissedAt: null } });
  const extra = [
    { id: 'ffprobe', label: 'FFprobe', group: 'essential', required: true },
    { id: 'yt-dlp', label: 'yt-dlp', group: 'ai', installable: true, consent: true, downloadBytes: 41166968, license: 'Unlicense' },
    { id: 'whisper-cli', label: 'whisper.cpp (whisper-cli)', group: 'ai', installable: true, consent: true, license: 'MIT' },
  ];
  base.items = [...base.items, ...extra].map(item => ({ ...item, ready: ready.includes(item.id) }));
  base.essentialsReady = ['ffmpeg', 'ffprobe', 'zenity'].every(id => ready.includes(id));
  return base;
}

test('etapa sem dependência obrigatória fica bloqueada e leva à tela de dependências', async () => {
  const details = realDetails({ stages: stageAt('media') });
  localApi.setupStatus.mockResolvedValue(gatedSetup(['zenity'])); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  expect(await screen.findAllByText(/requer dependências/i)).not.toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
  expect(await screen.findByRole('heading', { name: /etapa bloqueada/i })).toBeInTheDocument();
  expect(screen.getByText(/precisa de FFmpeg e FFprobe/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /renderizar/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /instalar dependências/i }));
  expect(await screen.findByRole('heading', { name: /prepare seu computador/i })).toBeInTheDocument();
  expect(await screen.findByText(/necessário para continuar/i)).toHaveTextContent(/FFmpeg, FFprobe/);
});

test('recurso bloqueado dentro da etapa abre dependências com o item já marcado', async () => {
  const details = realDetails({ stages: stageAt('media') });
  localApi.setupStatus.mockResolvedValue(gatedSetup(['ffmpeg', 'ffprobe', 'zenity'])); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));
  const features = await screen.findByRole('list', { name: /recursos desta etapa/i });
  expect(within(features).getByText('Importar mídia local').closest('li')).toHaveTextContent('Disponível');
  expect(within(features).getByText('Importar vídeo por URL').closest('li')).toHaveTextContent(/Bloqueado: requer yt-dlp/);
  expect(within(features).getByText('Transcrever em português').closest('li')).toHaveTextContent(/whisper.cpp \(whisper-cli\) e Pesos Whisper large-v3/);
  fireEvent.click(within(features).getByRole('button', { name: /desbloquear importar vídeo por url/i }));
  expect(await screen.findByLabelText('yt-dlp')).toBeChecked();
  expect(screen.getByLabelText(/pesos whisper large-v3/i)).not.toBeChecked();
});

test('erro DEPENDENCY_MISSING do servidor oferece instalar as dependências', async () => {
  const details = realDetails({ stages: stageAt('review') });
  localApi.setupStatus.mockResolvedValue(gatedSetup(['ffmpeg', 'ffprobe', 'zenity'])); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  localApi.chooseDirectory.mockResolvedValue({ path: '/saida' }); localApi.render = vi.fn().mockRejectedValue(Object.assign(new Error('Para renderizar, instale: FFmpeg'), { code: 'DEPENDENCY_MISSING', details: { missing: ['ffmpeg'] } }));
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));
  fireEvent.click(await screen.findByRole('button', { name: /renderizar vídeo/i }));
  expect(await screen.findByText(/para renderizar, instale/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /instalar dependências/i }));
  expect(await screen.findByRole('heading', { name: /prepare seu computador/i })).toBeInTheDocument();
});
