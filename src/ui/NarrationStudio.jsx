import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, AudioLines, Check, Gauge, Headphones, Lock, Mic, Scissors, Sparkles, Square, Trash2, Upload, Volume2, Wand2, Wind, X } from 'lucide-react';
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
  const mode = details.project.narrationBy === 'ai' ? 'ai' : details.project.narrationBy === 'creator' ? 'creator' : null;
  // Voz de IA: a cena gerada mais recente de cada cena, na ordem do roteiro. Eu gravo: os takes na ordem da lista.
  const latest = new Map(narration.takes.filter(take => take.origin === 'generated' && !take.stale).map(take => [take.sceneId, take.id]));
  const finalTakeIds = mode === 'ai' ? state.scenes.map(scene => latest.get(scene.id)).filter(Boolean) : narration.takes.filter(take => take.origin !== 'generated').map(take => take.id);
  return <div className="narration">
    <div aria-live="polite">{status && <div className="notice" role="status">{status}</div>}</div>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    <JobsPanel jobs={jobs} uploads={[]} onCancel={async jobId => { await localApi.cancelJob(jobId); refreshJobs(); }}/>
    <NarratorChoice project={details.project} profiles={state.profiles} path={projectPath} onUpdated={onUpdated} onOpenVoice={onOpenVoice}/>
    {/* Só aparecem as seções do jeito escolhido: voz de IA gera por cena; "Eu gravo" grava ou importa takes. */}
    {mode === 'ai' && <VoiceSection projectPath={projectPath} narration={narration} finalTakeIds={finalTakeIds} base={base} state={state} setup={setup} onOpenSetup={onOpenSetup} act={act} startJob={startJob} running={running} onOpenVoice={onOpenVoice}/>}
    {mode === 'creator' && <TakesSection projectPath={projectPath} narration={narration} act={act} base={base}/>}
    {mode === 'creator' && <TreatmentSection takeIds={finalTakeIds} projectPath={projectPath} narration={narration} previewSeconds={state.previewSeconds} act={act} startJob={startJob} base={base} setup={setup} onOpenSetup={onOpenSetup}/>}
  </div>;
}

/**
 * Quem narra este vídeo. A voz de IA é a voz clonada da pessoa e só aparece quando existe
 * ao menos um perfil gravado em “Minha voz”; sem perfil, resta gravar os takes.
 */
function NarratorChoice({ project, profiles, path, onUpdated, onOpenVoice }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const choose = async narrationBy => {
    if (narrationBy === project.narrationBy) return;
    setBusy(true); setError('');
    try { onUpdated?.(await localApi.runProjectAction({ path, baseRevision: project.revision, action: { type: 'project.update', narrationBy } })); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  };
  const aiLocked = !profiles.length;
  const options = [
    { id: 'ai', icon: Sparkles, title: 'Voz de IA', subtitle: 'Sua voz clonada', disabled: aiLocked,
      text: aiLocked ? 'Indisponível: nenhum perfil de voz gravado ainda.' : `Gerada cena a cena com o perfil gravado em “Minha voz” (${profiles.length} ${profiles.length === 1 ? 'perfil' : 'perfis'}).` },
    { id: 'creator', icon: Mic, title: 'Eu gravo', subtitle: 'Microfone ou arquivo', disabled: false,
      text: 'Você grava ou importa os takes aqui embaixo; a IA não gera voz.' },
  ];
  return <section className="workflow-card" aria-labelledby="narrator-title">
    <div className="section-title"><div><span className="eyebrow">Quem narra</span><h2 id="narrator-title">Voz deste vídeo</h2></div></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="narrator-options" role="radiogroup" aria-label="Quem narra este vídeo">
      {options.map(option => {
        const Icon = option.disabled ? Lock : option.icon; const selected = project.narrationBy === option.id;
        return <label key={option.id} className={`narrator-option ${selected ? 'selected' : ''} ${option.disabled ? 'locked' : ''}`}>
          <input type="radio" className="sr-only" name="narration-by" disabled={busy || option.disabled} checked={selected} onChange={() => choose(option.id)}/>
          <span className="narrator-icon" aria-hidden="true"><Icon size={20}/></span>
          <span className="narrator-copy"><strong>{option.title}</strong><small className="narrator-sub">{option.subtitle}</small><span className="option-hint">{option.text}</span></span>
          <span className="narrator-check" aria-hidden="true">{selected && <Check size={14}/>}</span>
        </label>;
      })}
    </div>
    {aiLocked && <div className="narrator-unlock" role="status">
      <span><Mic size={16} aria-hidden="true"/><span>Para liberar a voz de IA, grave uma amostra da sua voz (cerca de 60 s) em <strong>Minha voz</strong>.</span></span>
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

const CLEANUP = [
  ['aiDenoise', Sparkles, 'Limpar a voz com IA', 'DeepFilterNet3 local: tira ruído de fundo, ventilador, chiado e eco leve.', 'narration.ai'],
  ['removeBreaths', Wind, 'Silenciar respiros', 'O que fica entre as frases (respiro, estalo, ruído) vira silêncio.', 'narration.pauses'],
  ['trimPauses', Scissors, 'Encurtar pausas longas', 'Corta as pausas maiores que o limite e o silêncio das pontas.', 'narration.pauses'],
];
const LEVEL = [
  ['compress', Gauge, 'Compressão de locução', 'Deixa trechos baixos e altos mais parecidos, sem esmagar.'],
  ['normalize', Volume2, 'Volume padrão', 'Ganho medido até o alvo, com limitador de pico.'],
];
const TARGETS = [[-14, '-14', 'Mais alto'], [-16, '-16', 'YouTube'], [-19, '-19', 'Podcast']];
const PAUSES = [[0.25, 'Curtas'], [0.4, 'Naturais'], [0.7, 'Calmas']];
const seconds = value => `${value.toFixed(value < 1 ? 2 : 1).replace('.', ',')} s`;

function TreatmentSection({ takeIds, projectPath, narration, previewSeconds, act, startJob, base, setup, onOpenSetup }) {
  const [settings, setSettings] = useState({ maxPauseSeconds: 0.4, aiDenoise: true, removeBreaths: true, trimPauses: true, ...narration.treatment }); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false);
  const missing = feature => (setup && feature ? featureBlock(feature, setup.items) : []);
  // Recurso sem modelo instalado fica desligado e travado até instalar.
  const effective = { ...settings, ...Object.fromEntries(CLEANUP.filter(([, , , , feature]) => missing(feature).length).map(([key]) => [key, false])) };
  const set = (key, value) => { setSettings(previous => ({ ...previous, [key]: value })); setPreview(null); };
  const listen = async () => { setBusy(true); setPreview(await act(() => localApi.narrationPreview({ path: projectPath, takeIds, treatment: effective }))); setBusy(false); };
  const toggle = ([key, Icon, label, hint, feature]) => {
    const absent = missing(feature);
    return <div key={key} className={`treat-toggle ${effective[key] ? 'on' : ''} ${absent.length ? 'locked' : ''}`}>
      <label className="treat-toggle-main">
        <input type="checkbox" role="switch" disabled={Boolean(absent.length)} checked={effective[key]} onChange={event => set(key, event.target.checked)}/>
        <span className="treat-icon" aria-hidden="true"><Icon size={17}/></span>
        <span className="treat-copy"><strong>{label}</strong><small>{absent.length ? `Precisa instalar: ${absent.map(item => item.label).join(', ')}.` : hint}</small></span>
        {!absent.length && <span className="switch" aria-hidden="true"/>}
      </label>
      {absent.length > 0 && onOpenSetup && <button className="mini-button" onClick={() => onOpenSetup(absent.map(item => item.id))}>Instalar</button>}
    </div>;
  };
  const chips = (name, label, options, value, key, disabled, format) => <div className={`treat-target ${disabled ? 'off' : ''}`} role="radiogroup" aria-label={label}>
    <span>{label}</span>
    {options.map(([option, hint]) => <label key={option} className={value === option ? 'active' : ''}>
      <input type="radio" className="sr-only" name={name} disabled={disabled} checked={value === option} onChange={() => set(key, option)}/>
      <strong>{format(option)}</strong><small>{hint}</small>
    </label>)}
  </div>;
  return <section className="workflow-card treatment" aria-labelledby="treatment-title">
    <div className="section-title"><div><span className="eyebrow">Tratamento</span><h2 id="treatment-title">Ouvir, ajustar e montar</h2></div></div>
    <p className="treat-intro">Limpa a sua gravação e junta os takes, na ordem da lista, num único áudio: a <strong>narração final</strong>, que vai para a edição. Tudo roda no seu computador; os originais nunca são alterados.</p>
    {!takeIds.length && <p className="plan-line">Grave ou importe um take acima para montar a narração final.</p>}
    <div className="treat-groups">
      <fieldset className="treat-group"><legend>Limpeza</legend>{CLEANUP.map(toggle)}
        {chips('max-pause', 'Pausas', PAUSES, effective.maxPauseSeconds, 'maxPauseSeconds', !effective.trimPauses, seconds)}
      </fieldset>
      <fieldset className="treat-group"><legend>Nível</legend>{LEVEL.map(toggle)}
        {chips('target-lufs', 'Alvo (LUFS)', TARGETS.map(([value, , hint]) => [value, hint]), effective.targetLufs, 'targetLufs', !effective.normalize, value => String(value))}
      </fieldset>
    </div>
    <div className="treat-actions"><button className="button quiet" disabled={!takeIds.length || busy} onClick={listen}><Headphones size={17} aria-hidden="true"/> {busy ? 'Preparando…' : `Ouvir preview (${previewSeconds} s)`}</button><button className="button primary" disabled={!takeIds.length} onClick={() => startJob(() => localApi.assembleNarration({ ...base, takeIds, treatment: effective }))}><Wand2 size={17}/> {narration.assembled ? 'Montar de novo' : 'Montar narração final'}</button></div>
    {preview && <div className="ab-preview">{[['original', 'Sem tratamento'], ['treated', 'Com tratamento']].map(([key, label]) => <div key={key} className={key}><span className="ab-label"><AudioLines size={14} aria-hidden="true"/> {label}{key === 'treated' && preview.removedSeconds > 0 ? ` · ${seconds(preview.removedSeconds)} de pausas a menos` : ''}</span><audio controls src={fileUrl(projectPath, { preview: preview[key].file })} aria-label={`Preview ${label.toLowerCase()}`}/><small>{measureLine(preview[key].measures)}</small></div>)}</div>}
    <FinalNarration projectPath={projectPath} narration={narration}/>
  </section>;
}

/** O áudio montado que a edição usa (fica nas mídias do projeto). */
function FinalNarration({ projectPath, narration }) {
  if (!narration.assembled) return null;
  return <div className="final-narration">
    <div className="final-head"><span className="final-icon" aria-hidden="true"><Check size={16}/></span><div><strong>Narração final{narration.assembled.outdated ? ' · desatualizada' : ''}</strong><small>{narration.assembled.outdated ? 'Um take usado foi excluído: monte de novo.' : 'É o áudio que a edição usa. Já está nas mídias do projeto e entra na timeline.'}</small></div></div>
    <audio controls preload="none" src={fileUrl(projectPath, { assembled: 1 })} aria-label="Ouvir narração final"/>
    <small>{measureLine(narration.assembled.measures)}</small>
  </div>;
}

/** Voz de IA já sai limpa: na montagem só junta as cenas e acerta o volume, sem limpeza nem cortes. */
export const AI_FINAL_TREATMENT = { aiDenoise: false, removeBreaths: false, trimPauses: false, compress: false, normalize: true, targetLufs: -16 };

function VoiceSection({ projectPath, narration, finalTakeIds, base, state, setup, onOpenSetup, act, startJob, running, onOpenVoice }) {
  const missing = setup ? featureBlock('voice.synthetic', setup.items) : [];
  const [profileId, setProfileId] = useState(state.profiles[0]?.id || ''); const [plan, setPlan] = useState(null);
  useEffect(() => { if (!state.profiles.some(profile => profile.id === profileId)) setProfileId(state.profiles[0]?.id || ''); }, [state.profiles]);
  const pending = state.scenes.filter(scene => !scene.generated[profileId]);
  const checkPlan = async () => { const next = (await act(() => localApi.voicePlan()))?.plan || null; setPlan(next); return next; };
  // Antes de gerar, confere a memória de novo: se faltar, mostra o painel para liberar em vez de abrir uma tarefa que falha.
  const generate = async sceneIds => {
    const next = await checkPlan();
    if (next?.status === 'needs-free-memory') { window.requestAnimationFrame(() => document.getElementById('memory-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })); return; }
    await startJob(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds }));
  };
  // Confere a memória assim que a seção abre, para mostrar antes de gerar o que dá para fechar.
  useEffect(() => { if (state.profiles.length && !missing.length) Promise.resolve(localApi.voicePlan()).then(result => setPlan(result?.plan || null), () => null); }, [state.profiles.length, missing.length]);
  return <section className="workflow-card" aria-labelledby="voice-title">
    <div className="section-title"><div><span className="eyebrow">Voz clonada · VoxCPM2</span><h2 id="voice-title">Narração com a sua voz</h2></div>{onOpenVoice && <span className="header-actions"><button className="button quiet" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Minha voz</button></span>}</div>
    {missing.length > 0 ? <div className="notice error" role="alert"><span>Para gerar voz, instale: {missing.map(item => item.label).join(', ')}.</span><button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))}>Instalar dependências</button></div> : <>
      {!state.profiles.length && <div className="empty-state"><strong>Nenhum perfil de voz.</strong><span>Grave uma amostra da sua voz em “Minha voz” (barra lateral): o Content Lab mostra um texto de cerca de 60 s, grava e cria o perfil. A narração por voz de IA só fica disponível depois disso.</span>{onOpenVoice && <button className="button primary" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Abrir Minha voz</button>}</div>}
      {state.profiles.length > 0 && <>
        <div className="generate-bar"><label>Perfil<select value={profileId} onChange={event => setProfileId(event.target.value)}>{state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><button className="mini-button" onClick={checkPlan}>Verificar recursos</button><button className="button primary" disabled={!pending.length || running} onClick={() => generate(pending.map(scene => scene.id))}>Gerar {pending.length} cena{pending.length === 1 ? '' : 's'} pendente{pending.length === 1 ? '' : 's'}</button></div>
        {plan && plan.status !== 'needs-free-memory' && <p className="plan-line" role="status">{plan.status === 'ready' ? `Pronto: ${plan.device.toUpperCase()}, ${plan.threads} núcleos, até ${Math.round(plan.memoryLimitBytes / 1024 ** 3)} GB.` : plan.reasons.join(' ')}{plan.estimate?.realtimeFactor ? ` Cerca de ${plan.estimate.realtimeFactor} s de processamento por segundo de fala (${plan.estimate.source}).` : ''}</p>}
        {plan?.status === 'needs-free-memory' && <MemoryPanel plan={plan} onChanged={checkPlan}/>}
        {state.scenes.length ? <ol className="media-list">{state.scenes.map(scene => <li key={scene.id}><span><strong>{scene.label}</strong><small>{scene.text.length > 140 ? `${scene.text.slice(0, 140)}…` : scene.text}</small></span>{scene.generated[profileId] ? <span className="available">Gerada</span> : <button className="mini-button" disabled={running} onClick={() => generate([scene.id])}>Gerar</button>}</li>)}</ol> : <div className="empty-state"><span>Escreva abertura, desenvolvimento ou payoff no roteiro para gerar cenas.</span></div>}
        <div className="voice-final">
          <div><strong>Narração final</strong><small>{pending.length ? `Faltam ${pending.length} cena${pending.length === 1 ? '' : 's'} para gerar. ` : ''}Junta as cenas geradas, na ordem do roteiro, num único áudio no volume padrão do YouTube. A voz de IA já sai limpa: não passa por tratamento.</small></div>
          <button className="button primary" disabled={!finalTakeIds.length || running} onClick={() => startJob(() => localApi.assembleNarration({ ...base, takeIds: finalTakeIds, treatment: AI_FINAL_TREATMENT }))}><Wand2 size={17} aria-hidden="true"/> {narration.assembled ? 'Montar de novo' : 'Montar narração final'}</button>
        </div>
        <FinalNarration projectPath={projectPath} narration={narration}/>
      </>}
    </>}
  </section>;
}

const gbText = bytes => `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;

/**
 * Falta RAM para a voz clonada: mostra quanto falta e os programas abertos que mais usam
 * memória, com botão para fechar cada um (com confirmação). Navegadores ganham a opção de
 * fechar só algumas abas pelo gerenciador de tarefas deles.
 */
function MemoryPanel({ plan, onChanged }) {
  const [apps, setApps] = useState(null); const [confirming, setConfirming] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = async () => { try { setApps((await localApi.systemApps()).apps); } catch (issue) { setError(issue.message); } };
  useEffect(() => { load(); }, [plan.availableBytes]);
  const missingBytes = Math.max(0, plan.requiredBytes - plan.availableBytes);
  const close = async (app, force = false) => {
    setError(''); setMessage('');
    try {
      const result = await localApi.closeApp({ name: app.name, force });
      if (result.closed) setMessage(`${app.name} fechado: cerca de ${gbText(result.freedBytes)} liberados.`);
      else setConfirming({ ...app, stuck: true });
    } catch (issue) { setError(issue.message); }
    await onChanged(); await load();
  };
  return <div id="memory-panel" className="memory-panel" role="region" aria-labelledby="memory-title">
    <div className="memory-head">
      <div><strong id="memory-title">Libere {gbText(missingBytes)} de memória para gerar</strong><small>A voz clonada precisa de {gbText(plan.requiredBytes)} livres; há {gbText(plan.availableBytes)} agora. Feche algum destes programas:</small></div>
      <button className="mini-button" onClick={async () => { await onChanged(); await load(); }}>Verificar de novo</button>
    </div>
    <span className="memory-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (plan.availableBytes / plan.requiredBytes) * 100)}%` }}/></span>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {apps === null ? <p className="plan-line">Procurando programas abertos…</p> : apps.length ? <ul className="memory-apps">{apps.map(app => <li key={app.name}>
      <span><strong>{app.name}</strong><small>{gbText(app.bytes)}{app.kind === 'browser' ? ' · navegador: dá para fechar só algumas abas com Shift+Esc (gerenciador de tarefas dele)' : ''}</small></span>
      <button className="mini-button" aria-label={`Fechar ${app.name}${app.kind === 'browser' ? ' inteiro' : ''}`} onClick={() => setConfirming(app)}>{app.kind === 'browser' ? 'Fechar tudo' : 'Fechar'}</button>
    </li>)}</ul> : <p className="plan-line">Nenhum programa grande aberto. Talvez este computador não tenha memória suficiente agora.</p>}
    {confirming && <ConfirmDialog
      title={confirming.stuck ? `${confirming.name} não fechou` : `Fechar ${confirming.name}?`}
      message={confirming.stuck ? `${confirming.name} não respondeu. Forçar o fechamento encerra na hora: o que não foi salvo nele se perde.` : `${confirming.name} vai ser fechado por completo (${confirming.processes} processo${confirming.processes === 1 ? '' : 's'}, ${gbText(confirming.bytes)}). Salve o que estiver aberto nele antes.${confirming.kind === 'browser' ? ' Se o Content Lab estiver aberto neste navegador, a página fecha junto; o servidor continua e é só abrir de novo.' : ''}`}
      confirm={confirming.stuck ? 'Forçar fechamento' : `Fechar ${confirming.name}`}
      onClose={() => setConfirming(null)}
      onConfirm={async () => { const app = confirming; setConfirming(null); await close(app, Boolean(app.stuck)); }}
    />}
  </div>;
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
