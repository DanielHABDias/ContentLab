import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { PublishView } from './PublishView.jsx';
vi.mock('./local-api.js', () => ({ localApi: { productionOutputs: vi.fn(async () => ({ renders: [], thumbnails: [] })) } }));
const details = (type = 'short') => ({ path: '/p', project: { type, aspectRatio: type === 'short' ? '9:16' : '16:9', title: 'Projeto', revision: 1, stages: [], media: [{ id: 'a' }, { id: 'b' }], creative: { packaging: { titleA: 'Título principal', titleB: 'Alternativa antiga', thumbnailMediaId: 'a', thumbnailB: 'b' } } } });
test('Short apresenta somente a embalagem A, inclusive em projetos com dados B antigos', async () => {
  const { container } = render(<PublishView details={details()} onBack={() => {}} onEdit={() => {}}/>);
  expect(screen.getByAltText('Thumbnail')).toHaveAttribute('src', expect.stringContaining('a'));
  expect(screen.queryByText('Alternativa antiga')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.publish-variant')).toHaveLength(1);
  expect(container.querySelector('.portrait-project')).toBeInTheDocument();
  await screen.findByText('Nenhum vídeo renderizado ainda.');
});
test('vídeo longo mantém as duas variantes e o layout horizontal', async () => {
  const { container } = render(<PublishView details={details('long')} onBack={() => {}} onEdit={() => {}}/>);
  expect(screen.getByText('Alternativa antiga')).toBeInTheDocument();
  expect(container.querySelectorAll('.publish-variant')).toHaveLength(2);
  expect(container.querySelector('.portrait-project')).not.toBeInTheDocument();
  await screen.findByText('Nenhum vídeo renderizado ainda.');
});
