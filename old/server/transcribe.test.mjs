import test from 'node:test';
import assert from 'node:assert/strict';
import {transcriptTextLines,transcribeAudio} from './transcribe.mjs';

test('word mode shows one timestamped entry per word with real boundaries',()=>{
  const source={
    segments:[{start:0.17,end:1.4,text:'Você sabe Batman?'}],
    words:[{word:'Você',start:.17,end:.28},{word:'sabe',start:.28,end:.67},
      {word:'Batman?',start:.89,end:1.4}]
  };
  assert.deepEqual(transcriptTextLines(source,'words'),[
    '[0.17 → 0.28] Você','[0.28 → 0.67] sabe','[0.89 → 1.40] Batman?'
  ]);
  assert.deepEqual(transcriptTextLines(source,'segments'),[
    '[0.17 → 1.40] Você sabe Batman?'
  ]);
  assert.throws(()=>transcriptTextLines(source,'sentences'),/Detalhamento/);
  assert.deepEqual(source.words[2],{word:'Batman?',start:.89,end:1.4},
    'Text formatting must never change canonical word timestamps');
});

test('invalid text detail is rejected before audio processing',async()=>{
  await assert.rejects(()=>transcribeAudio('missing.wav','/tmp',{
    detail:'incorrect'
  }),/Detalhamento da transcrição inválido/);
});
