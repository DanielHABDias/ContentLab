import React from 'react';
import {
  AbsoluteFill, cancelRender, continueRender, delayRender,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/fonts';

type Props = {fontFamily?: HQFont;
  upperText: string;
  lowerText: string;
  tagColor?: string;
  assets?: {anton?: string; bangers?: string};
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const readableInk = (hex: string) => {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return luminance >= 135 ? '#090C12' : '#FFFFFF';
};

/** Sobreposição transparente: o vídeo ou a imagem ficam na cena normal do Content Lab. */
export default function QuadroHQSobreCena({fontFamily,
  upperText,
  lowerText,
  tagColor = '#5CA5AD',
  assets = {},
}: Props) {
  const mainFont=fontFamily??'Anton',tagFont=fontFamily??'Bangers';
  const mainFontUrl=resolveHQFont(mainFont,assets),tagFontUrl=resolveHQFont(tagFont,assets);
  if (!upperText?.trim() || !lowerText?.trim()) {
    throw new Error('QuadroHQSobreCena requer upperText e lowerText.');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(tagColor)) {
    throw new Error('tagColor deve ser hexadecimal no formato #RRGGBB.');
  }


  const [handle] = React.useState(() => delayRender('Carregando fontes do quadro HQ'));
  React.useEffect(() => {
    Promise.all([
      loadFont({family: mainFont, url: mainFontUrl}),
      loadFont({family: tagFont, url: tagFontUrl}),
    ]).then(() => continueRender(handle)).catch((error) => cancelRender(error));
  }, [mainFontUrl,tagFontUrl,mainFont,tagFont,handle]);

  const frame = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const horizontal = w > h;
  const unit = Math.min(w, h) / 1080;
  const time = frame / fps;
  const frameIn = ease(time / .24);
  const mainOpen = ease((time - .08) / .40);
  const tagOpen = ease((time - .20) / .30);
  // After opening (0.50 s), hold for 1.50 s, then compact around the same corner.
  const compact = horizontal ? ease((time - 2.0) / .65) : 0;
  const panelScale = 1 - .42 * compact;
  const upper = upperText.toLocaleUpperCase('pt-BR');
  const lower = lowerText.toLocaleUpperCase('pt-BR');
  const fontSize = Math.max(46 * unit, Math.min(94 * unit, w * (lower.length > 28 ? .058 : lower.length > 19 ? .07 : .091)));
  const paper = '#F5EFDE';
  const ink = '#111723';
  const tagInk = readableInk(tagColor);

  return <AbsoluteFill style={{background: 'transparent', pointerEvents: 'none', overflow: 'hidden'}}>
    <AbsoluteFill style={{pointerEvents: 'none', opacity: .22,
      backgroundImage: `radial-gradient(circle, #080A11 ${3.2 * unit}px, transparent ${3.8 * unit}px)`,
      backgroundSize: `${18 * unit}px ${18 * unit}px`}} />
    <div style={{position: 'absolute', inset: '1.5% 3% 2.4%', border: `${5 * unit}px solid ${paper}`,
      boxSizing: 'border-box', opacity: .9 * frameIn}} />

    <div style={{position: 'absolute', top: '.6%', left: '5%', zIndex: 2,
      fontFamily: mainFont, fontSize: 31 * unit, letterSpacing: 2 * unit,
      color: paper, textShadow: mainFont === 'Anton' ? 'none' : `${2 * unit}px ${3 * unit}px 0 #090C12`, opacity: frameIn}}>{upper}</div>

    <div style={{position: 'absolute', zIndex: 3, left: '5%', right: horizontal ? '30%' : '5%', bottom: '5%',
      transform: `scale(${panelScale})`, transformOrigin: 'left bottom',
      filter: `drop-shadow(${7 * unit}px ${9 * unit}px 0 #05060B)`}}>
      <div style={{display: 'inline-block', background: tagColor, color: tagInk,
        padding: `${5 * unit}px ${17 * unit}px ${2 * unit}px`, marginBottom: -4 * unit,
        border: `${3 * unit}px solid #0D1016`,
        clipPath: `inset(0 ${(1 - tagOpen) * 100}% 0 0)`,
        transform: 'rotate(-1.3deg)', fontFamily: tagFont,
        fontSize: 28 * unit, letterSpacing: 2 * unit}}>{upper}</div>
      <div style={{background: paper, border: `${6 * unit}px solid #080B11`,
        padding: `${20 * unit}px ${25 * unit}px ${17 * unit}px`,
        clipPath: `inset(0 ${(1 - mainOpen) * 100}% 0 0)`,
        fontFamily: mainFont, color: ink, fontSize, lineHeight: .96,
        letterSpacing: -.55 * unit, overflowWrap: 'break-word'}}>{lower}</div>
    </div>
  </AbsoluteFill>;
}

type HQFont = 'Bangers' | 'Anton';
export function resolveHQFont(family:HQFont, assets:{bangers?:string;anton?:string}){
  if(family!=='Bangers'&&family!=='Anton')throw new Error('fontFamily deve ser Bangers ou Anton.');
  const key=family==='Anton'?'anton':'bangers';
  if(!assets[key])throw new Error(`Informe customComponent.assets.${key} para a fonte ${family}.`);
  return assets[key]!;
}
