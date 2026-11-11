import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App.jsx';

test('abre um projeto e exibe o workflow', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /abrir por que heróis falham/i }));
  expect(screen.getByRole('heading', { name: /por que heróis falham/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /da ideia ao pacote final/i })).toBeInTheDocument();
  expect(screen.getByText('Revisão e render')).toBeInTheDocument();
});

test('oferece navegação de retorno', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /abrir a evolução do omnitrix/i }));
  fireEvent.click(screen.getByRole('button', { name: /^← projetos$/i }));
  expect(screen.getByRole('heading', { name: /projetos locais/i })).toBeInTheDocument();
});
