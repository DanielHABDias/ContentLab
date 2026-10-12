import fs from 'node:fs';
import {run} from './exec.mjs';

const fmt=n=>Number(n).toFixed(6);
const musicPresets={subtle:-22,normal:-18,present:-12,music_only:-6};
const mediaPresets={subtle:-12,normal:-6,strong:0};
// Silencedetect recognizes silence *at the edges*. Internal pauses are intentionally preserved.
export function edgeSilenceBounds(log,duration,{padding=0.008}={}){
  const starts=[...log.matchAll(/silence_start:\s*([\d.]+)/g)].map(x=>Number(x[1]));
  const ends=[...log.matchAll(/silence_end:\s*([\d.]+)/g)].map(x=>Number(x[1]));
  if(!Number.isFinite(duration)||duration<=0)return {start:0,end:0,empty:true};
  let start=0,end=duration;
  if(starts.length&&starts[0]<=0.03&&ends.length)start=Math.min(duration,Math.max(0,ends[0]-padding));
  const lastStart=starts.at(-1),lastEnd=ends.at(-1);
  if(Number.isFinite(lastStart)&&Number.isFinite(lastEnd)&&lastEnd>=duration-0.08)
    end=Math.min(duration,Math.max(0,lastStart+padding));
  if(end<=start+0.005)return {start:0,end:0,empty:true};
  return {start:Number(start.toFixed(6)),end:Number(end.toFixed(6)),empty:false};
}
export async function probeAudioDuration(file,{ffprobe='ffprobe',signal}={}){
  const r=await run(ffprobe,['-v','error','-show_entries','format=duration','-of','json',file],{signal});
  const duration=Number(JSON.parse(r.stdout).format?.duration);
  if(!Number.isFinite(duration)||duration<=0)throw Error('Duração de áudio inválida: '+file);
  return duration;
}
export async function measureSfxEdges(file,{ffmpeg='ffmpeg',ffprobe='ffprobe',signal}={}){
  const duration=await probeAudioDuration(file,{ffprobe,signal});
  const {stderr}=await run(ffmpeg,['-hide_banner','-nostats','-loglevel','info','-i',file,
    '-vn','-af','silencedetect=noise=-50dB:d=0.04','-f','null','-'],{signal});
  return {...edgeSilenceBounds(stderr,duration),duration};
}
// Each insertion is at an absolute position on the *resulting* narration timeline.
export function silenceSourcePositions(inserts=[]){
  let accumulated=0,lastAt=-1;
  return [...inserts].sort((a,b)=>a.at-b.at).map(({at,duration})=>{
    if(!(Number.isFinite(at)&&Number.isFinite(duration)&&at>=0&&duration>0&&at>=lastAt))
      throw Error('Intervalo de silêncio da narração inválido.');
    const sourceAt=at-accumulated;
    if(sourceAt<0)throw Error('Silêncios da narração não podem se sobrepor.');
    lastAt=at+duration;accumulated+=duration;
    return {at,duration,sourceAt};
  });
}


export async function prepareNarration(input,output,settings,{ffmpeg='ffmpeg',signal,duration}={}){
  const cuts=settings.sourceCuts||[],voice=settings.voice||{},filters=[];
  if(cuts.length){
    cuts.forEach((cut,i)=>filters.push('[0:a]atrim=start='+fmt(cut.start)+':end='+fmt(cut.end)+',asetpts=PTS-STARTPTS[c'+i+']'));
    filters.push(cuts.map((_,i)=>'[c'+i+']').join('')+'concat=n='+cuts.length+':v=0:a=1[cut]');
  }else filters.push('[0:a]asetpts=PTS-STARTPTS[cut]');
  const processFilters=[];
  if((voice.highpassHz??70)>0)processFilters.push('highpass=f='+Number(voice.highpassHz??70));
  if(voice.normalize!==false)processFilters.push('loudnorm=I='+Number(voice.targetLufs??-16)+':TP='+Number(voice.truePeakDb??-1.5)+':LRA=11');
  processFilters.push('aresample=48000','aformat=sample_rates=48000:channel_layouts=stereo');
  filters.push('[cut]'+processFilters.join(',')+'[clean]');
  const inserts=silenceSourcePositions(settings.silenceInserts||[]);
  let outputLabel='clean';
  if(inserts.length){
    const remaining=duration===undefined?undefined:duration-inserts.reduce((n,x)=>n+x.duration,0);
    if(remaining!==undefined&&remaining<0)throw Error('Silêncio inserido ultrapassa duração do vídeo.');
    // Split a normalized source timeline. Silence is *inserted*, not substituted.
    // Only boundary gaps are added; pauses inside words/clips are unaffected.
    const base=remaining===undefined?'anull':'apad,atrim=end='+fmt(Math.max(0.001,remaining));
    const segmentCount=inserts.length+1;
    const channels=Array.from({length:segmentCount},(_,i)=>'[seg'+i+']').join('');
    filters.push('[clean]'+base+',asplit='+segmentCount+channels);
    const parts=[];let previous=0;
    for(let i=0;i<inserts.length;i++){
      const item=inserts[i];
      if(item.sourceAt<previous)throw Error('Silêncios da narração em ordem inválida.');
      filters.push('[seg'+i+']atrim=start='+fmt(previous)+':end='+fmt(item.sourceAt)+',asetpts=PTS-STARTPTS[part'+i+']');
      filters.push('anullsrc=r=48000:cl=stereo:d='+fmt(item.duration)+'[silence'+i+']');
      parts.push('[part'+i+']','[silence'+i+']');
      previous=item.sourceAt;
    }
    filters.push('[seg'+inserts.length+']atrim=start='+fmt(previous)+',asetpts=PTS-STARTPTS[tail]');
    parts.push('[tail]');
    filters.push(parts.join('')+'concat=n='+parts.length+':v=0:a=1[aligned]');
    outputLabel='aligned';
  }
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-filter_complex',filters.join(';'),
    '-map','['+outputLabel+']','-c:a','pcm_s16le',output],{signal});
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('Narração limpa não foi criada.');
  if(cuts.length&&!inserts.length){
    const actual=(fs.statSync(output).size-44)/192000;
    const expected=cuts.reduce((n,x)=>n+x.end-x.start,0);
    if(Math.abs(actual-expected)>0.08)throw Error('sourceCuts produziram narração incompleta.');
  }
  return output;
}
export async function mixAudio(visual,cleaned,plan,resolvedAssets,output,duration,{ffmpeg='ffmpeg',ffprobe='ffprobe',signal}={}){
  const args=['-hide_banner','-loglevel','error','-y','-i',visual,'-i',cleaned];
  const graph=['[1:a]apad,atrim=end='+fmt(duration)+',asetpts=PTS-STARTPTS,volume='+Number(plan.audio.voice?.trimDb??0)+'dB[voice]'];
  const musicLabels=[],effectLabels=[],layers=[];
  const queue=[];
  for(const m of plan.audio.music||[])queue.push({item:m,type:'music',start:m.start,end:m.end,
    file:resolvedAssets[m.asset],loop:true});
  for(const scene of plan.timeline){
    if(scene.background?.asset&&scene.background.muted===false&&/\.(mp4|mov|mkv|webm)$/i.test(scene.background.asset)){
      queue.push({item:scene.background,type:'background',start:scene.start,end:scene.end,
        file:resolvedAssets[scene.background.asset],loop:!!scene.background.loop});
    }
    for(const item of scene.elements||[]){
      if(item.type==='sfx'&&item.asset){
        const start=item.at??item.start??scene.start;
        queue.push({item,type:'sfx',start,end:Math.min(duration,start+(item.config?.duration??duration)),
          file:resolvedAssets[item.asset],loop:false});
      }else if(['video','overlay'].includes(item.type)&&item.muted===false&&item.asset){
        queue.push({item,type:item.type,start:item.start??scene.start,end:item.end??scene.end,
          file:resolvedAssets[item.asset],loop:!!item.loop});
      }
    }
  }
  let index=2;
  const measured=new Map();
  for(const {item,type,start,end,file,loop} of queue){
    if(!file||!(end>start)||start>=duration)continue;
    const length=Math.min(duration,end)-start;
    let edges=null;
    if(type==='sfx'){
      if(!measured.has(file))measured.set(file,await measureSfxEdges(file,{ffmpeg,ffprobe,signal}));
      edges=measured.get(file);
      if(edges.empty)continue;
    }
    const audibleLength=edges?Math.min(length,edges.end-edges.start):length;
    if(loop)args.push('-stream_loop','-1');
    args.push('-i',file);
    const conf=item.config||{},preset=item.preset??conf.preset??'normal';
    const presetValues=type==='music'?musicPresets:mediaPresets;
    const gain=Number(item.trimDb??conf.trimDb??presetValues[preset]??presetValues.normal);
    const fadeIn=Math.min(audibleLength,Number(item.fadeIn??conf.fadeIn??0));
    const fadeOut=Math.min(audibleLength,Number(item.fadeOut??conf.fadeOut??0));
    const filters=['atrim=start='+fmt(edges?.start??0)+':end='+fmt(edges?edges.start+audibleLength:audibleLength),'asetpts=PTS-STARTPTS',
      'loudnorm=I=-16:TP=-1.5:LRA=11','aresample=48000',
      'aformat=sample_rates=48000:channel_layouts=stereo','volume='+gain+'dB'];
    if(fadeIn>0)filters.push('afade=t=in:st=0:d='+fmt(fadeIn));
    if(fadeOut>0)filters.push('afade=t=out:st='+fmt(audibleLength-fadeOut)+':d='+fmt(fadeOut));
    filters.push('adelay='+Math.round(start*1000)+':all=1','apad','atrim=end='+fmt(duration));
    const label='audio'+index;
    graph.push('['+index+':a]'+filters.join(',')+'['+label+']');
    (type==='music'?musicLabels:effectLabels).push('['+label+']');
    layers.push({type,asset:item.asset,start,end:Math.min(start+audibleLength,duration),
      edgeTrim:edges?{start:edges.start,end:Math.max(0,edges.duration-edges.end)}:null,
      trimDb:gain,preset,fadeIn,fadeOut,loop,normalized:true});
    index++;
  }
  let mixLabels=['[voice]'];
  if(musicLabels.length){
    if(musicLabels.length===1)graph.push(musicLabels[0]+'anull[musicbed]');
    else graph.push(musicLabels.join('')+'amix=inputs='+musicLabels.length+':duration=longest:normalize=0[musicbed]');
    const duck=plan.audio.ducking||{};
    if(duck.enabled!==false){
      graph.push('[voice]asplit=2[voice_mix][voice_side]');
      graph.push('[musicbed][voice_side]sidechaincompress=threshold='+Number(duck.threshold??.02)+
        ':ratio='+Number(duck.ratio??6)+':attack='+Number(duck.attackMs??40)+
        ':release='+Number(duck.releaseMs??350)+'[ducked]');
      mixLabels=['[voice_mix]','[ducked]'];
    }else mixLabels.push('[musicbed]');
  }
  mixLabels.push(...effectLabels);
  graph.push(mixLabels.join('')+'amix=inputs='+mixLabels.length+
    ':duration=longest:normalize=0,alimiter=limit=0.95,atrim=end='+fmt(duration)+'[mixed]');
  args.push('-filter_complex',graph.join(';'),'-map','0:v:0','-map','[mixed]',
    '-c:v','copy','-c:a','aac','-b:a','192k','-t',fmt(duration),
    '-movflags','+faststart',output);
  await run(ffmpeg,args,{signal});
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('MP4 final não foi criado.');
  return layers;
}
export async function probeOutput(file,{ffprobe='ffprobe',signal}={}){
  const {stdout}=await run(ffprobe,['-v','error','-show_entries',
    'stream=codec_type,duration,codec_name:format=duration','-of','json',file],{signal});
  const obj=JSON.parse(stdout);
  const video=obj.streams?.find(x=>x.codec_type==='video'),audio=obj.streams?.find(x=>x.codec_type==='audio');
  if(!video||!audio)throw Error('Saída sem vídeo ou áudio.');
  return {videoDuration:Number(video.duration||obj.format?.duration),
    audioDuration:Number(audio.duration||obj.format?.duration),
    videoCodec:video.codec_name,audioCodec:audio.codec_name};
}
