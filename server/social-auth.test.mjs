import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {envPath,ensureSocialEnv,writeSocialEnv,readSocialEnv,socialValue} from './social-env.mjs';

const sandbox=(fn)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cl-social-config-'));
  try { return fn(root); } finally { fs.rmSync(root,{recursive:true,force:true}); }
};
test('creates ignored local .env without any credentials',()=>sandbox(root=>{
  ensureSocialEnv(root);
  assert.ok(fs.existsSync(envPath(root)));
  assert.deepEqual(readSocialEnv(root),{});
  if(process.platform!=='win32')
    assert.equal(fs.statSync(envPath(root)).mode&0o077,0,'Only owner can read/write .env');
}));
test('writes credentials preserving unrelated keys and comments',()=>sandbox(root=>{
  fs.writeFileSync(envPath(root),'# user comments\nUSER_VARIABLE=test\n');
  writeSocialEnv({CONTENTLAB_YOUTUBE_CLIENT_ID:'my ID',CONTENTLAB_YOUTUBE_CLIENT_SECRET:'my-secret'},root);
  const text=fs.readFileSync(envPath(root),'utf8');
  assert.match(text,/# user comments/);
  assert.match(text,/USER_VARIABLE=test/);
  assert.equal(readSocialEnv(root).CONTENTLAB_YOUTUBE_CLIENT_ID,'my ID');
  assert.equal(socialValue('CONTENTLAB_YOUTUBE_CLIENT_SECRET',root),'my-secret');
  writeSocialEnv({CONTENTLAB_YOUTUBE_CLIENT_ID:'new-app'},root);
  assert.equal(readSocialEnv(root).CONTENTLAB_YOUTUBE_CLIENT_ID,'new-app');
  assert.equal(readSocialEnv(root).CONTENTLAB_YOUTUBE_CLIENT_SECRET,'my-secret');
}));
test('rejects unsafe keys, newlines and symlink credentials',()=>sandbox(root=>{
  assert.throws(()=>writeSocialEnv({EVIL:'x'},root),/inválido/);
  assert.throws(()=>writeSocialEnv({CONTENTLAB_YOUTUBE_CLIENT_SECRET:'a\nb'},root),/inválido/);
  if(process.platform!=='win32'){
    const external=path.join(root,'other');
    fs.writeFileSync(external,'secret');
    fs.symlinkSync(external,envPath(root));
    assert.throws(()=>ensureSocialEnv(root),/inseguro/);
  }
}));
test('stores refresh tokens without leaking into unrelated values',()=>sandbox(root=>{
  const secret='random+=/ :# " token';
  writeSocialEnv({CONTENTLAB_TIKTOK_REFRESH_TOKEN:secret,CONTENTLAB_TIKTOK_EXPIRES_AT:'12345'},root);
  assert.equal(readSocialEnv(root).CONTENTLAB_TIKTOK_REFRESH_TOKEN,secret);
  assert.equal(readSocialEnv(root).CONTENTLAB_TIKTOK_EXPIRES_AT,'12345');
}));
