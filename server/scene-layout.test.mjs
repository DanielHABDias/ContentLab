import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {elementDimensions,mediaDefaultsToFullFrame} from '../backend/remotion/src/layout.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('image and video without cells occupy the full frame by default',()=>{
  for(const type of ['image','video']){
    assert.equal(mediaDefaultsToFullFrame(type,undefined),true);
    assert.deepEqual(elementDimensions({type,cells:undefined,regionWidth:1920,regionHeight:1080,frameWidth:1920,frameHeight:1080}),{width:1920,height:1080});
  }
});

test('explicit cells preserve intentional media regions and other layers keep their legacy box',()=>{
  assert.deepEqual(elementDimensions({type:'image',cells:[2,5,8],regionWidth:640,regionHeight:1080,frameWidth:1920,frameHeight:1080}),{width:640,height:1080});
  assert.deepEqual(elementDimensions({type:'text',cells:undefined,regionWidth:1920,regionHeight:1080,frameWidth:1920,frameHeight:1080}),{width:1536,height:864});
});

test('the visual editor creates image and video layers full-frame with cover',()=>{
  const source=fs.readFileSync(path.join(root,'frontend/static/visual_editor.js'),'utf8');
  assert.doesNotMatch(source,/if\(type==='image'\)element\.cells=/);
  assert.match(source,/if\(\['image','video'\]\.includes\(type\)\)element\.fit='cover'/);
});
