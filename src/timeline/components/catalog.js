import diazverso from './diazverso/catalog.json' with { type: 'json' };

/**
 * Cenas embutidas: a ênfase cinética do Content Lab e as cenas HQ do plugin Diazverso
 * (compiladas por `scripts/build-diazverso-scenes.mjs`, arquivo único com imports só de React/Remotion).
 * Props `json` aceitam objetos/listas; referências `brand:<nome>` (anton, nox, comic-page, ícones)
 * e `media:<id>` (imagem do projeto) viram arquivos no render.
 */
export const DIAZVERSO_VERSION = diazverso.plugin;
export const BUNDLED_COMPONENTS = [
  { id: 'kinetic_emphasis', file: 'KineticEmphasis.tsx', exportName: 'KineticEmphasis', label: 'Ênfase cinética', use: 'Palavra ou frase curta em destaque sobre o vídeo', propsSchema: { text: { type: 'string', label: 'Texto', default: 'Texto em destaque' }, color: { type: 'color', label: 'Cor', default: '#d8ff48' } } },
  ...diazverso.components,
];
