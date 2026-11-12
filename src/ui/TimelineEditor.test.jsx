import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { TimelineEditor } from './TimelineEditor.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { editState: vi.fn(), editApply: vi.fn(), editUndo: vi.fn(), editRedo: vi.fn(), editAddMedia: vi.fn(), editAddComponent: vi.fn(), editCaptions: vi.fn(), editAspect: vi.fn(), editFrame: vi.fn(), editClip: vi.fn(), jobs: vi.fn() } }));

const clip = (id, extra) => ({ id, type: 'media', sourceId: 'media_a', name: id, startFrame: 0, durationInFrames: 60, fit: 'cover', anchor: 'center', keyframes: {}, effects: [], sourceInFrame: 0, volume: 1, style: 'legenda', ...extra });
function details(overrides = {}) {
  const project = { id: 'p', title: 'P', revision: 7, aspectRatio: '16:9', stages: [], media: [{ id: 'media_a', kind: 'video', name: 'cena.mp4', metadata: { durationSeconds: 10, audioCodec: 'aac' } }, { id: 'media_b', kind: 'audio', name: 'voz.wav', transcript: { status: 'raw' }, metadata: { durationSeconds: 8 } }], timeline: { fps: 30, durationInFrames: 300, aspectRatio: '16:9', safeArea: { top: .05, right: .05, bottom: .08, left: .05 }, tracks: [
    { id: 'visual_main', kind: 'visual', name: 'Principal', muted: false, locked: false, clips: [clip('clip_a'), clip('clip_b', { startFrame: 90 })] },
    { id: 'audio_main', kind: 'audio', name: 'Áudio', muted: false, locked: false, clips: [] },
    { id: 'captions_main', kind: 'caption', name: 'Legendas', muted: false, locked: false, clips: [] },
  ] }, ...overrides };
  return { project, path: '/p', history: [], edit: { canUndo: true, canRedo: false, undoLabel: 'Mover', redoLabel: null } };
}

beforeEach(() => { vi.clearAllMocks(); localApi.editState.mockResolvedValue(details()); localApi.editFrame.mockResolvedValue({ name: 'p-0123456789abcdef-0-16x9.png' }); localApi.editApply.mockResolvedValue(details()); localApi.editUndo.mockResolvedValue(details()); });

test('preview pede frame pelo mesmo plano e mostra área segura', async () => {
  render(<TimelineEditor details={details()} onUpdated={vi.fn()}/>);
  expect(await screen.findByRole('img', { name: /frame 0 em 16:9/i })).toHaveAttribute('src', '/api/v1/edit/preview?name=p-0123456789abcdef-0-16x9.png');
  expect(localApi.editFrame).toHaveBeenCalledWith({ path: '/p', frame: 0, aspectRatio: '16:9' });
  fireEvent.change(screen.getByLabelText('Proporção'), { target: { value: '9:16' } });
  await waitFor(() => expect(localApi.editFrame).toHaveBeenLastCalledWith({ path: '/p', frame: 0, aspectRatio: '9:16' }));
  expect(localApi.editAspect).not.toHaveBeenCalled();
});

test('dividir, excluir com ripple e desfazer usam comandos versionados com a revisão atual', async () => {
  const onUpdated = vi.fn();
  render(<TimelineEditor details={details()} onUpdated={onUpdated}/>);
  fireEvent.click(screen.getByRole('button', { name: /clip_a, 0:00/i }));
  fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
  fireEvent.click(screen.getByRole('button', { name: /dividir/i }));
  await waitFor(() => expect(localApi.editApply).toHaveBeenCalledWith(expect.objectContaining({ baseRevision: 7, commands: [expect.objectContaining({ op: 'clip.split', clipId: 'clip_a', frame: 30 })] })));
  fireEvent.click(screen.getByLabelText('Ripple'));
  fireEvent.keyDown(window, { key: 'Delete' });
  await waitFor(() => expect(localApi.editApply).toHaveBeenLastCalledWith(expect.objectContaining({ commands: [{ op: 'clip.remove', trackId: 'visual_main', clipId: 'clip_a', ripple: true }] })));
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  await waitFor(() => expect(localApi.editUndo).toHaveBeenCalledWith({ path: '/p', baseRevision: 7 }));
  expect(onUpdated).toHaveBeenCalled();
});

test('propriedades aplicam enquadramento por proporção, fades e corte de entrada', async () => {
  render(<TimelineEditor details={details()} onUpdated={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: /clip_b, 0:03/i }));
  const panel = screen.getByRole('complementary');
  fireEvent.change(within(panel).getByLabelText('Entrada na mídia (s)'), { target: { value: '2' } });
  fireEvent.change(within(panel).getByLabelText('Enquadramento'), { target: { value: 'contain' } });
  fireEvent.click(within(panel).getByLabelText(/posição própria em 16:9/i));
  fireEvent.change(within(panel).getByLabelText('Largura %'), { target: { value: '50' } });
  fireEvent.change(within(panel).getByLabelText('Fade in (s)'), { target: { value: '0.5' } });
  fireEvent.click(within(panel).getByRole('button', { name: 'Aplicar' }));
  await waitFor(() => expect(localApi.editApply).toHaveBeenCalled());
  const [trim, update] = localApi.editApply.mock.calls[0][0].commands;
  expect(trim).toMatchObject({ op: 'clip.trim', clipId: 'clip_b', startFrame: 90, durationInFrames: 60, sourceInFrame: 60 });
  expect(update.patch).toMatchObject({ fit: 'contain', layout: { '16:9': { x: 0, y: 0, width: 0.5, height: 1 } }, effects: [{ type: 'fade-in', params: { seconds: 0.5 } }] });
});

test('trocar proporção do projeto mostra o relatório antes de confirmar', async () => {
  localApi.editAspect.mockRejectedValueOnce(Object.assign(new Error('Confirme'), { code: 'CONFIRMATION_REQUIRED', details: { from: '16:9', to: '9:16', clipsWithoutLayout: ['clip_a', 'clip_b'], reopens: ['edit'] } })).mockResolvedValueOnce(details());
  render(<TimelineEditor details={details()} onUpdated={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Proporção'), { target: { value: '9:16' } });
  fireEvent.click(screen.getByRole('button', { name: /usar 9:16 no projeto/i }));
  const dialog = await screen.findByRole('alertdialog', { name: /trocar proporção/i });
  expect(within(dialog).getByText(/2 clip\(s\) sem enquadramento próprio/)).toBeInTheDocument();
  expect(within(dialog).getByText(/edição aprovada será reaberta/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Usar 9:16' }));
  await waitFor(() => expect(localApi.editAspect).toHaveBeenLastCalledWith({ path: '/p', baseRevision: 7, aspectRatio: '9:16', confirm: true }));
});

test('track bloqueada não aceita arrastar e silenciar usa comando de track', async () => {
  const locked = details(); locked.project.timeline.tracks[0].locked = true;
  render(<TimelineEditor details={locked} onUpdated={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Silenciar Áudio' }));
  await waitFor(() => expect(localApi.editApply).toHaveBeenCalledWith(expect.objectContaining({ commands: [{ op: 'track.update', trackId: 'audio_main', muted: true }] })));
  const item = screen.getByRole('button', { name: /clip_a, 0:00/i });
  fireEvent.pointerDown(item, { clientX: 10 });
  expect(item.querySelector('.trim-handle')).toBeNull();
});

test('importa SRT do computador e adiciona componente configurado no playhead', async () => {
  const component = { id: 'kinetic_emphasis', label: 'Ênfase cinética', propsSchema: { text: { type: 'string', label: 'Texto do componente', default: 'Texto em destaque' }, color: { type: 'color', label: 'Cor do componente', default: '#d8ff48' } } };
  localApi.editState.mockResolvedValue({ ...details(), components: [component] });
  localApi.editCaptions.mockResolvedValue(details()); localApi.editAddComponent.mockResolvedValue(details());
  render(<TimelineEditor details={{ ...details(), components: [component] }} onUpdated={vi.fn()}/>);
  const file = new File(['1\n00:00:00,000 --> 00:00:01,000\nOi\n'], 'legendas.srt', { type: 'application/x-subrip' });
  Object.defineProperty(file, 'text', { value: async () => '1\n00:00:00,000 --> 00:00:01,000\nOi\n' });
  fireEvent.change(screen.getByLabelText('Importar arquivo SRT'), { target: { files: [file] } });
  await waitFor(() => expect(localApi.editCaptions).toHaveBeenCalledWith(expect.objectContaining({ srtName: 'legendas.srt', srtText: expect.stringContaining('Oi'), style: 'legenda' })));
  fireEvent.change(screen.getByLabelText('Componente'), { target: { value: 'kinetic_emphasis' } });
  fireEvent.change(screen.getByLabelText('Texto do componente'), { target: { value: 'Título real' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar componente' }));
  await waitFor(() => expect(localApi.editAddComponent).toHaveBeenCalledWith(expect.objectContaining({ componentId: 'kinetic_emphasis', componentProps: { text: 'Título real', color: '#d8ff48' } })));
});

test('inventário: editor sem controles anônimos e clip operável só pelo teclado', async () => {
  const { auditControls } = await import('./a11y-audit.js');
  const { container } = render(<TimelineEditor details={details()} onUpdated={vi.fn()}/>);
  await screen.findByRole('img', { name: /frame 0/i });
  expect(auditControls(container)).toEqual([]);
  const item = screen.getByRole('button', { name: /clip_b, 0:03/i }); item.focus(); fireEvent.keyDown(item, { key: 'Enter' }); fireEvent.click(item);
  expect(auditControls(container)).toEqual([]);
  fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
  await waitFor(() => expect(localApi.editApply).toHaveBeenCalledWith(expect.objectContaining({ commands: [expect.objectContaining({ op: 'clip.move', clipId: 'clip_b' })] })));
});
