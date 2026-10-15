import http from 'node:http';
import {pathToFileURL} from 'node:url';

const route='/api/social/oauth/instagram/callback';
const bindHost='127.0.0.1';
const bridgePort=()=>Number(process.env.CONTENTLAB_INSTAGRAM_BRIDGE_PORT||5151);
const appPort=()=>Number(process.env.PORT||5000);

export function instagramBridgeHandler(req,res,{targetPort=appPort()}={}){
  const local=new URL(req.url||'/', 'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'||local.pathname!==route){
    res.statusCode=404;
    res.end('Not found');
    return;
  }
  const code=local.searchParams.get('code');
  const state=local.searchParams.get('state');
  const error=local.searchParams.get('error');
  if(!state||state.length>512||(!code&&!error)||(code&&code.length>4096)){
    res.statusCode=400;
    res.end('Retorno OAuth invalido.');
    return;
  }
  // Apenas os parâmetros OAuth esperados atravessam a ponte.
  const location=new URL('http://127.0.0.1:'+targetPort+route);
  location.searchParams.set('state',state);
  if(code)location.searchParams.set('code',code);
  if(error)location.searchParams.set('error',String(error).slice(0,100));
  res.statusCode=307;
  res.setHeader('Location',location.toString());
  res.end();
}

export function startInstagramBridge({port=bridgePort(),targetPort=appPort()}={}){
  if(!Number.isInteger(port)||port<1024||port>65535||
    !Number.isInteger(targetPort)||targetPort<1||targetPort>65535)
    throw Error('Porta da ponte Instagram inválida.');
  const server=http.createServer((req,res)=>instagramBridgeHandler(req,res,{targetPort}));
  server.listen(port,bindHost,()=>{
    process.stdout.write('Instagram OAuth bridge: http://'+bindHost+':'+port+route+'\n');
    process.stdout.write('Encaminhe somente este endereço com um túnel HTTPS e registre a URL pública na Meta.\n');
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  startInstagramBridge();
}
