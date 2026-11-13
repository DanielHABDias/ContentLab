import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { NarrationStudio } from './NarrationStudio.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { narration: vi.fn(), jobs: vi.fn(), cancelJob: vi.fn(), chooseMedia: vi.fn(), narrationImport: vi.fn(), updateTake: vi.fn(), reorderTakes: vi.fn(), deleteTake: vi.fn(), narrationPreview: vi.fn(), assembleNarration: vi.fn(), generateVoice: vi.fn(), voicePlan: vi.fn(), uploadTake: vi.fn(), runProjectAction: vi.fn() } }));

const setup = (voice = true) => ({ items: [{ id: 'ffmpeg', label: 'FFmpeg', ready: true }, { id: 'ffprobe', label: 'FFprobe', ready: true }, { id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', ready: voice }] });
const measures = (lufs) => ({ durationSeconds: 20, integratedLufs: lufs, truePeakDb: -1.5, sampleRate: 48000, channels: 1, wav48kMono: true });
const take = (id, name, extra = {}) => ({ id, name, origin: 'recording', durationSeconds: 12.5, trim: null, file: `takes/${id}/take.wav`, ...extra });
const details = (narrationBy = 'ai') => ({ path: '/p', project: { id: 'projeto', title: 'Projeto', revision: 7, narrationBy } });
function state(overrides = {}) {
  return {
    narration: { revision: 3, takes: [take('take_aaaaaa1', 'Abertura'), take('take_bbbbbb2', 'Corpo', { origin: 'import' })], treatment: { trimSilence: true, denoise: true, highpass: true, compress: true, normalize: true, targetLufs: -16, preset: 'original' }, assembled: null },
    scenes: [{ id: 'hook-1', label: 'Abertura 1', text: 'Você já reparou nisso?', generated: { voice_abc123: 'take_x' } }, { id: 'development-1', label: 'Desenvolvimento 1', text: 'Primeiro ponto.', generated: { voice_abc123: null } }],
    profiles: [{ id: 'voice_abc123', name: 'Minha voz', consent: { granted: true, holder: 'Daniel', grantedAt: '2026-11-11T00:00:00Z' }, durationSeconds: 15, checkSample: null }],
    presets: [{ id: 'original', label: 'Original' }, { id: 'warm', label: 'Quente' }], previewSeconds: 20, ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); localApi.narration.mockResolvedValue(state()); localApi.jobs.mockResolvedValue({ jobs: [] }); });

test('voz clonada bloqueada sem VoxCPM2 leva às dependências; takes continuam disponíveis', async () => {
  const onOpenSetup = vi.fn();
  render(<NarrationStudio details={details()} setup={setup(false)} onOpenSetup={onOpenSetup}/>);
  expect(await screen.findByText('Abertura')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('region', { name: /narração com a sua voz/i })).getByRole('button', { name: /instalar dependências/i }));
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
  expect(await screen.findByText('Abertura')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /narração com a sua voz/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /permitir microfone/i })).toBeInTheDocument();
});

test('microfone só é pedido depois do clique explícito', async () => {
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  globalThis.MediaRecorder = class { static isTypeSupported() { return true; } };
  render(<NarrationStudio details={details()} setup={setup()} onOpenSetup={vi.fn()}/>);
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
  render(<NarrationStudio details={details()} setup={setup()} onOpenSetup={vi.fn()}/>);
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

test('geração pede só as cenas pendentes do perfil escolhido', async () => {
  localApi.generateVoice.mockResolvedValue({ id: 'job_1', kind: 'voice.generate', label: 'Gerar voz: 1 cena', state: 'running', progress: { phase: 'Abertura', done: 0, total: 1 } });
  render(<NarrationStudio details={details()} setup={setup()} onOpenSetup={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /gerar 1 cena pendente/i }));
  await waitFor(() => expect(localApi.generateVoice).toHaveBeenCalledWith({ path: '/p', profileId: 'voice_abc123', sceneIds: ['development-1'] }));
});

test('inventário: estúdio de narração sem controles anônimos', async () => {
  const { auditControls } = await import('./a11y-audit.js');
  const { container } = render(<NarrationStudio details={details()} setup={setup(true)} onOpenSetup={vi.fn()}/>);
  expect(await screen.findByText('Abertura')).toBeInTheDocument();
  expect(auditControls(container)).toEqual([]);
});
