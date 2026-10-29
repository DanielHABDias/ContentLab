import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readAudioTreatmentSettings,writeAudioTreatmentSettings} from './audio-treatment-settings.mjs';

test('configuração do tratamento é local, recuperável e usa padrões quando ausente ou inválida',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contentlab-treatment-preferences-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'config','audio-treatment-settings.json');
  assert.equal(readAudioTreatmentSettings(file),null);
  const settings={voiceTreatmentRecipe:'custom',transcriptionRemoveMiddle:true,
    transcriptionMinSilence:'0.15',transcriptionThreshold:'-24',
    transcriptionReduceBreaths:true,transcriptionBreathStrength:'80',
    voiceEnhancementEngine:'deepfilter',voiceEnhancementMode:'strong',voiceEnhancementStrength:'100'};
  const saved=writeAudioTreatmentSettings(settings,file);
  assert.deepEqual(saved,settings);
  assert.deepEqual(readAudioTreatmentSettings(file),settings);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).version,1);
  assert.deepEqual(fs.readdirSync(path.dirname(file)),['audio-treatment-settings.json']);
  assert.throws(()=>writeAudioTreatmentSettings({transcriptionBreathStrength:'110'},file),/Intensidade/);
  assert.deepEqual(readAudioTreatmentSettings(file),settings,'configuração inválida não destrói a anterior');
  fs.writeFileSync(file,'{não é json}');
  assert.equal(readAudioTreatmentSettings(file),null,'configuração corrompida deve recair nos padrões');
});
