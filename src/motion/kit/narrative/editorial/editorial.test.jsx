// @vitest-environment jsdom
import React from 'react';
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
const clock=vi.hoisted(()=>({frame:0,width:1920,height:1080}));
vi.mock('remotion',async original=>({...await original(),Img:props=><img {...props}/>,OffthreadVideo:({src,muted})=><video src={src} muted={muted}/>,Sequence:({children,from})=><div data-from={from}>{children}</div>,Freeze:({children,frame})=><div data-frozen-frame={frame}>{children}</div>,useCurrentFrame:()=>clock.frame,useVideoConfig:()=>({...clock,fps:30,durationInFrames:300})}));
import {EDITORIAL_SCENES} from './index';
import {pauseFrame,recallState,reactionState} from './timing';
import {Source} from './media';
import {Assets} from '../../stage';
import {PersonagemCtx} from '../../Personagem';
import catalog from '../../catalog.json';
import {narrativeEvents} from '../events';
afterEach(cleanup);
test('annotation and recall hold the source and resume without skipping a frame',()=>{
 for(const fn of [pauseFrame,recallState])for(const len of [120,300]){
  const {start,end}=fn(0,len);expect(fn(start-1,len).frame).toBe(start-1);expect(fn(start,len).frame).toBe(start);expect(fn(end-1,len).frame).toBe(start);expect(fn(end,len).frame).toBe(start);expect(fn(end+1,len).frame).toBe(start+1);
 }
});
test('reaction appears and disappears by cut and swaps PNG exactly once',()=>{
 const state=reactionState(0,300);expect(reactionState(state.start-1,300).visible).toBe(false);expect(reactionState(state.start,300).visible).toBe(true);expect(reactionState(state.swap-1,300).index).toBe(0);expect(reactionState(state.swap,300).index).toBe(1);expect(reactionState(state.end,300).visible).toBe(false);
 const cues=narrativeEvents('personagemReacao',{},10,30);expect(Math.round(cues[0].at*30)).toBe(state.start);expect(Math.round(cues[1].at*30)).toBe(state.swap);
});
test('media outside its interval freezes at a real source frame and all video stays muted',()=>{
 const props={item:{midia:'media:sample',inicio:5},len:300,from:60,until:120};
 const wrap=()=> <Assets.Provider value={{sample:{src:'sample.mp4',kind:'video'}}}><Source {...props}/></Assets.Provider>;
 clock.frame=30;const view=render(wrap());expect(view.container.querySelector('[data-frozen-frame]').dataset.frozenFrame).toBe('0');
 clock.frame=90;view.rerender(wrap());expect(view.container.querySelector('[data-from]').dataset.from).toBe('60');expect(view.container.querySelector('video').muted).toBe(true);
 clock.frame=200;view.rerender(wrap());expect(view.container.querySelector('[data-frozen-frame]').dataset.frozenFrame).toBe('59');
});
test('all sixteen scenes render finite layouts before, during and after transitions in both formats',()=>{
 expect(Object.keys(EDITORIAL_SCENES)).toHaveLength(16);
 for(const V of [false,true])for(const frame of [0,150,299])for(const [id,Scene] of Object.entries(EDITORIAL_SCENES)){
  Object.assign(clock,{frame,width:V?1080:1920,height:V?1920:1080});
  const view=render(<PersonagemCtx.Provider value={{poses:{parado:{src:'pose.png',w:800,h:1500}}}}><Scene len={300} {...catalog.cenas[id].exemplo}/></PersonagemCtx.Provider>);
  expect(view.container.innerHTML,id).not.toMatch(/NaN|Infinity/);view.unmount();
 }
});
test('sequential strips have one active source and reaction is absent outside its window',()=>{
 const Strips=EDITORIAL_SCENES.faixasSequenciais;clock.frame=150;
 const view=render(<Strips len={300} {...catalog.cenas.faixasSequenciais.exemplo}/>);expect(view.container.querySelectorAll('[data-editorial-active="true"]')).toHaveLength(1);view.unmount();
 const Reaction=EDITORIAL_SCENES.personagemReacao;clock.frame=0;
 const wrapper=()=> <PersonagemCtx.Provider value={{poses:{parado:'pose.png'}}}><Reaction len={300} {...catalog.cenas.personagemReacao.exemplo}/></PersonagemCtx.Provider>;
 const screen=render(wrapper());expect(screen.container.querySelector('[data-editorial-reaction]')).toBeNull();clock.frame=150;screen.rerender(wrapper());expect(screen.container.querySelector('[data-editorial-reaction]')).toBeTruthy();
});
