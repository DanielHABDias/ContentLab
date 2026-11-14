// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const clock=vi.hoisted(()=>({frame:0}));
vi.mock('remotion',async importOriginal=>({...await importOriginal(),useCurrentFrame:()=>clock.frame,useVideoConfig:()=>({width:1920,height:1080,fps:30,durationInFrames:120})}));
import { Board, Card } from './shared';
import { cardEntrance, containFocus, thresholdFrame, thresholdValue } from './choreography.js';
import { narrativeEvents } from './events.js';
afterEach(cleanup);

test('a spatial transform cannot make a future card visible or cancel its entrance',()=>{
 clock.frame=10;
 const props={item:{titulo:'PROVA'},len:120,x:0,y:0,w:500,h:300,at:30,style:{transform:'rotateY(30deg)',opacity:.8}};
 const view=render(<Card {...props}/>);const card=view.container.querySelector('[data-motion-card]');
 expect(card.style.transform).toBe('rotateY(30deg)');
 expect(card.firstElementChild.style.opacity).toBe('0');
 clock.frame=70;view.rerender(<Card {...props}/>);
 expect(card.firstElementChild.style.opacity).toBe('1');
 expect(card.firstElementChild.style.transform).not.toBe(card.style.transform);
});

test('entrance timing is stable across frame rates and is hidden before its cue',()=>{
 expect(cardEntrance(29,30,30,'direita').opacity).toBe(0);
 const a=cardEntrance(30,0,30,'direita'),b=cardEntrance(60,0,60,'direita');
 expect(a.opacity).toBe(1);expect(b.opacity).toBe(1);
 expect(a.transform).not.toMatch(/NaN|Infinity/);expect(b.transform).not.toMatch(/NaN|Infinity/);
});

test('threshold sound and impact use the first crossing frame, in both directions',()=>{
 for(const [from,to,limit] of [[15,90,65],[90,15,65]])for(const fps of [24,30,60]){
  const len=4*fps,f=thresholdFrame({len,from,to,limit});
  expect(f).toBeGreaterThan(0);
  const crossed=v=>to>from?v>=limit:v<=limit;
  expect(crossed(thresholdValue(f,len,from,to))).toBe(true);
  expect(crossed(thresholdValue(f-1,len,from,to))).toBe(false);
  const cue=narrativeEvents('limiar',{de:from,valor:to,limite:limit},4,fps).find(e=>e.name==='error');
  expect(Math.round(cue.at*fps)).toBe(f);
 }
 expect(thresholdFrame({len:120,from:10,to:30,limit:65})).toBeNull();
 expect(thresholdFrame({len:120,from:10,to:10,limit:10})).toBeNull();
});

test('the lens compensates the source image letterboxing rather than magnifying a wrong location',()=>{
 const portrait=containFocus(400,800,1000,500,0,0);
 expect(portrait).toEqual({w:250,h:500,x:375,y:0});
 const wide=containFocus(1600,400,500,1000,1,1);
 expect(wide).toEqual({w:500,h:125,x:500,y:562.5});
});

test('no reveal or choice cue is fabricated when the scene keeps the outcome open',()=>{
 expect(narrativeEvents('pecaAusente',{contexto:[],revelar:false},4)).toEqual([]);
 expect(narrativeEvents('bifurcacao',{opcoes:[{titulo:'A'},{titulo:'B'}]},4).some(e=>e.name==='impact')).toBe(false);
 expect(narrativeEvents('limiar',{de:10,valor:30,limite:65},4).some(e=>e.name==='error')).toBe(false);
 const cues=narrativeEvents('dossie',{pistas:[{titulo:'A'}]},4);
 expect(cues.map(e=>e.name)).toEqual(['camera','type']);
});


test('the animated heading has a clipping area and stays above the board contents',()=>{
 clock.frame=30;
 const view=render(<Board len={120} titulo="O QUE AS PISTAS CONTAM?"><div/></Board>);
 const heading=view.container.querySelector('[data-motion-heading]');
 expect(Number.parseFloat(heading.style.height)).toBeGreaterThan(80);
 expect(heading.textContent).toBe('O QUE AS PISTAS CONTAM?');
 expect(heading.firstElementChild.style.whiteSpace).toBe('nowrap');
});
