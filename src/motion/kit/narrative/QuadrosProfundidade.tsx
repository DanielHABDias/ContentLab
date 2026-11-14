import React from 'react';
import { Board, Card, Caption, Common, Item, useBoard, phase, hit } from './shared';
/** Travelling lateral de planos separados em Z; preserva o quadro inteiro, sem voo WebGL. */
export const QuadrosProfundidade: React.FC<Common & { planos: Item[]; profundidade?: number }> = p => {
 const b=useBoard();const items=(p.planos||[]).slice(0,4);const move=phase(b.f,p.len,.1,.75);const depth=Math.max(30,Math.min(160,p.profundidade??85));
 return <Board {...p}><div style={{position:'absolute',inset:'110px 0 70px',perspective:1800,perspectiveOrigin:`${35+move*30}% 50%`,transformStyle:'preserve-3d'}}>{items.map((item,i)=>{const z=i*depth;return <Card key={i} item={item} len={p.len} x={b.V?100+i*35:80+i*310} y={b.V?70+i*140:80+i*25} w={b.V?600:500} h={b.V?360:460} at={hit(p.len,i*.09)} style={{transform:`translate3d(${(move-.5)*(i+1)*-55}px,0,${z}px) rotateY(${-12+move*16}deg)`,filter:`brightness(${.55+i*.15})`,zIndex:i}}/>})}</div><Caption text="PLANOS / CONTEXTO / DETALHE" x={30} y={b.h-45} w={b.w-60} size={26}/></Board>;
};
