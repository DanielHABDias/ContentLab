import React, { useContext } from 'react';
import { staticFile } from 'remotion';
import { ComicPageCTACena } from '../../timeline/components/hq/ComicPageCTA';
import { PersonagemCtx, choosePose } from './Personagem';
import { Assets } from './scenes';

type Lado = { titulo?: string; midia?: string };

/**
 * Tela final do vídeo longo (os últimos 5–20 s, depois da narração): a página HQ `ComicPageCTA` do Content Lab,
 * com dois quadros de vídeo e o espaço para a bolinha do canal, onde ficam os elementos finais do YouTube.
 * O personagem do projeto entra na pose pedida; sem personagem, a cena não tem como montar a página.
 */
export const TelaFinal: React.FC<{ len: number; titulo?: string; chamada?: string; inscricao?: string; manchete?: string; canal?: string; pose?: string; esquerda?: Lado; direita?: Lado; icone?: string; pagina?: boolean; cor?: string }> = ({ titulo = 'CONTINUE ESSA HISTÓRIA!', chamada = 'VAI LÁ ASSISTIR!', inscricao = 'INSCREVA-SE', manchete = 'A ANÁLISE COMPLETA', canal = '', pose = 'acenando', esquerda = {}, direita = {}, icone, pagina = true, cor = '#EF3F49' }) => {
  const assets = useContext(Assets); const character = useContext(PersonagemCtx);
  const src = (ref?: string) => (ref ? assets[ref.replace(/^media:/, '')]?.src : undefined);
  const figure = choosePose(character, { pose, humor: 'feliz', seed: 'telafinal' });
  if (!figure) return null;
  return <ComicPageCTACena
    backgroundStyle={pagina ? 'comic-page' : undefined} fontFamily="Anton" channelName={canal} topTitle={titulo} subscribeText={inscricao} calloutText={chamada} headline={manchete} stripeColor={cor}
    leftTitle={esquerda.titulo || 'ASSISTA TAMBÉM'} rightTitle={direita.titulo || 'PRÓXIMO VÍDEO'}
    assets={{ anton: staticFile('brand/Anton-Regular.ttf'), character: figure.src, thumbnailLeft: src(esquerda.midia), thumbnailRight: src(direita.midia), channelIcon: src(icone) }} />;
};
