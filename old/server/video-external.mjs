import fs from 'node:fs';
import path from 'node:path';
import {run} from './exec.mjs';
import {mediaToolExecutable} from './runtime-tools.mjs';
import {APP_ROOT} from './plan.mjs';
import {ensurePortableTool,portableToolPath} from './portable-tools.mjs';

// O downloader externo só recebe links HTTPS de plataformas reconhecidas.
const YOUTUBE_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com',
  'music.youtube.com','youtu.be']);
const OTHER_HOSTS=[
  'tiktok.com','instagram.com','facebook.com','fb.watch','vimeo.com',
  'dailymotion.com','dai.ly','reddit.com','redd.it','v.redd.it',
  'twitch.tv','clips.twitch.tv','pinterest.com','pin.it',
  'x.com','twitter.com','streamable.com','rumble.com','bilibili.com',
  'b23.tv','kick.com','threads.net','soundcloud.com'
];
const matchesHost=(hostname,domain)=>hostname===domain||hostname.endsWith('.'+domain);
export function classifyVideoLink(input){
  let parsed;
  try{parsed=new URL(input);}catch{throw Error('Cole um link HTTPS válido de um vídeo.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)
    throw Error('Use um endereço HTTPS público, sem usuário, senha ou porta personalizada.');
  const host=parsed.hostname.toLowerCase();
  if(YOUTUBE_HOSTS.has(host))return {provider:'youtube',url:parsed.toString()};
  if(OTHER_HOSTS.some(domain=>matchesHost(host,domain)))
    return {provider:'external',url:parsed.toString(),hostname:host};
  throw Error('Este site ainda não está habilitado para importar vídeos. São aceitos links públicos do YouTube, TikTok, Instagram, Pinterest, Vimeo, X, Reddit e outras plataformas compatíveis.');
}
export function externalToolPath({env=process.env,platform=process.platform,directory=APP_ROOT}={}){
  if(env.CONTENTLAB_YT_DLP)return env.CONTENTLAB_YT_DLP;
  const local=portableToolPath('ytdlp',{root:directory,platform});
  if(fs.existsSync(local))return local;
  return platform==='win32'?'yt-dlp.exe':'yt-dlp';
}
function ytDlpError(err){
  if(err?.code==='ENOENT'||/\bENOENT\b/i.test(err?.message||''))
    return Error('O downloader não pôde ser preparado automaticamente. Reinicie pelo inicializador do Content Lab com acesso à internet; confira o log da instalação.');
  if(err?.name==='TimeoutError'||err?.name==='AbortError')
    return Error('O site demorou demais para responder. Tente novamente com um link público.');
  const message=String(err?.message||'falha desconhecida');
  if(/unsupported URL|no video formats|unable to extract|not available/i.test(message))
    return Error('O site não disponibilizou um vídeo compatível neste endereço. Verifique se o link é público e se o yt-dlp suporta essa página.');
  if(/log.?in|private video|authentication required|cookies/i.test(message))
    return Error('O vídeo exige autenticação ou não está disponível publicamente. O Content Lab não acessa contas privadas.');
  return Error('Não foi possível acessar o vídeo pelo yt-dlp. Verifique se o programa está atualizado e se a plataforma permite o download. '+message.slice(-280));
}
function cliOptions(provider){
  // Sem playlist, configurações globais nem extrator genérico para reduzir a superfície de URLs arbitrárias.
  return ['--ignore-config','--no-playlist','--ies','default,-generic','--no-warnings',
    ...(provider==='youtube'?['--js-runtimes','node:'+process.execPath]:[])];
}
export async function getExternalVideoInfo(input,{runner=run,env=process.env}={}){
  const {provider,url}=classifyVideoLink(input);
  if(runner===run&&!env.CONTENTLAB_YT_DLP)await ensurePortableTool('ytdlp');
  let result;
  try{
    result=await runner(externalToolPath({env}),[
      ...cliOptions(provider),'--skip-download','--print','%(.{id,title,duration,thumbnail})j',url
    ],{signal:AbortSignal.timeout(60000)});
  }catch(error){throw ytDlpError(error);}
  let info;
  try{info=JSON.parse(result.stdout);}catch{throw Error('O yt-dlp não devolveu informações válidas deste vídeo.');}
  if(info?._type==='playlist')throw Error('Cole o link de um único vídeo, não de uma playlist.');
  return {
    title:String(info.title||'Vídeo da internet').slice(0,180),
    duration:Number(info.duration||0),
    thumbnail:typeof info.thumbnail==='string'&&/^https:\/\//.test(info.thumbnail)?
      info.thumbnail:'',
    url,id:String(info.id||''),provider
  };
}
export async function downloadExternalAsset(input,folder,{
  runner=run,env=process.env,update=()=>{}
}={}){
  const {provider,url}=classifyVideoLink(input);
  if(runner===run&&!env.CONTENTLAB_YT_DLP)await ensurePortableTool('ytdlp',{update:message=>update(3,message)});
  const ffmpeg=mediaToolExecutable('ffmpeg');
  const args=[
    ...cliOptions(provider),
    '--max-filesize','1G',
    '-f','bv*+ba/b',
    '--merge-output-format','mp4',
    '--recode-video','mp4',
    '--output',path.join(folder,'video.%(ext)s'),
    '--no-progress'
  ];
  if(ffmpeg!=='ffmpeg')args.push('--ffmpeg-location',path.dirname(ffmpeg));
  args.push(url);
  update(10,'Obtendo vídeo pela plataforma de origem…');
  try{
    await runner(externalToolPath({env}),args,{
      signal:AbortSignal.timeout(25*60*1000)
    });
  }catch(error){throw ytDlpError(error);}
  const file=path.join(folder,'video.mp4');
  if(!fs.existsSync(file)||!fs.statSync(file).size)
    throw Error('A plataforma não produziu um MP4 compatível. Reinicie pelo inicializador para conferir as ferramentas e tente novamente com um link público.');
  update(85,'Verificando vídeo importado…');
  return file;
}
