import hq from './hq/catalog.json' with { type: 'json' };

/**
 * Cenas embutidas do modo clips: a ênfase cinética e as cenas HQ do Content Lab
 * (arquivo único cada, imports só de React/Remotion). Props `json` aceitam objetos/listas;
 * referências `brand:<nome>` (anton, comic-page, ícones do kit) e `media:<id>` (mídia do projeto) viram arquivos no render.
 */
export const BUNDLED_COMPONENTS = [
  { id: 'kinetic_emphasis', file: 'KineticEmphasis.tsx', exportName: 'KineticEmphasis', label: 'Ênfase cinética', use: 'Palavra ou frase curta em destaque sobre o vídeo', propsSchema: { text: { type: 'string', label: 'Texto', default: 'Texto em destaque' }, color: { type: 'color', label: 'Cor', default: '#d8ff48' } } },
  ...hq.components,
];
