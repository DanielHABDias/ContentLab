import test from 'node:test';
import assert from 'node:assert/strict';
import {remotionCliRenderOptions} from './remotion.mjs';

test('Remotion renders frames before encoding by default to avoid broken pipes',()=>{
  const flags=remotionCliRenderOptions({});
  assert.ok(flags.includes('--disallow-parallel-encoding'));
  assert.deepEqual(flags.slice(0,2),['--log','info']);
});

test('explicit opt-in allows parallel encoding and verbose diagnostics',()=>{
  const flags=remotionCliRenderOptions({
    CONTENTLAB_REMOTION_PARALLEL_ENCODING:'1',
    CONTENTLAB_REMOTION_DEBUG:'1',
  });
  assert.ok(!flags.includes('--disallow-parallel-encoding'));
  assert.deepEqual(flags,['--log','verbose']);
});

test('only exact opt-in enables parallel encoding',()=>{
  assert.ok(remotionCliRenderOptions({CONTENTLAB_REMOTION_PARALLEL_ENCODING:'false'})
    .includes('--disallow-parallel-encoding'));
});
