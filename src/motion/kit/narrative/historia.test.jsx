// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const clock=vi.hoisted(()=>({frame:0,width:1920,height:1080}));
vi.mock('remotion',async original=>({...await original(),useCurrentFrame:()=>clock.frame,useVideoConfig:()=>({...clock,fps:30,durationInFrames:120})}));
import { Vinculo, Memoria, DuplaVida } from './Historia';
import { narrativeEvents } from './events';
afterEach(cleanup);
test('relationship text changes at the same frame as its impact in both layouts',()=>{
 for(const vertical of [false,true]){
  Object.assign(clock,{width:vertical?1080:1920,height:vertical?1920:1080,frame:65});
  const props={len:120,pessoas:[{titulo:'PETER'},{titulo:'OTTO'}],antes:'CONFIANÇA',depois:'RUPTURA'};
  const view=render(<Vinculo {...props}/>);expect(view.getByText('CONFIANÇA')).toBeTruthy();
  clock.frame=66;view.rerender(<Vinculo {...props}/>);expect(view.getByText('RUPTURA')).toBeTruthy();
  expect(narrativeEvents('vinculo',props,4).find(e=>e.name==='impact').at).toBe(2.2);
  expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);view.unmount();
 }
});
test('memory returns to a sharp present and split responsibilities follow configured switches',()=>{
 clock.frame=119;
 const view=render(<Memoria len={120} presente={{titulo:'AGORA'}} lembranca={{titulo:'ANTES'}} retorno="O PESO"/>);
 expect(view.container.querySelector('[data-motion-card="AGORA"]').style.filter).toContain('blur(0px)');view.unmount();
 clock.frame=60;const split=render(<DuplaVida len={120} lados={[{titulo:'PESSOA'},{titulo:'HERÓI'}]} trocas={[.25]}/>);
 expect(split.container.querySelector('[data-motion-card="HERÓI"]').style.filter).toBe('brightness(1.12)');
 expect(narrativeEvents('duplaVida',{lados:[],trocas:[]},4)).toEqual([]);
});
