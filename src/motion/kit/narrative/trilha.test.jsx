// @vitest-environment jsdom
import React from 'react';
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
const clock=vi.hoisted(()=>({frame:0,width:1920,height:1080}));
vi.mock('remotion',async original=>({...await original(),Img:(props)=><img {...props}/>,Sequence:({children})=>children,Freeze:({children})=>children,useCurrentFrame:()=>clock.frame,useVideoConfig:()=>({...clock,fps:30,durationInFrames:300})}));
import {passageFrames,timelineProps,timelineState} from './trilha';
import {TrilhaViva} from './TrilhaViva';
import {PersonagemClose,PensamentoVivo} from './PersonagemIdeias';
import {PersonagemCtx} from '../Personagem';
import {narrativeEvents} from './events';
afterEach(cleanup);
const chapters=n=>Array.from({length:n},(_,i)=>({titulo:`CAP ${i+1}`,midia:`media:m${i}`}));
test('a timeline accepts any number of chapters and clamps where the camera starts and stops',()=>{
 const p=timelineProps({capitulos:chapters(40),de:0,ate:99});expect([p.n,p.from,p.to,p.rewind]).toEqual([40,1,40,false]);
 expect(timelineProps({capitulos:chapters(5),de:4,ate:1}).rewind).toBe(true);
 expect(timelineProps({fragmentos:chapters(3)}).enter).toBe(true);
 expect(timelineProps({capitulos:chapters(3)}).enter).toBe(false);
});
test('the camera travels between chapters, enters at the end and comes back out at the start',()=>{
 const enter={capitulos:chapters(5),de:1,ate:3,entrar:true};
 expect(timelineState(0,300,enter).pos).toBe(1);
 const end=timelineState(299,300,enter);expect(end.pos).toBe(3);expect(end.zoom).toBeCloseTo(1,5);expect(end.inside).toBe(3);
 const out={capitulos:chapters(5),de:2,ate:4,sair:true};
 const first=timelineState(0,300,out);expect(first.zoom).toBe(1);expect(first.inside).toBe(2);
 expect(timelineState(299,300,out).zoom).toBe(0);
 let prev=0;for(let f=0;f<300;f+=10){const pos=timelineState(f,300,enter).pos;expect(pos).toBeGreaterThanOrEqual(prev);prev=pos;}
});
test('going back rewinds: the screen darkens first and the camera then moves backwards',()=>{
 const back={capitulos:chapters(6),de:5,ate:1};
 expect(timelineState(15,300,back).dark).toBeGreaterThan(.9);
 expect(timelineState(150,300,back).rewinding).toBe(true);
 expect(timelineState(299,300,back).pos).toBe(1);
 const cues=narrativeEvents('trilhaViva',back,10).map(e=>e.name);expect(cues).toContain('glitch');expect(cues).toContain('whoosh-rapido');
 expect(passageFrames(300,back).map(x=>x.chapter)).toEqual([4,3,2,1]);
 expect(narrativeEvents('trilhaViva',{capitulos:[]},10)).toEqual([]);
});
test('a long timeline only draws the chapters near the camera, and entering fills both formats',()=>{
 for(const V of [false,true]){
  Object.assign(clock,{frame:0,width:V?1080:1920,height:V?1920:1080});
  const props={len:300,capitulos:chapters(40),de:20,ate:21,entrar:true};
  const view=render(<TrilhaViva {...props}/>);
  expect(view.container.querySelectorAll('[data-trail-item]').length).toBeLessThan(8);
  expect(view.container.querySelectorAll('[data-trail-active="true"]')).toHaveLength(1);
  clock.frame=299;view.rerender(<TrilhaViva {...props}/>);
  const world=view.container.querySelector('[data-timeline-world]').style.transform;
  const scale=Number(/scale\(([\d.]+)\)/.exec(world)[1]);expect(scale).toBeGreaterThan(V?1.5:3.9);
  expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/);
  view.unmount();
 }
 Object.assign(clock,{frame:120,width:1920,height:1080});
 const back=render(<TrilhaViva len={300} capitulos={chapters(5)} de={4} ate={1}/>);
 expect(back.container.querySelector('[data-timeline-rewind]')).toBeTruthy();back.unmount();
});
test('character scenes preserve imported PNGs without drawing features',()=>{
 clock.frame=299;
 for(const Component of [PersonagemClose,PensamentoVivo]){
  const screen=render(<PersonagemCtx.Provider value={{poses:{parado:{src:'data:image/png;base64,AA==',w:800,h:1500}}}}><Component len={300} ideias={[{texto:'UMA IDEIA',icone:'raio'}]}/></PersonagemCtx.Provider>);
  expect(screen.container.querySelector('img')).toBeTruthy();expect(screen.getByText('UMA IDEIA')).toBeTruthy();screen.unmount();
 }
});
