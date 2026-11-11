import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, FolderOpen, History, LayoutTemplate, MessageSquareText, Plus, RotateCcw, Settings2, Sparkles, X } from 'lucide-react';
import { Logo } from './Logo.jsx';

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
              {index === active && <button className="mini-button">Abrir etapa</button>}
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

function NewProjectDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Vídeo longo');
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" aria-label="Novo projeto" onSubmit={event => { event.preventDefault(); onCreate({ id: Date.now(), title, type, ratio: type === 'Short' ? '9:16' : '16:9', progress: 0, step: 'Ideia e brief', updated: 'Agora', accent: 'blue' }); }}><div className="section-title"><div><span className="eyebrow">Projeto local</span><h2>Novo vídeo</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div><label>Título<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Nome do projeto"/></label><fieldset><legend>Formato</legend><label><input type="radio" name="type" checked={type === 'Vídeo longo'} onChange={() => setType('Vídeo longo')}/> Vídeo longo · 16:9</label><label><input type="radio" name="type" checked={type === 'Short'} onChange={() => setType('Short')}/> Short · 9:16</label></fieldset><div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary">Criar projeto</button></div></form></div>;
}

export function App() {
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState(projects);
  const [creating, setCreating] = useState(false);
  const [homeNotice, setHomeNotice] = useState('');
  const createProject = (project) => { setItems(previous => [project, ...previous]); setCreating(false); setSelected(project); };
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
