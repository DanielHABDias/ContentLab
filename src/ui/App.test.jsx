import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from './App.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { listProjects: vi.fn(), openProject: vi.fn(), createProject: vi.fn(), chooseDirectory: vi.fn(), choosePackage: vi.fn(), chooseMedia: vi.fn(), inspectPackage: vi.fn(), importPackage: vi.fn(), importMedia: vi.fn(), runProjectAction: vi.fn(), renderPresets: vi.fn(), renderJobs: vi.fn(), enqueueRender: vi.fn(), cancelRender: vi.fn(), retryRender: vi.fn(), revealRender: vi.fn(), renderLog: vi.fn(), forgetProject: vi.fn(), revealProject: vi.fn(), renameProject: vi.fn(), changeProjectId: vi.fn(), duplicateProject: vi.fn(), exportProject: vi.fn(), deleteProject: vi.fn(), restoreProject: vi.fn(), projectActivities: vi.fn(), cancelProjectActivities: vi.fn(), setupStatus: vi.fn(), setupJobs: vi.fn(), setupInstall: vi.fn(), setupPause: vi.fn(), setupResume: vi.fn(), setupCancel: vi.fn(), setupOnboarding: vi.fn(), relocateProject: vi.fn(), getSettings: vi.fn(), about: vi.fn(), validateFolder: vi.fn(), updateSettings: vi.fn(), storageUsage: vi.fn(), storageOrphans: vi.fn(), storageCleanup: vi.fn(), planMigration: vi.fn(), startMigration: vi.fn(), storageJobs: vi.fn(), cancelMigration: vi.fn(), backupRegistry: vi.fn(), registryBackups: vi.fn(), restoreRegistry: vi.fn(), importFiles: vi.fn(), importUrl: vi.fn(), mediaUsage: vi.fn(), removeMedia: vi.fn(), createCut: vi.fn(), removeCut: vi.fn(), transcribe: vi.fn(), transcript: vi.fn(), saveTranscript: vi.fn(), searchTranscripts: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), upload: vi.fn() } }));

function setupStatus(overrides = {}) {
  const items = [
    { id: 'ffmpeg', label: 'FFmpeg', group: 'essential', kind: 'system', required: true, ready: true, detected: 'ffmpeg 6' },
    { id: 'zenity', label: 'Diálogo nativo (zenity)', group: 'essential', kind: 'system', required: true, ready: true, detected: '4.0' },
    { id: 'whisper-large-v3', label: 'Pesos Whisper large-v3', group: 'ai', kind: 'download', required: false, ready: false, installable: true, consent: true, downloadBytes: 3095033483, license: 'MIT', origin: 'https://huggingface.co/ggerganov/whisper.cpp', version: 'ggml-large-v3' },
    { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', group: 'ai', kind: 'python', required: false, ready: false, installable: true, consent: true, downloadBytes: 7.5 * 1024 ** 3, license: 'Apache-2.0', runtime: { status: 'ready', device: 'cpu', torchBuild: 'cpu', threads: 9, memoryLimitBytes: 12.4 * 1024 ** 3, estimate: { realtimeFactor: 25.4, source: 'referência' }, reasons: [], warnings: ['Radeon RX 580 não tem suporte do ROCm. Usando CPU.'] } },
  ];
  return { platform: { os: 'linux', arch: 'x64', distro: 'Zorin OS 18', packageManager: 'apt' }, hardware: { cpu: { model: 'AMD Ryzen 5 5500', threads: 12 }, memory: { totalBytes: 15.5 * 1024 ** 3, availableBytes: 13 * 1024 ** 3 }, gpus: [{ name: 'Radeon RX 580' }] }, toolsDirectory: '/app/.tools', freeBytes: 80 * 1024 ** 3, essentialsReady: true, onboarding: { completedAt: null, dismissedAt: null }, items, jobs: [], ...overrides };
}

function realDetails(overrides = {}) {
  const ids = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];
  const project = { schema: 'contentlab-project-v1', id: 'meu_projeto', title: 'Meu projeto', type: 'long', aspectRatio: '16:9', mode: 'review', revision: 1, stages: ids.map((id, index) => ({ id, state: index ? 'pending' : 'active', revision: 0, approvedRevision: null, dependsOn: index ? [ids[index - 1]] : [] })), media: [], timeline: { schema: 'contentlab-timeline-v1', fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [] }, creative: { brief: { thesis: '', audience: '', promise: '', notes: '' }, script: { hook: '', development: '', payoff: '', visual: '', sources: '' }, packaging: { titleA: '', titleB: '', description: '', tags: '', seo: '', thumbnailMediaId: null } }, ...overrides };
  return { project, path: '/tmp/meu_projeto', history: [{ id: 'one', type: 'project.created', revision: 1 }], card: { id: project.id, title: project.title, type: project.type, aspectRatio: project.aspectRatio, revision: project.revision, stage: 'brief', progress: 0, path: '/tmp/meu_projeto' } };
}

beforeEach(() => { vi.clearAllMocks(); localApi.about.mockResolvedValue({ app: { name: 'Content Lab', version: '2.0.0' }, system: { platform: 'linux', arch: 'x64', node: 'v22', cpus: 12, memoryGb: 15.5 }, nativeDialog: { available: true, tool: 'zenity' }, paths: { data: '~/.local/share/contentlab' }, dependencies: [], projects: { known: 0 }, generatedAt: '2026-11-12T00:00:00Z' }); localApi.setupStatus.mockResolvedValue(setupStatus({ onboarding: { completedAt: '2026-11-11T00:00:00Z', dismissedAt: null } })); localApi.listProjects.mockResolvedValue({ projects: [] }); localApi.chooseDirectory.mockResolvedValue({ path: null }); localApi.choosePackage.mockResolvedValue({ path: null }); localApi.renderPresets.mockResolvedValue({ presets: [{ id: 'full-hd', label: 'Full HD', width: 1920, height: 1080 }] }); localApi.renderJobs.mockResolvedValue({ jobs: [] }); });

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
  const details = realDetails({ creative: { ...realDetails().project.creative, brief: { thesis: 'Tese', audience: 'Público', promise: 'Promessa', notes: '' } } }); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.runProjectAction.mockResolvedValue(realDetails({ ...details.project, revision: 2 })); render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i })); fireEvent.click(await screen.findByRole('button', { name: /aprovar etapa/i })); await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', baseRevision: 1, action: { type: 'stage.approve', stageId: 'brief', expectedRevision: 0 } }));
});

test('modo autônomo executa job da etapa sem aprovar silenciosamente', async () => {
  const details = realDetails({ mode: 'autonomous' });
  localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  localApi.runProjectAction.mockResolvedValue(realDetails({ ...details.project, revision: 2, workflowJobs: [{ id: 'job_one', stageId: 'brief', state: 'waiting_input', baseRevision: 1, operationId: 'op_one', inputs: ['project@1'], outputs: ['missing:tese'], log: ['Faltam: tese'], stopReason: 'missing_artifacts', createdAt: 'x', finishedAt: 'x' }] }));
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  expect(await screen.findByText(/nunca publica automaticamente/i)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /executar etapa atual/i }));
  await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ type: 'workflow.run', stageId: 'brief', jobId: expect.stringMatching(/^job_/) }) })));
  expect(await screen.findByText(/faltam: tese/i)).toBeInTheDocument();
});

test('conflito oferece comparar e recarregar sem sobrescrever', async () => {
  const details = realDetails({ creative: { ...realDetails().project.creative, brief: { thesis: 'Tese', audience: 'Público', promise: 'Promessa', notes: '' } } });
  localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  localApi.runProjectAction.mockRejectedValue(Object.assign(new Error('Conflito de revisão: esperado 1, atual 2'), { code: 'REVISION_CONFLICT', details: { expected: 1, actual: 2 } }));
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i })); await screen.findByRole('heading', { name: 'Meu projeto' }); fireEvent.click(screen.getByRole('button', { name: /aprovar etapa/i }));
  expect(await screen.findByText(/esperado 1, atual 2/i)).toBeInTheDocument(); fireEvent.click(screen.getByText('Comparar')); expect(screen.getByText(/sua base: revisão 1/i)).toBeInTheDocument();
  localApi.openProject.mockResolvedValue(realDetails({ ...details.project, revision: 2 })); fireEvent.click(screen.getByRole('button', { name: /recarregar/i }));
  await waitFor(() => expect(localApi.openProject).toHaveBeenLastCalledWith('/tmp/meu_projeto'));
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
  fireEvent.click(screen.getByRole('button', { name: /^escolher$/i })); await waitFor(() => expect(localApi.chooseDirectory).toHaveBeenCalled()); expect(localApi.exportProject).not.toHaveBeenCalled();
  localApi.chooseDirectory.mockResolvedValue({ path: '/backups' }); fireEvent.click(screen.getByRole('button', { name: /^escolher$/i })); await screen.findByText('/backups'); fireEvent.click(screen.getByRole('button', { name: /^exportar$/i }));
  expect(await screen.findByText('Exportado: /backups/meu_projeto-r1.zip')).toBeInTheDocument();
  expect(localApi.exportProject).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', outputDirectory: '/backups', format: 'zip', includeRenders: false, includeCache: false });
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
  expect(screen.getByText(/AMD Ryzen 5 5500 · 12 núcleos · RAM 15,5 GB \(13 GB livres\) · Radeon RX 580/)).toBeInTheDocument();
  expect(screen.getByText(/processador \(CPU\) · PyTorch cpu · 9 núcleos · limite de memória 12,4 GB · ~25,4 s por segundo de áudio \(referência\)/)).toBeInTheDocument();
  expect(screen.getByText(/RX 580 não tem suporte do ROCm/)).toBeInTheDocument();
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

test('render bloqueado oferece configurar as dependências', async () => {
  const details = realDetails({ stages: stageAt('review') });
  localApi.setupStatus.mockResolvedValue(gatedSetup(['ffprobe', 'zenity'])); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details);
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));
  expect(await screen.findByText(/precisa de ffmpeg/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /instalar dependências/i }));
  expect(await screen.findByRole('heading', { name: /prepare seu computador/i })).toBeInTheDocument();
});

function settingsFixture() {
  const root = path => ({ path, exists: true, isDefault: true });
  return { revision: 3, roots: { projects: root('/data/projects'), media: root('/data/media'), renderCache: root('/data/render'), tools: root('/app/.tools'), renderOutput: { path: null, exists: null } }, limits: { cacheMaxBytes: null, minFreeBytes: 2 * 1024 ** 3 }, migratable: ['media', 'renderCache', 'tools'], recoveredFrom: null, registryRecovery: null };
}
function mockSettings() {
  localApi.getSettings.mockResolvedValue(settingsFixture());
  localApi.storageUsage.mockResolvedValue({ categories: { projects: { bytes: 1024, count: 1, path: '/data/projects' }, objects: { bytes: 5 * 1024 ** 2, path: '/data/media/objects' }, cuts: { bytes: 2048, path: '/data/media/cuts' } }, derivedBytes: 2048, freeBytes: 50 * 1024 ** 3, warnings: [], unanalyzedProjects: 0 });
  localApi.storageJobs.mockResolvedValue({ jobs: [] }); localApi.registryBackups.mockResolvedValue({ backups: [] });
}

test('mudar cache com dados abre migração assistida com plano antes de mover', async () => {
  mockSettings(); localApi.chooseDirectory.mockResolvedValue({ path: '/disco2/cache' }); localApi.validateFolder.mockResolvedValue({ writable: true });
  localApi.updateSettings.mockRejectedValue(Object.assign(new Error('decida'), { code: 'MIGRATION_DECISION_REQUIRED', details: { kind: 'media', usedBytes: 5000 } }));
  localApi.planMigration.mockResolvedValue({ kind: 'media', source: '/data/media', target: '/disco2/cache', files: 12, bytes: 5 * 1024 ** 2, freeBytes: 10 * 1024 ** 3, sufficient: true, conflicts: [], notRelocatable: null });
  localApi.startMigration.mockResolvedValue({ id: 'm1', state: 'running' });
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /configurações/i }));
  expect(await screen.findByText('5 MB')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /alterar cache de mídia/i }));
  const dialog = await screen.findByRole('dialog', { name: /mover dados/i });
  expect(within(dialog).getByText(/12 arquivos · 5 MB/)).toBeInTheDocument();
  expect(localApi.validateFolder).toHaveBeenCalledWith('/disco2/cache');
  fireEvent.click(within(dialog).getByRole('button', { name: /migrar dados/i }));
  await waitFor(() => expect(localApi.startMigration).toHaveBeenCalledWith({ kind: 'media', target: '/disco2/cache', removeSource: false }));
});

test('limpar derivados pede confirmação e não remove nada se cancelado', async () => {
  mockSettings(); localApi.storageCleanup.mockResolvedValue({ removed: ['cortes'], bytes: 2048 });
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /configurações/i }));
  fireEvent.click(await screen.findByRole('button', { name: /limpar derivados/i }));
  fireEvent.click(within(screen.getByRole('alertdialog', { name: 'Limpar derivados' })).getByRole('button', { name: 'Cancelar' }));
  expect(localApi.storageCleanup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /limpar derivados/i }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Limpar' }));
  await waitFor(() => expect(localApi.storageCleanup).toHaveBeenCalledWith({}));
  expect(await screen.findByText(/liberado 2 KB/i)).toBeInTheDocument();
});

test('projeto movido pode ser relocalizado pelo menu', async () => {
  const missing = { id: 'meu_projeto', title: 'Meu projeto', path: '/antigo/meu_projeto', status: 'missing', problem: 'Pasta não encontrada' };
  localApi.listProjects.mockResolvedValue({ projects: [missing] }); localApi.chooseDirectory.mockResolvedValue({ path: '/novo/meu_projeto' });
  localApi.relocateProject.mockResolvedValue({ ...realDetails(), path: '/novo/meu_projeto', card: { ...cardWith(), path: '/novo/meu_projeto' } });
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /ações de meu projeto/i }));
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /localizar pasta/i }));
  await waitFor(() => expect(localApi.relocateProject).toHaveBeenCalledWith({ path: '/antigo/meu_projeto', newPath: '/novo/meu_projeto' }));
  expect(await screen.findByRole('button', { name: /abrir meu projeto/i })).toBeEnabled();
});

test('voz clonada em computador sem RAM suficiente não pode ser marcada e explica o motivo', async () => {
  const status = setupStatus();
  status.items = status.items.map(item => item.id === 'voxcpm2' ? { ...item, installable: false, problem: 'Este computador não comporta o modelo', runtime: { ...item.runtime, status: 'unsupported', reasons: ['São necessários cerca de 13 GB de RAM no total; este computador tem 8 GB.'] } } : item);
  localApi.setupStatus.mockResolvedValue(status);
  render(<App/>); await screen.findByRole('heading', { name: /prepare seu computador/i });
  expect(screen.queryByLabelText(/voxcpm2/i)).not.toBeInTheDocument();
  expect(screen.getByText(/este computador tem 8 GB/)).toBeInTheDocument();
});

function mediaDetails() {
  const media = { id: 'media_abc', kind: 'audio', uri: '/cache/a.wav', sha256: 'a'.repeat(64), rights: 'owned', name: 'fala.wav', source: { type: 'file', value: '/home/fala.wav' }, metadata: { durationSeconds: 3, sizeBytes: 2048, width: null, height: null, videoCodec: null, audioCodec: 'pcm_s16le', sampleRate: 48000 }, cuts: [], transcript: { status: 'raw', model: 'whisper-large-v3', language: 'pt', segments: 2, updatedAt: 'x' } };
  const details = realDetails({ media: [media], stages: stageAt('media') });
  return { ...details, mediaStatus: [{ id: 'media_abc', available: true }] };
}
async function openMedia(details) {
  localApi.setupStatus.mockResolvedValue(gatedSetup(['ffmpeg', 'ffprobe', 'zenity', 'whisper-cli', 'whisper-large-v3']));
  localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.jobs.mockResolvedValue({ jobs: [] });
  localApi.transcript.mockResolvedValue({ transcript: { raw: [{ start: 0, end: 1.5, text: 'Olá mundo' }, { start: 1.5, end: 3, text: 'teste' }], current: [{ start: 0, end: 1.5, text: 'Olá mundo' }, { start: 1.5, end: 3, text: 'teste' }], revised: null, revision: 0, srt: '1' } });
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  fireEvent.click(await screen.findByRole('button', { name: /mídias locais/i }));
}

test('mídias: importa vários arquivos e mostra detalhes reais da mídia', async () => {
  const details = mediaDetails(); localApi.chooseMedia.mockResolvedValue({ paths: ['/a.wav', '/b.mp4'] }); localApi.importFiles.mockResolvedValue({ id: 'job_1', state: 'running' });
  await openMedia(details);
  expect(await screen.findByText(/Áudio · 0:03,0 · 2 KB · direitos: Própria · transcrição bruta/)).toBeInTheDocument();
  expect(screen.getByText('/home/fala.wav')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /importar arquivos/i }));
  await waitFor(() => expect(localApi.importFiles).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', sources: ['/a.wav', '/b.mp4'], rights: 'pending' }));
  expect(localApi.chooseMedia).toHaveBeenCalledWith('Importar mídias', true);
});

test('mídias: remover mostra os usos antes de desassociar', async () => {
  const details = mediaDetails(); localApi.mediaUsage.mockResolvedValue({ thumbnail: true, clips: [{ trackId: 'v', clipId: 'c' }], total: 2 }); localApi.removeMedia.mockResolvedValue({});
  await openMedia(details);
  fireEvent.click(await screen.findByRole('button', { name: /remover fala.wav/i }));
  const dialog = await screen.findByRole('alertdialog', { name: /remover do projeto/i });
  expect(within(dialog).getByText(/thumbnail da embalagem e 1 clip/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /desassociar e remover/i }));
  await waitFor(() => expect(localApi.removeMedia).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', baseRevision: 1, mediaId: 'media_abc', detachUsages: true }));
});

test('mídias: URL exige confirmar direitos; transcrição editada salva revisão', async () => {
  const details = mediaDetails(); localApi.saveTranscript.mockResolvedValue({ revision: 1 });
  localApi.setupStatus.mockResolvedValue(gatedSetup(['ffmpeg', 'ffprobe', 'zenity', 'yt-dlp', 'whisper-cli', 'whisper-large-v3']));
  localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.jobs.mockResolvedValue({ jobs: [] });
  localApi.transcript.mockResolvedValue({ transcript: { raw: [{ start: 0, end: 1.5, text: 'Olá mundo' }], current: [{ start: 0, end: 1.5, text: 'Olá mundo' }], revised: null, revision: 0, srt: '1' } });
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i })); fireEvent.click(await screen.findByRole('button', { name: /mídias locais/i }));
  const form = await screen.findByRole('form', { name: /importar por url/i });
  fireEvent.change(within(form).getByPlaceholderText(/https/), { target: { value: 'https://exemplo.com/v' } });
  expect(within(form).getByRole('button', { name: /baixar/i })).toBeDisabled();
  const segment = await screen.findByLabelText('Trecho 1');
  expect(screen.getByRole('button', { name: /salvar revisão/i })).toBeDisabled();
  fireEvent.change(segment, { target: { value: 'Olá, mundo!' } });
  expect(screen.getByText(/Original: Olá mundo/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /salvar revisão/i }));
  await waitFor(() => expect(localApi.saveTranscript).toHaveBeenCalledWith({ path: '/tmp/meu_projeto', mediaId: 'media_abc', baseRevision: 0, segments: [{ start: 0, end: 1.5, text: 'Olá, mundo!' }] }));
});

test('pedir mudanças abre diálogo acessível, exige motivo e devolve o foco', async () => {
  const details = realDetails(); localApi.listProjects.mockResolvedValue({ projects: [details.card] }); localApi.openProject.mockResolvedValue(details); localApi.runProjectAction.mockResolvedValue(realDetails({ ...details.project, revision: 2 }));
  render(<App/>); fireEvent.click(await screen.findByRole('button', { name: /abrir meu projeto/i }));
  const opener = await screen.findByRole('button', { name: /pedir mudanças/i }); opener.focus(); fireEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Pedir mudanças' });
  expect(within(dialog).getByLabelText(/o que precisa mudar/i)).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir mudanças' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(/escreva o motivo/i);
  expect(localApi.runProjectAction).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Pedir mudanças' })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  fireEvent.click(opener);
  fireEvent.change(screen.getByLabelText(/o que precisa mudar/i), { target: { value: 'Tese fraca' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pedir mudanças' }));
  await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith(expect.objectContaining({ action: { type: 'stage.request_changes', stageId: 'brief', reason: 'Tese fraca' } })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
