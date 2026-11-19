import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DocsScreen } from './DocsScreen.jsx';
import { localApi } from './local-api.js';

vi.mock('./local-api.js', () => ({ localApi: { brandDocs: vi.fn(), brandFileUrl: vi.fn() } }));
vi.mock('./KitPreview.jsx', () => ({ ScenePlayer: () => <div>Scene</div>, BackgroundPlayer: ({kind, playing}) => <div data-testid="background" data-playing={playing ? 'true' : 'false'}>{kind}</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('background gallery stays still until requested, allows just one animation, and keeps Half-Tone naming', async () => {
  localApi.brandDocs.mockResolvedValue({ scenes: [], moods: [], backgrounds: ['papel', 'papel-dobras', 'halftone'], colors: [], captions: [], sound: [], sfx: [], rules: [] });
  render(<DocsScreen onBack={() => {}}/>);
  await waitFor(() => expect(screen.getAllByTestId('background')).toHaveLength(3));
  const playing = () => screen.getAllByTestId('background').filter(el => el.dataset.playing === 'true').map(el=>el.textContent);
  expect(playing()).toEqual([]);
  expect(screen.getByText('Half-Tone')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Animar fundo papel' })); expect(playing()).toEqual(['papel']);
  fireEvent.click(screen.getByRole('button', { name: 'Animar fundo papel-dobras' })); expect(playing()).toEqual(['papel-dobras']);
  fireEvent.click(screen.getByRole('button', { name: 'Pausar fundo papel-dobras' })); expect(playing()).toEqual([]);
});
