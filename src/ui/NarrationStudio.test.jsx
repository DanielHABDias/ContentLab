import { scenesFromScript } from '../audio/narration-service.js';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { NarrationStudio } from './NarrationStudio.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { getSettings: vi.fn(), updateSettings: vi.fn(), setupStatus: vi.fn(), narration: vi.fn(), openProject: vi.fn(), revealNarration: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), chooseMedia: vi.fn(), narrationImport: vi.fn(), updateTake: vi.fn(), reorderTakes: vi.fn(), deleteTake: vi.fn(), narrationPreview: vi.fn(), assembleNarration: vi.fn(), generateVoice: vi.fn(), voicePlan: vi.fn(), productionTranscribeNarration: vi.fn(), uploadTake: vi.fn(), runProjectAction: vi.fn(), systemApps: vi.fn(), closeApp: vi.fn() } }));

const setup = (voice = true) => ({ items: [{ id: 'ffmpeg', label: 'FFmpeg', ready: true }, { id: 'ffprobe', label: 'FFprobe', ready: true }, { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', ready: voice }] });
const measures = (lufs) => ({ durationSeconds: 20, integratedLufs: lufs, truePeakDb: -1.5, sampleRate: 48000, channels: 1, wav48kMono: true });
const take = (id, name, extra = {}) => ({ id, name, origin: 'recording', durationSeconds: 12.5, trim: null, file: `takes/${id}/take.wav`, ...extra });
const details = (narrationBy = 'ai') => ({ path: '/p', project: { id: 'projeto', title: 'Projeto', revision: 7, narrationBy } });
function state(overrides = {}) {
  return {
    narration: { revision: 3, takes: [take('take_aaaaaa1', 'Abertura'), take('take_bbbbbb2', 'Corpo', { origin: 'import' })], treatment: { trimSilence: true, denoise: true, highpass: true, compress: true, normalize: true, targetLufs: -16, preset: 'original' }, assembled: null },
    scenes: [{ id: 'hook-1', label: 'Abertura 1', text: 'Você já reparou nisso?', generated: { voice_abc123: 'take_x' } }, { id: 'development-1', label: 'Desenvolvimento 1', text: 'Primeiro ponto. Segundo.', lines: [{ text: 'Primeiro ponto.', direction: 'titulo' }, { text: 'Segundo.', direction: null }], generated: { voice_abc123: null } }],
    profiles: [{ id: 'voice_abc123', name: 'Minha voz', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, durationSeconds: 15, checkSample: null }],
    previewSeconds: 20, ...overrides,
  };
}

beforeEach(() => { vi.resetAllMocks(); localApi.voicePlan.mockResolvedValue({ plan: { status: 'ready' } }); localApi.narration.mockResolvedValue(state()); localApi.jobs.mockResolvedValue({ jobs: [] }); });

test('voz clonada bloqueada sem VoxCPM2 leva às dependências', async () => {
  const onOpenSetup = vi.fn();
  render(<NarrationStudio details={details()} setup={setup(false)} onOpenSetup={onOpenSetup}/>);
  fireEvent.click(within(await screen.findByRole('region', { name: /narração com a sua voz/i })).getByRole('button', { name: /instalar dependências/i }));
  expect(onOpenSetup).toHaveBeenCalledWith(['voxcpm2']);
});

test('sem perfil de voz a opção de voz de IA fica bloqueada e aponta para Minha voz', async () => {
  localApi.narration.mockResolvedValue(state({ profiles: [] }));
  const onOpenVoice = vi.fn();
  render(<NarrationStudio details={details(null)} setup={setup()} onOpenSetup={vi.fn()} onOpenVoice={onOpenVoice}/>);
  const choice = await screen.findByRole('region', { name: /voz deste vídeo/i });
  expect(within(choice).getByRole('radio', { name: /voz de ia/i })).toBeDisabled();
  expect(within(choice).getByRole('radio', { name: /eu gravo/i })).toBeEnabled();
  expect(within(choice).getByText(/nenhum perfil de voz gravado ainda/i)).toBeInTheDocument();
  fireEvent.click(within(choice).getByRole('button', { name: /abrir minha voz/i }));
  expect(onOpenVoice).toHaveBeenCalled();
  expect(localApi.runProjectAction).not.toHaveBeenCalled();
});

test('com perfil, escolher a voz de IA grava narrationBy no projeto', async () => {
  const updated = { project: { ...details('ai').project, revision: 8 } };
  localApi.runProjectAction.mockResolvedValue(updated);
  const onUpdated = vi.fn();
  render(<NarrationStudio details={details(null)} setup={setup()} onOpenSetup={vi.fn()} onUpdated={onUpdated}/>);
  const choice = await screen.findByRole('region', { name: /voz deste vídeo/i });
  fireEvent.click(within(choice).getByRole('radio', { name: /voz de ia/i }));
  await waitFor(() => expect(localApi.runProjectAction).toHaveBeenCalledWith({ path: '/p', baseRevision: 7, action: { type: 'project.update', narrationBy: 'ai' } }));
  expect(onUpdated).toHaveBeenCalledWith(updated);
});

test('quando a pessoa grava, a seção de voz clonada some da etapa', async () => {
  render(<NarrationStudio details={details('creator')} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByRole('heading', { name: 'Abertura', exact: true })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /narração com a sua voz/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /permitir microfone/i })).toBeInTheDocument();
});

test('microfone só é pedido depois do clique explícito', async () => {
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  globalThis.MediaRecorder = class { static isTypeSupported() { return true; } };
  render(<NarrationStudio details={details('creator')} setup={setup()} onOpenSetup={vi.fn()}/>);
  await screen.findByRole('heading', { name: 'Abertura', exact: true });
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /permitir microfone/i }));
  expect(await screen.findByRole('button', { name: /^gravar$/i })).toBeInTheDocument();
  expect(getUserMedia).toHaveBeenCalledTimes(1);
});

test('reordena, corta sem destruir e mostra preview A/B medido', async () => {
  localApi.reorderTakes.mockResolvedValue({ narration: state().narration });
  localApi.updateTake.mockResolvedValue({ narration: state().narration });
  localApi.narrationPreview.mockResolvedValue({ original: { file: 'aaaaaaaaaaaaaaaaaaaaaaaa-original.wav', measures: measures(-28) }, treated: { file: 'aaaaaaaaaaaaaaaaaaaaaaaa-tratado.wav', measures: measures(-16) } });
  render(<NarrationStudio details={details('creator')} setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Descer Abertura' }));
  await waitFor(() => expect(localApi.reorderTakes).toHaveBeenCalledWith({ path: '/p', baseRevision: 3, order: ['take_bbbbbb2', 'take_aaaaaa1'] }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  const wave = screen.getByRole('group', { name: 'Onda do áudio: Ouvir edição do take' });
  vi.spyOn(wave, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 });
  fireEvent(wave, new MouseEvent('pointerdown', { button: 0, clientX: 80, bubbles: true }));
  fireEvent(wave, new MouseEvent('pointerup', { button: 0, clientX: 320, bubbles: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Manter seleção' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(localApi.updateTake).toHaveBeenCalledWith(expect.objectContaining({ takeId: 'take_aaaaaa1', segments: [{ start: 1, end: 4 }] })));
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Pausas' })).getByRole('radio', { name: /curtas/i }));
  fireEvent.click(screen.getByRole('button', { name: /ouvir preview/i }));
  expect(await screen.findByText(/-16\.0 LUFS/)).toBeInTheDocument();
  expect(screen.getByText(/-28\.0 LUFS/)).toBeInTheDocument();
  expect(localApi.narrationPreview).toHaveBeenCalledWith(expect.objectContaining({ treatment: expect.objectContaining({ maxPauseSeconds: 0.25 }) }));
});

test('geração pede só as cenas pendentes do perfil escolhido', async () => {
  localApi.generateVoice.mockResolvedValue({ id: 'job_1', kind: 'voice.generate', label: 'Gerar voz: 1 cena', state: 'running', progress: { phase: 'Abertura', done: 0, total: 1 } });
  render(<NarrationStudio details={details()} setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /gerar 1 cena pendente/i }));
  await waitFor(() => expect(localApi.generateVoice).toHaveBeenCalledWith({ path: '/p', profileId: 'voice_abc123', sceneIds: ['development-1'] }));
});

test('mostra a voz sendo criada: cena atual, tempo e estimativa', async () => {
  const job = { id: 'job_1', kind: 'voice.generate', label: 'Gerar voz: 1 cena', state: 'running', startedAt: new Date().toISOString(), progress: { phase: 'Desenvolvimento 1', done: 0, total: 1, sceneId: 'development-1', sceneStartedAt: new Date().toISOString(), estimateSeconds: 300 } };
  localApi.jobs.mockResolvedValue({ jobs: [job] });
  render(<NarrationStudio details={details()} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByText('Criando sua voz: Desenvolvimento 1')).toBeInTheDocument();
  expect(screen.getByText(/de ~5:00/)).toBeInTheDocument();
  expect(screen.getByText('Criando…')).toBeInTheDocument();
});

test('inventário: estúdio de narração sem controles anônimos', async () => {
  const { auditControls } = await import('./a11y-audit.js');
  const { container } = render(<NarrationStudio details={details()} setup={setup(true)} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByRole('region', { name: /narração com a sua voz/i })).toBeInTheDocument();
  expect(auditControls(container)).toEqual([]);
});

test('mostra só as seções do jeito escolhido e explica a narração final', async () => {
  const base = state(); localApi.narration.mockResolvedValue({ ...base, narration: { ...base.narration, takes: [...base.narration.takes, take('take_x', 'Abertura 1', { origin: 'generated', sceneId: 'hook-1' })] } });
  localApi.assembleNarration.mockResolvedValue({ id: 'job1', kind: 'narration.assemble', state: 'running' });
  const { unmount } = render(<NarrationStudio details={details('ai')} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByRole('region', { name: /narração com a sua voz/i })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /gravações e áudios/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /ouvir, ajustar e montar/i })).not.toBeInTheDocument();
  expect(screen.getByText(/não passa por tratamento/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /montar narração final/i }));
  await waitFor(() => expect(localApi.assembleNarration).toHaveBeenCalledWith(expect.objectContaining({ takeIds: ['take_x'], treatment: expect.objectContaining({ aiDenoise: false, removeBreaths: false, trimPauses: false, normalize: true }) })));
  unmount();
  render(<NarrationStudio details={details('creator')} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByRole('region', { name: /gravações e áudios/i })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /narração com a sua voz/i })).not.toBeInTheDocument();
});

test('sem escolher quem narra, só aparece a escolha', async () => {
  render(<NarrationStudio details={details(null)} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByRole('region', { name: /voz deste vídeo/i })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /ouvir, ajustar e montar/i })).not.toBeInTheDocument();
});

test('sem RAM livre, mostra o que fechar e fecha com confirmação', async () => {
  localApi.voicePlan.mockResolvedValue({ plan: { status: 'needs-free-memory', requiredBytes: 11.5 * 1024 ** 3, availableBytes: 9 * 1024 ** 3, reasons: ['Feche programas'], device: 'cpu', threads: 9, memoryLimitBytes: 0, estimate: {} } });
  localApi.systemApps.mockResolvedValue({ supported: true, apps: [{ name: 'ChatGPT', bytes: 3.2 * 1024 ** 3, processes: 8, kind: 'app' }, { name: 'brave', bytes: 2.9 * 1024 ** 3, processes: 12, kind: 'browser' }] });
  localApi.closeApp.mockResolvedValue({ name: 'ChatGPT', closed: true, freedBytes: 3.2 * 1024 ** 3, remaining: 0 });
  render(<NarrationStudio details={details('ai')} setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: /gerar 1 cena pendente/i }));
  const panel = await screen.findByRole('region', { name: /libere 2,5 gb de memória/i });
  expect(await within(panel).findByText(/shift\+esc/i)).toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Fechar brave inteiro' })).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Fechar ChatGPT' }));
  const dialog = await screen.findByRole('alertdialog', { name: /fechar chatgpt/i });
  expect(localApi.closeApp).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: /fechar chatgpt/i }));
  await waitFor(() => expect(localApi.closeApp).toHaveBeenCalledWith({ name: 'ChatGPT', force: false }));
  expect(await screen.findByText(/chatgpt fechado: cerca de 3,2 gb liberados/i)).toBeInTheDocument();
});

test('sem memória, gerar não abre tarefa: mostra o painel para liberar', async () => {
  localApi.voicePlan.mockResolvedValue({ plan: { status: 'needs-free-memory', requiredBytes: 11.5 * 1024 ** 3, availableBytes: 10.7 * 1024 ** 3, reasons: [], device: 'cpu', threads: 9, memoryLimitBytes: 0, estimate: {} } });
  localApi.systemApps.mockResolvedValue({ supported: true, apps: [] });
  render(<NarrationStudio details={details('ai')} setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /gerar 1 cena pendente/i }));
  expect(await screen.findByRole('region', { name: /libere 0,8 gb/i })).toBeInTheDocument();
  await waitFor(() => expect(localApi.voicePlan).toHaveBeenCalledTimes(1));
  expect(localApi.generateVoice).not.toHaveBeenCalled();
});

test('projeto só mostra o painel após tentar gerar e a nova tentativa executa as mesmas cenas', async () => {
  localApi.voicePlan.mockResolvedValue({ plan: { status: 'needs-free-memory', requiredBytes: 11.5 * 1024 ** 3, availableBytes: 9 * 1024 ** 3, mode: 'standard' } });
  localApi.systemApps.mockResolvedValue({ apps: [] });
  localApi.generateVoice.mockResolvedValue({ id: 'retry_project', kind: 'voice.generate', state: 'completed', progress: {} });
  render(<NarrationStudio details={details('ai')} setup={setup()} onOpenSetup={vi.fn()}/>);
  const generate = await screen.findByRole('button', { name: /gerar 1 cena pendente/i });
  expect(localApi.voicePlan).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
  fireEvent.click(generate);
  const panel = await screen.findByRole('region', { name: /libere/i });
  expect(within(panel).getByRole('button', { name: /trocar para modo econômico/i })).toBeInTheDocument();
  let resolvePlan;
  localApi.voicePlan.mockImplementationOnce(() => new Promise(resolve => { resolvePlan = resolve; }));
  fireEvent.click(within(panel).getByRole('button', { name: /tentar de novo/i }));
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
  resolvePlan({ plan: { status: 'ready' } });
  await waitFor(() => expect(localApi.generateVoice).toHaveBeenCalledWith({ path: '/p', profileId: 'voice_abc123', sceneIds: ['development-1'] }));
});

test('quem grava vê o roteiro falado, uma frase por linha, sem a direção visual', async () => {
  render(<NarrationStudio details={details('creator')} setup={setup(true)} onOpenSetup={vi.fn()}/>);
  const script = await screen.findByRole('region', { name: 'Roteiro de narração' });
  expect(within(script).getByText('Primeiro ponto.')).toBeInTheDocument();
  expect(within(script).getByText('Segundo.')).toBeInTheDocument();
  expect(within(script).queryByText(/titulo/)).not.toBeInTheDocument();
});


test('gravação mostra só falas, agrupadas por capítulos, sem cenas, direção ou títulos de blocos', async () => {
  const scenes = scenesFromScript({ sources: 'Fonte que não se lê', chapters: [
    { id: 'origin', title: 'Origem', blocks: [
      { id: 'speech1', type: 'narration', title: 'Rótulo de produção', text: 'Primeira fala.' },
      { id: 'clip', type: 'scene', title: 'Cena do filme', text: 'Som original da transformação.' },
      { id: 'speech2', type: 'narration', title: '', text: 'Segunda fala.' },
    ] },
    { id: 'ending', title: 'Conclusão', blocks: [{ id: 'speech3', type: 'narration', title: '', text: 'Fala final.' }, { id: 'direction', type: 'direction', title: '', text: 'Mover a câmera.' }] },
  ] });
  localApi.narration.mockResolvedValue(state({ scenes }));
  render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  const script = await screen.findByRole('region', { name: 'Roteiro de narração' });
  const origin = within(script).getByRole('region', { name: 'Origem' });
  expect(within(origin).getByText('Primeira fala.')).toBeInTheDocument();
  expect(within(origin).getByText('Segunda fala.')).toBeInTheDocument();
  expect(within(within(script).getByRole('region', { name: 'Conclusão' })).getByText('Fala final.')).toBeInTheDocument();
  expect(script).not.toHaveTextContent(/Som original|Mover a câmera|Fonte que|Rótulo de produção/);
});

test('mostra transcrição pronta e permite retomar a falha sem remontar os takes', async () => {
  localApi.narration.mockResolvedValueOnce(state({ narration: { ...state().narration, assembled: { mediaId: 'media_voice', measures: measures(-16) } }, transcription: { status: 'failed', error: 'O Whisper falhou.' } })).mockResolvedValue(state({ narration: { ...state().narration, assembled: { mediaId: 'media_voice', measures: measures(-16) } }, transcription: { status: 'ready', words: 3 } }));
  localApi.productionTranscribeNarration.mockResolvedValue({ jobId: 'transcription_retry' });
  render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar transcrição palavra por palavra' }));
  expect(await screen.findByText(/Transcrição pronta · 3 palavras/)).toBeInTheDocument();
  expect(localApi.productionTranscribeNarration).toHaveBeenCalledWith({ path: '/p' });
  expect(localApi.assembleNarration).not.toHaveBeenCalled();
});

test('abre roteiro em outra aba ao lado da gravação, mantendo o projeto e a captura ativa', async () => {
  const stopTrack = vi.fn(); const stopRecording = vi.fn(); const startRecording = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, configurable: true });
  const previousRecorder = globalThis.MediaRecorder;
  globalThis.MediaRecorder = class { static isTypeSupported() { return true; } start = startRecording; stop = stopRecording; };
  const view = render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  const takes = await screen.findByRole('region', { name: 'Gravações e áudios' });
  const link = within(takes).getByRole('link', { name: 'Abrir roteiro em outra aba' });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const url = new URL(link.href);
  expect(url.searchParams.get('view')).toBe('narration-script');
  expect(url.searchParams.get('project')).toBe('/p');
  fireEvent.click(within(takes).getByRole('button', { name: /permitir microfone/i }));
  fireEvent.click(await within(takes).findByRole('button', { name: 'Gravar' }));
  fireEvent.click(link);
  expect(within(takes).getByRole('button', { name: /Parar/ })).toBeEnabled();
  expect(startRecording).toHaveBeenCalledTimes(1);
  expect(stopRecording).not.toHaveBeenCalled();
  expect(stopTrack).not.toHaveBeenCalled();
  view.unmount();
  globalThis.MediaRecorder = previousRecorder;
});

test('pausar e retomar mantém um único take; falha de envio permite salvar a mesma gravação novamente', async () => {
  const pause = vi.fn(); const resume = vi.fn(); const stopTrack = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) }, configurable: true });
  const previous = globalThis.MediaRecorder;
  globalThis.MediaRecorder = class {
    mimeType = 'audio/webm'; static isTypeSupported() { return true; }
    pause = pause; resume = resume;
    start() { this.ondataavailable({ data: new Blob(['primeira fala']) }); }
    stop() { this.ondataavailable({ data: new Blob(['segunda fala']) }); this.onstop(); }
  };
  localApi.uploadTake.mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValueOnce({});
  const view = render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Permitir microfone' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Gravar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pausar gravação' }));
  expect(pause).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Gravação pausada')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retomar gravação' }));
  expect(resume).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Parar e salvar/ }));
  expect(await screen.findByRole('button', { name: 'Tentar salvar gravação' })).toBeInTheDocument();
  const blob = localApi.uploadTake.mock.calls[0][0].blob;
  expect(blob.size).toBe('primeira falasegunda fala'.length);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar salvar gravação' }));
  await waitFor(() => expect(localApi.uploadTake).toHaveBeenCalledTimes(2));
  expect(localApi.uploadTake.mock.calls[1][0].blob).toBe(blob);
  expect(await screen.findByRole('button', { name: 'Gravar' })).toBeInTheDocument();
  expect(stopTrack).not.toHaveBeenCalled();
  view.unmount(); globalThis.MediaRecorder = previous;
});

test.each(['creator', 'ai'])('montagem em %s confirma o clique antes da resposta e acompanha o job junto ao botão', async mode => {
  const initial = state();
  localApi.narration.mockResolvedValue({ ...initial, narration: { ...initial.narration, takes: [...initial.narration.takes, take('take_x', 'Cena', { origin: 'generated', sceneId: 'hook-1' })] } });
  let resolveRequest;
  localApi.assembleNarration.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
  render(<NarrationStudio details={details(mode)} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Montar narração final' }));
  const starting = screen.getByRole('button', { name: 'Iniciando montagem…' });
  expect(starting).toBeDisabled(); expect(starting).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('Solicitando a montagem da narração…')).toBeInTheDocument();
  fireEvent.click(starting);
  expect(localApi.assembleNarration).toHaveBeenCalledTimes(1);
  const job = { id: 'assemble_one', label: 'Montar narração', kind: 'narration.assemble', state: 'running', progress: { phase: 'Montando e tratando', done: 0, total: 4 } };
  localApi.jobs.mockResolvedValue({ jobs: [job] });
  await act(async () => { resolveRequest(job); });
  const assembling = await screen.findByRole('button', { name: 'Montando narração…' });
  expect(assembling).toBeDisabled();
  expect(within(assembling.parentElement).getByRole('status')).toHaveTextContent('Montando e tratando');
  localApi.jobs.mockResolvedValue({ jobs: [{ ...job, state: 'completed' }] });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Montar narração final' })).toBeEnabled(), { timeout: 3000 });
});

test('falha ao iniciar a montagem mostra aviso junto ao botão e permite tentar novamente', async () => {
  localApi.assembleNarration.mockRejectedValue(new Error('Falha ao iniciar'));
  render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Montar narração final' }));
  expect(await screen.findByText('Não foi possível iniciar a montagem. Confira o aviso de erro e tente novamente.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Montar narração final' })).toBeEnabled();
});


test('narração final abre a pasta real, indica espera e permite tentar novamente após erro', async () => {
  localApi.narration.mockResolvedValue(state({ narration: { ...state().narration, assembled: { mediaId: 'media_voice', measures: measures(-16) } } }));
  let rejectOpen;
  localApi.revealNarration.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectOpen = reject; })).mockResolvedValue({ revealed: '/p/narration/assembled' });
  render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir pasta' }));
  expect(screen.getByRole('button', { name: 'Abrindo pasta…' })).toBeDisabled();
  expect(localApi.revealNarration).toHaveBeenCalledWith('/p');
  await act(async () => rejectOpen(new Error('Não foi possível abrir a pasta.')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir a pasta.');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pasta' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir pasta' })).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('conclusão da transcrição atualiza o projeto usado pela aprovação', async () => {
  const job = { id: 'transcription_one', kind: 'transcription', label: 'Transcrever', state: 'running', progress: { phase: 'Transcrevendo', done: 0, total: 100 } };
  localApi.jobs.mockResolvedValue({ jobs: [job] });
  const updated = { ...details('creator'), project: { ...details('creator').project, revision: 8 } };
  localApi.openProject.mockResolvedValue(updated);
  const onUpdated = vi.fn();
  render(<NarrationStudio details={details('creator')} setup={setup()} onUpdated={onUpdated}/>);
  await screen.findByText('Áudio final disponível. O Whisper está preparando os tempos de cada palavra em segundo plano.');
  expect(onUpdated).not.toHaveBeenCalled();
  localApi.jobs.mockResolvedValue({ jobs: [{ ...job, state: 'completed' }] });
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated), { timeout: 3500 });
  expect(localApi.openProject).toHaveBeenCalledWith('/p');
});

test('áudio final aparece durante a transcrição quando o projeto recebe a montagem', async () => {
  const job = { id: 'assembling', kind: 'narration.assemble', label: 'Montar', state: 'running', progress: { phase: 'Montando', done: 0, total: 4 } };
  localApi.jobs.mockResolvedValue({ jobs: [job] });
  const view = render(<NarrationStudio details={details('creator')} setup={setup()}/>);
  await screen.findByRole('button', { name: 'Montando narração…' });
  expect(screen.queryByRole('button', { name: 'Abrir pasta' })).not.toBeInTheDocument();
  localApi.narration.mockResolvedValue(state({ narration: { ...state().narration, assembled: { mediaId: 'media_voice', measures: measures(-16) } }, transcription: { status: 'running' } }));
  view.rerender(<NarrationStudio details={{ ...details('creator'), project: { ...details('creator').project, revision: 8 } }} setup={setup()}/>);
  expect(await screen.findByRole('button', { name: 'Abrir pasta' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Montando narração…' })).toBeDisabled();
  expect(screen.getByText('Áudio final disponível. O Whisper está preparando os tempos de cada palavra em segundo plano.')).toBeInTheDocument();
});

test('painel da edição permite retomar a transcrição sem reabrir a gravação aprovada', async () => {
  localApi.narration.mockResolvedValue(state({ narration: { ...state().narration, assembled: { mediaId: 'voice', measures: measures(-16) } }, transcription: { status: 'failed', error: 'O Whisper falhou.' } }));
  localApi.productionTranscribeNarration.mockResolvedValue({ jobId: 'retry' });
  render(<NarrationStudio timingOnly details={details('creator')} setup={setup()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar transcrição palavra por palavra' }));
  await waitFor(() => expect(localApi.productionTranscribeNarration).toHaveBeenCalledWith({ path: '/p' }));
  expect(screen.queryByRole('button', { name: 'Permitir microfone' })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: /eu gravo/i })).not.toBeInTheDocument();
});

test('narração aprovada permite abrir a pasta e retomar os tempos, preservando os takes', async () => {
  localApi.narration.mockResolvedValue(state({ narration: { ...state().narration, assembled: { mediaId: 'voice', measures: measures(-16) } }, transcription: { status: 'failed', error: 'O Whisper falhou.' } }));
  localApi.revealNarration.mockResolvedValue({ revealed: '/p/narration/assembled' });
  render(<NarrationStudio readOnly details={details('creator')} setup={setup()}/>);
  expect(await screen.findByRole('button', { name: 'Abrir pasta' })).toBeEnabled();
  expect(screen.getAllByRole('button', { name: 'Editar' })[0]).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Gerar transcrição palavra por palavra' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pasta' }));
  await waitFor(() => expect(localApi.revealNarration).toHaveBeenCalledWith('/p'));
});
