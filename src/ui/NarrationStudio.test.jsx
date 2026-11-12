import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { NarrationStudio } from './NarrationStudio.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { narration: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), chooseMedia: vi.fn(), narrationImport: vi.fn(), updateTake: vi.fn(), reorderTakes: vi.fn(), deleteTake: vi.fn(), narrationPreview: vi.fn(), assembleNarration: vi.fn(), createVoiceProfile: vi.fn(), voiceProfileReport: vi.fn(), deleteVoiceProfile: vi.fn(), generateVoice: vi.fn(), voicePlan: vi.fn(), uploadTake: vi.fn() } }));

const setup = (voice = true) => ({ items: [{ id: 'ffmpeg', label: 'FFmpeg', ready: true }, { id: 'ffprobe', label: 'FFprobe', ready: true }, { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', ready: voice }] });
const measures = (lufs) => ({ durationSeconds: 20, integratedLufs: lufs, truePeakDb: -1.5, sampleRate: 48000, channels: 1, wav48kMono: true });
const take = (id, name, extra = {}) => ({ id, name, origin: 'recording', durationSeconds: 12.5, trim: null, file: `takes/${id}/take.wav`, ...extra });
function state(overrides = {}) {
  return {
    narration: { revision: 3, takes: [take('take_aaaaaa1', 'Abertura'), take('take_bbbbbb2', 'Corpo', { origin: 'import' })], treatment: { trimSilence: true, denoise: true, highpass: true, compress: true, normalize: true, targetLufs: -16, preset: 'original' }, assembled: null },
    scenes: [{ id: 'hook-1', label: 'Abertura 1', text: 'Você já reparou nisso?', generated: { voice_abc123: 'take_x' } }, { id: 'development-1', label: 'Desenvolvimento 1', text: 'Primeiro ponto.', generated: { voice_abc123: null } }],
    profiles: [{ id: 'voice_abc123', name: 'Minha voz', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, durationSeconds: 15 }],
    presets: [{ id: 'original', label: 'Original' }, { id: 'warm', label: 'Quente' }], previewSeconds: 20, ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); localApi.narration.mockResolvedValue(state()); localApi.jobs.mockResolvedValue({ jobs: [] }); });

test('voz clonada bloqueada sem VoxCPM2 leva às dependências; takes continuam disponíveis', async () => {
  const onOpenSetup = vi.fn();
  render(<NarrationStudio projectPath="/p" setup={setup(false)} onOpenSetup={onOpenSetup}/>);
  expect(await screen.findByText('Abertura')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('region', { name: /sua voz/i })).getByRole('button', { name: /instalar dependências/i }));
  expect(onOpenSetup).toHaveBeenCalledWith(['voxcpm2']);
  expect(screen.queryByRole('button', { name: /gravar minha voz/i })).not.toBeInTheDocument();
});

test('microfone só é pedido depois do clique explícito', async () => {
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  globalThis.MediaRecorder = class { static isTypeSupported() { return true; } };
  render(<NarrationStudio projectPath="/p" setup={setup()} onOpenSetup={vi.fn()}/>);
  await screen.findByText('Abertura');
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /permitir microfone/i }));
  expect(await screen.findByRole('button', { name: /^gravar$/i })).toBeInTheDocument();
  expect(getUserMedia).toHaveBeenCalledTimes(1);
});

test('reordena, corta sem destruir e mostra preview A/B medido', async () => {
  localApi.reorderTakes.mockResolvedValue({ narration: state().narration });
  localApi.updateTake.mockResolvedValue({ narration: state().narration });
  localApi.narrationPreview.mockResolvedValue({ original: { file: 'aaaaaaaaaaaaaaaaaaaaaaaa-original.wav', measures: measures(-28) }, treated: { file: 'aaaaaaaaaaaaaaaaaaaaaaaa-tratado.wav', measures: measures(-16) } });
  render(<NarrationStudio projectPath="/p" setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Descer Abertura' }));
  await waitFor(() => expect(localApi.reorderTakes).toHaveBeenCalledWith({ path: '/p', baseRevision: 3, order: ['take_bbbbbb2', 'take_aaaaaa1'] }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  fireEvent.change(screen.getByLabelText('Início (s)'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Fim (s)'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(localApi.updateTake).toHaveBeenCalledWith(expect.objectContaining({ takeId: 'take_aaaaaa1', trim: { start: 1, end: 4 } })));
  fireEvent.change(screen.getByLabelText('Timbre'), { target: { value: 'warm' } });
  fireEvent.click(screen.getByRole('button', { name: /ouvir preview/i }));
  expect(await screen.findByText(/-16\.0 LUFS/)).toBeInTheDocument();
  expect(screen.getByText(/-28\.0 LUFS/)).toBeInTheDocument();
  expect(localApi.narrationPreview).toHaveBeenCalledWith(expect.objectContaining({ treatment: expect.objectContaining({ preset: 'warm' }) }));
});

test('perfil exige consentimento marcado; geração pede só cenas pendentes', async () => {
  localApi.createVoiceProfile.mockResolvedValue({ profile: {} });
  localApi.generateVoice.mockResolvedValue({ id: 'job_1', kind: 'voice.generate', label: 'Gerar voz: 1 cena', state: 'running', progress: { phase: 'Abertura', done: 0, total: 1 } });
  render(<NarrationStudio projectPath="/p" setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /usar take existente/i }));
  const dialog = screen.getByRole('form', { name: /novo perfil de voz/i });
  fireEvent.change(within(dialog).getByLabelText('Titular da voz'), { target: { value: 'Daniel' } });
  fireEvent.change(within(dialog).getByLabelText(/texto lido/i), { target: { value: 'Olá.' } });
  expect(within(dialog).getByRole('button', { name: /criar perfil/i })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: /criar perfil/i }));
  await waitFor(() => expect(localApi.createVoiceProfile).toHaveBeenCalledWith(expect.objectContaining({ path: '/p', holder: 'Daniel', referenceText: 'Olá.', consent: true, takeId: 'take_bbbbbb2' })));
  fireEvent.click(screen.getByRole('button', { name: /gerar 1 cena pendente/i }));
  await waitFor(() => expect(localApi.generateVoice).toHaveBeenCalledWith({ path: '/p', profileId: 'voice_abc123', sceneIds: ['development-1'] }));
});

test('excluir perfil mostra o que será apagado antes de confirmar', async () => {
  localApi.voiceProfileReport.mockResolvedValue({ profile: { id: 'voice_abc123', name: 'Minha voz' }, takes: 2, projects: [{ path: '/p', title: 'Projeto A', takes: [{}, {}], assembled: true }] });
  localApi.deleteVoiceProfile.mockResolvedValue({ deleted: true, failures: [] });
  render(<NarrationStudio projectPath="/p" setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /excluir perfil minha voz/i }));
  const dialog = await screen.findByRole('alertdialog', { name: /excluir perfil de voz/i });
  expect(within(dialog).getByText(/2 take\(s\) gerado\(s\) em 1 projeto/)).toBeInTheDocument();
  expect(within(dialog).getByText('Projeto A: 2 take(s) + montagem')).toBeInTheDocument();
  expect(localApi.deleteVoiceProfile).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: /excluir perfil e áudios/i }));
  await waitFor(() => expect(localApi.deleteVoiceProfile).toHaveBeenCalledWith('voice_abc123'));
});

test('inventário: estúdio de narração sem controles anônimos', async () => {
  const { auditControls } = await import('./a11y-audit.js');
  const { container } = render(<NarrationStudio projectPath="/p" setup={setup(true)} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByText('Abertura')).toBeInTheDocument();
  expect(auditControls(container)).toEqual([]);
});

test('gravação guiada mostra texto de ~60 s, para sozinha e cria perfil com o texto lido', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { VOICE_SAMPLE_TEXT } = await import('./NarrationStudio.jsx');
  class FakeRecorder { static isTypeSupported(type) { return type.startsWith('audio/webm'); } constructor() { this.mimeType = 'audio/webm'; this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['x'], { type: 'audio/webm' }) }); this.onstop(); } }
  globalThis.MediaRecorder = FakeRecorder; URL.createObjectURL = vi.fn(() => 'blob:amostra'); URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) } });
  localApi.uploadTake.mockResolvedValue({ take: { id: 'take_amostra', durationSeconds: 57.6 } });
  localApi.createVoiceProfile.mockResolvedValue({ profile: {} });
  render(<NarrationStudio projectPath="/p" setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /gravar minha voz/i }));
  const dialog = screen.getByRole('dialog', { name: /gravar minha voz/i });
  expect(within(dialog).getByLabelText('Texto para ler')).toHaveTextContent(VOICE_SAMPLE_TEXT.slice(0, 40));
  expect(VOICE_SAMPLE_TEXT.split(/\s+/).length).toBeGreaterThanOrEqual(135);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: /começar a gravar/i }));
  await waitFor(() => expect(within(dialog).getByRole('timer')).toBeInTheDocument());
  await vi.advanceTimersByTimeAsync(60_000);
  await waitFor(() => expect(localApi.uploadTake).toHaveBeenCalledWith(expect.objectContaining({ path: '/p', name: 'amostra-de-voz.webm' })));
  expect(await within(dialog).findByText(/^0:57/)).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Titular da voz'), { target: { value: 'Daniel' } });
  const create = within(dialog).getByRole('button', { name: 'Criar perfil' }); expect(create).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(create);
  await waitFor(() => expect(localApi.createVoiceProfile).toHaveBeenCalledWith({ path: '/p', takeId: 'take_amostra', name: 'Minha voz', holder: 'Daniel', referenceText: VOICE_SAMPLE_TEXT, consent: true }));
  vi.useRealTimers();
});
