import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { VoiceScreen } from './VoiceScreen.jsx';
import { localApi } from './local-api.js';
import { VOICE_SAMPLE_TEXT } from '../audio/narration-service.js';

vi.mock('./local-api.js', () => ({ localApi: { getSettings: vi.fn(), updateSettings: vi.fn(), setupStatus: vi.fn(), voicePlan: vi.fn(), systemApps: vi.fn(), closeApp: vi.fn(), voiceStudio: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), uploadVoiceSample: vi.fn(), discardVoiceSample: vi.fn(), createVoiceProfile: vi.fn(), generateVoiceCheck: vi.fn(), voiceProfileReport: vi.fn(), deleteVoiceProfile: vi.fn() } }));

const setup = (voice = true) => ({ items: [{ id: 'ffmpeg', label: 'FFmpeg', ready: true }, { id: 'ffprobe', label: 'FFprobe', ready: true }, { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', ready: voice }] });
const profile = (extra = {}) => ({ id: 'voice_abc123', name: 'Minha voz', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, durationSeconds: 57.6, checkSample: null, ...extra });
const studio = (profiles = []) => ({ profiles, sampleText: VOICE_SAMPLE_TEXT, sampleLimitSeconds: 58, checkPhrase: 'Testando a minha voz clonada no Content Lab.' });

beforeEach(() => { vi.resetAllMocks(); localApi.voicePlan.mockResolvedValue({ plan: { status: 'ready' } }); localApi.systemApps.mockResolvedValue({ apps: [] }); localApi.voiceStudio.mockResolvedValue(studio()); localApi.jobs.mockResolvedValue({ jobs: [] }); });

test('sem perfil, explica que a voz de IA fica bloqueada nos projetos', async () => {
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  expect(await screen.findByText(/nenhuma voz gravada ainda/i)).toBeInTheDocument();
  expect(screen.getByText(/só aceitam narração gravada por você/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /gravar a primeira voz/i })).toBeEnabled();
});

test('sem VoxCPM2 a gravação fica indisponível e leva às dependências', async () => {
  const onOpenSetup = vi.fn();
  render(<VoiceScreen setup={setup(false)} onOpenSetup={onOpenSetup} onBack={vi.fn()}/>);
  expect(await screen.findByRole('button', { name: /gravar nova voz/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /instalar dependências/i }));
  expect(onOpenSetup).toHaveBeenCalledWith(['voxcpm2']);
});

test('gravação guiada mostra o texto de ~60 s, para sozinha e cria o perfil com o texto lido', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  class FakeRecorder { static isTypeSupported(type) { return type.startsWith('audio/webm'); } constructor() { this.mimeType = 'audio/webm'; this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['x'], { type: 'audio/webm' }) }); this.onstop(); } }
  globalThis.MediaRecorder = FakeRecorder; URL.createObjectURL = vi.fn(() => 'blob:amostra'); URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  localApi.uploadVoiceSample.mockResolvedValue({ sampleId: '11111111-2222-3333-4444-555555555555', measures: { durationSeconds: 57.6 } });
  localApi.createVoiceProfile.mockResolvedValue({ profile: { id: 'voice_abc123', name: 'Minha voz' } });

  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /gravar a primeira voz/i }));
  const dialog = screen.getByRole('dialog', { name: /gravar minha voz/i });
  expect(within(dialog).getByLabelText('Texto para ler')).toHaveTextContent(VOICE_SAMPLE_TEXT.slice(0, 40));
  expect(VOICE_SAMPLE_TEXT.split(/\s+/).length).toBeGreaterThanOrEqual(135);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: /começar a gravar/i }));
  await waitFor(() => expect(within(dialog).getByRole('timer')).toBeInTheDocument());
  await vi.advanceTimersByTimeAsync(60_000);
  await waitFor(() => expect(localApi.uploadVoiceSample).toHaveBeenCalledWith(expect.objectContaining({ name: 'amostra-de-voz.webm' })));
  expect(await within(dialog).findByText(/^0:57/)).toBeInTheDocument();

  fireEvent.change(within(dialog).getByLabelText('Titular da voz'), { target: { value: 'Daniel' } });
  const create = within(dialog).getByRole('button', { name: 'Criar perfil' });
  expect(create).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  fireEvent.click(create);
  await waitFor(() => expect(localApi.createVoiceProfile).toHaveBeenCalledWith({ sampleId: '11111111-2222-3333-4444-555555555555', name: 'Minha voz', holder: 'Daniel', referenceText: VOICE_SAMPLE_TEXT, consent: true }));
  expect(await screen.findByText(/perfil “minha voz” criado/i)).toBeInTheDocument();
  vi.useRealTimers();
});

test('“ouvir como ficou” gera a amostra da voz clonada e mostra o áudio depois', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  localApi.generateVoiceCheck.mockResolvedValue({ id: 'job_1', kind: 'voice.check', label: 'Amostra de “Minha voz” · cerca de 3 min', state: 'running', progress: { phase: 'Gerando a frase de conferência', done: 0, total: 1 } });
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /ouvir como ficou/i }));
  await waitFor(() => expect(localApi.generateVoiceCheck).toHaveBeenCalledWith('voice_abc123'));
  expect(await screen.findByText(/ainda sem amostra da voz clonada/i)).toBeInTheDocument();

  localApi.voiceStudio.mockResolvedValue(studio([profile({ checkSample: { phrase: 'Testando.', generatedAt: '2026-11-13T10:00:00Z', durationSeconds: 6.2 } })]));
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  expect(await screen.findByLabelText('Ouvir a voz clonada de Minha voz')).toBeInTheDocument();
});

test('excluir perfil mostra o que será apagado antes de confirmar', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  localApi.voiceProfileReport.mockResolvedValue({ profile: { id: 'voice_abc123', name: 'Minha voz' }, takes: 2, projects: [{ path: '/p', title: 'Projeto A', takes: [{}, {}], assembled: true }] });
  localApi.deleteVoiceProfile.mockResolvedValue({ deleted: true, failures: [] });
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /excluir perfil minha voz/i }));
  const dialog = await screen.findByRole('alertdialog', { name: /excluir perfil de voz/i });
  expect(within(dialog).getByText(/2 take\(s\) gerado\(s\) em 1 projeto/)).toBeInTheDocument();
  expect(within(dialog).getByText('Projeto A: 2 take(s) + montagem')).toBeInTheDocument();
  expect(localApi.deleteVoiceProfile).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: /excluir perfil e áudios/i }));
  await waitFor(() => expect(localApi.deleteVoiceProfile).toHaveBeenCalledWith('voice_abc123'));
});

test('inventário: tela de voz sem controles anônimos', async () => {
  const { auditControls } = await import('./a11y-audit.js');
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  const { container } = render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()} onBack={vi.fn()}/>);
  expect(await screen.findByLabelText('Ouvir a amostra gravada de Minha voz')).toBeInTheDocument();
  expect(auditControls(container)).toEqual([]);
});

const lowMemory = () => ({ status: 'needs-free-memory', requiredBytes: 11.5 * 1024 ** 3, availableBytes: 9 * 1024 ** 3 });

test.each([false, true])('sem RAM, conferir voz mostra o painel e permite liberar memória e tentar de novo (amostra existente: %s)', async existing => {
  localApi.voiceStudio.mockResolvedValue(studio([profile(existing ? { checkSample: { generatedAt: '2026-11-13', durationSeconds: 6 } } : {})]));
  localApi.voicePlan.mockResolvedValue({ plan: lowMemory() });
  localApi.systemApps.mockResolvedValue({ apps: [{ name: 'Editor', bytes: 3 * 1024 ** 3, processes: 2, kind: 'app' }] });
  localApi.closeApp.mockResolvedValue({ closed: true, freedBytes: 3 * 1024 ** 3 });
  localApi.generateVoiceCheck.mockResolvedValue({ id: 'job_retry', kind: 'voice.check', state: 'completed' });
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()}/>);
  const button = await screen.findByRole('button', { name: existing ? /gerar de novo/i : /ouvir como ficou/i });
  fireEvent.click(button);
  const panel = await screen.findByRole('region', { name: /libere 2,5 gb/i });
  expect(localApi.generateVoiceCheck).not.toHaveBeenCalled();
  fireEvent.click(await within(panel).findByRole('button', { name: 'Fechar Editor' }));
  const dialog = await screen.findByRole('alertdialog', { name: /fechar editor/i });
  expect(localApi.closeApp).not.toHaveBeenCalled();
  localApi.voicePlan.mockResolvedValue({ plan: { status: 'ready' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar Editor' }));
  await waitFor(() => expect(localApi.closeApp).toHaveBeenCalledWith({ name: 'Editor', force: false }));
  await waitFor(() => expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument());
  expect(localApi.generateVoiceCheck).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(localApi.generateVoiceCheck).toHaveBeenCalledWith('voice_abc123'));
});

test('falha ao verificar recursos impede a geração', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  localApi.voicePlan.mockRejectedValue(new Error('Não foi possível verificar a memória.'));
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /ouvir como ficou/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar a memória.');
  expect(localApi.generateVoiceCheck).not.toHaveBeenCalled();
});

test('falha de memória durante a geração da conferência também mostra o painel', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  const job = { id: 'job_failed', kind: 'voice.check', label: 'Amostra', state: 'failed', code: 'MEMORY_LIMIT', error: 'Falta memória', progress: { phase: 'Falhou' } };
  localApi.generateVoiceCheck.mockResolvedValue(job);
  localApi.jobs.mockResolvedValue({ jobs: [job] });
  localApi.voicePlan.mockResolvedValueOnce({ plan: { status: 'ready' } }).mockResolvedValue({ plan: lowMemory() });
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()}/>);
  expect(screen.queryByRole('region', { name: /memória/i })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: /ouvir como ficou/i }));
  expect(await screen.findByRole('region', { name: /atingiu o limite de memória/i })).toBeInTheDocument();
});

test('ao tentar de novo o painel some durante a conferência e só volta se faltar RAM', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  localApi.voicePlan.mockResolvedValue({ plan: lowMemory() });
  localApi.generateVoiceCheck.mockResolvedValue({ id: 'retry', kind: 'voice.check', state: 'completed', progress: {} });
  render(<VoiceScreen setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /ouvir como ficou/i }));
  const panel = await screen.findByRole('region', { name: /libere/i });
  let resolvePlan;
  localApi.voicePlan.mockImplementationOnce(() => new Promise(resolve => { resolvePlan = resolve; }));
  fireEvent.click(within(panel).getByRole('button', { name: /tentar de novo/i }));
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
  resolvePlan({ plan: lowMemory() });
  const again = await screen.findByRole('region', { name: /libere/i });
  expect(localApi.generateVoiceCheck).not.toHaveBeenCalled();
  localApi.voicePlan.mockResolvedValue({ plan: { status: 'ready' } });
  fireEvent.click(within(again).getByRole('button', { name: /tentar de novo/i }));
  await waitFor(() => expect(localApi.generateVoiceCheck).toHaveBeenCalledWith('voice_abc123'));
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
});

test('falta de memória oferece modo econômico, salva a escolha e leva à instalação se necessário', async () => {
  localApi.voiceStudio.mockResolvedValue(studio([profile()]));
  localApi.voicePlan.mockResolvedValue({ plan: { ...lowMemory(), mode: 'standard' } });
  localApi.getSettings.mockResolvedValue({ revision: 4 });
  localApi.updateSettings.mockResolvedValue({ voice: { mode: 'economy' } });
  localApi.setupStatus.mockResolvedValue({ items: [{ id: 'voxcpm2-q8', ready: false }] });
  const onOpenSetup = vi.fn();
  render(<VoiceScreen setup={setup()} onOpenSetup={onOpenSetup}/>);
  fireEvent.click(await screen.findByRole('button', { name: /ouvir como ficou/i }));
  fireEvent.click(await screen.findByRole('button', { name: /trocar para modo econômico/i }));
  await waitFor(() => expect(localApi.updateSettings).toHaveBeenCalledWith({ baseRevision: 4, voice: { mode: 'economy' } }));
  expect(await screen.findByText(/instale o modo econômico/i)).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /libere/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /instalar dependências/i }));
  expect(onOpenSetup).toHaveBeenCalledWith(['voxcpm2-q8']);
  expect(localApi.generateVoiceCheck).not.toHaveBeenCalled();
});
