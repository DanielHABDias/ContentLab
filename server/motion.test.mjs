import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {clamp01,smoothstep5,easeMotion,motionDuration,motionProgress,motionEnvelope,interpolate} from '../backend/remotion/src/motion.mjs';
import {easedTransitionExpression} from './compose.mjs';
const approx=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('smooth curves start/end exactly, without jumps or overshooting',()=>{
  for(const curve of ['ease_in_out','ease_in','ease_out','linear']){
    approx(easeMotion(0,curve),0);
    approx(easeMotion(1,curve),1);
    let last=0;
    for(let i=1;i<=100;i++){
      const p=easeMotion(i/100,curve);
      assert.ok(p>=last&&p<=1,curve+' monotonic');
      last=p;
    }
  }
  approx(smoothstep5(0.5),.5);
  assert.ok(smoothstep5(.01)<.0001,'soft start without sudden velocity');
  assert.ok(1-smoothstep5(.99)<.0001,'soft stop without sudden velocity');
  approx(clamp01(-7),0);approx(clamp01(4),1);
  approx(interpolate(10,20,.5),15);
});

test('requested 0.1-second motion lasts exactly 0.1 seconds',()=>{
  approx(motionDuration(.1,.8),.1);
  approx(motionProgress(0,.1),0);
  approx(motionProgress(.05,.1),.5);
  approx(motionProgress(.1,.1),1);
  approx(motionProgress(.101,.1),1);
  // No implicit 50 or 60 millisecond minimum: 20ms stays 20ms.
  approx(motionDuration(.02,.8),.02);
  approx(motionProgress(.02,.02),1);
  // When a narrated word is shorter, movement may only use its real window.
  approx(motionDuration(.1,.075),.075);
  approx(motionProgress(.075,.075),1);
  assert.equal(motionProgress(0,0),1,'cut is still instantaneous');
});

test('idle amplitude smoothly reaches zero at both layer boundaries',()=>{
  for(const duration of [.1,.2,2,15]){
    approx(motionEnvelope(0,duration),0);
    approx(motionEnvelope(duration,duration),0);
    assert.ok(motionEnvelope(duration/2,duration)>.99);
    assert.ok(motionEnvelope(.0001,duration)<.01);
    assert.ok(motionEnvelope(duration-.0001,duration)<.01);
  }
});

test('FFmpeg fade/slide/blur expressions finish on final transition frame',()=>{
  for(const fps of [24,30,60]){
    const duration=.1;
    const frames=Math.round(duration*fps);
    const expression=easedTransitionExpression(duration,fps);
    assert.ok(expression.includes('t/'));
    assert.ok(expression.includes(String((frames-1)/fps).slice(0,4)));
    const fade=easedTransitionExpression(duration,fps,'P');
    assert.ok(fade.includes('1-P'));
    assert.ok(fade.includes('/'+(frames-1)));
    // At 30 fps a .1s transition has 3 sampled frames: 0, 0.5, 1.
    const values=Array.from({length:frames},(_,i)=>smoothstep5(i/(frames-1)));
    approx(values[0],0);approx(values.at(-1),1);
    assert.ok(values.every((v,i)=>i===0||v>=values[i-1]));
  }
});

test('all Remotion motion families share the frame-based easing helper',()=>{
  const src=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),
    '..','backend','remotion','src','scene.tsx'),'utf8');
  for(const token of ['motionProgress(elapsed, enterDuration','motionProgress(exitDuration - remaining',
    'motionEnvelope(elapsed, total)','motionDuration(configured, active.end - active.start)',
    'motionProgress(absolute - active.start','highlightTransitionDuration',
    'const travel = motionProgress(elapsed, total)']){
    assert.ok(src.includes(token),token);
  }
  assert.ok(!src.includes('Math.max(0.06, Math.min(configured'));
  assert.ok(!src.includes('Math.max(0.05, Math.min(configured'));
});
