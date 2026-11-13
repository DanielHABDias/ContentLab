import { RecordingWave } from './RecordingWave.jsx';
import { WaveAudioPlayer } from './WaveAudioPlayer.jsx';
import { AudioTakeEditor } from './AudioTakeEditor.jsx';
import { editDuration, takeSegments } from '../audio/audio-edits.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, AudioLines, Check, FolderOpen, Loader2, Gauge, Headphones, Lock, Mic, Pause, Play, Scissors, Sparkles, Square, Trash2, Upload, Volume2, Wand2, Wind, X } from 'lucide-react';
import { ConfirmDialog } from './Dialogs.jsx';
import { localApi } from './local-api.js';
import { JobsPanel, clock } from './MediaLibrary.jsx';
import { DependencyNotice } from './DependencyGate.jsx';
import { useVoiceGeneration } from './useVoiceGeneration.js';
import { MemoryPanel } from './MemoryPanel.jsx';
import { NarrationChapters, NarrationReaderLink } from './NarrationReader.jsx';
import { featureBlock } from '../core/capabilities.js';

const ORIGINS = { recording: 'Gravação', import: 'Importado', generated: 'Voz clonada' };
const fileUrl = (project, params) => `/api/v1/narration/file?path=${encodeURIComponent(project)}&${new URLSearchParams(params)}`;
const db = value => (value === null || value === undefined ? '—' : `${value.toFixed(1)}`);
export const measureLine = measures => `${clock(measures.durationSeconds)} · ${db(measures.integratedLufs)} LUFS · pico ${db(measures.truePeakDb)} dBTP · ${measures.wav48kMono ? 'WAV 48 kHz mono' : `${measures.sampleRate} Hz, ${measures.channels} canal(is)`}`;

/**
 * Etapa Narração: quem narra (voz de IA clonada ou a pessoa gravando), takes, tratamento
 * com preview A/B, montagem e geração por cena com o perfil de voz.
 */
export function NarrationStudio({ timingOnly = false, readOnly = false, details, setup, onOpenSetup, onUpdated, onOpenVoice }) {
  const projectPath = details.path;
  const [state, setState] = useState(null); const [jobs, setJobs] = useState([]); const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const [jobRequest, setJobRequest] = useState(null); const requestLock = useRef(false);
  const [assemblyError, setAssemblyError] = useState('');
  const load = async () => { try { setState(await localApi.narration(projectPath)); } catch (issue) { setError(issue); } };
  const refreshJobs = async () => { const { jobs: list } = await localApi.jobs(projectPath).catch(() => ({ jobs: [] })); const mine = list.filter(job => job.kind.startsWith('narration') || job.kind === 'voice.generate' || job.kind === 'transcription'); setJobs(mine); };
  useEffect(() => { load(); refreshJobs(); }, [projectPath, details.project.revision]);
  const running = jobs.some(job => job.state === 'running');
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      load();
      if (onUpdated) localApi.openProject(projectPath).then(onUpdated).catch(setError);
    }
    wasRunning.current = running;
  }, [running]);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(refreshJobs, 1500); return () => window.clearInterval(timer); }, [running]);
  const act = async (task, done) => { setError(null); setStatus(''); try { const result = await task(); if (result?.narration) setState(previous => ({ ...previous, narration: result.narration })); else await load(); if (done) setStatus(done); return result; } catch (issue) { setError(issue); if (issue.code === 'NARRATION_CONFLICT') await load(); return null; } };
  const startJob = async (task, kind = 'other') => {
    if (requestLock.current || jobs.some(job => job.state === 'running')) return;
    requestLock.current = true; setJobRequest(kind);
    if (kind === 'narration.assemble') setAssemblyError('');
    try {
      const job = await act(task);
      if (job?.id) setJobs(previous => [job, ...previous]);
      if (job?.id || job?.jobId) refreshJobs();
      else if (kind === 'narration.assemble') setAssemblyError('Não foi possível iniciar a montagem. Confira o aviso de erro e tente novamente.');
    } finally { requestLock.current = false; setJobRequest(null); }
  };
  const assembly = { requesting: jobRequest === 'narration.assemble', job: jobs.find(job => job.kind === 'narration.assemble' && job.state === 'running'), error: assemblyError };
  if (!state) return <section className="workflow-card"><p className="empty-state">{error ? error.message : 'Carregando narração…'}</p></section>;
  const { narration } = state; const base = { path: projectPath, baseRevision: narration.revision };
  if (timingOnly) return <div className="narration"><DependencyNotice error={error} onOpenSetup={onOpenSetup}/><JobsPanel jobs={jobs} uploads={[]} onCancel={async jobId => { await localApi.cancelJob(jobId); refreshJobs(); }}/><TranscriptionStatus transcription={state.transcription} assembled={narration.assembled} running={running} onRetry={() => startJob(() => localApi.productionTranscribeNarration({ path: projectPath }))}/></div>;
  const mode = details.project.narrationBy === 'ai' ? 'ai' : details.project.narrationBy === 'creator' ? 'creator' : null;
  // Voz de IA: a cena gerada mais recente de cada cena, na ordem do roteiro. Eu gravo: os takes na ordem da lista.
  const latest = new Map(narration.takes.filter(take => take.origin === 'generated' && !take.stale).map(take => [take.sceneId, take.id]));
  const finalTakeIds = mode === 'ai' ? state.scenes.map(scene => latest.get(scene.id)).filter(Boolean) : narration.takes.filter(take => take.origin !== 'generated').map(take => take.id);
  return <div className="narration">
    <div aria-live="polite">{status && <div className="notice" role="status">{status}</div>}</div>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    <JobsPanel jobs={jobs} uploads={[]} onCancel={async jobId => { await localApi.cancelJob(jobId); refreshJobs(); }}/>
    <fieldset className="view-only-fieldset" disabled={readOnly}>{readOnly && <legend className="sr-only">Narração aprovada, só visualização</legend>}
    <NarratorChoice project={details.project} profiles={state.profiles} path={projectPath} onUpdated={onUpdated} onOpenVoice={onOpenVoice}/>
    {/* Só aparecem as seções do jeito escolhido: voz de IA gera por cena; "Eu gravo" grava ou importa takes. */}
    {mode === 'ai' && <VoiceSection hideFinal={readOnly} projectPath={projectPath} narration={narration} finalTakeIds={finalTakeIds} base={base} state={state} setup={setup} onOpenSetup={onOpenSetup} act={act} startJob={startJob} reload={load} jobs={jobs} running={running || Boolean(jobRequest)} assembly={assembly} onOpenVoice={onOpenVoice}/>}
    {mode === 'creator' && <ScriptToRead scenes={state.scenes} projectPath={projectPath}/>}
    {mode === 'creator' && <TakesSection projectPath={projectPath} narration={narration} act={act} base={base}/>}
    {mode === 'creator' && <TreatmentSection hideFinal={readOnly} takeIds={finalTakeIds} projectPath={projectPath} narration={narration} previewSeconds={state.previewSeconds} act={act} startJob={startJob} assembly={assembly} running={running || Boolean(jobRequest)} base={base} setup={setup} onOpenSetup={onOpenSetup}/>}
    </fieldset>
    {readOnly && <section className="workflow-card"><FinalNarration projectPath={projectPath} narration={narration}/></section>}
    {mode && <TranscriptionStatus transcription={state.transcription} assembled={narration.assembled} running={running} onRetry={() => startJob(() => localApi.productionTranscribeNarration({ path: projectPath }))}/>}
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
    <div className="section-title"><div><span className="eyebrow">Takes</span><h2 id="takes-title">Gravações e áudios</h2></div><button className="button quiet" onClick={importFiles}><Upload size={17}/> Importar áudio</button></div>
    <div className="recording-script-shortcut"><div><strong>Roteiro na segunda tela</strong><small>Deixe as falas abertas enquanto grava aqui.</small></div><NarrationReaderLink projectPath={projectPath}/></div>
    <Recorder projectPath={projectPath} onDone={async take => { await act(async () => null, 'Gravação salva como take.'); if (take) setEditing(take); }}/>
    {narration.takes.length ? <ol className="media-list take-list">{narration.takes.map((take, index) => <li key={take.id}>
      <span><strong>{take.name}</strong><small>{ORIGINS[take.origin]} · {clock(editDuration(takeSegments(take)))}{take.trim ? ` · usa ${clock(take.trim.start)}–${clock(take.trim.end)}` : ''}{take.stale ? ' · texto da cena mudou' : ''}</small><WaveAudioPlayer src={fileUrl(projectPath, { take: take.id })} label={`Ouvir ${take.name}`} duration={take.durationSeconds} segments={takeSegments(take)}/></span>
      <span className="take-actions"><button className="icon-button" aria-label={`Subir ${take.name}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button className="icon-button" aria-label={`Descer ${take.name}`} disabled={index === narration.takes.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button className="mini-button" onClick={() => setEditing(take)}>Editar</button><button className="icon-button" aria-label={`Excluir ${take.name}`} onClick={() => setDeleting(take)}><Trash2 size={16}/></button></span>
    </li>)}</ol> : <div className="empty-state"><strong>Nenhum take ainda.</strong><span>Grave pelo microfone ou importe um áudio. Os originais nunca são alterados.</span></div>}
    {editing && <AudioTakeEditor src={fileUrl(projectPath, { take: editing.id })} take={editing} onClose={() => setEditing(null)} onSave={async values => { const result = await act(() => localApi.updateTake({ ...base, takeId: editing.id, ...values }), 'Take atualizado.'); if (result) setEditing(null); else throw new Error('Não foi possível salvar. Confira o aviso da narração e tente novamente.'); }}/>}
    {deleting && <ConfirmDialog title="Excluir take" message={`“${deleting.name}” e o arquivo dele serão apagados deste projeto.`} confirm="Excluir take" onClose={() => setDeleting(null)} onConfirm={async () => { await act(() => localApi.deleteTake({ ...base, takeId: deleting.id }), 'Take excluído.'); setDeleting(null); }}/>}
  </section>;
}

/** Microfone só depois do clique explícito em “Permitir microfone”. */
function Recorder({ projectPath, onDone }) {
  const [phase, setPhase] = useState('idle'); const [error, setError] = useState(''); const [seconds, setSeconds] = useState(0); const recorder = useRef(null); const stream = useRef(null); const timer = useRef(null); const pendingUpload = useRef(null);
  useEffect(() => () => { window.clearInterval(timer.current); stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const allow = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador não permite gravar. Importe um áudio.'); return; }
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); setPhase('ready'); }
    catch { setError('Microfone negado ou indisponível.'); setPhase('idle'); }
  };
  const saveRecording = async () => {
    setError(''); setPhase('saving');
    try { const result = await localApi.uploadTake({ path: projectPath, ...pendingUpload.current }); pendingUpload.current = null; await onDone(result?.take); setPhase('ready'); }
    catch (issue) { setError(`${issue.message} A gravação está preservada nesta aba; tente salvar novamente.`); setPhase('unsaved'); }
  };
  const start = () => {
    const chunks = []; const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(item => MediaRecorder.isTypeSupported?.(item)) || '';
    const media = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined); recorder.current = media;
    media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      window.clearInterval(timer.current); setPhase('saving');
      const blob = new Blob(chunks, { type: media.mimeType }); const extension = media.mimeType.includes('ogg') ? 'ogg' : media.mimeType.includes('mp4') ? 'm4a' : 'webm';
      pendingUpload.current = { blob, name: `gravacao.${extension}` }; await saveRecording();
    };
    media.start(1000); setSeconds(0); timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000); setPhase('recording');
  };
  const pause = () => { recorder.current.pause(); window.clearInterval(timer.current); setPhase('paused'); };
  const resume = () => { recorder.current.resume(); timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000); setPhase('recording'); };
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setPhase('idle'); };
  const capturing = ['recording', 'paused'].includes(phase);
  return <div className={`recorder recorder-${phase}`} aria-label="Gravador de narração" role="region">
    <div className="recorder-monitor"><div className="recorder-heading"><span className={`recorder-indicator ${phase === 'recording' ? 'live' : ''}`} aria-hidden="true"/><strong role="status">{({ idle: 'Prepare o microfone', ready: 'Pronto para gravar', recording: 'Gravando', paused: 'Gravação pausada', saving: 'Salvando gravação…', unsaved: 'Gravação aguardando envio' })[phase]}</strong><output className="recorder-time" aria-label="Tempo gravado">{clock(seconds)}</output></div>
      {capturing ? <RecordingWave stream={stream.current} paused={phase === 'paused'}/> : <p className="recorder-hint">{phase === 'idle' ? 'Permita o microfone para começar. Você poderá pausar e retomar o mesmo take.' : phase === 'ready' ? 'Grave no seu ritmo. Depois, selecione e corte os erros pela onda.' : phase === 'saving' ? 'O take será aberto no editor assim que terminar de salvar.' : 'O áudio está preservado nesta aba. Tente enviá-lo novamente.'}</p>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="recorder-actions">
      {phase === 'idle' && <button className="button primary" onClick={allow}><Mic size={17}/> Permitir microfone</button>}
      {phase === 'ready' && <><button className="button primary" onClick={start}><Mic size={17}/> Gravar</button><button className="button quiet" onClick={release}>Desligar microfone</button></>}
      {capturing && <button type="button" className="button quiet" onClick={phase === 'paused' ? resume : pause}>{phase === 'paused' ? <Play size={16}/> : <Pause size={16}/>} {phase === 'paused' ? 'Retomar gravação' : 'Pausar gravação'}</button>}
      {phase === 'unsaved' && <button type="button" className="button primary" onClick={saveRecording}>Tentar salvar gravação</button>}
    </div>
    {capturing && <div className="recorder-finish"><span>Terminou o take? Salve para ouvir e cortar.</span><button className="button recording" onClick={() => recorder.current.stop()}><Square size={15}/> Parar e salvar</button></div>}
  </div>;
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

function TreatmentSection({ hideFinal = false, takeIds, projectPath, narration, previewSeconds, act, startJob, assembly, running, base, setup, onOpenSetup }) {
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
    <div className="treat-actions"><button className="button quiet" disabled={!takeIds.length || busy || running} onClick={listen}><Headphones size={17} aria-hidden="true"/> {busy ? 'Preparando…' : `Ouvir preview (${previewSeconds} s)`}</button><AssemblyButton assembled={narration.assembled} disabled={!takeIds.length || busy || running} assembly={assembly} onClick={() => startJob(() => localApi.assembleNarration({ ...base, takeIds, treatment: effective }), 'narration.assemble')}/></div>
    {preview && <div className="ab-preview">{[['original', 'Sem tratamento'], ['treated', 'Com tratamento']].map(([key, label]) => <div key={key} className={key}><span className="ab-label"><AudioLines size={14} aria-hidden="true"/> {label}{key === 'treated' && preview.removedSeconds > 0 ? ` · ${seconds(preview.removedSeconds)} de pausas a menos` : ''}</span><WaveAudioPlayer src={fileUrl(projectPath, { preview: preview[key].file })} label={`Preview ${label.toLowerCase()}`} duration={preview[key].measures.durationSeconds}/><small>{measureLine(preview[key].measures)}</small></div>)}</div>}
    {!hideFinal && <FinalNarration projectPath={projectPath} narration={narration}/>}
  </section>;
}

/** Feedback junto ao clique, desde o envio até a montagem e a transcrição terminarem. */
function AssemblyButton({ assembled, disabled, assembly, onClick }) {
  const busy = assembly.requesting || Boolean(assembly.job);
  return <div className="assembly-control">
    <button type="button" className="button primary" disabled={disabled || busy} aria-busy={busy} onClick={onClick}>{busy ? <Loader2 size={17} className="spin" aria-hidden="true"/> : <Wand2 size={17} aria-hidden="true"/>} {assembly.requesting ? 'Iniciando montagem…' : assembly.job ? 'Montando narração…' : assembled ? 'Montar de novo' : 'Montar narração final'}</button>
    {busy && <p role="status">{assembly.requesting ? 'Solicitando a montagem da narração…' : assembly.job.progress?.phase || 'Montagem iniciada. Preparando o áudio e a transcrição.'}</p>}
    {assembly.error && <p className="missing" role="alert">{assembly.error}</p>}
  </div>;
}

/** O áudio montado que a edição usa (fica nas mídias do projeto). */
function FinalNarration({ projectPath, narration }) {
  const [opening, setOpening] = useState(false); const [error, setError] = useState('');
  const openFolder = async () => {
    setOpening(true); setError('');
    try { await localApi.revealNarration(projectPath); }
    catch (issue) { setError(issue.message); }
    finally { setOpening(false); }
  };
  if (!narration.assembled) return null;
  return <div className="final-narration">
    <div className="final-head"><span className="final-icon" aria-hidden="true"><Check size={16}/></span><div><strong>Narração final{narration.assembled.outdated ? ' · desatualizada' : ''}</strong><small>{narration.assembled.outdated ? 'Os takes foram alterados: monte de novo.' : 'É o áudio que a edição usa. Já está nas mídias do projeto e entra na timeline.'}</small></div><button type="button" className="mini-button final-folder" disabled={opening} onClick={openFolder}>{opening ? <Loader2 size={16} className="spin" aria-hidden="true"/> : <FolderOpen size={16} aria-hidden="true"/>}{opening ? 'Abrindo pasta…' : 'Abrir pasta'}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <WaveAudioPlayer src={fileUrl(projectPath, { assembled: 1, version: narration.assembled.createdAt || narration.assembled.mediaId })} label="Ouvir narração final" duration={narration.assembled.measures.durationSeconds}/>
    <small>{measureLine(narration.assembled.measures)}</small>
  </div>;
}

/** Voz de IA já sai limpa: na montagem só junta as cenas e acerta o volume, sem limpeza nem cortes. */
export const AI_FINAL_TREATMENT = { aiDenoise: false, removeBreaths: false, trimPauses: false, compress: false, normalize: true, targetLufs: -16 };

function VoiceSection({ hideFinal = false, projectPath, narration, finalTakeIds, base, state, setup, onOpenSetup, act, startJob, reload, jobs, running, assembly, onOpenVoice }) {
  const missing = setup ? featureBlock('voice.synthetic', setup.items) : [];
  const [profileId, setProfileId] = useState(state.profiles[0]?.id || '');
  const resources = useVoiceGeneration(jobs, reload);
  const generating = running || resources.busy;
  useEffect(() => { if (!state.profiles.some(profile => profile.id === profileId)) setProfileId(state.profiles[0]?.id || ''); }, [state.profiles]);
  const pending = state.scenes.filter(scene => !scene.generated[profileId]);
  const voiceJob = jobs.find(job => job.kind === 'voice.generate' && job.state === 'running');
  const generate = sceneIds => startJob(() => resources.attempt(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds })));
  return <section className="workflow-card" aria-labelledby="voice-title">
    <div className="section-title"><div><span className="eyebrow">Voz clonada · VoxCPM2</span><h2 id="voice-title">Narração com a sua voz</h2></div>{onOpenVoice && <span className="header-actions"><button className="button quiet" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Minha voz</button></span>}</div>
    {missing.length > 0 ? <div className="notice error" role="alert"><span>Para gerar voz, instale: {missing.map(item => item.label).join(', ')}.</span><button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))}>Instalar dependências</button></div> : <>
      {!state.profiles.length && <div className="empty-state"><strong>Nenhum perfil de voz.</strong><span>Grave uma amostra da sua voz em “Minha voz” (barra lateral): o Content Lab mostra um texto de cerca de 60 s, grava e cria o perfil. A narração por voz de IA só fica disponível depois disso.</span>{onOpenVoice && <button className="button primary" onClick={onOpenVoice}><Mic size={17} aria-hidden="true"/> Abrir Minha voz</button>}</div>}
      {state.profiles.length > 0 && <>
        <div className="generate-bar"><label>Perfil<select value={profileId} onChange={event => setProfileId(event.target.value)}>{state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><button className="button primary" disabled={!pending.length || generating} onClick={() => generate(pending.map(scene => scene.id))}>Gerar {pending.length} cena{pending.length === 1 ? '' : 's'} pendente{pending.length === 1 ? '' : 's'}</button></div>
        <DependencyNotice error={resources.error} onOpenSetup={onOpenSetup}/>
        {resources.status && <p className="notice" role="status">{resources.status}</p>}
        {resources.plan && <MemoryPanel plan={resources.plan} onChanged={resources.refresh} onRetry={() => startJob(resources.retry)} onUseEconomy={resources.useEconomy} busy={resources.busy}/>}
        {voiceJob && <VoiceProgress job={voiceJob} scenes={state.scenes}/>}
        {state.scenes.length ? <ol className="media-list">{state.scenes.map(scene => <li key={scene.id} className={voiceJob?.progress.sceneId === scene.id ? 'scene-generating' : undefined}><span><strong>{scene.label}</strong><small>{scene.text.length > 140 ? `${scene.text.slice(0, 140)}…` : scene.text}</small></span>{voiceJob?.progress.sceneId === scene.id ? <span className="scene-status"><Loader2 size={14} className="spin" aria-hidden="true"/> Criando…</span> : scene.generated[profileId] ? <span className="available">Gerada</span> : <button className="mini-button" disabled={generating} onClick={() => generate([scene.id])}>Gerar</button>}</li>)}</ol> : <div className="empty-state"><span>Escreva abertura, desenvolvimento ou payoff no roteiro para gerar cenas.</span></div>}
        <div className="voice-final">
          <div><strong>Narração final</strong><small>{pending.length ? `Faltam ${pending.length} cena${pending.length === 1 ? '' : 's'} para gerar. ` : ''}Junta as cenas geradas, na ordem do roteiro, num único áudio no volume padrão do YouTube. A voz de IA já sai limpa: não passa por tratamento.</small></div>
          <AssemblyButton assembled={narration.assembled} disabled={!finalTakeIds.length || running} assembly={assembly} onClick={() => startJob(() => localApi.assembleNarration({ ...base, takeIds: finalTakeIds, treatment: AI_FINAL_TREATMENT }), 'narration.assemble')}/>
        </div>
        {!hideFinal && <FinalNarration projectPath={projectPath} narration={narration}/>}
      </>}
    </>}
  </section>;
}

const mmss = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Indicação viva de que a voz está sendo criada: cena atual, tempo decorrido e estimativa. */
function VoiceProgress({ job, scenes }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { sceneId, sceneStartedAt, estimateSeconds, done = 0, total } = job.progress;
  const scene = scenes.find(item => item.id === sceneId);
  const elapsed = Math.max(0, (now - Date.parse(sceneStartedAt || job.startedAt)) / 1000);
  const share = estimateSeconds ? Math.min(0.95, elapsed / estimateSeconds) : null;
  const over = estimateSeconds && elapsed > estimateSeconds;
  return <div className="voice-progress" role="status" aria-live="polite">
    <div className="voice-progress-head">
      <span className="voice-wave" aria-hidden="true"><i/><i/><i/><i/><i/></span>
      <div><strong>{scene ? `Criando sua voz: ${scene.label}` : 'Preparando a geração da voz…'}</strong>
        <small>{total > 1 ? `Cena ${Math.min(done + 1, total)} de ${total} · ` : ''}{mmss(elapsed)}{estimateSeconds ? (over ? ' · passou da estimativa, ainda processando' : ` de ~${mmss(estimateSeconds)}`) : ''}</small></div>
    </div>
    <span className={`voice-progress-bar${share == null || over ? ' indeterminate' : ''}`}><i style={share != null && !over ? { width: `${Math.round(share * 100)}%` } : undefined}/></span>
    <small className="voice-progress-hint">Pode continuar usando o app. Feche programas pesados para acelerar.</small>
  </div>;
}

/** Somente fala, agrupada pelos capítulos editoriais; títulos são orientação, nunca locução. */
function ScriptToRead({ scenes, projectPath }) {
  return <section className="workflow-card script-to-read" aria-labelledby="script-read-title">
    <NarrationReaderLink projectPath={projectPath}/>
    <details open>
      <summary><span className="eyebrow">Para gravar</span><h2 id="script-read-title">Roteiro de narração</h2><small>Leia somente os textos abaixo. Os títulos dos capítulos não são narrados.</small></summary>
      <NarrationChapters scenes={scenes}/>
    </details>
  </section>;
}

function TranscriptionStatus({ transcription, assembled, running, onRetry }) {
  const ready = transcription?.status === 'ready' && !assembled?.outdated;
  const working = running || transcription?.status === 'running';
  return <section className="workflow-card narration-transcription" aria-labelledby="narration-transcript-title"><h2 id="narration-transcript-title">Tempos para edição</h2>
    <p>Depois de montar a narração, o Whisper large-v3 completo transcreve automaticamente cada palavra com início e fim.</p>
    {ready ? <p role="status" className="ready">Transcrição pronta · {transcription.words} palavras com tempo. A IA já pode usá-las na edição.</p> : working ? <p role="status">Áudio final disponível. O Whisper está preparando os tempos de cada palavra em segundo plano.</p> : assembled ? <><p role="status">{transcription?.error || 'Os tempos para edição ainda não estão prontos. Gere a transcrição para a IA sincronizar as cenas e legendas.'}</p><button type="button" className="button quiet" disabled={assembled.outdated} onClick={onRetry}>Gerar transcrição palavra por palavra</button>{assembled.outdated && <p>Os takes mudaram. Monte a narração novamente.</p>}</> : <p>Grave ou gere os takes e monte a narração para preparar os tempos.</p>}
  </section>;
}

export { ConfirmDialog } from './Dialogs.jsx';
