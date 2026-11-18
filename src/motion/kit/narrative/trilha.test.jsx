// @vitest-environment jsdom
import React from 'react';
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
const clock=vi.hoisted(()=>({frame:0,width:1920,height:1080}));
vi.mock('remotion',async original=>({...await original(),Img:(props)=><img {...props}/>,Sequence:({children})=>children,Freeze:({children})=>children,useCurrentFrame:()=>clock.frame,useVideoConfig:()=>({...clock,fps:30,durationInFrames:300})}));
import {trailSchedule,trailState,trailGeometry} from './trilha';
import {TrilhaViva} from './TrilhaViva';
import {RasgoCena} from './RasgoCena';
import {PersonagemClose,PensamentoVivo} from './PersonagemIdeias';
import {PersonagemCtx} from '../Personagem';
import {narrativeEvents} from './events';
afterEach(cleanup);
test('timeline freezes previous clips at the last played frame and starts the next from zero',()=>{
 const schedule=trailSchedule(300,3);
 for(let i=0;i<3;i++){
  let state=trailState(schedule[i].start,300,3);expect(state.active).toBe(i);expect(state.elapsed(i)).toBe(0);
  if(i){const last=state.elapsed(i-1);state=trailState(299,300,3);expect(state.elapsed(i-1)).toBe(last);}
 }
 const state=trailState(299,300,3);expect(state.elapsed(2)).toBe(71);
 expect(narrativeEvents('trilhaViva',{fragmentos:[{},{},{}]},10).filter(e=>e.name==='camera').map(e=>Math.round(e.at*30))).toEqual(schedule.map(x=>x.start));
 expect(narrativeEvents('trilhaViva',{fragmentos:[]},10)).toEqual([]);
});
test('the colored path advances monotonically along the winding curve',()=>{
 let prev=-1;for(let t=0;t<=1;t+=.025){const g=trailGeometry(1600,500,t);expect(g.progress).toBeGreaterThan(prev);expect(g.path).not.toMatch(/NaN|Infinity/);prev=g.progress;}
});
test('one timeline fragment is colored at a time and the last fills both canvas formats',()=>{
 for(const V of [false,true]){
  Object.assign(clock,{frame:150,width:V?1080:1920,height:V?1920:1080});
  const props={len:300,fragmentos:[{titulo:'A',midia:'media:a'},{titulo:'B',midia:'media:b'},{titulo:'C',midia:'media:c'}]};
  const view=render(<TrilhaViva {...props}/>);expect(view.container.querySelectorAll('[data-trail-active="true"]')).toHaveLength(1);
  clock.frame=299;view.rerender(<TrilhaViva {...props}/>);const last=view.container.querySelector('[data-trail-item="2"]');expect(last.style.width).toBe(`${clock.width}px`);expect(last.style.left).toBe('0px');expect(last.style.filter).toBe('none');view.unmount();
 }
});
test('the reveal completes and character scenes preserve imported PNGs without drawing features',()=>{
 clock.frame=299;const view=render(<RasgoCena len={300} antes="a" depois="b"/>);expect(view.container.querySelector('[data-reveal-progress]').style.clipPath).toBe('none');view.unmount();
 for(const Component of [PersonagemClose,PensamentoVivo]){
  const screen=render(<PersonagemCtx.Provider value={{poses:{parado:{src:'data:image/png;base64,AA==',w:800,h:1500}}}}><Component len={300} ideias={[{texto:'UMA IDEIA',icone:'raio'}]}/></PersonagemCtx.Provider>);
  expect(screen.container.querySelector('img')).toBeTruthy();expect(screen.getByText('UMA IDEIA')).toBeTruthy();screen.unmount();
 }
});
