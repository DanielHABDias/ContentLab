import fs from 'node:fs';
import {run} from './exec.mjs';

const fmt=n=>Number(n).toFixed(6);
const musicPresets={subtle:-22,normal:-18,present:-12,music_only:-6};
const mediaPresets={subtle:-12,normal:-6,strong:0};

export async function prepareNarration(input,output,settings,{ffmpeg='ffmpeg',signal}={}){
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
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-filter_complex',filters.join(';'),
    '-map','[clean]','-c:a','pcm_s16le',output],{signal});
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('Narração limpa não foi criada.');
  if(cuts.length){
    // PCM 16-bit stereo at 48 kHz: 192,000 bytes per second (+ WAV header).
    const actual=(fs.statSync(output).size-44)/192000;
    const expected=cuts.reduce((n,x)=>n+x.end-x.start,0);
    if(Math.abs(actual-expected)>0.08)throw Error('sourceCuts produziram narração incompleta.');
  }
  return output;
}
export async function mixAudio(visual,cleaned,plan,resolvedAssets,output,duration,{ffmpeg='ffmpeg',signal}={}){
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
        queue.push({item,type:'sfx',start,end:Math.min(duration,start+(item.config?.duration??10)),
          file:resolvedAssets[item.asset],loop:false});
      }else if(['video','overlay'].includes(item.type)&&item.muted===false&&item.asset){
        queue.push({item,type:item.type,start:item.start??scene.start,end:item.end??scene.end,
          file:resolvedAssets[item.asset],loop:!!item.loop});
      }
    }
  }
  let index=2;
  for(const {item,type,start,end,file,loop} of queue){
    if(!file||!(end>start)||start>=duration)continue;
    const length=Math.min(duration,end)-start;
    if(loop)args.push('-stream_loop','-1');
    args.push('-i',file);
    const conf=item.config||{},preset=item.preset??conf.preset??'normal';
    const presetValues=type==='music'?musicPresets:mediaPresets;
    const gain=Number(item.trimDb??conf.trimDb??presetValues[preset]??presetValues.normal);
    const fadeIn=Math.min(length,Number(item.fadeIn??conf.fadeIn??0));
    const fadeOut=Math.min(length,Number(item.fadeOut??conf.fadeOut??0));
    const filters=['atrim=end='+fmt(length),'asetpts=PTS-STARTPTS',
      'loudnorm=I=-16:TP=-1.5:LRA=11','aresample=48000',
      'aformat=sample_rates=48000:channel_layouts=stereo','volume='+gain+'dB'];
    if(fadeIn>0)filters.push('afade=t=in:st=0:d='+fmt(fadeIn));
    if(fadeOut>0)filters.push('afade=t=out:st='+fmt(length-fadeOut)+':d='+fmt(fadeOut));
    filters.push('adelay='+Math.round(start*1000)+':all=1','apad','atrim=end='+fmt(duration));
    const label='audio'+index;
    graph.push('['+index+':a]'+filters.join(',')+'['+label+']');
    (type==='music'?musicLabels:effectLabels).push('['+label+']');
    layers.push({type,asset:item.asset,start,end:Math.min(end,duration),
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
