// Diagrams are generated deterministically in JavaScript. No screenshots,
// drawing tools, network images or pre-baked raster files are required.
const escape=(text)=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const T=(x,y,value,size=17,color='#263349',weight=500,anchor='start')=>
  '<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-size="'+size+'" font-family="Inter,Arial,sans-serif" fill="'+color+'" font-weight="'+weight+'">'+escape(value)+'</text>';
const R=(x,y,w,h,fill='#fff',stroke='#DDE5F0',radius=14)=>
  '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+radius+'" fill="'+fill+'" stroke="'+stroke+'"/>';
const L=(x1,y1,x2,y2,color='#9AAEC9',width=2,dash='')=>
  '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+width+'" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>';
const frame=(body,title,width=900,height=420)=>
  '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(title)+'">'+
  '<rect width="'+width+'" height="'+height+'" rx="24" fill="#F6F8FC"/>'+
  T(32,42,title,21,'#14243C',750)+body+'</svg>';
const diagrams={
  structure(){
    const blocks=[['project','Nome · formato · FPS'],['sources','Assets · transcrição'],['audio','Narração · música · SFX'],['timeline','Cenas · camadas · movimento']];
    return frame(blocks.map(([name,desc],i)=>{
      const x=40+(i%2)*430,y=82+Math.floor(i/2)*137;
      return R(x,y,392,112,'#FFFFFF')+R(x+15,y+20,8,70,i===0?'#3079E5':i===1?'#56A68A':i===2?'#E9AC4E':'#9877D9','none',4)+
        T(x+44,y+49,name,23,'#1F3655',740)+T(x+44,y+80,desc,16,'#78869A');
    }).join('')+T(450,397,'edit_plan.json → validação → Remotion / FFmpeg',14,'#526680',600,'middle'),'Estrutura do plano',900,435);
  },
  grid(){
    let b='';
    for(let i=0;i<9;i++){
      const x=136+i%3*211,y=86+Math.floor(i/3)*101;
      b+=R(x,y,195,88,[1,4,7].includes(i)?'#F5F8FE':(i%3===1?'#DBEAFE':'#FFFFFF'),'#CCD8E9',14)+
        T(x+97.5,y+55,String(i+1),27,i%3===1?'#2368CB':'#5D6C80',750,'middle');
    }
    return frame(b+T(450,402,'[2, 5, 8] = coluna central   ·   [5] = célula central',16,'#345A8E',650,'middle'),'Posicionamento: grade 3 × 3',900,440);
  },
  fitting(){
    const panel=(x,name,crop)=>{
      let b=R(x,95,370,244,'#111D30','#344361',15);
      if(crop)b+=R(x+12,109,346,212,'#367BBF','#367BBF',8)+
        R(x+95,130,180,170,'#76BFA5','#76BFA5',18)+T(x+185,225,'Zoom / recorte',16,'#173C3C',740,'middle');
      else b+=R(x+34,126,302,182,'#367BBF','#367BBF',8)+
        R(x+110,144,150,144,'#76BFA5','#76BFA5',18)+T(x+185,227,'Quadro inteiro',16,'#173C3C',740,'middle');
      return b+T(x+185,373,name,22,'#203754',740,'middle');
    };
    return frame(panel(45,'contain · preserva',false)+panel(485,'cover · pode cortar',true)+
      T(450,415,'Vídeo 16:9 já adequado: não aplicar ampliação automática',14,'#596C86',570,'middle'),'Enquadramento sem perda por zoom',900,447);
  },
  layers(){
    const names=[['z = 30','Texto / legenda','#E5EEFF'],['z = 20','PNG com transparência','#E8F8F0'],['z = 10','Vídeo / plano de fundo','#FDF2E3']];
    let b=R(84,83,732,272,'#13243F','#13243F',19);
    names.forEach(([z,t,color],i)=>{
      const x=151+i*67,y=117+i*66;
      b+=R(x,y,545,66,color,'#C2D2E5',10)+T(x+22,y+27,z,14,'#51739D',750)+T(x+22,y+50,t,17,'#213652',650);
    });
    return frame(b+T(450,405,'Camadas se sobrepõem conforme z e seus intervalos start/end',15,'#506782',590,'middle'),'Composição em camadas',900,438);
  },
  timeline(){
    let b=R(50,95,805,240,'#FFFFFF');
    const xs=[78,267,492,698],widths=[188,224,205,128];
    const colors=['#DDEAFD','#D8F3E5','#FDE9CB','#E9E0FA'];
    const names=['Cena 01','Cena 02','Cena 03','Cena 04'];
    for(let i=0;i<4;i++){
      b+=R(xs[i],154,widths[i]-10,80,colors[i],'#FFFFFF',9)+T(xs[i]+16,187,names[i],17,'#2B496D',730)+
        T(xs[i]+16,214,(i*4)+'s',13,'#60768E');
      if(i>0)b+=L(xs[i],116,xs[i],271,'#9BB4D4',2,'5 5');
    }
    b+=T(80,293,'0s',15,'#6B7C91')+T(811,293,'fim',15,'#6B7C91','500','end');
    return frame(b+T(450,384,'IDs estáveis: render de cenas alteradas, reuso das demais',16,'#4C6892',620,'middle'),'Storyboard e cache por ID',900,426);
  },
  audio(){
    const bars=[0.08,0.1,0.04,0.04,.25,.6,.81,.56,.4,.63,.45,.12,0,0,0,.7,.8,.56,.35,.22,.03,.03,.03,.02];
    let b=R(45,82,810,270,'#FFFFFF');
    b+=T(78,119,'SFX original',16,'#456280',700);
    const base=210;
    bars.forEach((v,i)=>{let x=75+i*31;
      b+=R(x,base-v*70,18,Math.max(3,v*140),i<4||i>19?'#CBD4E0':i>=12&&i<=14?'#FFC67B':'#4C8BDF','none',5);
    });
    b+=R(73,279,120,10,'#D9E2EE','none',3)+R(193,279,530,10,'#D9EAFE','none',3)+R(723,279,112,10,'#D9E2EE','none',3);
    b+=T(133,318,'cortar início',14,'#657792',600,'middle')+T(458,318,'preservar pausa interna',14,'#336AA7',700,'middle')+
      T(780,318,'cortar fim',14,'#657792',600,'middle');
    return frame(b+T(450,407,'sfx.at = início audível, com trim automático só nas bordas',16,'#4C6892',610,'middle'),'Efeitos sonoros: trim de bordas',900,445);
  },
  ripple(){
    let b='';
    const row=(y,title,colors,labels)=>{
      b+=T(40,y+33,title,15,'#35516D',700);
      let x=165;
      for(let i=0;i<colors.length;i++){
        const w=i===1?145:175;b+=R(x,y,w,60,colors[i],'#FFFFFF',9)+T(x+w/2,y+36,labels[i],15,'#35516D',600,'middle');x+=w+7;
      }
    };
    row(102,'ANTES',['#DEEAFE','#E1F4EA','#F4E3FC'],['Cena A','Cena B','Cena C']);
    row(222,'DEPOIS',['#DEEAFE','#FDE9CA','#E1F4EA','#F4E3FC'],['Cena A','Nova + pausa','Cena B','Cena C']);
    return frame(b+T(450,397,'Inserir tempo desloca cenas, música e fala posteriores',16,'#48668C',620,'middle'),'Inserção com sincronização (ripple)',900,434);
  },
  transitions(){
    let b=R(42,94,816,252,'#FFF');
    for(let i=0;i<7;i++){
      const x=74+i*107,progress=i/6;
      b+=R(x,156,93,113,i===0?'#5B88CB':i===6?'#65B8A1':'#E1EBF4','#FFFFFF',8);
      b+=R(x+9+progress*10,176,23,55,'#4882C8','none',4)+R(x+58-progress*12,190,24,44,'#68B89F','none',4);
    }
    return frame(b+T(450,397,'Frames reais da cena entrante, mantendo o tempo total do vídeo',15,'#4D6888',630,'middle'),'Transições com movimento',900,435);
  }
};
export const diagramNames=Object.keys(diagrams);
export function diagramSvg(name){
  if(!Object.hasOwn(diagrams,name))throw Error('Diagrama desconhecido: '+name);
  return diagrams[name]();
}
