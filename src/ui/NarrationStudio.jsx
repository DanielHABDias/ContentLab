import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mic, Square, Trash2, Upload, Wand2, X } from 'lucide-react';
import { ConfirmDialog } from './Dialogs.jsx';
import { localApi } from './local-api.js';
import { JobsPanel, clock } from './MediaLibrary.jsx';
import { DependencyNotice } from './DependencyGate.jsx';
import { featureBlock } from '../core/capabilities.js';

const ORIGINS = { recording: 'Gravação', import: 'Importado', generated: 'Voz clonada' };
const fileUrl = (project, params) => `/api/v1/narration/file?path=${encodeURIComponent(project)}&${new URLSearchParams(params)}`;
const db = value => (value === null || value === undefined ? '—' : `${value.toFixed(1)}`);
export const measureLine = measures => `${clock(measures.durationSeconds)} · ${db(measures.integratedLufs)} LUFS · pico ${db(measures.truePeakDb)} dBTP · ${measures.wav48kMono ? 'WAV 48 kHz mono' : `${measures.sampleRate} Hz, ${measures.channels} canal(is)`}`;

/**
 * Etapa Narração: quem narra (voz de IA clonada ou a pessoa gravando), takes, tratamento
 * com preview A/B, montagem e geração por cena com o perfil de voz.
 */
export function NarrationStudio({ details, setup, onOpenSetup, onUpdated, onOpenVoice }) {
  const projectPath = details.path;
  const [state, setState] = useState(null); const [jobs, setJobs] = useState([]); const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const load = async () => { try { setState(await localApi.narration(projectPath)); } catch (issue) { setError(issue); } };
  const refreshJobs = async () => { const { jobs: list } = await localApi.jobs(projectPath).catch(() => ({ jobs: [] })); const mine = list.filter(job => job.kind.startsWith('narration') || job.kind === 'voice.generate'); setJobs(previous => { if (previous.some(job => job.state === 'running') && !mine.some(job => job.state === 'running')) load(); return mine; }); };
  useEffect(() => { load(); refreshJobs(); }, [projectPath]);
  const running = jobs.some(job => job.state === 'running');
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(refreshJobs, 1500); return () => window.clearInterval(timer); }, [running]);
  const act = async (task, done) => { setError(null); setStatus(''); try { const result = await task(); if (result?.narration) setState(previous => ({ ...previous, narration: result.narration })); else await load(); if (done) setStatus(done); return result; } catch (issue) { setError(issue); if (issue.code === 'NARRATION_CONFLICT') await load(); return null; } };
  const startJob = async task => { const job = await act(task); if (job?.id) { setJobs(previous => [job, ...previous]); refreshJobs(); } };
  if (!state) return <section className="workflow-card"><p className="empty-state">{error ? error.message : 'Carregando narração…'}</p></section>;
  const { narration } = state; const base = { path: projectPath, baseRevision: narration.revision };
  return <div className="narration">
    <div aria-live="polite">{status && <div className="notice" role="status">{status}</div>}</div>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    <JobsPanel jobs={jobs} uploads={[]} onCancel={async jobId => { await localApi.cancelJob(jobId); refreshJobs(); }}/>
    <NarratorChoice project={details.project} profiles={state.profiles} path={projectPath} onUpdated={onUpdated} onOpenVoice={onOpenVoice}/>
    <TakesSection projectPath={projectPath} narration={narration} act={act} base={base}/>
    <TreatmentSection projectPath={projectPath} narration={narration} presets={state.presets} previewSeconds={state.previewSeconds} act={act} startJob={startJob} base={base}/>
    {details.project.narrationBy !== 'creator' && <VoiceSection projectPath={projectPath} state={state} setup={setup} onOpenSetup={onOpenSetup} act={act} startJob={startJob} running={running} onOpenVoice={onOpenVoice}/>}
  </div>;
}

/**
 * Quem narra este vídeo. A voz de IA é a voz clonada da pessoa e só aparece quando existe
 * ao menos um perfil gravado em “Minha voz”; sem perfil, resta gravar os takes.
 */
function NarratorChoice({ project, profiles, path, onUpdated, onOpenVoice }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const choose = async narrationBy => {
    setBusy(true); setError('');
    try { onUpdated?.(await localApi.runProjectAction({ path, baseRevision: project.revision, action: { type: 'project.update', narrationBy } })); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  };
  return <section className="workflow-card" aria-labelledby="narrator-title">
    <div className="section-title"><div><span className="eyebrow">Quem narra</span><h2 id="narrator-title">Voz deste vídeo</h2></div></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <fieldset><legend className="sr-only">Quem narra este vídeo</legend>
      <label><input type="radio" name="narration-by" disabled={busy || !profiles.length} checked={project.narrationBy === 'ai'} onChange={() => choose('ai')}/> Voz de IA (sua voz clonada)<span className="option-hint">{profiles.length ? `Gerada cena a cena com o perfil gravado em “Minha voz” (${profiles.length} ${profiles.length === 1 ? 'perfil' : 'perfis'}).` : 'Indisponível: nenhum perfil de voz gravado ainda.'}</span></label>
      <label><input type="radio" name="narration-by" disabled={busy} checked={project.narrationBy === 'creator'} onChange={() => choose('creator')}/> Eu gravo<span className="option-hint">Você grava ou importa os takes aqui embaixo; a IA não gera voz.</span></label>
    </fieldset>
    {!profiles.length && <div className="notice" role="status">
      <span>Para liberar a voz de IA, grave uma amostra da sua voz (cerca de 60 s) em <strong>Minha voz</strong>.</span>
      {onOpenVoice && <button className="mini-button" onClick={onOpenVoice}>Abrir Minha voz</button>}
    </div>}
    {!project.narrationBy && <p className="plan-line">Escolha uma das duas para liberar a geração ou a gravação da narração.</p>}
  </section>;
}

function TakesSection({ projectPath, narration, act, base }) {
  const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null);
  const importFiles = async () => { const choice = await act(() => localApi.chooseMedia('Importar áudio para a narração', true)); if (!choice?.paths?.length) return; const result = await act(() => localApi.narrationImport({ path: projectPath, sources: choice.paths })); if (result) await act(async () => null, result.failed ? `${result.imported} importado(s); falharam: ${result.results.filter(item => item.error).map(item => item.error).join('; ')}` : `${result.imported} take(s) importado(s).`); };
  const move = (index, delta) => { const order = narration.takes.map(take => take.id); const [item] = order.splice(index, 1); order.splice(index + delta, 0, item); return act(() => localApi.reorderTakes({ ...base, order })); };
  return <section className="workflow-card" aria-labelledby="takes-title">
    <div className="section-title"><div><span className="eyebrow">Takes</span><h2 id="takes-title">Gravações e áudios</h2></div><div className="header-actions"><Recorder projectPath={projectPath} onDone={() => act(async () => null, 'Gravação salva como take.')}/><button className="button quiet" onClick={importFiles}><Upload size={17}/> Importar áudio</button></div></div>
    {narration.takes.length ? <ol className="media-list take-list">{narration.takes.map((take, index) => <li key={take.id}>
      <span><strong>{take.name}</strong><small>{ORIGINS[take.origin]} · {clock(take.durationSeconds)}{take.trim ? ` · usa ${clock(take.trim.start)}–${clock(take.trim.end)}` : ''}{take.stale ? ' · texto da cena mudou' : ''}</small><audio controls preload="none" src={fileUrl(projectPath, { take: take.id })} aria-label={`Ouvir ${take.name}`}/></span>
      <span className="take-actions"><button className="icon-button" aria-label={`Subir ${take.name}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button className="icon-button" aria-label={`Descer ${take.name}`} disabled={index === narration.takes.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button className="mini-button" onClick={() => setEditing(take)}>Editar</button><button className="icon-button" aria-label={`Excluir ${take.name}`} onClick={() => setDeleting(take)}><Trash2 size={16}/></button></span>
    </li>)}</ol> : <div className="empty-state"><strong>Nenhum take ainda.</strong><span>Grave pelo microfone ou importe um áudio. Os originais nunca são alterados.</span></div>}
    {editing && <TakeDialog take={editing} onClose={() => setEditing(null)} onSave={async values => { if (await act(() => localApi.updateTake({ ...base, takeId: editing.id, ...values }), 'Take atualizado.')) setEditing(null); }}/>}
    {deleting && <ConfirmDialog title="Excluir take" message={`“${deleting.name}” e o arquivo dele serão apagados deste projeto.`} confirm="Excluir take" onClose={() => setDeleting(null)} onConfirm={async () => { await act(() => localApi.deleteTake({ ...base, takeId: deleting.id }), 'Take excluído.'); setDeleting(null); }}/>}
  </section>;
}

/** Microfone só depois do clique explícito em “Permitir microfone”. */
function Recorder({ projectPath, onDone }) {
  const [phase, setPhase] = useState('idle'); const [error, setError] = useState(''); const [seconds, setSeconds] = useState(0); const recorder = useRef(null); const stream = useRef(null); const timer = useRef(null);
  useEffect(() => () => { window.clearInterval(timer.current); stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const allow = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador não permite gravar. Importe um áudio.'); return; }
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); setPhase('ready'); }
    catch { setError('Microfone negado ou indisponível.'); setPhase('idle'); }
  };
  const start = () => {
    const chunks = []; const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(item => MediaRecorder.isTypeSupported?.(item)) || '';
    const media = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined); recorder.current = media;
    media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      window.clearInterval(timer.current); setPhase('saving');
      const blob = new Blob(chunks, { type: media.mimeType }); const extension = media.mimeType.includes('ogg') ? 'ogg' : media.mimeType.includes('mp4') ? 'm4a' : 'webm';
      try { await localApi.uploadTake({ path: projectPath, blob, name: `gravacao.${extension}` }); onDone(); setPhase('ready'); } catch (issue) { setError(issue.message); setPhase('ready'); }
    };
    media.start(1000); setSeconds(0); timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000); setPhase('recording');
  };
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setPhase('idle'); };
  return <span className="recorder">{error && <small className="missing" role="alert">{error}</small>}
    {phase === 'idle' && <button className="button quiet" onClick={allow}><Mic size={17}/> Permitir microfone</button>}
    {phase === 'ready' && <><button className="button primary" onClick={start}><Mic size={17}/> Gravar</button><button className="mini-button" onClick={release}>Desligar microfone</button></>}
    {phase === 'recording' && <button className="button primary recording" onClick={() => recorder.current.stop()}><Square size={15}/> Parar · {clock(seconds)}</button>}
    {phase === 'saving' && <span role="status">Salvando gravação…</span>}
  </span>;
}

function TreatmentSection({ projectPath, narration, presets, previewSeconds, act, startJob, base }) {
  const [settings, setSettings] = useState(narration.treatment); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false);
  const takeIds = narration.takes.map(take => take.id);
  const set = (key, value) => { setSettings(previous => ({ ...previous, [key]: value })); setPreview(null); };
  const listen = async () => { setBusy(true); setPreview(await act(() => localApi.narrationPreview({ path: projectPath, takeIds, treatment: settings }))); setBusy(false); };
  const toggles = { trimSilence: 'Cortar silêncio das pontas', denoise: 'Redução de ruído', highpass: 'Filtro de graves (high-pass 80 Hz)', compress: 'Compressão leve', normalize: 'Normalizar loudness' };
  return <section className="workflow-card" aria-labelledby="treatment-title">
    <div className="section-title"><div><span className="eyebrow">Tratamento</span><h2 id="treatment-title">Ouvir, ajustar e montar</h2></div></div>
    <div className="treatment-grid">{Object.entries(toggles).map(([key, label]) => <label key={key} className="check"><input type="checkbox" checked={settings[key]} onChange={event => set(key, event.target.checked)}/> {label}</label>)}
      <label>Loudness alvo<select value={settings.targetLufs} disabled={!settings.normalize} onChange={event => set('targetLufs', Number(event.target.value))}><option value={-14}>-14 LUFS (mais alto)</option><option value={-16}>-16 LUFS (YouTube)</option><option value={-19}>-19 LUFS (podcast mono)</option></select></label>
      <label>Timbre<select value={settings.preset} onChange={event => set('preset', event.target.value)}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
    </div>
    <div className="dialog-actions"><button className="button quiet" disabled={!takeIds.length || busy} onClick={listen}>{busy ? 'Preparando…' : `Ouvir preview (${previewSeconds} s)`}</button><button className="button primary" disabled={!takeIds.length} onClick={() => startJob(() => localApi.assembleNarration({ ...base, takeIds, treatment: settings }))}><Wand2 size={17}/> Montar narração</button></div>
    {preview && <div className="ab-preview">{[['original', 'Sem tratamento'], ['treated', 'Com tratamento']].map(([key, label]) => <div key={key}><strong>{label}</strong><audio controls src={fileUrl(projectPath, { preview: preview[key].file })} aria-label={`Preview ${label.toLowerCase()}`}/><small>{measureLine(preview[key].measures)}</small></div>)}</div>}
    {narration.assembled && <div className="rights-note"><strong>Narração montada{narration.assembled.outdated ? ' · um take usado foi excluído; monte de novo' : ''}</strong><span>{measureLine(narration.assembled.measures)} · já está no catálogo de mídias do projeto.</span><audio controls preload="none" src={fileUrl(projectPath, { assembled: 1 })} aria-label="Ouvir narração montada"/></div>}
  </section>;
}

function VoiceSection({ projectPath, state, setup, onOpenSetup, act, startJob, running, onOpenVoice }) {
  const missing = setup ? featureBlock('voice.synthetic', setup.items) : [];
  const [profileId, setProfileId] = useState(state.profiles[0]?.id || ''); const [plan, setPlan] = useState(null);
  useEffect(() => { if (!state.profiles.some(profile => profile.id === profileId)) setProfileId(state.profiles[0]?.id || ''); }, [state.profiles]);
  const pending = state.scenes.filter(scene => !scene.generated[profileId]);
  const checkPlan = async () => setPlan((await act(() => localApi.voicePlan()))?.plan || null);
  return <section className="workflow-card" aria-labelledby="voice-title">
    <div className="section-title"><div><span className="eyebrow">Voz clonada · VoxCPM2</span><h2 id="voice-title">Narração com a sua voz</h2></div>{onOpenVoice && <span className="header-actions"><button className="button quiet" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Minha voz</button></span>}</div>
    {missing.length > 0 ? <div className="notice error" role="alert"><span>Para gerar voz, instale: {missing.map(item => item.label).join(', ')}.</span><button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))}>Instalar dependências</button></div> : <>
      {!state.profiles.length && <div className="empty-state"><strong>Nenhum perfil de voz.</strong><span>Grave uma amostra da sua voz em “Minha voz” (barra lateral): o Content Lab mostra um texto de cerca de 60 s, grava e cria o perfil. A narração por voz de IA só fica disponível depois disso.</span>{onOpenVoice && <button className="button primary" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Abrir Minha voz</button>}</div>}
      {state.profiles.length > 0 && <>
        <div className="generate-bar"><label>Perfil<select value={profileId} onChange={event => setProfileId(event.target.value)}>{state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><button className="mini-button" onClick={checkPlan}>Verificar recursos</button><button className="button primary" disabled={!pending.length || running} onClick={() => startJob(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds: pending.map(scene => scene.id) }))}>Gerar {pending.length} cena{pending.length === 1 ? '' : 's'} pendente{pending.length === 1 ? '' : 's'}</button></div>
        {plan && <p className="plan-line" role="status">{plan.status === 'ready' ? `Pronto: ${plan.device.toUpperCase()}, ${plan.threads} núcleos, até ${Math.round(plan.memoryLimitBytes / 1024 ** 3)} GB.` : plan.reasons.join(' ')}{plan.estimate?.realtimeFactor ? ` Cerca de ${plan.estimate.realtimeFactor} s de processamento por segundo de fala (${plan.estimate.source}).` : ''}</p>}
        {state.scenes.length ? <ol className="media-list">{state.scenes.map(scene => <li key={scene.id}><span><strong>{scene.label}</strong><small>{scene.text.length > 140 ? `${scene.text.slice(0, 140)}…` : scene.text}</small></span>{scene.generated[profileId] ? <span className="available">Gerada</span> : <button className="mini-button" disabled={running} onClick={() => startJob(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds: [scene.id] }))}>Gerar</button>}</li>)}</ol> : <div className="empty-state"><span>Escreva abertura, desenvolvimento ou payoff no roteiro para gerar cenas.</span></div>}
      </>}
    </>}
  </section>;
}

function TakeDialog({ take, onClose, onSave }) {
  const [name, setName] = useState(take.name); const [start, setStart] = useState(take.trim?.start ?? 0); const [end, setEnd] = useState(take.trim?.end ?? take.durationSeconds);
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" aria-label="Editar take" onSubmit={event => { event.preventDefault(); onSave({ name, trim: Number(start) === 0 && Number(end) >= take.durationSeconds ? null : { start: Number(start), end: Number(end) } }); }}>
    <div className="section-title"><h2>Editar take</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div>
    <label>Nome<input required value={name} onChange={event => setName(event.target.value)}/></label>
    <label>Início (s)<input type="number" min="0" step="0.1" max={take.durationSeconds} value={start} onChange={event => setStart(event.target.value)}/></label>
    <label>Fim (s)<input type="number" min="0.1" step="0.1" max={take.durationSeconds} value={end} onChange={event => setEnd(event.target.value)}/></label>
    <p className="plan-line">O corte só define o trecho usado na montagem; o arquivo original continua inteiro ({clock(take.durationSeconds)}).</p>
    <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary">Salvar</button></div>
  </form></div>;
}

export { ConfirmDialog } from './Dialogs.jsx';
