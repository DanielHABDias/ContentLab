import test from 'node:test';
import assert from 'node:assert/strict';
import {clamp01,smootherstep,ease,progress,intervalSeconds,idleEnvelope} from '../backend/remotion/src/motion.mjs';

test('C2 easing is smooth, bounded, monotonic and settles at both ends',()=>{
  assert.equal(smootherstep(-5),0);
  assert.equal(smootherstep(5),1);
  assert.equal(smootherstep(0),0);
  assert.equal(smootherstep(1),1);
  assert.equal(smootherstep(0.5),0.5);
  let previous=-1;
  for(let i=0;i<=100;i++){
    const value=smootherstep(i/100);
    assert.ok(value>=previous && value>=0 && value<=1, 'motion must never reverse or overshoot');
    previous=value;
  }
  const delta=0.001;
  assert.ok(smootherstep(delta)<0.000001,'start velocity/acceleration must settle');
  assert.ok(1-smootherstep(1-delta)<0.000001,'end velocity/acceleration must settle');
  assert.equal(ease(.25,'linear'),.25,'explicitly linear keyframes remain linear');
  assert.ok(ease(.5,'ease_out')>.5);
  assert.ok(ease(.5,'ease_in')<.5);
  assert.equal(clamp01(Infinity),0);
});

test('a fast 0.1s animation retains exactly 0.1s, not forced to 0.18 or 0.06',()=>{
  const duration=intervalSeconds(.1,.4,.18);
  assert.equal(duration,.1);
  assert.equal(progress(-.1,duration),0);
  assert.equal(progress(0,duration),0);
  assert.equal(progress(.05,duration),.5);
  assert.equal(progress(.1,duration),1);
  assert.equal(progress(.11,duration),1);
  assert.equal(intervalSeconds(.01,.4,.18),.01);
  assert.equal(intervalSeconds(.1,.07,.18),.07,'never overrun the word interval');
  assert.equal(progress(.1,.1),1);
  assert.equal(progress(.1,.5),smootherstep(.2),'speed controlled by time, not preset easing');
});

test('idle float/wiggle/pulse envelopes have no abrupt first/last-frame pop',()=>{
  assert.equal(idleEnvelope(0,2),0);
  assert.equal(idleEnvelope(2,2),0);
  assert.ok(idleEnvelope(.001,2)<0.00001);
  assert.equal(idleEnvelope(1,2),1);
  assert.ok(idleEnvelope(1.999,2)<0.00001);
  assert.equal(idleEnvelope(.1,.1),0);
  assert.ok(idleEnvelope(.05,.1)>0);
});
