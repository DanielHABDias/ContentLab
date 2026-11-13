import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ScriptPanel } from './ScriptPanel.jsx';

function Editor() {
  const [value, setValue] = useState({ chapters: [], sources: '' });
  return <ScriptPanel project={{ title: 'História', revision: 1, type: 'long' }} value={value} onChange={(key, next) => setValue(previous => ({ ...previous, [key]: next }))}/>;
}

test('cria capítulos, alterna fala e cena, move blocos e desfaz remoção com o texto preservado', () => {
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar capítulo' }));
  fireEvent.change(screen.getByLabelText('Título do capítulo 1'), { target: { value: 'Origem' } });
  fireEvent.click(screen.getByRole('button', { name: 'Narração', exact: true }));
  fireEvent.change(screen.getByLabelText('Texto da narração'), { target: { value: 'Esta é a fala.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cena / som original' }));
  fireEvent.change(screen.getByLabelText('Descrição da cena e do som original'), { target: { value: 'Transformação com áudio da obra.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Subir bloco 2 do capítulo 1' }));
  expect(within(screen.getByRole('article', { name: 'Bloco 1 do capítulo 1' })).getByDisplayValue('Transformação com áudio da obra.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar capítulo' }));
  fireEvent.change(within(screen.getByRole('article', { name: 'Bloco 2 do capítulo 1' })).getByLabelText('Mover para capítulo'), { target: { value: screen.getAllByRole('option').find(item => item.textContent.startsWith('2.')).value } });
  expect(within(screen.getByRole('region', { name: 'Capítulo 2', exact: true })).getByDisplayValue('Esta é a fala.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remover capítulo 2' }));
  expect(screen.queryByDisplayValue('Esta é a fala.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
  expect(screen.getByDisplayValue('Esta é a fala.')).toBeInTheDocument();
});

test('visualização preserva roteiro antigo e bloqueia alterações', () => {
  const onChange = vi.fn();
  render(<ScriptPanel readOnly project={{ title: 'Antigo', revision: 1 }} value={{ hook: 'Fala antiga.', visual: 'Uma imagem.', sources: 'Fonte.' }} onChange={onChange}/>);
  expect(screen.getByDisplayValue('Fala antiga.')).toHaveAttribute('readonly');
  expect(screen.getByDisplayValue('Uma imagem.')).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Adicionar capítulo' })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
