// 16-bit stereo PCM WAV; no codec or external service required.
export function toWav(buffer) {
  const channels=buffer.numberOfChannels;
  const frames=buffer.length;
  const bytes=frames*channels*2;
  const data=new ArrayBuffer(44+bytes),view=new DataView(data);
  const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  ascii(0,"RIFF");view.setUint32(4,36+bytes,true);ascii(8,"WAVE");
  ascii(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
  view.setUint32(28,buffer.sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);
  ascii(36,"data");view.setUint32(40,bytes,true);
  const source=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  let cursor=44;
  for(let frame=0;frame<frames;frame++){
    for(let channel=0;channel<channels;channel++){
      const sample=Math.max(-1,Math.min(1,source[channel][frame]));
      view.setInt16(cursor,sample < 0 ? Math.round(sample*32768) : Math.round(sample*32767),true);
      cursor+=2;
    }
  }
  return new Blob([data],{type:"audio/wav"});
}
