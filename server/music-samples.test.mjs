import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {sampleOrigin,instrumentSample} from "./music-samples.mjs";

test("metadados de amostras CC0 ficam restritos ao catálogo permitido",()=>{
  assert.match(sampleOrigin("piano","INSPiano_Vel03_C4_01.ogg"),
    /facebookincubator\/Meta-open-sound\/main\/systems\/instruments\/meta-piano/);
  assert.match(sampleOrigin("steel","INSGuitarSteel_StringLowE_Vel03_E2_01.ogg"),
    /meta-steel-guitar\/ogg/);
  assert.match(sampleOrigin("nylon","INSGuitarNylon_StringA_Vel01Finger_C4_01.ogg"),
    /meta-nylon-guitar\/ogg/);
  assert.throws(()=>sampleOrigin("oculus","example.ogg"),/inválida/);
  assert.throws(()=>sampleOrigin("piano","../../.env"),/não permitido/);
  assert.throws(()=>sampleOrigin("steel","INSPiano_Vel03_C4_01.ogg"),/não permitido/);
});
test("amostras reais são armazenadas como cache de áudio, sem cópia de código",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"contentlab-samples-test-"));
  const file="INSPiano_Vel03_C4_01.ogg";
  const sample=Buffer.alloc(1024);sample.write("OggS",0);
  let requests=0;
  try{
    const opts={cacheRoot:root,fetch:async(url)=>{
      requests++;
      assert.ok(url.endsWith(file));
      return {ok:true,headers:{get:()=>String(sample.length)},
        arrayBuffer:async()=>Uint8Array.from(sample).buffer};
    }};
    const a=await instrumentSample("piano",file,opts);
    const b=await instrumentSample("piano",file,opts);
    assert.deepEqual(a,b);
    assert.equal(requests,1,"o arquivo deve ser baixado só uma vez");
    assert.deepEqual(await fs.readFile(path.join(root,"piano",file)),sample);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test("falha ao carregar biblioteca real não deve virar guitarra eletrônica falsa",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"contentlab-sample-error-"));
  try{
    await assert.rejects(()=>instrumentSample("steel",
      "INSGuitarSteel_StringLowE_Vel03_E2_01.ogg",{
        cacheRoot:root,fetch:async()=>({ok:false,status:404})
      }),/indisponível/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
