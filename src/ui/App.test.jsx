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
  fireEvent.click(screen.getByRole('button', { name: /voltar aos projetos/i }));
  expect(screen.getByRole('heading', { name: /projetos locais/i })).toBeInTheDocument();
});

test('aprova e reabre etapas preservando histórico', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /abrir o detalhe que muda o batman/i }));
  fireEvent.click(screen.getByRole('button', { name: /aprovar etapa/i }));
  expect(screen.getByRole('status')).toHaveTextContent('Roteiro aprovado');
  fireEvent.click(screen.getAllByRole('button', { name: /reabrir/i })[0]);
  expect(screen.getByRole('status')).toHaveTextContent('Ideia e brief reaberto');
  expect(screen.getByText(/etapas posteriores precisam de revisão/i)).toBeInTheDocument();
});

test('cria projeto local de demonstração', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /novo projeto/i }));
  fireEvent.change(screen.getByPlaceholderText(/nome do projeto/i), { target: { value: 'Meu piloto' } });
  fireEvent.click(screen.getByRole('button', { name: /criar projeto/i }));
  expect(screen.getByRole('heading', { name: 'Meu piloto' })).toBeInTheDocument();
});
