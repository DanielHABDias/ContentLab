import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './exec.mjs';
import {APP_ROOT} from './plan.mjs';
import {chatterboxTask} from './chatterbox.mjs';

test('Chatterbox adapter rejects unknown models before starting Python',async()=>{
  await assert.rejects(chatterboxTask({model:'../unknown',action:'download'}),/inválido/);
});
test('worker state probes local files only, incomplete checkpoints stay uninstalled',async t=>{
  try{await run('python3',['--version']);}catch{t.skip('Python 3 não disponível');return;}
  const source=`import json, runpy, sys, tempfile, types\nfrom pathlib import Path\nworker=runpy.run_path(sys.argv[1])\nwith tempfile.TemporaryDirectory() as root:\n def snapshot(*args, **kwargs):\n  assert kwargs['local_files_only'] is True\n  assert kwargs['revision']==worker['REVISION']\n  return root\n hub=types.ModuleType('huggingface_hub');hub.snapshot_download=snapshot;sys.modules['huggingface_hub']=hub\n request={'action':'state','model':'chatterbox-multilingual'}\n worker['main'](request)\n for name in worker['FILES']: Path(root,name).write_bytes(b'test fixture')\n worker['main'](request)\n`;
  const {stdout}=await run('python3',['-c',source,APP_ROOT+'/server/chatterbox_worker.py']);
  const events=stdout.trim().split('\n').map(x=>JSON.parse(x));
  assert.equal(events[0].installed,false);assert.equal(events[1].installed,true);
});
test('worker rejects unsupported language before loading dependencies or weights',async t=>{
  try{await run('python3',['--version']);}catch{t.skip('Python 3 não disponível');return;}
  await assert.rejects(run('python3',['-c',"import runpy,sys; runpy.run_path(sys.argv[1])['main']({'action':'generate','model':'chatterbox-multilingual','language':'Chinese'})",APP_ROOT+'/server/chatterbox_worker.py']),/português, inglês ou espanhol/);
});
test('sentence sampling retries premature EOS, bounds failure and forwards expression',async t=>{
  try{await run('python3',['--version']);}catch{t.skip('Python 3 não disponível');return;}
  const source=`import runpy,sys,types,contextlib\nworker=runpy.run_path(sys.argv[1]); sample=worker['sentence_audio']\nseeds=[]\ntorch=types.SimpleNamespace(manual_seed=seeds.append,inference_mode=contextlib.nullcontext)\nnp=types.SimpleNamespace(isfinite=lambda s:types.SimpleNamespace(all=lambda:s.finite))\nclass Wave:\n def __init__(self,n,finite=True): self.n=n;self.finite=finite\n def __len__(self): return self.n\n def detach(self): return self\n def cpu(self): return self\n def numpy(self): return self\n def reshape(self,*args): return self\n def copy(self): return self\nclass Model:\n sr=100\n def __init__(self,values): self.values=iter(values);self.calls=[]\n def generate(self,text,**kw): self.calls.append(kw);return next(self.values)\nrequest=dict(seed=42,language='Portuguese',reference='local.wav',exaggeration=.75,cfgWeight=.3,temperature=.8,topP=.9,repetitionPenalty=1.2)\nmodel=Model([Wave(1),Wave(100)]);result=sample(model,'Uma frase completa',request,0,torch,np)\nassert len(result)==100 and seeds==[42,43] and len(model.calls)==2\nassert model.calls[0]['exaggeration']==.75 and model.calls[0]['cfg_weight']==.3 and model.calls[0]['language_id']=='pt'\nmodel=Model([Wave(100,False),Wave(1),Wave(1)])\ntry: sample(model,'Uma frase completa',request,0,torch,np)\nexcept ValueError: pass\nelse: raise AssertionError('Must reject after three attempts')\nassert len(model.calls)==3\nprint('sampling checks passed')\n`;
  assert.match((await run('python3',['-c',source,APP_ROOT+'/server/chatterbox_worker.py'])).stdout,/sampling checks passed/);
});
test('V3 selection uses native support or exact checkpoint interception, restoring loader on failure',async t=>{
  try{await run('python3',['--version']);}catch{t.skip('Python 3 não disponível');return;}
  const source=`import runpy,sys,types\nfrom pathlib import Path\nload=runpy.run_path(sys.argv[1])['load_multilingual_model']\nroot=Path('/fixture');original=lambda p:str(p)\nmtl=types.SimpleNamespace(load_safetensors=original)\nclass Legacy:\n @staticmethod\n def from_local(local,device): return mtl.load_safetensors(local/'t3_mtl23ls_v2.safetensors')\nmtl.ChatterboxMultilingualTTS=Legacy\nassert load(root,'cpu',mtl)=='/fixture/t3_mtl23ls_v3.safetensors'\nassert mtl.load_safetensors is original\nclass Native:\n @staticmethod\n def from_local(local,device,t3_model=None): return t3_model\nmtl.ChatterboxMultilingualTTS=Native\nassert load(root,'cpu',mtl)=='v3'\nclass Failing:\n @staticmethod\n def from_local(local,device): raise RuntimeError('Invalid checkpoint')\nmtl.ChatterboxMultilingualTTS=Failing\ntry: load(root,'cpu',mtl)\nexcept RuntimeError: pass\nelse: raise AssertionError('No silent fallback')\nassert mtl.load_safetensors is original\nprint('V3 loader checks passed')\n`;
  assert.match((await run('python3',['-c',source,APP_ROOT+'/server/chatterbox_worker.py'])).stdout,/V3 loader checks passed/);
});
