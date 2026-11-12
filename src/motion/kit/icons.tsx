import React from 'react';
import { ANTON, C } from './fx';

/**
 * Ícones HQ (traço de tinta, preenchimento chapado) para representar o que o Nox fala:
 * aparecem no balão acima dele na cena `aparte`. Desenho original, sem fonte de emoji.
 */
export const ICONS = ['lampada', 'interrogacao', 'exclamacao', 'coracao', 'caveira', 'dinheiro', 'relogio', 'raio', 'certo', 'errado', 'fogo', 'coroa', 'escudo', 'olho', 'cerebro', 'trofeu'] as const;
export type Icon = typeof ICONS[number];

const stroke = { stroke: C.ink, strokeWidth: 9, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const IconArt: React.FC<{ name: Icon | string; size: number }> = ({ name, size }) => {
  const body = (() => {
    switch (name) {
      case 'lampada': return <>
        {[0, 1, 2, 3, 4].map(i => { const a = -Math.PI * (0.15 + i * 0.175); return <line key={i} x1={100 + Math.cos(a) * 70} y1={80 + Math.sin(a) * 70} x2={100 + Math.cos(a) * 92} y2={80 + Math.sin(a) * 92} {...stroke} />; })}
        <circle cx={100} cy={88} r={52} fill={C.yellow} {...stroke} /><rect x={78} y={136} width={44} height={30} rx={6} fill="#bbb" {...stroke} /></>;
      case 'interrogacao': case 'exclamacao': return <>
        <circle cx={100} cy={100} r={80} fill={name === 'interrogacao' ? C.blue : C.red} {...stroke} />
        <text x={100} y={142} textAnchor="middle" fontFamily={ANTON} fontSize={120} fill="#fff" stroke={C.ink} strokeWidth={5}>{name === 'interrogacao' ? '?' : '!'}</text></>;
      case 'coracao': return <path d="M100 172 C30 120 20 70 52 48 C76 32 96 48 100 66 C104 48 124 32 148 48 C180 70 170 120 100 172 Z" fill={C.red} {...stroke} />;
      case 'caveira': return <>
        <path d="M40 100 C40 50 70 26 100 26 C130 26 160 50 160 100 C160 124 146 136 136 140 L136 168 L64 168 L64 140 C54 136 40 124 40 100 Z" fill="#f2f2f2" {...stroke} />
        <circle cx={76} cy={98} r={17} fill={C.ink} /><circle cx={124} cy={98} r={17} fill={C.ink} /><path d="M92 132 L100 118 L108 132 Z" fill={C.ink} />
        {[82, 100, 118].map(x => <line key={x} x1={x} y1={150} x2={x} y2={168} {...stroke} strokeWidth={6} />)}</>;
      case 'dinheiro': return <><circle cx={100} cy={100} r={80} fill="#3ddc84" {...stroke} /><text x={100} y={140} textAnchor="middle" fontFamily={ANTON} fontSize={112} fill="#fff" stroke={C.ink} strokeWidth={5}>$</text></>;
      case 'relogio': return <><circle cx={100} cy={104} r={74} fill="#fff" {...stroke} /><line x1={100} y1={104} x2={100} y2={60} {...stroke} /><line x1={100} y1={104} x2={136} y2={118} {...stroke} /><rect x={86} y={14} width={28} height={18} fill={C.red} {...stroke} strokeWidth={6} /></>;
      case 'raio': return <polygon points="112,16 46,112 94,112 78,186 154,82 106,82 128,16" fill={C.yellow} {...stroke} />;
      case 'certo': return <><circle cx={100} cy={100} r={80} fill="#3ddc84" {...stroke} /><path d="M60 102 L88 130 L142 70" fill="none" {...stroke} stroke="#fff" strokeWidth={18} /></>;
      case 'errado': return <><circle cx={100} cy={100} r={80} fill={C.red} {...stroke} /><path d="M68 68 L132 132 M132 68 L68 132" fill="none" {...stroke} stroke="#fff" strokeWidth={18} /></>;
      case 'fogo': return <path d="M100 182 C54 182 40 146 48 118 C56 92 76 84 74 52 C98 66 104 88 102 104 C112 96 118 82 116 64 C150 92 162 120 156 144 C150 168 128 182 100 182 Z" fill="#ff8a1f" {...stroke} />;
      case 'coroa': return <polygon points="30,150 40,64 76,104 100,48 124,104 160,64 170,150" fill={C.yellow} {...stroke} />;
      case 'escudo': return <path d="M100 20 L164 44 C164 110 140 154 100 180 C60 154 36 110 36 44 Z" fill={C.blue} {...stroke} />;
      case 'olho': return <><path d="M20 100 C60 46 140 46 180 100 C140 154 60 154 20 100 Z" fill="#fff" {...stroke} /><circle cx={100} cy={100} r={30} fill={C.ink} /><circle cx={110} cy={90} r={9} fill="#fff" /></>;
      case 'cerebro': return <path d="M70 160 C40 160 26 136 32 116 C18 100 26 74 46 68 C48 44 76 32 96 44 C112 30 144 36 150 60 C174 66 180 96 166 110 C176 136 156 162 128 158 C116 172 84 172 70 160 Z M100 46 L100 160" fill="#f7a1c4" {...stroke} />;
      case 'trofeu': return <><path d="M60 30 L140 30 L134 96 C130 120 116 132 100 132 C84 132 70 120 66 96 Z" fill={C.yellow} {...stroke} /><path d="M60 46 C28 46 30 92 66 96 M140 46 C172 46 170 92 134 96" fill="none" {...stroke} /><rect x={76} y={150} width={48} height={26} fill={C.yellow} {...stroke} /><line x1={100} y1={132} x2={100} y2={150} {...stroke} /></>;
      default: return <text x={100} y={130} textAnchor="middle" fontFamily={ANTON} fontSize={90} fill={C.ink}>{String(name).slice(0, 3)}</text>;
    }
  })();
  return <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible', filter: 'drop-shadow(6px 6px 0 rgba(11,11,16,.9))' }}>{body}</svg>;
};
