import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, Clock3, FolderOpen, LayoutTemplate, Plus, Settings2, Sparkles } from 'lucide-react';
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
  const active = Math.max(1, steps.indexOf(project.step));
  return (
    <main id="main" className="workspace">
      <button className="text-button" onClick={onBack}>← Projetos</button>
      <header className="project-header">
        <div><span className="eyebrow">{project.type} · {project.ratio}</span><h1>{project.title}</h1></div>
        <div className="header-actions"><button className="button quiet"><Settings2 size={18}/> Configurar</button><button className="button primary">Continuar <ArrowRight size={18}/></button></div>
      </header>
      <section className="workflow-card" aria-labelledby="workflow-title">
        <div className="section-title"><div><span className="eyebrow">Fluxo do projeto</span><h2 id="workflow-title">Da ideia ao pacote final</h2></div><span className="mode-pill"><Sparkles size={15}/> Revisão por etapa</span></div>
        <ol className="workflow-list">
          {steps.map((step, index) => (
            <li className={index < active ? 'done' : index === active ? 'active' : ''} key={step}>
              <span className="step-index">{index < active ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span>
              <span><strong>{step}</strong><small>{index < active ? 'Aprovado' : index === active ? 'Em andamento' : 'Aguardando'}</small></span>
              {index === active && <button className="mini-button">Abrir etapa</button>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export function App() {
  const [selected, setSelected] = useState(null);
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
          <header className="home-header"><div><span className="eyebrow">Seu espaço de criação</span><h1>Projetos locais</h1><p>Retome um vídeo ou comece uma nova produção.</p></div><button className="button primary"><Plus size={19}/> Novo projeto</button></header>
          <div className="quick-actions"><button><FolderOpen/><span><strong>Abrir projeto</strong><small>Escolher uma pasta local</small></span></button><button><ArrowRight/><span><strong>Importar pacote</strong><small>.contentlab ou ZIP</small></span></button></div>
          <section aria-labelledby="recent-title"><div className="section-title"><h2 id="recent-title">Recentes</h2><button className="text-button">Ver todos</button></div><div className="project-grid">{projects.map(project => <ProjectCard key={project.id} project={project} onOpen={setSelected}/>)}</div></section>
        </main>
      )}
    </div>
  );
}
