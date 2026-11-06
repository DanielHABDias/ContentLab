// Allowlisted server-side cache of CC0 instrument OGGs. This is an audio-asset
// cache, never a backup of application code or JSON projects.
import fs from "node:fs/promises";
import path from "node:path";
import {APP_ROOT} from "./plan.mjs";
const ORIGIN="https://raw.githubusercontent.com/facebookincubator/Meta-open-sound/main/systems/instruments/";
const COLLECTIONS=Object.freeze({
  piano:"meta-piano",steel:"meta-steel-guitar",nylon:"meta-nylon-guitar"
});
const inflight=new Map();
export function sampleOrigin(collection,file){
  if(!Object.hasOwn(COLLECTIONS,collection))
    throw Error("Biblioteca de instrumento inválida.");
  const rule=collection==="piano"
    ?/^INSPiano_Vel0[1-4]_[A-G]s?[0-8]_01\.ogg$/
    :collection==="steel"
      ?/^INSGuitarSteel_String(LowE|A|D|G|B|HighE)_Vel0[1-3]_[A-G]s?[2-6]_01\.ogg$/
      :/^INSGuitarNylon_String(LowE|A|D|G|B|HighE)_Vel0[1-3](Finger|Pick)_[A-G]s?[2-5]_01\.ogg$/;
  if(!rule.test(file))throw Error("Nome de sample não permitido.");
  return ORIGIN+COLLECTIONS[collection]+"/ogg/"+file;
}
export async function instrumentSample(collection,file,opts={}){
  const url=sampleOrigin(collection,file);
  const root=opts.cacheRoot||path.join(APP_ROOT,".contentlab","music-instruments");
  const folder=path.join(root,collection),target=path.join(folder,file);
  try{
    const data=await fs.readFile(target);
    if(data.subarray(0,4).toString()==="OggS")return data;
  }catch(error){if(error.code!=="ENOENT")throw error;}
  if(inflight.has(target))return inflight.get(target);
  const promise=(async()=>{
    let response;
    try{
      response=await (opts.fetch||fetch)(url,{signal:AbortSignal.timeout(20000)});
    }catch(error){throw Error("Falha de rede ao carregar instrumento CC0: "+error.message);}
    if(!response.ok)throw Error("Arquivo CC0 indisponível ("+response.status+"): "+file);
    const declared=Number(response.headers?.get?.("content-length")||0);
    if(declared>12*1024*1024)throw Error("Amostra maior que o limite de 12 MB.");
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<256||bytes.length>12*1024*1024||
      bytes.subarray(0,4).toString()!=="OggS")
      throw Error("Amostra OGG ausente, grande demais ou inválida: "+file);
    await fs.mkdir(folder,{recursive:true});
    await fs.writeFile(target,bytes);
    return bytes;
  })();
  inflight.set(target,promise);
  try{return await promise;}finally{inflight.delete(target);}
}
export function mountMusicSampleRoutes(app){
  app.get("/api/music/sample/:collection/:file",async(req,res)=>{
    try{
      const bytes=await instrumentSample(req.params.collection,req.params.file);
      res.set("Cache-Control","private, max-age=86400");
      res.type("audio/ogg").send(bytes);
    }catch(error){
      const invalid=/não permitido|inválida/.test(error.message);
      res.status(invalid?400:503).json({error:error.message});
    }
  });
}
