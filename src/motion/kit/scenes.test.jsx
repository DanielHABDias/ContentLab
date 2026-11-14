import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
vi.mock('remotion', async importOriginal => ({ ...(await importOriginal()), useCurrentFrame: () => 30, useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 90 }) }));
import { Formula, Titulo } from './scenes';

test('a formula without an optional stamp renders its terms and a legible inequality', () => {
  render(<Formula len={90} termos={[{ rotulo: 'admiração', valor: 'ADMIRAR' }, { rotulo: 'atitude', valor: 'AGIR' }]} operadores={['≠']}/>);
  expect(screen.getByText('ADMIRAR')).toBeInTheDocument();
  expect(screen.getByText('AGIR')).toBeInTheDocument();
  expect(screen.getByText('≠')).toHaveStyle({ fontFamily: 'Arial, sans-serif' });
});

test('yellow kinetic type has a dark backing on a yellow background', () => {
  render(<Titulo len={90} palavras={['CHANCE?']} fundo="explosao" tom="amarelo"/>);
  expect(screen.getByText('CHANCE?').style.background).not.toBe('');
});
