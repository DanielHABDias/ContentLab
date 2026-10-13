import test from 'node:test';
import assert from 'node:assert/strict';
import {isHardwareEncoderFailure,runRemotionWithEncodingFallback} from './remotion-encoding.mjs';

const gpuCommand=['render','Scene','out.mp4','--codec','h264','--hardware-acceleration=if-possible','--overwrite'];

test('detects the NVENC CUDA failure from the ContentLab render log',()=>{
  assert.equal(isHardwareEncoderFailure(Error('[h264_nvenc @ 0x123] Cannot load libcuda.so.1\nError while opening encoder')),true);
  assert.equal(isHardwareEncoderFailure(Error('Encoder: h264_nvenc, hardware accelerated: true\nError while opening encoder\nConversion failed!')),true);
  assert.equal(isHardwareEncoderFailure(Error('No NVENC capable devices found')),true);
  assert.equal(isHardwareEncoderFailure(Error('Error while compiling custom TSX scene')),false);
  assert.equal(isHardwareEncoderFailure(Error('FFmpeg configured with --enable-encoder=h264_nvenc\nTSX syntax error')),false);
});

test('retries failed GPU encoding once with CPU H.264, preserving other flags',async()=>{
  const attempts=[];let callbacks=0;
  const result=await runRemotionWithEncodingFallback(gpuCommand,{
    hardwareAccel:true,
    execute:async args=>{attempts.push(args);if(attempts.length===1)throw Error('Cannot load libcuda.so.1');return 'rendered';},
    onFallback:()=>{callbacks++;},
  });
  assert.equal(result,'rendered');
  assert.equal(callbacks,1);
  assert.equal(attempts.length,2);
  assert.deepEqual(attempts[0],gpuCommand);
  assert.deepEqual(attempts[1],gpuCommand.map(x=>x==='--hardware-acceleration=if-possible'?'--hardware-acceleration=disable':x));
});

test('never repeats a normal scene error or a CPU-only error',async()=>{
  for(const hardwareAccel of [false,true]){
    const attempts=[];
    const command=hardwareAccel?gpuCommand:['render','--hardware-acceleration=disable'];
    await assert.rejects(()=>runRemotionWithEncodingFallback(command,{
      hardwareAccel,execute:async args=>{attempts.push(args);throw Error(hardwareAccel?'TSX syntax error':'Cannot load libcuda.so.1');},
    }),/TSX syntax error|Cannot load libcuda/);
    assert.equal(attempts.length,1);
  }
});

test('does not retry canceled GPU rendering',async()=>{
  const signal={aborted:true};let attempts=0;
  await assert.rejects(()=>runRemotionWithEncodingFallback(gpuCommand,{
    signal,hardwareAccel:true,execute:async()=>{attempts++;throw Error('Cannot load libcuda.so.1');},
  }),/Cannot load libcuda/);
  assert.equal(attempts,1);
});

test('does not swallow errors from software fallback or retry repeatedly',async()=>{
  let attempts=0;
  await assert.rejects(()=>runRemotionWithEncodingFallback(gpuCommand,{
    hardwareAccel:true,execute:async()=>{attempts++;throw Error(attempts===1?'Cannot load libcuda.so.1':'CPU encode failed');},
  }),/CPU encode failed/);
  assert.equal(attempts,2);
});
