import { thresholdFrame } from './choreography.js';

/** SFX for real events only; count, turn, duration and frame rate follow the configured scene. */
export function narrativeEvents(scene, props, duration, fps = 30) {
  const events=[]; const len=Math.max(1,Math.round(duration*fps));
  const add=(name,fraction,volume=.4)=>events.push({name,at:Math.round(Math.max(0,Math.min(.999,fraction))*len)/fps,volume});
  const count=(key,max)=>(props[key]||[]).slice(0,max).length;
  switch(scene) {
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
    case 'convergencia':for(let i=0;i<count('frentes',3);i++)add(i%2?'tick':'camera',i*.1,.32);add('whoosh-lento',.43,.3);add('impact',.65);add('sub',.65,.3);break;
  }
  return events.sort((a,b)=>a.at-b.at).filter(e=>e.at<duration);
}
