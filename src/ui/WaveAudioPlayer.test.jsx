import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WaveAudioPlayer } from './WaveAudioPlayer.jsx';
import { AudioTakeEditor } from './AudioTakeEditor.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ duration: 10, peaks: Array.from({ length: 4000 }, (_, i) => i % 2 ? 1 : 0.2) }) }));
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { this.dispatchEvent(new Event('play')); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { this.dispatchEvent(new Event('pause')); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const source = '/api/v1/narration/file?path=%2Fp&take=take_a';

test('player carrega ondas, controla volume/velocidade e pula partes excluídas na reprodução', async () => {
  const view = render(<WaveAudioPlayer src={source} label="Teste" duration={10} segments={[{ start: 0, end: 2 }, { start: 4, end: 8 }]}/>);
  await waitFor(() => expect(screen.queryByText('Carregando ondas…')).not.toBeInTheDocument());
  expect(fetch).toHaveBeenCalledWith(`${source}&waveform=1`, expect.any(Object));
  expect(view.container.querySelectorAll('svg rect').length).toBeGreaterThan(100);
  const audio = view.container.querySelector('audio');
  expect(audio).not.toHaveAttribute('controls');
  fireEvent.change(screen.getByRole('slider', { name: 'Posição: Teste' }), { target: { value: '3' } });
  expect(audio.currentTime).toBe(5);
  audio.currentTime = 2.1; fireEvent.timeUpdate(audio); expect(audio.currentTime).toBe(4);
  fireEvent.change(screen.getByLabelText('Volume: Teste'), { target: { value: '0.4' } });
  expect(audio.volume).toBe(0.4);
  fireEvent.change(screen.getByLabelText('Velocidade: Teste'), { target: { value: '1.5' } });
  expect(audio.playbackRate).toBe(1.5);
  fireEvent.click(screen.getByRole('button', { name: 'Reproduzir: Teste' }));
  expect(await screen.findByRole('button', { name: 'Pausar: Teste' })).toBeInTheDocument();
});

test('arrastar seleciona um erro; excluir fecha o intervalo, desfazer/refazer e salvar preservam tempos originais', async () => {
  const onSave = vi.fn();
  render(<AudioTakeEditor take={{ name: 'Minha gravação', durationSeconds: 10 }} src={source} onSave={onSave} onClose={vi.fn()}/>);
  const dialog = screen.getByRole('dialog', { name: 'Editar take' });
  const track = within(dialog).getByRole('group', { name: 'Onda do áudio: Ouvir edição do take' });
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 });
  fireEvent.pointerDown(track, { button: 0, clientX: 200, pointerId: 1 });
  fireEvent.pointerMove(track, { clientX: 400, pointerId: 1 });
  fireEvent.pointerUp(track, { clientX: 400, pointerId: 1 });
  expect(within(dialog).getByLabelText('Duração da seleção')).toHaveTextContent('2.00 s selecionados');
  expect(within(dialog).queryByLabelText('Início (s)')).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText('Fim (s)')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir seleção' }));
  expect(screen.getByText(/8.00 s após os cortes/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer corte' }));
  expect(screen.getByText(/10.00 s após os cortes/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refazer corte' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: 'Minha gravação', segments: [{ start: 0, end: 2 }, { start: 4, end: 10 }] }));
});

test('falha das ondas não bloqueia reprodução e oferece tentar carregar novamente', async () => {
  fetch.mockRejectedValueOnce(new Error('offline'));
  render(<WaveAudioPlayer src={source} label="Teste" duration={10}/>);
  expect(await screen.findByText(/Ondas indisponíveis/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reproduzir: Teste' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar ondas' }));
  await waitFor(() => expect(screen.queryByText(/Ondas indisponíveis/)).not.toBeInTheDocument());
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});

test('editor carrega ondas imediatamente mesmo sem receber evento de visibilidade', async () => {
  const observe = vi.fn();
  vi.stubGlobal('IntersectionObserver', class { observe = observe; disconnect() {} });
  render(<WaveAudioPlayer src={source} label="Editor" duration={10} onSelect={vi.fn()}/>);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(observe).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Carregando ondas…')).not.toBeInTheDocument());
});

test('roda do mouse navega horizontalmente pela onda sem mover o modal; zoom do navegador é preservado', () => {
  render(<WaveAudioPlayer src={source} label="Editor" duration={10} zoom={4} onSelect={vi.fn()}/>);
  const viewport = screen.getByRole('region', { name: 'Navegação horizontal da onda' });
  Object.defineProperty(viewport, 'clientWidth', { value: 200 });
  Object.defineProperty(viewport, 'scrollWidth', { value: 800 });
  const wheel = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
  viewport.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true); expect(viewport.scrollLeft).toBe(80);
  viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -2, deltaMode: 1, bubbles: true, cancelable: true }));
  expect(viewport.scrollLeft).toBe(40);
  const zoom = new WheelEvent('wheel', { deltaY: 80, ctrlKey: true, bubbles: true, cancelable: true });
  viewport.dispatchEvent(zoom);
  expect(zoom.defaultPrevented).toBe(false); expect(viewport.scrollLeft).toBe(40);
});

test('servidor antigo que devolve WAV em vez de ondas mostra como corrigir', async () => {
  fetch.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'audio/wav' }) });
  render(<WaveAudioPlayer src={source} label="Teste" duration={10}/>);
  expect(await screen.findByText(/Reinicie o Content Lab para carregar a atualização das ondas/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reproduzir: Teste' })).toBeEnabled();
});


test('salva os cortes aplicados com uma nova seleção fracionária ativa, sem zerá-la ou aplicá-la', async () => {
  const onSave = vi.fn();
  render(<AudioTakeEditor take={{ name: 'Take', durationSeconds: 10 }} src={source} onSave={onSave} onClose={vi.fn()}/>);
  const track = screen.getByRole('group', { name: 'Onda do áudio: Ouvir edição do take' });
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 });
  fireEvent.pointerDown(track, { button: 0, clientX: 200 });
  fireEvent.pointerUp(track, { button: 0, clientX: 400 });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir seleção' }));
  fireEvent.pointerDown(track, { button: 0, clientX: 123.456 });
  fireEvent.pointerUp(track, { button: 0, clientX: 456.789 });
  expect(screen.getByLabelText('Duração da seleção')).not.toHaveTextContent('0.00 s selecionados');
  expect(screen.getByRole('dialog', { name: 'Editar take' }).checkValidity()).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: 'Take', segments: [{ start: 0, end: 2 }, { start: 4, end: 10 }] }));
});
