import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { VoiceScreen } from './VoiceScreen.jsx';
import { localApi } from './local-api.js';
import { VOICE_SAMPLE_TEXT } from '../audio/narration-service.js';

vi.mock('./local-api.js', () => ({ localApi: { voiceStudio: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), uploadVoiceSample: vi.fn(), discardVoiceSample: vi.fn(), createVoiceProfile: vi.fn(), generateVoiceCheck: vi.fn(), voiceProfileReport: vi.fn(), deleteVoiceProfile: vi.fn() } }));

const setup = (voice = true) => ({ items: [{ id: 'ffmpeg', label: 'FFmpeg', ready: true }, { id: 'ffprobe', label: 'FFprobe', ready: true }, { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', ready: voice }] });
const profile = (extra = {}) => ({ id: 'voice_abc123', name: 'Minha voz', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, durationSeconds: 57.6, checkSample: null, ...extra });
const studio = (profiles = []) => ({ profiles, sampleText: VOICE_SAMPLE_TEXT, sampleLimitSeconds: 58, checkPhrase: 'Testando a minha voz clonada no Content Lab.' });

beforeEach(() => { vi.clearAllMocks(); localApi.voiceStudio.mockResolvedValue(studio()); localApi.jobs.mockResolvedValue({ jobs: [] }); });

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
