import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {APP_ROOT} from './plan.mjs';

/**
 * Configuração local de integrações. Nunca grave senhas de contas sociais:
 * somente IDs/secrets do aplicativo OAuth e os tokens devolvidos pelo provedor.
 * .env já é ignorado pelo Git; crie-o com acesso restrito ao usuário do SO.
 */
export const ENV_KEYS = Object.freeze([
  'CONTENTLAB_YOUTUBE_CLIENT_ID','CONTENTLAB_YOUTUBE_CLIENT_SECRET',
  'CONTENTLAB_YOUTUBE_ACCESS_TOKEN','CONTENTLAB_YOUTUBE_REFRESH_TOKEN',
  'CONTENTLAB_YOUTUBE_EXPIRES_AT',
  'CONTENTLAB_INSTAGRAM_CLIENT_ID','CONTENTLAB_INSTAGRAM_CLIENT_SECRET',
  'CONTENTLAB_INSTAGRAM_REDIRECT_URI','CONTENTLAB_INSTAGRAM_ACCESS_TOKEN',
  'CONTENTLAB_INSTAGRAM_EXPIRES_AT','CONTENTLAB_INSTAGRAM_ACCOUNT_ID',
  'CONTENTLAB_TIKTOK_CLIENT_KEY','CONTENTLAB_TIKTOK_CLIENT_SECRET',
  'CONTENTLAB_TIKTOK_ACCESS_TOKEN','CONTENTLAB_TIKTOK_REFRESH_TOKEN',
  'CONTENTLAB_TIKTOK_EXPIRES_AT','CONTENTLAB_TIKTOK_SCOPE',
  'CONTENTLAB_TIKTOK_OPEN_ID'
]);

const keyAllowed = (key) => ENV_KEYS.includes(key);
export const envPath = (root=APP_ROOT) => path.join(root,'.env');
const parseValue = (value) => {
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try { return JSON.parse(raw); } catch { return raw.slice(1,-1); }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1,-1);
  return raw.replace(/\s+#.*$/,'').trim();
};
const safeStat = (file) => {
  try {
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink()) throw Error('Arquivo .env inseguro: precisa ser arquivo regular.');
    return info;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
};
export function readSocialEnv(root=APP_ROOT) {
  const file=envPath(root);
  if (!safeStat(file)) return {};
  const values={};
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if(match && keyAllowed(match[1])) values[match[1]]=parseValue(match[2]);
  }
  return values;
}
export function socialValue(key,root=APP_ROOT) {
  if (!keyAllowed(key)) throw Error('Chave de configuração inválida.');
  const stored=readSocialEnv(root);
  return (stored[key]!==undefined ? stored[key] : process.env[key]) || '';
}
export function writeSocialEnv(patch={},root=APP_ROOT) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Configuração inválida.');
  for(const [key,value] of Object.entries(patch)) {
    if (!keyAllowed(key) || typeof value !== 'string' || value.length>8192 || /[\r\n\0]/.test(value))
      throw Error('Campo de configuração inválido.');
  }
  const target=envPath(root);
  const exists=safeStat(target);
  const original=exists ? fs.readFileSync(target,'utf8') :
    '# Content Lab — credenciais locais (não versionar nem compartilhar)\n';
  const lines=original.replace(/\r\n/g,'\n').split('\n');
  const applied=new Set();
  for(let i=0;i<lines.length;i++) {
    const match=lines[i].match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    const key=match?.[1];
    if (key && Object.hasOwn(patch,key)) {
      if(applied.has(key)) {lines[i]='# Chave duplicada removida: '+key;continue;}
      lines[i]=key+'='+JSON.stringify(patch[key]);
      applied.add(key);
    }
  }
  for(const [key,value] of Object.entries(patch)) {
    if(!applied.has(key)) lines.push(key+'='+JSON.stringify(value));
  }
  const newText=lines.join('\n').replace(/\n*$/,'')+'\n';
  const temporary=path.join(root,'.env.'+crypto.randomUUID()+'.tmp');
  try {
    fs.writeFileSync(temporary,newText,{encoding:'utf8',mode:0o600,flag:'wx'});
    fs.chmodSync(temporary,0o600);
    fs.renameSync(temporary,target);
    fs.chmodSync(target,0o600);
  } finally {if(fs.existsSync(temporary))fs.rmSync(temporary,{force:true});}
  return target;
}
export function ensureSocialEnv(root=APP_ROOT) {
  if(!safeStat(envPath(root))) writeSocialEnv({},root);
  return envPath(root);
}
