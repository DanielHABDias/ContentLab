import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, FileText, FolderOpen, History, ImagePlus, LayoutTemplate, MessageSquareText, Plus, RotateCcw, Save, Settings2, Sparkles, Tag, X } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { loadProjectCards, saveProjectCards } from './project-repository.js';

const projects = [
  { id: 1, title: 'Por que heróis falham?', type: 'Vídeo longo', ratio: '16:9', progress: 62, step: 'Narração', updated: 'Hoje, 14:32', accent: 'blue' },
  { id: 2, title: 'O detalhe que muda o Batman', type: 'Short', ratio: '9:16', progress: 34, step: 'Roteiro', updated: 'Ontem, 21:08', accent: 'red' },
  { id: 3, title: 'A evolução do Omnitrix', type: 'Vídeo longo', ratio: '16:9', progress: 91, step: 'Revisão final', updated: '8 nov, 18:40', accent: 'lime' },
];

function ProjectCard({ project, onOpen }) {
  return (
    <button className="project-card" onClick={() => onOpen(project)} aria-label={`Abrir ${project.title}`}>
      <span className={`poster poster-${project.accent}`} aria-hidden="true"><span>{project.progress}</span></span>
      <span className="project-copy">
        <span className="eyebrow">{project.type} · {project.ratio}</span>
        <strong>{project.title}</strong>
        <span className="step"><Clock3 size={14} /> {project.step}</span>
        <span className="progress"><i style={{ width: `${project.progress}%` }} /></span>
        <small>{project.progress}% · {project.updated}</small>
      </span>
      <ChevronRight className="project-arrow" aria-hidden="true" />
    </button>
  );
}

function ProjectView({ project, onBack }) {
  const steps = ['Ideia e brief', 'Roteiro', 'Embalagem', 'Mídia', 'Narração', 'Edição', 'Revisão e render'];
  const initial = Math.max(1, steps.indexOf(project.step));
  const [active, setActive] = useState(initial);
  const [mode, setMode] = useState('review');
  const [notice, setNotice] = useState('');
  const [events, setEvents] = useState([{ id: 1, text: `${steps[Math.max(0, initial - 1)]} aprovado`, time: 'Hoje, 14:18' }]);
  const [editorOpen, setEditorOpen] = useState(false);
  const record = (text) => setEvents(previous => [{ id: Date.now(), text, time: 'Agora' }, ...previous]);
  const approve = () => {
    if (active >= steps.length - 1) return;
    record(`${steps[active]} aprovado`);
    setNotice(`${steps[active]} aprovado. Próxima etapa liberada.`);
    setActive(value => value + 1);
  };
  const requestChanges = () => {
    record(`Ajustes solicitados em ${steps[active]}`);
    setNotice('Pedido de mudanças registrado na etapa atual.');
  };
  const reopen = (index) => {
    record(`${steps[index]} reaberto; etapas posteriores precisam de revisão`);
    setActive(index);
    setNotice(`${steps[index]} reaberto sem apagar o histórico.`);
  };
  if (editorOpen) return <CreativeEditor project={project} onBack={() => setEditorOpen(false)} />;
  return (
    <main id="main" className="workspace">
      <button className="text-button" aria-label="Voltar aos projetos" onClick={onBack}><ArrowLeft size={16}/> Projetos</button>
      <header className="project-header">
        <div><span className="eyebrow">{project.type} · {project.ratio}</span><h1>{project.title}</h1></div>
        <div className="header-actions"><button className="button quiet"><Settings2 size={18}/> Configurar</button><button className="button primary">Continuar <ArrowRight size={18}/></button></div>
      </header>
      <section className="workflow-card" aria-labelledby="workflow-title">
        <div className="section-title"><div><span className="eyebrow">Fluxo do projeto · demonstração</span><h2 id="workflow-title">Da ideia ao pacote final</h2></div><label className="mode-select"><Sparkles size={15}/><span className="sr-only">Modo do projeto</span><select value={mode} onChange={event => { setMode(event.target.value); record(event.target.value === 'review' ? 'Modo de revisão por etapa ativado' : 'Modo autônomo ativado'); }}><option value="review">Revisão por etapa</option><option value="autonomous">Autônomo até o final</option></select></label></div>
        {notice && <div className="notice" role="status"><Check size={16}/>{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
        <ol className="workflow-list">
          {steps.map((step, index) => (
            <li className={index < active ? 'done' : index === active ? 'active' : ''} key={step}>
              <span className="step-index">{index < active ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span>
              <span><strong>{step}</strong><small>{index < active ? 'Aprovado' : index === active ? 'Em andamento' : 'Aguardando'}</small></span>
              {index === active && <button className="mini-button" onClick={() => setEditorOpen(true)}>Abrir etapa</button>}
              {index < active && <button className="reopen-button" onClick={() => reopen(index)}><RotateCcw size={14}/> Reabrir</button>}
            </li>
          ))}
        </ol>
        <div className="approval-bar">
          <div><span className="eyebrow">Etapa atual</span><strong>{steps[active]}</strong></div>
          <button className="button quiet" onClick={requestChanges}><MessageSquareText size={17}/> Pedir mudanças</button>
          <button className="button primary" onClick={approve} disabled={active === steps.length - 1}><Check size={17}/> Aprovar etapa</button>
        </div>
      </section>
      <section className="history-card" aria-labelledby="history-title"><div className="section-title"><h2 id="history-title"><History size={20}/> Histórico</h2><span>{events.length} eventos</span></div><ul>{events.map(event => <li key={event.id}><span>{event.text}</span><small>{event.time}</small></li>)}</ul></section>
    </main>
  );
}

function CreativeEditor({ project, onBack }) {
  const [tab, setTab] = useState('script');
  const [saved, setSaved] = useState('Salvo agora');
  const [script, setScript] = useState({ hook: 'Todo herói falha. Mas algumas quedas revelam mais sobre coragem do que qualquer vitória.', development: 'A falha não encerra a jornada: ela expõe o conflito, cobra uma escolha e dá peso à transformação.', payoff: 'No fim, o que define o herói não é evitar a queda — é o que ele faz depois dela.', visual: 'Abrir com silhueta em queda; cortar para três escolhas decisivas; tipografia acompanha apenas as palavras-chave.' });
  const [meta, setMeta] = useState({ titleA: 'Por que todo herói precisa falhar', titleB: 'A queda que transforma um herói', description: 'Uma análise sobre falha, escolha e transformação nas grandes histórias.', tags: 'heróis, narrativa, quadrinhos, cinema', seo: 'Tese e promessa alinhadas. Confirmar nomes e fontes antes da aprovação.' });
  const change = (setter, key, value) => { setter(previous => ({ ...previous, [key]: value })); setSaved('Salvando…'); window.setTimeout(() => setSaved('Salvo agora'), 250); };
  return <main id="main" className="creative-editor"><header className="editor-top"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/> Workflow</button><div><span className="eyebrow">{project.title}</span><h1>Roteiro e embalagem</h1></div><span className="save-state" role="status"><Save size={15}/>{saved}</span></header><div className="editor-tabs" role="tablist"><button role="tab" aria-selected={tab === 'script'} onClick={() => setTab('script')}><FileText size={17}/> Roteiro</button><button role="tab" aria-selected={tab === 'package'} onClick={() => setTab('package')}><Tag size={17}/> Títulos e thumbnails</button></div>{tab === 'script' ? <section className="editor-layout"><div className="script-page"><div className="page-meta"><span>Versão 3</span><span>Roteiro {project.type === 'Short' ? 'Short' : 'longo'}</span></div><h2>{project.title}</h2><ScriptField label={project.type === 'Short' ? 'Abertura · hook imediato' : 'Abertura · gancho e entrega'} value={script.hook} onChange={value => change(setScript, 'hook', value)}/><ScriptField label="Desenvolvimento · argumento e contraste" value={script.development} onChange={value => change(setScript, 'development', value)}/><ScriptField label="Payoff · síntese e CTA contextual" value={script.payoff} onChange={value => change(setScript, 'payoff', value)}/><ScriptField label="Direção visual · não narrar" visual value={script.visual} onChange={value => change(setScript, 'visual', value)}/></div><aside className="editor-aside"><span className="eyebrow">Estrutura</span><ol><li className="ready"><Check/>Brief e tese</li><li className="active">Roteiro narrado</li><li>Fontes e direitos</li><li>Revisão factual</li></ol><div className="version-box"><History/><span><strong>Histórico local</strong><small>3 versões · última agora</small></span></div></aside></section> : <PackagingPanel meta={meta} onChange={(key, value) => change(setMeta, key, value)}/>}</main>;
}

function ScriptField({ label, value, onChange, visual = false }) {
  return <label className={visual ? 'script-block visual-note' : 'script-block'}><span>{label}</span><textarea value={value} onChange={event => onChange(event.target.value)} rows={visual ? 3 : 4}/><small>{value.trim().split(/\s+/).filter(Boolean).length} palavras</small></label>;
}

function PackagingPanel({ meta, onChange }) {
  return <section className="packaging"><div className="metadata-form"><span className="eyebrow">Duas promessas distintas</span><h2>Títulos A/B</h2><label>Título A <small>Clareza e tese</small><input value={meta.titleA} onChange={event => onChange('titleA', event.target.value)}/></label><label>Título B <small>Curiosidade ou contraste</small><input value={meta.titleB} onChange={event => onChange('titleB', event.target.value)}/></label><label>Descrição<textarea rows="5" value={meta.description} onChange={event => onChange('description', event.target.value)}/></label><label>Tags<input value={meta.tags} onChange={event => onChange('tags', event.target.value)}/></label><label>Notas de SEO<textarea rows="3" value={meta.seo} onChange={event => onChange('seo', event.target.value)}/></label></div><div className="thumb-panel"><div className="section-title"><div><span className="eyebrow">Conceitos e arquivos</span><h2>Thumbnails</h2></div><button className="button quiet"><ImagePlus size={17}/> Importar</button></div><div className="thumb-grid"><button className="thumb-concept thumb-a"><span>A</span><strong>Contradição</strong><small>Assunto dominante + queda visual</small></button><button className="thumb-concept thumb-b"><span>B</span><strong>Consequência</strong><small>Antes/depois com foco único</small></button><button className="thumb-drop"><ImagePlus/><strong>Criar ou importar</strong><small>PNG ou JPEG · 16:9</small></button></div><div className="rights-note"><strong>Estado: preliminar</strong><span>Fontes e direitos dos assets ainda precisam de revisão.</span></div></div></section>;
}

function NewProjectDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Vídeo longo');
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" aria-label="Novo projeto" onSubmit={event => { event.preventDefault(); onCreate({ id: Date.now(), title, type, ratio: type === 'Short' ? '9:16' : '16:9', progress: 0, step: 'Ideia e brief', updated: 'Agora', accent: 'blue' }); }}><div className="section-title"><div><span className="eyebrow">Projeto local</span><h2>Novo vídeo</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div><label>Título<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Nome do projeto"/></label><fieldset><legend>Formato</legend><label><input type="radio" name="type" checked={type === 'Vídeo longo'} onChange={() => setType('Vídeo longo')}/> Vídeo longo · 16:9</label><label><input type="radio" name="type" checked={type === 'Short'} onChange={() => setType('Short')}/> Short · 9:16</label></fieldset><div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary">Criar projeto</button></div></form></div>;
}

export function App() {
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState(() => loadProjectCards(projects));
  const [creating, setCreating] = useState(false);
  const [homeNotice, setHomeNotice] = useState('');
  const createProject = (project) => { setItems(previous => [project, ...previous]); setCreating(false); setSelected(project); };
  useEffect(() => saveProjectCards(items), [items]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Principal">
          <button className="nav-item active"><LayoutTemplate size={19}/> Projetos</button>
          <button className="nav-item"><FolderOpen size={19}/> Mídias locais</button>
        </nav>
        <div className="credit">Criado por <strong>Daniel Dias</strong><span>Diazverso</span></div>
      </aside>
      {selected ? <ProjectView project={selected} onBack={() => setSelected(null)} /> : (
        <main id="main" className="project-home">
          <header className="home-header"><div><span className="eyebrow">Seu espaço de criação · demonstração</span><h1>Projetos locais</h1><p>Retome um vídeo ou comece uma nova produção.</p></div><button className="button primary" onClick={() => setCreating(true)}><Plus size={19}/> Novo projeto</button></header>
          {homeNotice && <div className="notice" role="status"><Check size={16}/>{homeNotice}</div>}
          <div className="quick-actions"><button onClick={() => setHomeNotice('Seletor de pasta local pronto para integração no T05.')}><FolderOpen/><span><strong>Abrir projeto</strong><small>Escolher uma pasta local</small></span></button><button onClick={() => setHomeNotice('Importação de .contentlab e ZIP será conectada no T11.')}><ArrowRight/><span><strong>Importar pacote</strong><small>.contentlab ou ZIP</small></span></button></div>
          <section aria-labelledby="recent-title"><div className="section-title"><h2 id="recent-title">Recentes</h2><span className="demo-badge">Dados de demonstração</span></div><div className="project-grid">{items.map(project => <ProjectCard key={project.id} project={project} onOpen={setSelected}/>)}</div></section>
          {creating && <NewProjectDialog onClose={() => setCreating(false)} onCreate={createProject}/>} 
        </main>
      )}
    </div>
  );
}
