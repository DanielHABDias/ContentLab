import { entryCues, reactionState } from './editorial/timing.js';
import { passageFrames, timelineSchedule } from './trilha.js';
import { thresholdFrame } from './choreography.js';

/** SFX for real events only; count, turn, duration and frame rate follow the configured scene. */
export function narrativeEvents(scene, props, duration, fps = 30) {
  const events=[]; const len=Math.max(1,Math.round(duration*fps));
  const add=(name,fraction,volume=.4)=>events.push({name,at:Math.round(Math.max(0,Math.min(.999,fraction))*len)/fps,volume});
  const count=(key,max)=>(props[key]||[]).slice(0,max).length;
  switch(scene) {
    case 'montagemEncaixe':for(const t of entryCues(count('cenas',4)))add('camera',t,.3);if(count('cenas',4))add('whoosh-lento',.78,.3);break;
    case 'enquadramentoAlternado':{const n=(props.ordem||props.cenas||[]).slice(0,8).length;for(let i=0;i<n;i++)add(i%2?'swish':'camera',i/n,.3);break;}
    case 'detalheContexto':add('camera',0,.3);add('whoosh-lento',.15,.3);break;
    case 'janelaMovel':add('swish',.03,.3);add('whoosh-lento',.58,.3);break;
    case 'faixasSequenciais':{const n=count('cenas',3);for(let i=0;i<n;i++)add('swish',i/n,.3);break;}
    case 'fotogramasMudanca':for(let i=0;i<count('cenas',3);i++)add('camera',i*.2,.3);if(count('cenas',3))add('whoosh-lento',.79,.3);break;
    case 'anotacaoCena':add('tick',props.em??.32,.3);add('swish',Math.min(.95,(props.em??.32)+(props.pausa??.35)),.3);break;
    case 'retornoImagem':add('camera',props.em??.35,.3);add('swish',Math.min(.95,(props.em??.35)+(props.duracao??.2)),.3);break;
    case 'palavraRecortada':add('impact',.06,.3);break;
    case 'personagemPrimeiroPlano':add('pop',0,.3);break;
    case 'personagemReacao':{const state=reactionState(0,len,props.em??.28,props.ate??.83);add('pop',state.start/len,.3);add('tick',state.swap/len,.25);break;}
    case 'personagemAlternado':add('pop',0,.3);add('camera',.25,.3);add('pop',.62,.3);break;
    case 'legendaVirada':add('type',props.virada??.42,.3);break;
    case 'divisaoResolvida':add('whoosh-lento',props.virada??.33,.3);break;
    case 'corteCor':add('whoosh-rapido',.25,.3);break;
    case 'revelacaoRecortes':for(let i=0;i<4;i++)add(i%2?'swish':'camera',i*.17,.3);add('ding',.72,.3);break;
    case 'dossie': for(let i=0;i<count('pistas',4);i++){add(['camera','pop','camera','pop'][i],i*.13);add(['type','ding','tick','ding'][i],.5+i*.04,.32);} if(props.conclusao)add('impact',.76);break;
    case 'cronologiaRamos':add('whoosh',0);add('pop',.18);for(let i=0;i<count('ramos',3);i++)add(['camera','swish','camera'][i],.25+i*.18);break;
    case 'revelacaoCamadas': {const n=count('camadas',4);for(let i=0;i<n;i++)add(['swish','whoosh','whoosh-rapido','swish'][i],.12+i*.56/n);if(n)add('impact',.12+(n-1)*.56/n+.13);if(props.conclusao)add('sub',.82);break;}
    case 'contradicao':add('whoosh',0);add('error',props.virada??.42);add('sub',props.virada??.42,.3);if(props.veredito)add('impact',.76);break;
    case 'efeitoDomino':for(let i=0;i<count('etapas',4);i++)add(['tick','impact','sub','impact'][i],.16+i*.15);if(props.conclusao)add('sub',.76);break;
    case 'constelacao':for(let i=0;i<count('ideias',6);i++)add(i%2?'tick':'pop',.08+i*.08,.3);if(props.ligacoes?.length)add('swish',.6,.3);add('impact',.65);break;
    case 'quadrosProfundidade':{const n=count('planos',4);for(let i=0;i<n;i++)add(i?'camera':'whoosh',i*.12);for(let i=0;i<n-1;i++)add('swish',.18+.68*(i+.5)/(n-1),.3);break;}
    case 'lupaEvidencia':add('camera',0);add('swish',.15);if(props.detalhe)add('ding',.48);break;
    case 'bifurcacao':for(let i=0;i<count('opcoes',2);i++)add(i?'swish':'pop',.2+i*.12);if(Number.isInteger(props.escolhida)&&props.escolhida>=0&&props.escolhida<count('opcoes',2))add('impact',props.virada??.6);if(props.conclusao)add('sub',.76);break;
    case 'limiar':{add('tick',.12);const f=thresholdFrame({len,from:props.de??0,to:props.valor,limit:props.limite});if(f!==null){add('error',f/len);add('impact',f/len,.32);}add('ding',.7,.3);break;}
    case 'balancaCusto':add('camera',.08);add('swish',.28);add('impact',.4);add('sub',.4,.28);break;
    case 'ecoVisual':for(let i=0;i<count('ocorrencias',3);i++)add(i%2?'tick':'camera',i*.14,.32);add('swish',.55);add('impact',.76);break;
    case 'pecaAusente':for(let i=0;i<count('contexto',2);i++)add(i?'tick':'camera',i*.15);if(props.revelar!==false){add('whoosh',props.virada??.6);add('impact',(props.virada??.6)+Math.round(fps*.14)/len);}break;
    case 'trilhaViva':{const tl=timelineSchedule(props);if(!tl.n)break;
      if(tl.rewind){add('glitch',tl.blackout*.3,.3);add('whoosh-rapido',tl.travelStart,.35);}
      else if(tl.exit)add('swish',0,.3);
      if(tl.from!==tl.to&&!tl.rewind)add(Math.abs(tl.to-tl.from)>2?'whoosh-lento':'whoosh',tl.travelStart,.3);
      for(const pass of passageFrames(len,props))add('tick',pass.frame/len,.22);
      if(tl.enter){add('whoosh-lento',tl.enterStart,.32);add('camera',.96,.3);}
      break;}
    case 'personagemClose':{const n=count('ideias',6);for(let i=0;i<n;i++)add('pop',i/n,.3);break;}
    case 'pensamentoVivo':for(let i=0;i<count('ideias',3);i++)add('pop',.08+i*.19,.3);if(props.conclusao)add('ding',.76,.3);break;
    case 'rasgoCena':add('whoosh',Math.max(0,Math.min(.58,props.virada??.35)),.35);break;
    case 'vinculo':add('camera',0);if(count('pessoas',2)>1)add('camera',.12);add('impact',props.virada??.55);break;
    case 'memoria':add('camera',0);add('swish',.22);add('whoosh-lento',.72,.3);break;
    case 'duplaVida':for(let i=0;i<count('lados',2);i++)add('camera',i*.1);for(const t of (props.trocas??[.28,.55,.78]).filter(t=>t>=0&&t<1))add('swish',t,.3);break;
    case 'convergencia':for(let i=0;i<count('frentes',3);i++)add(i%2?'tick':'camera',i*.1,.32);add('whoosh-lento',.43,.3);add('impact',.65);add('sub',.65,.3);break;
  }
  return thin(events.filter(e=>e.at<duration),duration);
}

/**
 * Keeps the sound design sparse: a sound on every card entrance is what makes a montage feel machine-made.
 * Turning points (impact, error, sub) win; other cues need 0.3 s of room and the scene keeps about one per second.
 * A sub may layer under the impact it reinforces.
 */
const PRIORITY={impact:3,error:3,sub:3,ding:2,'whoosh-lento':2,'whoosh-rapido':2,whoosh:2};
export function thin(events,duration,gap=.3){
  const ranked=events.map((e,i)=>({e,i,p:PRIORITY[e.name]||1})).sort((a,b)=>b.p-a.p||a.e.at-b.e.at||a.i-b.i);
  const cap=Math.max(2,Math.round(duration*1.1)); const kept=[];
  for(const r of ranked){
    if(kept.length>=cap)break;
    const clash=kept.some(k=>Math.abs(k.e.at-r.e.at)<gap&&!(r.e.name==='sub'&&k.e.name==='impact'||r.e.name==='impact'&&k.e.name==='sub'));
    if(!clash)kept.push(r);
  }
  return kept.sort((a,b)=>a.e.at-b.e.at||a.i-b.i).map(r=>r.e);
}
