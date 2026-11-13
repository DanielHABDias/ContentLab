import { NarrationReader } from './NarrationReader.jsx';
import { ScriptPanel } from './ScriptPanel.jsx';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Power, ArrowLeft, ArrowRight, Check, Eye, Film, FileText, Lock, Mic, SlidersHorizontal, Wrench, FolderOpen, History, LayoutTemplate, MessageSquareText, Plus, RotateCcw, Save, Settings2, Sparkles, Tag, X } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { OFFLINE_EVENT, localApi } from './local-api.js';
import { DeleteDialog, ProjectCard, RenameDialog } from './ProjectManagement.jsx';
import { SetupWizard } from './SetupWizard.jsx';
import { MediaLibrary, mediaUrl } from './MediaLibrary.jsx';
import { NarrationStudio } from './NarrationStudio.jsx';
import { TimelineEditor } from './TimelineEditor.jsx';
import { RenderPanel } from './RenderPanel.jsx';
import { ConfirmDialog, ReasonDialog, useDialogFocus } from './Dialogs.jsx';
import { DocsScreen } from './DocsScreen.jsx';
import { ProjectFlowFields, flowFromPreset, flowPreset, flowSummary } from './ProjectFlowFields.jsx';
import { VoiceScreen } from './VoiceScreen.jsx';
import { SettingsScreen } from './SettingsScreen.jsx';
import { DependencyNotice, FeatureList, StageGate, isStageBlocked } from './DependencyGate.jsx';
import { STAGE_REQUIREMENTS, featureBlock } from '../core/capabilities.js';
import { missingStageArtifacts } from '../core/workflow.js';

const stageLabels = { brief: 'Ideia', packaging: 'Título e thumbnail', script: 'Roteiro', media: 'Mídia', narration: 'Narração', edit: 'Edição', review: 'Revisão e render' };
const typeLabels = { long: 'Vídeo longo', short: 'Short', custom: 'Personalizado' };


function ProjectWorkspace({ details, onBack, onUpdated, setup, onOpenSetup, onOpenVoice }) {
  const { project, history, path } = details;
  const activeStage = project.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state)) || project.stages.at(-1);
  const missing = missingStageArtifacts(project, activeStage.id);
  const [screen, setScreen] = useState('workflow'); const [viewing, setViewing] = useState(null); const [configuring, setConfiguring] = useState(false); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [conflict, setConflict] = useState(null);
  const run = async action => { setBusy(true); setNotice(''); setConflict(null); try { const updated = await localApi.runProjectAction({ path, baseRevision: project.revision, action }); onUpdated(updated); return updated; } catch (error) { setNotice(error.message); if (error.code === 'REVISION_CONFLICT') setConflict(error.details); throw error; } finally { setBusy(false); } };
  const reload = async () => { setBusy(true); try { onUpdated(await localApi.openProject(path)); setConflict(null); setNotice('Projeto recarregado com a revisão mais recente.'); } finally { setBusy(false); } };
  const [agentWaiting, setAgentWaiting] = useState(null);
  const revisionRef = useRef(project.revision); revisionRef.current = project.revision;
  const busyRef = useRef(false); busyRef.current = busy;
  // Ao vivo: quando a IA muda o projeto pelo MCP, a tela recarrega; e mostra quando ela espera uma decisão.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const live = await localApi.productionLive({ path });
        if (!active) return;
        setAgentWaiting(live.agentWaiting);
        if (live.revision > revisionRef.current && !busyRef.current) onUpdated(await localApi.openProject(path));
      } catch { /* app offline: o aviso global cuida disso */ }
    };
    tick(); const timer = window.setInterval(tick, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [path]);
  const approve = () => run({ type: 'stage.approve', stageId: activeStage.id, expectedRevision: activeStage.revision }).catch(() => null);
  const approval = <StageApproval stage={activeStage} missing={missing} busy={busy} agentWaiting={agentWaiting} onApprove={approve} onRequestChanges={() => setReasonFor({ kind: 'changes', stageId: activeStage.id })}/>;
  const runAutonomous = () => run({ type: 'workflow.run', stageId: activeStage.id, jobId: `job_${Date.now()}` }).catch(() => null);
  const [reasonFor, setReasonFor] = useState(null);
  const requestChanges = () => setReasonFor({ kind: 'changes', stageId: activeStage.id });
  const reopen = stageId => setReasonFor({ kind: 'reopen', stageId });
  const reasonDialog = reasonFor && <ReasonDialog title={reasonFor.kind === 'changes' ? 'Pedir mudanças' : `Reabrir ${stageLabels[reasonFor.stageId]}`} label={reasonFor.kind === 'changes' ? 'O que precisa mudar nesta etapa?' : 'Por que esta etapa será reaberta?'} confirm={reasonFor.kind === 'changes' ? 'Pedir mudanças' : 'Reabrir etapa'} onClose={() => setReasonFor(null)} onSubmit={async reason => { await run({ type: reasonFor.kind === 'changes' ? 'stage.request_changes' : 'stage.reopen', stageId: reasonFor.stageId, reason }); setReasonFor(null); }}/>;
  if (screen === 'timeline') return <main id="main" className="creative-editor wide"><header className="editor-top"><button className="text-button" onClick={() => setScreen('workflow')}><ArrowLeft size={16}/> Fluxo do projeto</button><div><span className="eyebrow">{project.title}</span><h1>Timeline</h1></div></header><TimelineEditor details={details} onUpdated={onUpdated}/></main>;
  // Etapa aprovada aberta só para ver: nada é salvo e ela não é reaberta.
  const viewStage = viewing && project.stages.find(stage => stage.id === viewing)?.state === 'approved' ? viewing : null;
  const openStage = stageId => { setViewing(stageId); setScreen('editor'); };
  const backToFlow = () => { setViewing(null); setScreen('workflow'); };
  const viewBar = viewStage && <ViewOnlyBar stageId={viewStage} current={activeStage} busy={busy} onReopen={() => reopen(viewStage)} onCurrent={() => setViewing(null)}/>;
  if (screen === 'editor') return <><CreativeEditor key={viewStage || activeStage.id} details={details} stageId={viewStage || activeStage.id} readOnly={Boolean(viewStage)} approval={viewBar || approval} onBack={backToFlow} onUpdated={onUpdated} setup={setup} onOpenSetup={onOpenSetup} onOpenVoice={onOpenVoice}/>{reasonDialog}</>;
  const latestJob = project.workflowJobs?.[0];
  return <main id="main" className="workspace"><button className="text-button" aria-label="Voltar aos projetos" onClick={onBack}><ArrowLeft size={16}/> Projetos</button><header className="project-header"><div><span className="eyebrow">{typeLabels[project.type]} · {project.aspectRatio}</span><h1>{project.title}</h1></div><div className="header-actions"><button className="button quiet" onClick={() => setConfiguring(true)}><Settings2 size={18}/> Configurar</button><button className="button quiet" onClick={() => setScreen('timeline')}><Film size={18}/> Timeline</button><button className="button primary" onClick={() => openStage(null)}>Continuar: {stageLabels[activeStage.id]} <ArrowRight size={18}/></button></div></header>
    {notice && <div className={`notice ${conflict ? 'error' : ''}`} role="alert"><X size={16}/><span>{notice}</span>{conflict && <><button className="mini-button" onClick={reload}>Recarregar</button><details><summary>Comparar</summary><p>Sua base: revisão {conflict.expected}. Em disco: revisão {conflict.actual}.</p></details></>}</div>}
    <section className="workflow-card" aria-labelledby="workflow-title"><div className="section-title"><div><span className="eyebrow">Fluxo do projeto</span><h2 id="workflow-title">Da ideia ao pacote final</h2></div><div className="flow-summary"><Sparkles size={15} aria-hidden="true"/><span>{flowSummary(project)}</span><button className="mini-button" disabled={busy} onClick={() => setConfiguring(true)}>Mudar fluxo</button></div></div>
      {project.mode === 'autonomous' && <div className="rights-note"><strong>Fluxo automático</strong><span>O Content Lab prepara e verifica a etapa, mas sempre para por direitos, consentimento, custo ou aprovação. Nunca publica automaticamente.</span><button className="mini-button" disabled={busy} onClick={runAutonomous}>Executar etapa atual</button></div>}
      {latestJob && <div className="automation-job" role="status"><strong>Último job · {stageLabels[latestJob.stageId]}</strong><span>{latestJob.log.join(' · ')} · base r{latestJob.baseRevision}</span></div>}
      <ol className="workflow-list">{project.stages.map((stage, index) => <li className={stage.state === 'approved' ? 'done' : stage.id === activeStage.id ? 'active' : ''} key={stage.id}><span className="step-index">{stage.state === 'approved' ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span><strong>{stageLabels[stage.id]}</strong><small>{stateLabel(stage.state)}{stage.state === 'invalidated' && ` · depende de ${stage.dependsOn.map(id => stageLabels[id]).join(', ')}`}{isStageBlocked(stage.id, setup) && <span className="lock-note"> · <Lock size={12} aria-hidden="true"/> requer dependências</span>}</small></span><span className="stage-actions">{stage.id === activeStage.id && <button className="mini-button" onClick={() => openStage(null)}>Abrir etapa</button>}{stage.state === 'approved' && <button className="mini-button" aria-label={`Ver ${stageLabels[stage.id]}`} onClick={() => openStage(stage.id)}><Eye size={14} aria-hidden="true"/> Ver</button>}{stage.state === 'approved' && <button className="reopen-button" disabled={busy} onClick={() => reopen(stage.id)}><RotateCcw size={14}/> Reabrir</button>}</span></li>)}</ol>
      {missing.length > 0 && <div className="notice info" role="status"><span>Para aprovar {stageLabels[activeStage.id]}, preencha: {missing.join(', ')}.</span><button className="mini-button" onClick={() => openStage(null)}>Preencher agora</button></div>}
      {approval}</section>
    {(project.changeRequests || []).length > 0 && <section className="history-card" aria-labelledby="changes-title"><div className="section-title"><h2 id="changes-title"><MessageSquareText size={20}/> Pedidos de mudança</h2></div><ul>{project.changeRequests.map(item => <li key={item.id}><span><strong>{stageLabels[item.stageId]}</strong> · {item.reason} · {item.author}</span><small>{item.status === 'open' ? `aberto na revisão ${item.requestedRevision}` : `resolvido na revisão ${item.resolvedRevision}`}</small></li>)}</ul></section>}
    <section className="history-card" aria-labelledby="history-title"><div className="section-title"><h2 id="history-title"><History size={20}/> Histórico</h2><span>{history.length} {history.length === 1 ? 'evento' : 'eventos'}</span></div>{history.length ? <ul>{history.map(event => <li key={event.id}><span>{eventLabel(event)}</span><small>revisão {event.revision}</small></li>)}</ul> : <div className="empty-state">Nenhum evento registrado.</div>}</section>{configuring && <ConfigDialog project={project} busy={busy} onClose={() => setConfiguring(false)} onSave={async values => { await run({ type: 'project.update', ...values }); setConfiguring(false); }}/>}{reasonDialog}</main>;
}

/** No lugar da aprovação quando se vê uma etapa já aprovada: deixa claro que nada muda sem reabrir. */
function ViewOnlyBar({ stageId, current, busy, onReopen, onCurrent }) {
  return <div className="approval-bar view-only-bar" role="note">
    <div><span className="eyebrow"><Eye size={13} aria-hidden="true"/> Só visualização</span><strong>{stageLabels[stageId]} · aprovada</strong>
      <small>Nada é alterado aqui. Para mudar esta etapa, reabra: as etapas seguintes voltam para revisão.</small></div>
    <button className="button quiet" disabled={busy} onClick={onReopen}><RotateCcw size={17} aria-hidden="true"/> Reabrir etapa</button>
    <button className="button primary" onClick={onCurrent}>Ir para a etapa atual: {stageLabels[current.id]} <ArrowRight size={17} aria-hidden="true"/></button>
  </div>;
}

/** Barra de aprovação da etapa atual: aparece no fluxo e dentro do editor da etapa. */
function StageApproval({ stage, missing, busy, agentWaiting, onApprove, onRequestChanges }) {
  const open = ['active', 'changes_requested', 'invalidated'].includes(stage.state);
  const waiting = agentWaiting?.stageId === stage.id;
  return <div className={`approval-bar ${waiting ? 'agent-waiting' : ''}`}>
    <div><span className="eyebrow">Etapa atual</span><strong>{stageLabels[stage.id]}</strong>
      {waiting && <span className="agent-note" role="status"><Sparkles size={14} aria-hidden="true"/> A IA está esperando você revisar esta etapa. Aprovar ou pedir mudanças avisa a IA; você também pode responder pelo chat.</span>}
      {missing.length > 0 && <small>Para aprovar, falta: {missing.join(', ')}.</small>}
    </div>
    <button className="button quiet" onClick={onRequestChanges} disabled={busy}><MessageSquareText size={17}/> Pedir mudanças</button>
    <button className="button primary" disabled={busy || missing.length > 0 || !open} title={missing.length ? `Falta: ${missing.join(', ')}` : undefined} onClick={onApprove}><Check size={17}/> Aprovar e seguir</button>
  </div>;
}

function ConfigDialog({ project, busy, onClose, onSave }) {
  const [title, setTitle] = useState(project.title); const [projectType, setProjectType] = useState(project.type); const [aspectRatio, setAspectRatio] = useState(project.aspectRatio);
  const [preset, setPreset] = useState(flowPreset(project));
  const ref = useDialogFocus(onClose, busy);
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="config-title" onSubmit={event => { event.preventDefault(); onSave({ title: title.trim(), projectType, aspectRatio, ...flowFromPreset(preset) }); }}><div className="section-title"><h2 id="config-title">Configurar projeto</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X aria-hidden="true"/></button></div><label>Título<input name="title" autoComplete="off" required value={title} onChange={event => setTitle(event.target.value)}/></label><label>Formato<select value={projectType} onChange={event => { setProjectType(event.target.value); if (event.target.value === 'short') setAspectRatio('9:16'); if (event.target.value === 'long') setAspectRatio('16:9'); }}><option value="long">Vídeo longo</option><option value="short">Short</option><option value="custom">Personalizado</option></select></label><label>Proporção<select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}><option value="16:9">16:9 · horizontal</option><option value="9:16">9:16 · vertical</option><option value="1:1">1:1 · quadrado</option><option value="4:5">4:5 · retrato</option></select></label><ProjectFlowFields name="config" preset={preset} onPreset={setPreset}/><p className="hint">Quem narra (sua voz de IA clonada ou você gravando) é escolhido na etapa Narração.</p><div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div></form></div>;
}

function CreativeEditor({ details, stageId, readOnly = false, approval, onBack, onUpdated, setup, onOpenSetup, onOpenVoice }) {
  const { project, path } = details; const initialTab = stageId === 'packaging' ? 'package' : stageId === 'brief' ? 'brief' : 'script';
  // Só aparecem as partes já abertas no fluxo: na Ideia não há roteiro nem embalagem ainda.
  const tabStage = { brief: 'brief', package: 'packaging', script: 'script' };
  const tabs = [['brief', Sparkles, 'Ideia'], ['package', Tag, 'Título e thumbnail'], ['script', FileText, 'Roteiro']].filter(([id]) => project.stages.find(stage => stage.id === tabStage[id])?.state !== 'pending'); const [tab, setTab] = useState(initialTab); const [creative, setCreative] = useState(() => structuredClone(project.creative)); const [saveState, setSaveState] = useState('Salvo em disco'); const [dirty, setDirty] = useState(false); const timer = useRef(null); const currentRevision = useRef(project.revision);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A IA escreveu pelo MCP enquanto a tela estava aberta: mostra o texto novo se não há edição pendente.
  useEffect(() => { if (!dirty && project.revision > currentRevision.current) { currentRevision.current = project.revision; setCreative(structuredClone(project.creative)); } }, [project.revision]);
  useEffect(() => { setTab(initialTab); }, [stageId]);
  const change = (section, key, value) => { if (readOnly) return; const next = { ...creative, [section]: { ...creative[section], [key]: value } }; setCreative(next); setDirty(true); setSaveState('Salvando…'); window.clearTimeout(timer.current); timer.current = window.setTimeout(async () => { try { const updated = await localApi.runProjectAction({ path, baseRevision: currentRevision.current, action: { type: 'creative.update', creative: next } }); currentRevision.current = updated.project.revision; setDirty(false); setSaveState('Salvo em disco'); onUpdated(updated); } catch (error) { setSaveState(`Erro: ${error.message}`); } }, 500); };
  if (!['brief', 'script', 'packaging'].includes(stageId)) return <OperationalStage details={details} stageId={stageId} readOnly={readOnly} approval={approval} onBack={onBack} onUpdated={onUpdated} setup={setup} onOpenSetup={onOpenSetup} onOpenVoice={onOpenVoice}/>;
  return <main id="main" className="creative-editor"><header className="editor-top"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/> Fluxo do projeto</button><div><span className="eyebrow">{project.title}</span><h1>{stageLabels[stageId]}</h1></div>{readOnly ? <span className="save-state view-only"><Eye size={15} aria-hidden="true"/>Só visualização</span> : <span className={`save-state ${dirty ? 'saving' : ''}`} role="status"><Save size={15}/>{saveState}</span>}</header><div className="editor-tabs" role="tablist" aria-label="Partes do conteúdo" onKeyDown={event => { const order = tabs.map(([id]) => id); const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!step) return; event.preventDefault(); const next = order[(order.indexOf(tab) + step + order.length) % order.length]; setTab(next); document.getElementById(`tab-${next}`)?.focus(); }}>{tabs.map(([id, Icon, label]) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="creative-panel" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}><Icon size={17} aria-hidden="true"/> {label}</button>)}</div><div id="creative-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>{tab === 'brief' ? <BriefPanel readOnly={readOnly} value={creative.brief} onChange={(key, value) => change('brief', key, value)}/> : tab === 'script' ? <ScriptPanel readOnly={readOnly} project={project} value={creative.script} onChange={(key, value) => change('script', key, value)}/> : <PackagingPanel readOnly={readOnly} path={path} value={creative.packaging} media={project.media} onChange={(key, value) => change('packaging', key, value)}/>}</div>{approval}</main>;
}

function BriefPanel({ value, onChange, readOnly }) { return <section className="packaging"><div className="metadata-form"><h2>A ideia do vídeo</h2><label>Tese<span className="field-hint">A ideia central em uma frase. Obrigatória para aprovar.</span><textarea readOnly={readOnly} rows="4" value={value.thesis} onChange={event => onChange('thesis', event.target.value)}/></label><label>Público<span className="field-hint">Para quem é o vídeo. Ex.: fãs de HQ que só viram os filmes.</span><input readOnly={readOnly} value={value.audience} onChange={event => onChange('audience', event.target.value)}/></label><label>Promessa<span className="field-hint">O que a pessoa ganha ao assistir até o fim.</span><input readOnly={readOnly} value={value.promise} onChange={event => onChange('promise', event.target.value)}/></label><label>Notas<span className="field-hint">Opcional: referências, fontes, ideias soltas.</span><textarea readOnly={readOnly} rows="5" value={value.notes} onChange={event => onChange('notes', event.target.value)}/></label></div></section>; }
function PackagingPanel({ path, value, media, onChange, readOnly }) { const images = media.filter(item => item.kind === 'image'); const variants = [['A', value.thumbnailA], ['B', value.thumbnailB]].filter(([, id]) => id && media.some(item => item.id === id)); return <section className="packaging"><div className="metadata-form"><h2>Títulos e metadados</h2><label>Título A<input readOnly={readOnly} value={value.titleA} onChange={event => onChange('titleA', event.target.value)}/></label><label>Título B<input readOnly={readOnly} value={value.titleB} onChange={event => onChange('titleB', event.target.value)}/></label><label>Descrição<textarea readOnly={readOnly} rows="5" value={value.description} onChange={event => onChange('description', event.target.value)}/></label><label>Tags<input readOnly={readOnly} value={value.tags} onChange={event => onChange('tags', event.target.value)}/></label><label>Notas de SEO<textarea readOnly={readOnly} rows="3" value={value.seo} onChange={event => onChange('seo', event.target.value)}/></label></div><div className="thumb-panel"><h2>Thumbnail</h2>{variants.length > 0 && <div className="thumb-variants">{variants.map(([label, id]) => <figure key={label}><img src={mediaUrl(path, id)} alt={`Thumbnail ${label}`}/><figcaption>Thumbnail {label}</figcaption></figure>)}</div>}{images.length ? <label>Arquivo do catálogo<select disabled={readOnly} value={value.thumbnailMediaId || ''} onChange={event => onChange('thumbnailMediaId', event.target.value || null)}><option value="">Nenhuma</option>{images.map(item => <option key={item.id} value={item.id}>{item.uri.split('/').at(-1)}</option>)}</select></label> : <div className="empty-state"><strong>Nenhuma imagem no catálogo.</strong><span>Importe uma imagem em Mídias locais para vinculá-la aqui.</span></div>}</div></section>; }

const ASSISTS = {
  media: [{ id: 'audio', label: 'Gerar efeitos sonoros', hint: 'SFX originais (whoosh, ding, boom, riser) e uma trilha de rascunho. Para publicar, importe uma trilha licenciada.', run: path => localApi.productionAudio({ path }), done: result => `${Object.keys(result.sfx || {}).length} efeitos e trilha de rascunho (${result.seconds} s) adicionados às mídias.` }, { id: 'slides', label: 'Gerar slides do roteiro', hint: 'Um slide com texto por cena, para vídeos sem filmagem própria.', run: path => localApi.productionSlides({ path }), done: result => `${result.slides.length} slide(s) adicionados às mídias.` }],
  edit: [{ id: 'motion', label: 'Montar em motion (composição)', hint: 'O vídeo inteiro no kit de motion: beats no ritmo da fala, cenas das obras, personagem do projeto em poses (se houver) e som em cada troca. Transcreva a narração antes.', run: path => localApi.productionMotionAuto({ path }), done: result => `Plano com ${result.beats} beats em ${result.durationSeconds} s (média ${result.averageBeat} s).${result.warnings?.length ? ` ${result.warnings.join(' ')}` : ''} Renderize para ver.` }, { id: 'assemble-hq', label: 'Montar no estilo HQ', hint: 'Cenas HQ com uma imagem do assunto por frase, trilha sob a voz, efeitos e legendas. Exige imagens importadas.', run: (path, details) => { const media = details.project.media; return localApi.productionAssemble({ path, scenes: 'auto', music: media.some(item => item.role === 'music'), sfx: media.some(item => item.role === 'sfx') }); }, done: result => `Montado: ${result.sceneClips} cena(s) com ${result.images} imagem(ns)${result.music ? ', trilha' : ''}${result.sfx ? ', efeitos' : ''}, ${result.captions || 0} legenda(s), ${result.durationSeconds.toFixed(1)} s.` }, { id: 'assemble', label: 'Montar timeline automaticamente', hint: 'Narração montada no áudio, mídias cobrindo a duração e legendas do roteiro. Dá para desfazer na timeline.', run: path => localApi.productionAssemble({ path }), done: result => `Timeline montada: ${result.visualClips} clip(s), ${result.captions || 0} legenda(s), ${result.durationSeconds.toFixed(1)} s.` }],
  review: [
    { id: 'thumbnails', label: 'Gerar thumbnails A/B', hint: 'A e B no estilo do kit: cena da obra, palavras de impacto do título e o personagem do projeto, se houver.', run: path => localApi.productionThumbnails({ path }), done: () => 'Thumbnails A e B salvas na embalagem.' },
    { id: 'deliverable', label: 'Montar pasta de entrega', hint: 'output/entrega: roteiro, títulos, descrição e capítulos, thumbnails, vídeo final e a lista do que foi conferido.', run: path => localApi.productionDeliverable({ path }), done: result => `Entrega em ${result.directory}${result.complete ? ', tudo conferido' : `; pendente: ${(result.checks || []).filter(item => !item.ok).map(item => item.label).join(', ')}`}.` },
  ],
};

function ProductionAssist({ stageId, details, onUpdated }) {
  const [busy, setBusy] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const items = ASSISTS[stageId]; if (!items) return null;
  const run = async item => { setBusy(item.id); setMessage(''); setError(''); try { const result = await item.run(details.path, details); setMessage(item.done(result)); onUpdated(await localApi.openProject(details.path)); } catch (issue) { setError(issue.message); } finally { setBusy(null); } };
  return <section className="workflow-card" aria-labelledby="assist-title"><div className="section-title"><h2 id="assist-title">Produção assistida</h2></div>
    <ul className="media-list">{items.map(item => <li key={item.id}><span><strong>{item.label}</strong><small>{item.hint}</small></span><button className="mini-button" aria-label={`Executar: ${item.label}`} disabled={Boolean(busy)} onClick={() => run(item)}>{busy === item.id ? 'Gerando…' : 'Executar'}</button></li>)}</ul>
    <div aria-live="polite">{message && <p className="notice" role="status">{message}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
  </section>;
}

function OperationalStage({ details, stageId, readOnly = false, approval, onBack, onUpdated, setup, onOpenSetup, onOpenVoice }) {
  const requirement = STAGE_REQUIREMENTS[stageId];
  const renderBlocked = setup ? featureBlock('render', setup.items) : [];
  const note = { narration: 'Escolha quem narra, grave ou importe takes, ouça o preview do tratamento e monte a narração. A voz de IA usa o perfil gravado em “Minha voz”.', edit: 'Monte os clips, legendas e enquadramentos. O preview usa o mesmo plano do render final.', media: 'Use Mídias locais na barra lateral para importar e verificar os arquivos.', review: 'O arquivo só é anunciado como concluído depois da validação com FFprobe.' }[stageId];
  return <main id="main" className="creative-editor"><header className="editor-top"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/> Fluxo do projeto</button><div><span className="eyebrow">{details.project.title}</span><h1>{stageLabels[stageId]}</h1></div></header><StageGate stageId={stageId} setup={setup} onOpenSetup={onOpenSetup}><section className="workflow-card"><div className="section-title"><h2>Recursos desta etapa</h2></div><FeatureList features={requirement?.features} setup={setup} onOpenSetup={onOpenSetup}/>{note && <div className="rights-note"><strong>{stageLabels[stageId]}</strong><span>{note}</span></div>}</section>{stageId === 'review' && <RenderPanel projectPath={details.path} blocked={renderBlocked} onOpenSetup={onOpenSetup}/>} {stageId === 'media' && readOnly && <MediaOverview details={details}/>}{stageId === 'narration' && (readOnly ? <fieldset className="view-only-fieldset" disabled><legend className="sr-only">Narração aprovada, só visualização</legend><NarrationStudio details={details} setup={setup} onOpenSetup={onOpenSetup} onUpdated={onUpdated} onOpenVoice={onOpenVoice}/></fieldset> : <NarrationStudio details={details} setup={setup} onOpenSetup={onOpenSetup} onUpdated={onUpdated} onOpenVoice={onOpenVoice}/>)} {stageId === 'edit' && <TimelineEditor details={details} onUpdated={onUpdated} readOnly={readOnly}/>}</StageGate>{!readOnly && <ProductionAssist stageId={stageId} details={details} onUpdated={onUpdated}/>}{approval}</main>;
}

const ROLE_LABELS = { content: 'Assunto', thumbnail: 'Thumbnail', slide: 'Slide', narration: 'Narração', music: 'Trilha', sfx: 'Efeito', background: 'Fundo', character: 'Personagem' };
const RIGHTS_LABELS = { owned: 'Própria', licensed: 'Licenciada', authorized: 'Autorizada', pending: 'Direitos pendentes' };

/** O que entrou na etapa Mídia, para revisar sem abrir a biblioteca. */
function MediaOverview({ details }) {
  const media = details.project.media;
  return <section className="workflow-card" aria-labelledby="media-overview-title"><div className="section-title"><h2 id="media-overview-title">Mídias do projeto</h2><span className="muted">{media.length} {media.length === 1 ? 'arquivo' : 'arquivos'}</span></div>
    {media.length ? <ul className="media-overview">{media.map(item => <li key={item.id}>
      {item.kind === 'image' ? <img src={mediaUrl(details.path, item.id)} alt="" loading="lazy"/> : item.kind === 'video' ? <video src={mediaUrl(details.path, item.id)} controls preload="metadata" aria-label={`Ver ${item.name || item.id}`}/> : item.kind === 'audio' ? <audio src={mediaUrl(details.path, item.id)} controls preload="none" aria-label={`Ouvir ${item.name || item.id}`}/> : null}
      <span><strong>{item.name || item.uri.split('/').at(-1)}</strong><small>{[ROLE_LABELS[item.role], RIGHTS_LABELS[item.rights]].filter(Boolean).join(' · ')}</small></span>
    </li>)}</ul> : <div className="empty-state">Nenhuma mídia no projeto.</div>}
  </section>;
}

function NewProjectDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState(''); const [type, setType] = useState('long'); const [parentDirectory, setParentDirectory] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState('auto');
  const ref = useDialogFocus(onClose, busy); const titleRef = useRef(null);
  const chooseLocation = async () => { setError(''); try { const result = await localApi.chooseDirectory('Onde criar o projeto?'); if (result.path) setParentDirectory(result.path); } catch (issue) { setError(issue.message); } };
  const submit = async event => { event.preventDefault(); if (!title.trim()) { setError('Dê um título ao vídeo para criar o projeto.'); titleRef.current?.focus(); return; } setBusy(true); setError(''); try { await onCreate({ title: title.trim(), type, aspectRatio: type === 'short' ? '9:16' : '16:9', ...flowFromPreset(preset), ...(parentDirectory ? { parentDirectory } : {}) }); } catch (issue) { setError(issue.message); setBusy(false); } };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title" noValidate onSubmit={submit}><div className="section-title"><div><span className="eyebrow">Projeto local</span><h2 id="new-project-title">Novo vídeo</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X aria-hidden="true"/></button></div><div aria-live="polite">{error && <div className="notice error" role="alert">{error}</div>}</div><label>Título<input ref={titleRef} name="title" autoComplete="off" autoFocus required aria-invalid={Boolean(error && !title.trim())} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Por que o Superman não perde…"/></label><fieldset><legend>Formato</legend><label><input type="radio" name="type" checked={type === 'long'} onChange={() => setType('long')}/> Vídeo longo · 16:9<span className="option-hint">Legenda só no gancho e nos apartes do personagem.</span></label><label><input type="radio" name="type" checked={type === 'short'} onChange={() => setType('short')}/> Short · 9:16<span className="option-hint">Vertical, com legenda o tempo todo.</span></label></fieldset><ProjectFlowFields name="new" preset={preset} onPreset={setPreset}/><div className="location-picker"><span><strong>Pasta</strong><small>{parentDirectory || 'Pasta padrão do Content Lab'}</small></span><button type="button" className="button quiet" onClick={chooseLocation}>Escolher pasta</button></div><p className="hint">Quem narra é escolhido na etapa Narração, com o roteiro na mão. Dá para mudar o fluxo depois, em Configurar.</p><div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Criando…' : 'Criar projeto'}</button></div></form></div>;
}

function PackageImportDialog({ preview: initial, onClose, onImported }) {
  const [preview, setPreview] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const ref = useDialogFocus(onClose, busy);
  const chooseDestination = async () => { const choice = await localApi.chooseDirectory('Onde importar o projeto?'); if (choice.path) { setError(''); try { setPreview(await localApi.inspectPackage({ packagePath: preview.packagePath, parentDirectory: choice.path })); } catch (issue) { setError(issue.message); } } };
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onImported(await localApi.importPackage({ packagePath: preview.packagePath, parentDirectory: preview.parentDirectory })); } catch (issue) { setError(issue.message); setBusy(false); } };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label="Importar pacote" onSubmit={submit}><div className="section-title"><div><span className="eyebrow">Prévia do pacote</span><h2>{preview.project.title}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div>{error && <div className="notice error" role="alert">{error}</div>}<dl className="target"><dt>Formato</dt><dd>{preview.format}</dd><dt>Projeto</dt><dd>{preview.project.id} · revisão {preview.project.revision}</dd><dt>Conteúdo</dt><dd>{preview.files} arquivos · {formatBytes(preview.logicalSize)}</dd><dt>Pacote</dt><dd>{formatBytes(preview.archiveSize)}</dd><dt>Destino</dt><dd>{preview.destination}</dd></dl>{preview.conflict && <div className="notice error" role="alert">Já existe um projeto nesse destino. Nada será sobrescrito; escolha outra pasta.</div>}<div className="dialog-actions"><button type="button" className="button quiet" onClick={chooseDestination}>Escolher destino</button><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || preview.conflict}>{busy ? 'Importando…' : 'Importar'}</button></div></form></div>;
}

function PackageExportDialog({ project, format, onClose, onExported }) {
  const [outputDirectory, setOutputDirectory] = useState(''); const [includeRenders, setIncludeRenders] = useState(false); const [includeCache, setIncludeCache] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const ref = useDialogFocus(onClose, busy);
  const choose = async () => { const choice = await localApi.chooseDirectory('Onde salvar a exportação?'); if (choice.path) setOutputDirectory(choice.path); };
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onExported(await localApi.exportProject({ path: project.path, outputDirectory, format, includeRenders, includeCache })); } catch (issue) { setError(issue.message); setBusy(false); } };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label="Exportar projeto" onSubmit={submit}><div className="section-title"><div><span className="eyebrow">Pacote {format}</span><h2>Exportar projeto</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div>{error && <div className="notice error" role="alert">{error}</div>}<div className="location-picker"><span><strong>Destino</strong><small>{outputDirectory || 'Escolha uma pasta fora do projeto'}</small></span><button type="button" className="button quiet" onClick={choose}>Escolher</button></div><label className="check"><input type="checkbox" checked={includeRenders} onChange={event => setIncludeRenders(event.target.checked)}/> Incluir renders prontos</label><label className="check"><input type="checkbox" checked={includeCache} onChange={event => setIncludeCache(event.target.checked)}/> Incluir caches e prévias</label><p className="hint">O projeto, a timeline e as mídias vinculadas são sempre incluídos.</p><div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !outputDirectory}>{busy ? 'Exportando…' : 'Exportar'}</button></div></form></div>;
}

function formatBytes(value) { if (!Number.isFinite(value)) return '—'; if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }

function stateLabel(state) { return ({ pending: 'Aguardando', active: 'Em andamento', changes_requested: 'Mudanças solicitadas', approved: 'Aprovado', invalidated: 'Precisa de nova revisão' })[state] || state; }
function eventLabel(event) { if (event.type === 'project.created') return 'Projeto criado'; if (event.type === 'operation.applied') return `Alteração salva: ${(event.actions || []).join(', ')}`; return event.type || 'Alteração registrada'; }

export function ConnectionBanner() {
  const [offline, setOffline] = useState(false); const [checking, setChecking] = useState(false);
  useEffect(() => { const handle = event => setOffline(!event.detail.online); window.addEventListener(OFFLINE_EVENT, handle); return () => window.removeEventListener(OFFLINE_EVENT, handle); }, []);
  if (!offline) return null;
  return <div className="notice error connection-banner" role="alert"><X size={16}/><span><strong>Sem conexão com o servidor local.</strong> Nada foi perdido: o que já está em disco continua salvo. Reabra o Content Lab se ele foi fechado.</span><button className="mini-button" disabled={checking} onClick={async () => { setChecking(true); try { await localApi.health(); } catch { /* segue offline */ } finally { setChecking(false); } }}>{checking ? 'Verificando…' : 'Tentar de novo'}</button></div>;
}

function ShutdownButton({ onDone }) {
  const [asking, setAsking] = useState(null); const [error, setError] = useState('');
  const open = async () => { setError(''); try { setAsking((await localApi.serverWork()).work); } catch (issue) { setError(issue.message); } };
  return <>
    <button className="nav-item shutdown" onClick={open}><Power size={18}/> Desligar</button>
    {error && <small className="missing" role="alert">{error}</small>}
    {asking && <ConfirmDialog title="Desligar o Content Lab" message={asking.length ? 'Isto ainda está em andamento e será interrompido:' : 'Fecha o servidor local e todos os processos do Content Lab (render, importações, voz, downloads). Projetos já salvos não são afetados.'} details={asking.map(item => `${item.label}${item.resumes ? ' — continua quando você abrir de novo' : ''}`)} confirm={asking.length ? 'Interromper e desligar' : 'Desligar'} onClose={() => setAsking(null)} onConfirm={async () => { try { await localApi.shutdown(true); setAsking(null); onDone(); } catch (issue) { setError(issue.message); setAsking(null); } }}/>}
  </>;
}

function ShutDownScreen() {
  return <main id="main" className="shutdown-screen" role="status"><Logo/><h1>Content Lab desligado</h1><p>Tudo foi encerrado. Pode fechar esta aba.</p><p>Para abrir de novo, rode <code>npm run app</code> na pasta do Content Lab{' '}(ou use o atalho do menu, no app instalado).</p></main>;
}

export function App() {
  const query = new URLSearchParams(window.location.search);
  return query.get('view') === 'narration-script' ? <NarrationReader projectPath={query.get('project')}/> : <ContentLabApp/>;
}

function ContentLabApp() {
  const [shutDown, setShutDown] = useState(false);
  if (shutDown) return <ShutDownScreen/>;
  return <AppShell onShutDown={() => setShutDown(true)}/>;
}

function AppShell({ onShutDown }) {
  const [selected, setSelected] = useState(null); const [section, setSection] = useState('projects'); const [items, setItems] = useState([]); const [creating, setCreating] = useState(false); const [homeNotice, setHomeNotice] = useState(''); const [loading, setLoading] = useState(true); const [serverError, setServerError] = useState('');
  useEffect(() => { localApi.listProjects().then(({ projects }) => setItems(projects)).catch(error => setServerError(error.message)).finally(() => setLoading(false)); }, []);
  const [setupInfo, setSetupInfo] = useState(null); const [firstRun, setFirstRun] = useState(false);
  // Link direto (?project=<pasta>): a IA abre o projeto no navegador da pessoa para ela acompanhar.
  const [linkedProject] = useState(() => { try { return new URLSearchParams(window.location.search).get('project'); } catch { return null; } });
  useEffect(() => { if (linkedProject) localApi.openProject(linkedProject).then(details => { setSelected(details); setSection('projects'); }).catch(error => setHomeNotice(error.message)); }, []);
  const refreshSetup = () => localApi.setupStatus().then(status => { setSetupInfo(status); return status; }).catch(() => null);
  useEffect(() => { refreshSetup().then(status => { if (status && !linkedProject && !status.onboarding.completedAt && !status.onboarding.dismissedAt) { setFirstRun(true); setSection('setup'); } }); }, []);
  const [setupFocus, setSetupFocus] = useState([]);
  const openSetup = (ids = []) => { setSetupFocus(ids); setSection('setup'); };
  const closeSetup = () => { setFirstRun(false); setSetupFocus([]); setSection('projects'); refreshSetup(); };
  const acceptDetails = details => { setSelected(details); if (!selected) setSection('projects'); if (details.card) setItems(previous => [details.card, ...previous.filter(item => item.path !== details.card.path)]); };
  const openRecent = async card => { setHomeNotice(''); try { acceptDetails(await localApi.openProject(card.path)); } catch (error) { setHomeNotice(error.message); } };
  const createProject = async input => { acceptDetails(await localApi.createProject(input)); setCreating(false); };
  const chooseAndOpen = async () => { setHomeNotice(''); try { const choice = await localApi.chooseDirectory('Abrir projeto do Content Lab'); if (choice.path) acceptDetails(await localApi.openProject(choice.path)); } catch (error) { setHomeNotice(error.message); } };
  const chooseAndImport = async () => { setHomeNotice(''); try { const choice = await localApi.choosePackage('Importar projeto do Content Lab'); if (choice.path) setDialog({ kind: 'import', preview: await localApi.inspectPackage({ packagePath: choice.path }) }); } catch (error) { setHomeNotice(error.message); } };
  const [dialog, setDialog] = useState(null); const [homeStatus, setHomeStatus] = useState(null); const [actionBusy, setActionBusy] = useState(false);
  const replaceCard = (oldPath, card) => setItems(previous => { const rest = previous.filter(item => item.path !== oldPath && item.path !== card?.path); return card ? [card, ...rest] : rest; });
  const projectAction = async (action, card) => {
    setHomeNotice(''); setHomeStatus(null);
    if (action === 'open') return openRecent(card);
    if (action === 'rename' || action === 'delete') return setDialog({ kind: action, project: card });
    setActionBusy(true);
    try {
      if (action === 'reveal') await localApi.revealProject(card.path);
      if (action === 'relocate') { const choice = await localApi.chooseDirectory(`Onde está “${card.title}” agora?`); if (choice.path) { const details = await localApi.relocateProject({ path: card.path, newPath: choice.path }); replaceCard(card.path, details.card); setHomeStatus({ text: `“${details.project.title}” relocalizado em ${details.path}.` }); } }
      if (action === 'forget') { await localApi.forgetProject(card.path); replaceCard(card.path, null); setHomeStatus({ text: `“${card.title}” saiu dos Recentes. A pasta continua em ${card.path}.` }); }
      if (action === 'duplicate') { setHomeStatus({ text: 'Duplicando…' }); const copy = await localApi.duplicateProject({ path: card.path }); replaceCard(null, copy.card); setHomeStatus({ text: `Cópia criada: ${copy.project.title}` }); }
      if (action.startsWith('export-')) setDialog({ kind: 'export', project: card, format: action.slice('export-'.length) });
    } catch (error) { setHomeStatus(null); setHomeNotice(error.message); }
    finally { setActionBusy(false); }
  };
  const deleted = result => { setDialog(null); replaceCard(result.path, null); setHomeStatus({ text: result.method === 'trash' ? `“${result.title}” foi movido para a lixeira.` : `“${result.title}” foi excluído permanentemente.${result.backupPath ? ` Backup: ${result.backupPath}` : ''}`, undoPath: result.method === 'trash' ? result.path : null }); };
  const restore = async directory => { setHomeNotice(''); try { const details = await localApi.restoreProject(directory); replaceCard(null, details.card); setHomeStatus({ text: `“${details.project.title}” foi restaurado.` }); } catch (error) { setHomeNotice(error.message); } };
  return <div className="app-shell"><ConnectionBanner/><aside className="sidebar"><Logo/><nav aria-label="Principal"><button className={`nav-item ${section === 'projects' ? 'active' : ''}`} onClick={() => { setSection('projects'); if (!selected) setSelected(null); }}><LayoutTemplate size={19}/> Projetos</button><button className={`nav-item ${section === 'media' ? 'active' : ''}`} disabled={!selected} title={selected ? 'Abrir catálogo do projeto' : 'Abra um projeto para acessar suas mídias'} onClick={() => setSection('media')}><FolderOpen size={19}/> Mídias locais</button><button className={`nav-item ${section === 'setup' ? 'active' : ''}`} onClick={() => openSetup()}><Wrench size={19}/> Dependências</button><button className={`nav-item ${section === 'voice' ? 'active' : ''}`} aria-current={section === 'voice' ? 'page' : undefined} onClick={() => setSection('voice')}><Mic size={19} aria-hidden="true"/> Minha voz</button><button className={`nav-item ${section === 'docs' ? 'active' : ''}`} aria-current={section === 'docs' ? 'page' : undefined} onClick={() => setSection('docs')}><BookOpen size={19} aria-hidden="true"/> Documentação</button><button className={`nav-item ${section === 'settings' ? 'active' : ''}`} onClick={() => setSection('settings')}><SlidersHorizontal size={19}/> Configurações</button></nav><ShutdownButton onDone={onShutDown}/><div className="credit">Criado por <strong>Daniel Dias</strong></div></aside>{section === 'voice' ? <VoiceScreen setup={setupInfo} onOpenSetup={openSetup} onBack={() => setSection('projects')}/> : section === 'settings' ? <SettingsScreen onBack={() => setSection('projects')} onOpenSetup={openSetup} onChanged={async () => setSetupInfo(await localApi.setupStatus())}/> : section === 'docs' ? <DocsScreen onBack={() => setSection('projects')}/> : section === 'setup' ? <SetupWizard firstRun={firstRun} focus={setupFocus} onClose={closeSetup} onFinished={closeSetup} onChanged={setSetupInfo}/> : selected ? (section === 'media' ? <MediaLibrary details={selected} onBack={() => setSection('projects')} onUpdated={acceptDetails} setup={setupInfo} onOpenSetup={openSetup}/> : <ProjectWorkspace details={selected} onBack={() => setSelected(null)} onUpdated={acceptDetails} setup={setupInfo} onOpenSetup={openSetup} onOpenVoice={() => setSection('voice')}/>) : <main id="main" className="project-home"><header className="home-header"><div><span className="eyebrow">Seu espaço de criação</span><h1>Projetos locais</h1><p>Retome um vídeo ou comece uma nova produção.</p></div><button className="button primary" onClick={() => setCreating(true)} disabled={Boolean(serverError)}><Plus size={19}/> Novo projeto</button></header>{serverError && <div className="notice error" role="alert"><X size={16}/><span><strong>Servidor local indisponível.</strong> Inicie o Content Lab com <code>npm run dev</code>. {serverError}</span></div>}{setupInfo && !setupInfo.essentialsReady && <div className="notice error" role="alert"><X size={16}/><span>Faltam dependências essenciais: {setupInfo.items.filter(item => item.required && !item.ready).map(item => item.label).join(', ')}.</span><button className="mini-button" onClick={() => openSetup(setupInfo.items.filter(item => item.required && !item.ready).map(item => item.id))}>Ver dependências</button></div>}{homeNotice && <div className="notice error" role="alert"><X size={16}/>{homeNotice}</div>}<div aria-live="polite">{homeStatus && <div className="notice" role="status"><span>{homeStatus.text}</span>{homeStatus.undoPath && <button className="mini-button" onClick={() => restore(homeStatus.undoPath)}>Desfazer</button>}</div>}</div><div className="quick-actions"><button onClick={chooseAndOpen} disabled={Boolean(serverError)}><FolderOpen/><span><strong>Abrir projeto</strong><small>Escolher uma pasta local</small></span></button><button onClick={chooseAndImport} disabled={Boolean(serverError)}><ArrowRight/><span><strong>Importar pacote</strong><small>.contentlab ou ZIP</small></span></button></div><section aria-labelledby="recent-title"><div className="section-title"><h2 id="recent-title">Recentes</h2><span>{items.length} {items.length === 1 ? 'projeto' : 'projetos'}</span></div>{loading ? <p className="empty-state">Carregando projetos locais…</p> : items.length ? <div className="project-grid" aria-busy={actionBusy}>{items.map(project => <ProjectCard key={project.path} project={project} onOpen={openRecent} onAction={projectAction}/>)}</div> : <div className="empty-state"><strong>Nenhum projeto recente.</strong><span>Comece um vídeo novo ou abra a pasta de um projeto existente.</span><button className="button primary" onClick={() => setCreating(true)} disabled={Boolean(serverError)}><Plus size={17} aria-hidden="true"/> Criar o primeiro projeto</button></div>}</section>{creating && <NewProjectDialog onClose={() => setCreating(false)} onCreate={createProject}/>}{dialog?.kind === 'rename' && <RenameDialog project={dialog.project} onClose={() => setDialog(null)} onDone={(details, oldPath) => { setDialog(null); if (details) { replaceCard(oldPath, details.card); setHomeStatus({ text: `Projeto atualizado: ${details.project.title}` }); } }}/>}{dialog?.kind === 'delete' && <DeleteDialog project={dialog.project} onClose={() => setDialog(null)} onDeleted={deleted}/>}{dialog?.kind === 'import' && <PackageImportDialog preview={dialog.preview} onClose={() => setDialog(null)} onImported={details => { setDialog(null); acceptDetails(details); }}/>}{dialog?.kind === 'export' && <PackageExportDialog project={dialog.project} format={dialog.format} onClose={() => setDialog(null)} onExported={result => { setDialog(null); setHomeStatus({ text: `Exportado: ${result.path}` }); }}/>}</main>}</div>;
}
