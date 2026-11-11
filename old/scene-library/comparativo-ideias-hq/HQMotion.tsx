/** Shared deterministic utilities. No frame clock, network assets or audio. */
export type HQBounds={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
const boundsCache=new Map<string,Promise<HQBounds>>();
export function imageBoundsHQ(src:string):Promise<HQBounds>{
  if(boundsCache.has(src))return boundsCache.get(src)!;
  const pending=(async()=>{
    const image=new Image();image.crossOrigin='anonymous';
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Imagem inválida: '+src));image.src=src;});
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>12){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(x1<0)throw new Error('Imagem totalmente transparente.');
    return {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,sourceWidth:canvas.width,sourceHeight:canvas.height};
  })();
  boundsCache.set(src,pending);if(boundsCache.size>32)boundsCache.delete(boundsCache.keys().next().value!);
  pending.catch(()=>{if(boundsCache.get(src)===pending)boundsCache.delete(src);});return pending;
}
export const clampHQ=(v:number)=>Math.max(0,Math.min(1,v));
/** Finish at the last displayed frame, including when end is the scene boundary. */
export function progressHQ(time:number,start:number,duration:number,fps:number){
  if(time>=start+duration-1/fps-1e-8)return 1;
  return clampHQ((time-start)/Math.max(1/fps,duration-1/fps));
}
export function fitLabelHQ(text:string,family:string,width:number,height:number,maximum:number,lineHeight=1.08){
  const ctx=document.createElement('canvas').getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');
  const wrap=(size:number)=>{ctx.font=`${size}px ${family}`;const lines:string[]=[];
    for(const paragraph of text.normalize('NFC').toLocaleUpperCase('pt-BR').split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}return lines;};
  let lo=.5,hi=maximum;for(let i=0;i<20;i++){const mid=(lo+hi)/2,lines=wrap(mid);if(lines.length*mid*lineHeight<=height&&lines.every(l=>ctx.measureText(l).width<=width))lo=mid;else hi=mid;}
  return {lines:wrap(lo),size:lo};
}
/** Stable nearest-edge travel distance, including a small overscan for shadows. */
export function edgeTravelHQ(position:number,size:number,viewport:number,direction:number,margin=30){return direction<0?position+size+margin:direction>0?viewport-position+margin:0;}
