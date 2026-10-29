import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// As preferências são pessoais desta instalação, nunca arquivos do projeto ou do Git.
export const AUDIO_TREATMENT_SETTINGS_FILE=path.join(os.homedir(),'.contentlab','audio-treatment-settings.json');
const checkboxes=new Set(['transcriptionTrimEdges','transcriptionRemoveMiddle','transcriptionNormalize','transcriptionCompression','transcriptionDeesser','transcriptionReduceBreaths']);
const selections={
  voiceTreatmentRecipe:['custom','preserve','balanced','strong'],
  transcriptionMinSilence:['0.15','0.2','0.35','0.5','0.7','1','1.4'],
  transcriptionThreshold:['-48','-42','-36','-30','-24'],
  transcriptionTargetLufs:['-16','-18','-14'],
  transcriptionHighpass:['70','0','90'],
  transcriptionVoicePreset:['original','warm','gentle','balanced','deep'],
  voiceEnhancementEngine:['off','deepfilter'],
  voiceEnhancementMode:['natural','strong']
};
function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Preferências de áudio inválidas.');
  const controls={};
  for(const [key,value] of Object.entries(input)){
    if(checkboxes.has(key)){
      if(typeof value!=='boolean')throw Error('Preferência booleana inválida: '+key);
      controls[key]=value;
    }else if(Object.hasOwn(selections,key)){
      if(typeof value!=='string'||!selections[key].includes(value))throw Error('Preferência de seleção inválida: '+key);
      controls[key]=value;
    }else if(['transcriptionBreathStrength','voiceEnhancementStrength'].includes(key)){
      const num=Number(value);
      if(typeof value!=='string'||!Number.isFinite(num)||num<0||num>100||value.length>6)
        throw Error('Intensidade de áudio inválida: '+key);
      controls[key]=value;
    }
  }
  if(!Object.keys(controls).length)throw Error('Nenhuma preferência de áudio foi informada.');
  return controls;
}
export function readAudioTreatmentSettings(file=AUDIO_TREATMENT_SETTINGS_FILE){
  try{
    if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())return null;
    const raw=fs.readFileSync(file,'utf8');
    if(raw.length>8192)return null;
    const data=JSON.parse(raw);
    return data?.version===1?validate(data.controls):null;
  }catch{return null;}
}
export function writeAudioTreatmentSettings(raw,file=AUDIO_TREATMENT_SETTINGS_FILE){
  if(typeof raw==='string'&&raw.length>8192)throw Error('Preferências de áudio muito grandes.');
  const controls=validate(typeof raw==='string'?JSON.parse(raw):raw);
  const folder=path.dirname(file);
  fs.mkdirSync(folder,{recursive:true,mode:0o700});
  if(fs.lstatSync(folder).isSymbolicLink())throw Error('Pasta das preferências não pode ser link simbólico.');
  const staged=file+'.next-'+crypto.randomUUID();
  try{
    fs.writeFileSync(staged,JSON.stringify({version:1,controls},null,2)+'\n',{flag:'wx',mode:0o600});
    fs.renameSync(staged,file);
  }finally{fs.rmSync(staged,{force:true});}
  return controls;
}
