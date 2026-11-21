import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ProjectFilter, PublicationControl, matchesFilter, publishedDate } from './Publication.jsx';

const items = [{ title: 'Antigo', published: true }, { title: 'Novo', published: false }, { title: 'Outro', published: false }];

test('o filtro padrão esconde os publicados e conta cada grupo', () => {
  expect(items.filter(item => matchesFilter(item, 'production')).map(item => item.title)).toEqual(['Novo', 'Outro']);
  expect(items.filter(item => matchesFilter(item, 'published')).map(item => item.title)).toEqual(['Antigo']);
  expect(items.filter(item => matchesFilter(item, 'all'))).toHaveLength(3);
  const onChange = vi.fn();
  render(<ProjectFilter value="production" items={items} onChange={onChange}/>);
  expect(screen.getByRole('radio', { name: /Em produção/ })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: /Publicados/ })).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('radio', { name: /Publicados/ }));
  expect(onChange).toHaveBeenCalledWith('published');
});

test('mostra a data da publicação e permite desfazer', () => {
  expect(publishedDate('2026-11-20T10:00:00.000Z')).toBe('20/11/2026');
  const onSet = vi.fn();
  render(<PublicationControl project={{ title: 'Vídeo', publication: { published: true, publishedAt: '2026-11-20', url: null } }} onSet={onSet}/>);
  expect(screen.getByText(/Publicado/)).toHaveTextContent('20/11/2026');
  fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }));
  expect(onSet).toHaveBeenCalledWith({ published: false });
});
