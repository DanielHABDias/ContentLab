import React from 'react';
import {
  AbsoluteFill, Img, cancelRender, continueRender, delayRender,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Props = {channelName?:string;topTitle?:string;subscribeText?:string;calloutText?:string;fontFamily?: HQFont;
  /** Texto abaixo da thumbnail. */
  headline?: string;
  /** Somente a faixa diagonal superior; os demais detalhes vermelhos são fixos. */
  stripeColor?: string;
  leftTitle?: string;
  rightTitle?: string;
  assets?: {thumbnail?: string; character?: string; bangers?: string; anton?: string;
    thumbnailLeft?: string; thumbnailRight?: string; channelIcon?: string};
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {const x = clamp(n); return x * x * (3 - 2 * x);};

export default function ComicPageCTA({fontFamily="Bangers",
  channelName='', topTitle='CONTINUE ESSA HISTÓRIA!', subscribeText='INSCREVA-SE', calloutText='VAI LÁ ASSISTIR!', headline = 'A ANÁLISE COMPLETA', stripeColor = '#EF3F49',
  leftTitle = 'ASSISTA TAMBÉM', rightTitle = 'PRÓXIMO VÍDEO', assets = {},
}: Props) {
  const fontUrl=resolveHQFont(fontFamily,assets);
  const {width: w, height: h, fps, durationInFrames} = useVideoConfig();
  const horizontal = w > h;
  if (!fontUrl) throw new Error('ComicPageCTA requer fontUrl.');
  if (!horizontal && !assets.thumbnail) throw new Error('ComicPageCTA vertical requer assets.thumbnail.');
  if (!assets.character) throw new Error('ComicPageCTA requer assets.character nas duas orientações.');
  if (!/^#[0-9a-fA-F]{6}$/.test(stripeColor)) {
    throw new Error('ComicPageCTA requer stripeColor no formato #RRGGBB.');
  }
  const [handle] = React.useState(() => delayRender('Carregando Bangers na CTA'));
  React.useEffect(() => {
    loadFont({family: fontFamily, url: fontUrl})
      .then(() => continueRender(handle))
      .catch((error) => cancelRender(error));
  }, [fontUrl,fontFamily,handle]);
  const frame = useCurrentFrame();
  const p = frame / Math.max(1, durationInFrames - 1);
  const seconds = frame / fps;
  // Som é configurado no edit_plan.json: whoosh em +0,06 s e pop em +0,11 s.
  const pageIn = ease((seconds - .06) / .38);
  const cardIn = ease((seconds - .06) / .48);
  const bubbleIn = ease((seconds - .11) / .30);
  const characterIn = ease((seconds - .62) / .38);
  const camera = ease((seconds - .62) / .40);
  const ink = '#080A11';
  const paper = '#F8ECD4';
  const red = '#EF3F49';
  if (horizontal) {
    const unit = h / 1080;
    const blue = '#2676E8';
    const yellow = '#F4C542';
    const cardStyle: React.CSSProperties = {position: 'absolute', top: '32%', width: '31%',
      boxSizing: 'border-box', aspectRatio: '16 / 9', border: `${7 * unit}px solid ${ink}`,
      background: '#1D273B'};
    const labelStyle: React.CSSProperties = {position: 'absolute', top: '69%', width: '31%',
      boxSizing: 'border-box', padding: `${10 * unit}px ${12 * unit}px`,
      fontFamily: fontFamily, background: ink, color: '#FFFFFF',
      fontSize: 54 * unit, lineHeight: 1.05, textAlign: 'center', overflowWrap: 'break-word'};
    return <AbsoluteFill style={{background: paper, overflow: 'hidden', fontFamily: fontFamily}}>
      <AbsoluteFill style={{opacity: .16, backgroundImage: `radial-gradient(${ink} ${2 * unit}px, transparent ${2.5 * unit}px)`,
        backgroundSize: `${22 * unit}px ${22 * unit}px`}} />
      <div style={{position: 'absolute', left: '-5%', top: '8%', width: '110%', height: '19%',
        boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: stripeColor, rotate: '-3deg', borderTop: `${7 * unit}px solid ${ink}`,
        borderBottom: `${7 * unit}px solid ${ink}`, translate: `0 ${(1 - pageIn) * -h * .4}px`}}>
        <div style={{textAlign: 'center', color: '#FFFFFF', WebkitTextStroke: fontFamily === 'Anton' ? '0px transparent' : `${2 * unit}px ${ink}`,
          textShadow: fontFamily === 'Anton' ? 'none' : `${5 * unit}px ${6 * unit}px 0 ${ink}`, fontSize: 98 * unit,
          lineHeight: 1, opacity: pageIn}}>{topTitle}</div>
      </div>
      <div style={{...cardStyle, left: '5%', background: blue,
        boxShadow: `${12 * unit}px ${14 * unit}px 0 ${blue}`,
        translate: `${(1 - cardIn) * -w * .5}px 0`, opacity: cardIn}}>
        {assets.thumbnailLeft && <Img src={assets.thumbnailLeft} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
      </div>
      <div style={{...cardStyle, right: '5%', background: red,
        boxShadow: `${12 * unit}px ${14 * unit}px 0 ${red}`,
        translate: `${(1 - cardIn) * w * .5}px 0`, opacity: cardIn}}>
        {assets.thumbnailRight && <Img src={assets.thumbnailRight} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
      </div>
      <div style={{position: 'absolute', left: '43%', top: '35%', width: '14%', aspectRatio: '1',
        boxSizing: 'border-box', borderRadius: '50%', border: `${7 * unit}px solid ${ink}`, overflow: 'hidden',
        background: yellow, boxShadow: `${9 * unit}px ${11 * unit}px 0 ${yellow}`,
        scale: .4 + .6 * bubbleIn, opacity: bubbleIn}}>
        {assets.channelIcon && <Img src={assets.channelIcon} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
      </div>
      <div style={{position: 'absolute', left: '-14.5%', bottom: '-2.5%', width: '43%',
        aspectRatio: '1280 / 698', translate: `0 ${(1 - characterIn) * h * .45}px`,
        filter: `drop-shadow(${8 * unit}px ${8 * unit}px 0 ${ink})`, pointerEvents: 'none'}}>
        <Img src={assets.character} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <div style={{...labelStyle, left: '15%', width: '21%', opacity: cardIn}}>{leftTitle.toLocaleUpperCase('pt-BR')}</div>
      <div style={{...labelStyle, right: '5%', opacity: cardIn}}>{rightTitle.toLocaleUpperCase('pt-BR')}</div>
      <div style={{...labelStyle, top: '66%', left: '39%', width: '22%', opacity: bubbleIn}}>{subscribeText}</div>
      <div style={{position: 'absolute', bottom: '7%', width: '100%', textAlign: 'center',
        fontSize: 32 * unit, color: ink, opacity: pageIn}}>{channelName}</div>
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{overflow: 'hidden', background: ink,
    fontFamily: fontFamily, opacity: Math.min(1, (1 - p) * 24)}}>
    <AbsoluteFill style={{background: paper, transform: `translateX(${(1 - pageIn) * w}px)`}} />
    <AbsoluteFill style={{opacity: .19, backgroundImage: `radial-gradient(${ink} 2px, transparent 2.5px)`,
      backgroundSize: '22px 22px'}} />
    <div style={{position: 'absolute', width: w * 1.5, height: h * .15,
      left: -w * .25, top: h * .12, transform: 'rotate(-12deg)',
      background: stripeColor, borderTop: `9px solid ${ink}`, borderBottom: `9px solid ${ink}`}} />
    <div style={{position: 'absolute', zIndex: 4, left: w * .055, top: h * .055,
      width: w * .89, boxSizing: 'border-box', padding: '34px 12px 18px',
      background: paper, border: `8px solid ${ink}`, boxShadow: `12px 14px 0 ${red}`,
      color: ink, fontSize: Math.min(118, w * .109),
      lineHeight: .87, textAlign: 'center',
      transform: `translateY(${(1 - pageIn) * -h * .20}px) rotate(-2deg)`}}>
      {topTitle}
    </div>
    <div style={{position: 'absolute', zIndex: 7, left: w * .10, top: h * .22,
      width: w * .79, background: ink, border: `9px solid ${ink}`,
      boxShadow: `18px 20px 0 ${red}`,
      transform: `translateX(${(1 - cardIn) * w}px) rotate(${(1 - cardIn) * 8 - 2}deg) scale(${1 + camera * .045})`,
      transformOrigin: '50% 30%'}}>
      <div style={{height: w * .79 * 9 / 16, background: '#303847', overflow: 'hidden'}}>
      <Img src={assets.thumbnail!} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
      <div style={{padding: '14px 22px 11px', background: paper, color: ink,
        fontSize: Math.min(45, w * .046), lineHeight: .9}}>{headline.toLocaleUpperCase('pt-BR')}</div>
    </div>
    <div style={{position: 'absolute', zIndex: 6, left: -w * .58, bottom: -h * .035,
      width: w * 1.93, height: w * 1.93 * 698 / 1280,
      transform: `translateY(${(1 - characterIn) * h * .54}px) rotate(-3deg)`,
      filter: 'drop-shadow(17px 13px 0 #080A11)'}}>
      <Img src={assets.character} style={{width: '100%', height: '100%',
        objectFit: 'contain', objectPosition: 'center bottom'}} />
    </div>
    <div style={{position: 'absolute', zIndex: 8, right: w * .035, bottom: h * .12,
      width: w * .49, padding: '20px 14px 14px', border: `8px solid ${ink}`,
      borderRadius: '48% 48% 42% 43%', color: ink, background: '#FFFFFF',
      boxShadow: `12px 13px 0 ${red}`, fontSize: Math.min(73, w * .07),
      lineHeight: .87, textAlign: 'center',
      transform: `scale(${.2 + .8 * bubbleIn}) rotate(${(1 - bubbleIn) * 14 - 6}deg)`,
      opacity: bubbleIn}}>{calloutText}</div>
    <div style={{position: 'absolute', zIndex: 8, right: w * .05, bottom: h * .035,
      color: ink, fontSize: 36, opacity: bubbleIn}}>{channelName}</div>
  </AbsoluteFill>;
}

type HQFont = 'Bangers' | 'Anton';
export function resolveHQFont(family:HQFont, assets:{bangers?:string;anton?:string}){
  if(family!=='Bangers'&&family!=='Anton')throw new Error('fontFamily deve ser Bangers ou Anton.');
  const key=family==='Anton'?'anton':'bangers';
  if(!assets[key])throw new Error(`Informe customComponent.assets.${key} para a fonte ${family}.`);
  return assets[key]!;
}
