import fs from 'node:fs';
import path from 'node:path';
import {run} from './exec.mjs';

const n=value=>Number(value||0);
const decimal=value=>Number(value).toFixed(6);
function audioFilter(settings){
  const voice=settings.voice||{},filters=[];
  if((voice.highpassHz??70)>0)filters.push('highpass=f='+Number(voice.highpassHz??70));
  if(voice.normalize!==false)filters.push('loudnorm=I='+Number(voice.targetLufs??-16)+':TP='+Number(voice.truePeakDb??-1.5)+':LRA=11');
  if(voice.trimDb)filters.push('volume='+Number(voice.trimDb)+'dB');
  return filters;
}
export async function prepareNarration(input,output,settings,{ffmpeg='ffmpeg',signal}={}){
  const cuts=settings.sourceCuts||[],filters=[];
  if(cuts.length){
    for(let i=0;i<cuts.length;i++)filters.push('[0:a]atrim=start='+decimal(cuts[i].start)+':end='+decimal(cuts[i].end)+',asetpts=PTS-STARTPTS[c'+i+']');
    filters.push(cuts.map((_,i)=>'[c'+i+']').join('')+'concat=n='+cuts.length+':v=0:a=1[cut]');
  }else filters.push('[0:a]asetpts=PTS-STARTPTS[cut]');
  filters.push('[cut]'+[...audioFilter(settings),'aresample=48000','aformat=sample_rates=48000:channel_layouts=stereo'].join(',')+'[clean]');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-filter_complex',filters.join(';'),
    '-map','[clean]','-c:a','pcm_s16le',output],{signal});
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('Narração limpa não foi criada.');
  return output;
}
export async function mixAudio(visual,cleaned,plan,resolvedAssets,output,duration,{ffmpeg='ffmpeg',signal}={}){
  const args=['-hide_banner','-loglevel','error','-y','-i',visual,'-i',cleaned];
  const graph=['[1:a]apad,atrim=end='+decimal(duration)+',asetpts=PTS-STARTPTS[voice]'];
  const mixLabels=['[voice]'],layers=[];
  let sourceIndex=2;
  const queue=[];
  for(const m of plan.audio.music||[])queue.push({type:'music',start:m.start,end:m.end,
    path:resolvedAssets[m.asset],...m,loop:true});
  for(const scene of plan.timeline){
    if(scene.background?.asset&&scene.background.muted===false&&/\.(mp4|mov|mkv|webm)$/i.test(scene.background.asset)){
      queue.push({...scene.background,type:'background-audio',start:scene.start,end:scene.end,
        path:resolvedAssets[scene.background.asset]});
    }
    for(const item of scene.elements||[]){
      if(item.type==='sfx'&&item.asset){
        const start=item.at??item.start??scene.start;
        queue.push({...item.config,type:'sfx',start,end:Math.min(duration,start+(item.config?.duration??1.0)),
          path:resolvedAssets[item.asset],loop:false});
      }else if(['video','overlay'].includes(item.type)&&item.muted===false&&item.asset){
        queue.push({...item,type:'media-audio',start:item.start??scene.start,end:item.end??scene.end,
          path:resolvedAssets[item.asset],loop:!!item.loop});
      }
    }
  }
  for(const layer of queue){
    if(!layer.path||!(layer.end>layer.start))continue;
    const index=sourceIndex++;
    if(layer.loop)args.push('-stream_loop','-1');
    args.push('-i',layer.path);
    const clipDuration=Math.max(0,layer.end-layer.start),delay=Math.max(0,Math.round(layer.start*1000));
    const filters=['atrim=end='+decimal(clipDuration),'asetpts=PTS-STARTPTS'];
    if(layer.trimDb)filters.push('volume='+Number(layer.trimDb)+'dB');
    if(layer.fadeIn>0)filters.push('afade=t=in:st=0:d='+Math.min(clipDuration,Number(layer.fadeIn)));
    if(layer.fadeOut>0)filters.push('afade=t=out:st='+Math.max(0,clipDuration-Number(layer.fadeOut))+':d='+Math.min(clipDuration,Number(layer.fadeOut)));
    filters.push('adelay='+delay+':all=1');
    graph.push('['+index+':a]'+filters.join(',')+'[layer'+index+']');
    mixLabels.push('[layer'+index+']');
    layers.push({type:layer.type,start:layer.start,end:layer.end});
  }
  graph.push(mixLabels.join('')+'amix=inputs='+mixLabels.length+':duration=longest:normalize=0,alimiter=limit=0.95,atrim=end='+decimal(duration)+'[mixed]');
  args.push('-filter_complex',graph.join(';'),'-map','0:v:0','-map','[mixed]',
    '-c:v','copy','-c:a','aac','-b:a','192k','-t',decimal(duration),'-movflags','+faststart',output);
  await run(ffmpeg,args,{signal});
  if(!fs.existsSync(output)||!fs.statSync(output).size)throw Error('MP4 final não foi criado.');
  return layers;
}
export async function probeOutput(file,{ffprobe='ffprobe',signal}={}){
  const {stdout}=await run(ffprobe,['-v','error','-show_entries','stream=codec_type,duration,codec_name:format=duration',
    '-of','json',file],{signal});
  const obj=JSON.parse(stdout),video=obj.streams?.find(x=>x.codec_type==='video'),audio=obj.streams?.find(x=>x.codec_type==='audio');
  if(!video||!audio)throw Error('Saída sem vídeo ou áudio.');
  return {videoDuration:Number(video.duration||obj.format?.duration),audioDuration:Number(audio.duration||obj.format?.duration),
    videoCodec:video.codec_name,audioCodec:audio.codec_name};
}
