import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mic, Square, Trash2, Upload, Wand2, X } from 'lucide-react';
import { ConfirmDialog, useDialogFocus } from './Dialogs.jsx';
import { localApi } from './local-api.js';
import { JobsPanel, clock } from './MediaLibrary.jsx';
import { DependencyNotice } from './DependencyGate.jsx';
import { featureBlock } from '../core/capabilities.js';

const ORIGINS = { recording: 'Gravação', import: 'Importado', generated: 'Voz clonada' };
const fileUrl = (project, params) => `/api/v1/narration/file?path=${encodeURIComponent(project)}&${new URLSearchParams(params)}`;
const db = value => (value === null || value === undefined ? '—' : `${value.toFixed(1)}`);
export const measureLine = measures => `${clock(measures.durationSeconds)} · ${db(measures.integratedLufs)} LUFS · pico ${db(measures.truePeakDb)} dBTP · ${measures.wav48kMono ? 'WAV 48 kHz mono' : `${measures.sampleRate} Hz, ${measures.channels} canal(is)`}`;

/** Etapa Narração: takes, tratamento com preview A/B, montagem e voz clonada com consentimento. */
export function NarrationStudio({ projectPath, setup, onOpenSetup }) {
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
    <TakesSection projectPath={projectPath} narration={narration} act={act} base={base}/>
    <TreatmentSection projectPath={projectPath} narration={narration} presets={state.presets} previewSeconds={state.previewSeconds} act={act} startJob={startJob} base={base}/>
    <VoiceSection projectPath={projectPath} state={state} setup={setup} onOpenSetup={onOpenSetup} act={act} startJob={startJob} running={running}/>
  </div>;
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

function VoiceSection({ projectPath, state, setup, onOpenSetup, act, startJob, running }) {
  const missing = setup ? featureBlock('voice.synthetic', setup.items) : [];
  const [profileId, setProfileId] = useState(state.profiles[0]?.id || ''); const [creating, setCreating] = useState(false); const [removing, setRemoving] = useState(null); const [plan, setPlan] = useState(null);
  useEffect(() => { if (!state.profiles.some(profile => profile.id === profileId)) setProfileId(state.profiles[0]?.id || ''); }, [state.profiles]);
  const pending = state.scenes.filter(scene => !scene.generated[profileId]);
  const checkPlan = async () => setPlan((await act(() => localApi.voicePlan()))?.plan || null);
  const askRemove = async profile => { const report = await act(() => localApi.voiceProfileReport(profile.id)); if (report) setRemoving(report); };
  return <section className="workflow-card" aria-labelledby="voice-title">
    <div className="section-title"><div><span className="eyebrow">Voz clonada · VoxCPM2</span><h2 id="voice-title">Sua voz, com consentimento</h2></div>{!missing.length && <span className="header-actions"><button className="button primary" onClick={() => setCreating('guided')}><Mic size={17}/> Gravar minha voz</button><button className="button quiet" onClick={() => setCreating('take')} disabled={!state.narration.takes.some(take => take.origin !== 'generated')} title="Usar um take já gravado ou importado">Usar take existente</button></span>}</div>
    {missing.length > 0 ? <div className="notice error" role="alert"><span>Para gerar voz, instale: {missing.map(item => item.label).join(', ')}.</span><button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))}>Instalar dependências</button></div> : <>
      {state.profiles.length ? <ul className="media-list">{state.profiles.map(profile => <li key={profile.id}><span><strong>{profile.name}</strong><small>Titular: {profile.consent.holder} · consentimento em {new Date(profile.consent.grantedAt).toLocaleDateString('pt-BR')} · amostra de {clock(profile.durationSeconds)}</small><audio controls preload="none" src={fileUrl(projectPath, { profile: profile.id })} aria-label={`Amostra de ${profile.name}`}/></span><button className="icon-button" aria-label={`Excluir perfil ${profile.name}`} onClick={() => askRemove(profile)}><Trash2 size={16}/></button></li>)}</ul> : <div className="empty-state"><strong>Nenhum perfil de voz.</strong><span>Use “Gravar minha voz”: o Content Lab mostra um texto de cerca de 60 s, grava e cria o perfil. A narração por voz clonada só fica disponível depois disso.</span></div>}
      {state.profiles.length > 0 && <>
        <div className="generate-bar"><label>Perfil<select value={profileId} onChange={event => setProfileId(event.target.value)}>{state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><button className="mini-button" onClick={checkPlan}>Verificar recursos</button><button className="button primary" disabled={!pending.length || running} onClick={() => startJob(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds: pending.map(scene => scene.id) }))}>Gerar {pending.length} cena{pending.length === 1 ? '' : 's'} pendente{pending.length === 1 ? '' : 's'}</button></div>
        {plan && <p className="plan-line" role="status">{plan.status === 'ready' ? `Pronto: ${plan.device.toUpperCase()}, ${plan.threads} núcleos, até ${Math.round(plan.memoryLimitBytes / 1024 ** 3)} GB.` : plan.reasons.join(' ')}{plan.estimate?.realtimeFactor ? ` Cerca de ${plan.estimate.realtimeFactor} s de processamento por segundo de fala (${plan.estimate.source}).` : ''}</p>}
        {state.scenes.length ? <ol className="media-list">{state.scenes.map(scene => <li key={scene.id}><span><strong>{scene.label}</strong><small>{scene.text.length > 140 ? `${scene.text.slice(0, 140)}…` : scene.text}</small></span>{scene.generated[profileId] ? <span className="available">Gerada</span> : <button className="mini-button" disabled={running} onClick={() => startJob(() => localApi.generateVoice({ path: projectPath, profileId, sceneIds: [scene.id] }))}>Gerar</button>}</li>)}</ol> : <div className="empty-state"><span>Escreva abertura, desenvolvimento ou payoff no roteiro para gerar cenas.</span></div>}
      </>}
    </>}
    {creating === 'guided' && <GuidedVoiceDialog projectPath={projectPath} onClose={() => setCreating(false)} onCreate={async values => { if (await act(() => localApi.createVoiceProfile({ path: projectPath, ...values }), 'Perfil de voz criado. Já dá para gerar a narração das cenas.')) setCreating(false); }}/>}
    {creating === 'take' && <ProfileDialog takes={state.narration.takes.filter(take => take.origin !== 'generated')} onClose={() => setCreating(false)} onCreate={async values => { if (await act(() => localApi.createVoiceProfile({ path: projectPath, ...values }), 'Perfil de voz criado.')) setCreating(false); }}/>}
    {removing && <ConfirmDialog title="Excluir perfil de voz" message={`O perfil “${removing.profile.name}” e a amostra serão apagados. ${removing.takes ? `Também serão apagados ${removing.takes} take(s) gerado(s) em ${removing.projects.length} projeto(s)${removing.projects.some(item => item.assembled) ? ', e as montagens que os usam saem do catálogo' : ''}.` : 'Nenhum áudio gerado com ele.'}`} details={removing.projects.map(item => `${item.title}: ${item.takes.length} take(s)${item.assembled ? ' + montagem' : ''}`)} confirm="Excluir perfil e áudios" onClose={() => setRemoving(null)} onConfirm={async () => { const result = await act(() => localApi.deleteVoiceProfile(removing.profile.id)); setRemoving(null); if (result) await act(async () => null, result.deleted ? 'Perfil e áudios gerados excluídos.' : `Alguns itens falharam: ${result.failures.map(item => item.error).join('; ')}`); }}/>}
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

function ProfileDialog({ takes, onClose, onCreate }) {
  const [takeId, setTakeId] = useState(takes.at(-1)?.id || ''); const [name, setName] = useState('Minha voz'); const [holder, setHolder] = useState(''); const [referenceText, setReferenceText] = useState(''); const [consent, setConsent] = useState(false);
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" aria-label="Novo perfil de voz" onSubmit={event => { event.preventDefault(); onCreate({ takeId, name, holder, referenceText, consent }); }}>
    <div className="section-title"><h2>Novo perfil de voz</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div>
    <label>Amostra (take de 3 a 60 s)<select required value={takeId} onChange={event => setTakeId(event.target.value)}>{takes.map(take => <option key={take.id} value={take.id}>{take.name} · {clock(take.durationSeconds)}</option>)}</select></label>
    <label>Nome do perfil<input required value={name} onChange={event => setName(event.target.value)}/></label>
    <label>Titular da voz<input required value={holder} onChange={event => setHolder(event.target.value)} placeholder="Nome de quem gravou"/></label>
    <label>Texto lido na amostra, exatamente<textarea required rows="3" value={referenceText} onChange={event => setReferenceText(event.target.value)}/></label>
    <label className="check consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> Sou o titular desta voz (ou tenho autorização por escrito dele) e autorizo gerar narrações com ela neste computador.</label>
    <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!consent || !takeId}>Criar perfil</button></div>
  </form></div>;
}

export { ConfirmDialog } from './Dialogs.jsx';

/** Texto de leitura (~150 palavras, ~60 s em ritmo de narração) com variedade de sons do PT-BR, perguntas, exclamações e números. */
export const VOICE_SAMPLE_TEXT = `Olá! Este é o meu perfil de voz para o Content Lab. Vou ler este texto com calma, do jeito que eu falo nos meus vídeos. Hoje o céu amanheceu limpo, e a cidade acordou devagar: o padeiro abriu a porta às seis e quinze, o ônibus passou lotado e alguém gritou lá da esquina. Você já reparou como cada lugar tem um som próprio? Na praia, as ondas quebram sem pressa; na floresta, os pássaros conversam entre os galhos; no centro, as buzinas não param nunca. Eu gosto de histórias que começam pequenas e crescem aos poucos. Um detalhe, uma pergunta, uma ideia que ninguém tinha percebido. Então eu pesquiso, escrevo, gravo e edito, até tudo fazer sentido. Será que vai dar certo? Às vezes dá, às vezes não. Mas cada vídeo me ensina alguma coisa nova. Obrigado por ouvir até aqui, e até a próxima!`;
const SAMPLE_LIMIT = 58;

function GuidedVoiceDialog({ projectPath, onClose, onCreate }) {
  const [phase, setPhase] = useState('intro'); const [seconds, setSeconds] = useState(0); const [error, setError] = useState('');
  const [take, setTake] = useState(null); const [preview, setPreview] = useState(''); const [name, setName] = useState('Minha voz'); const [holder, setHolder] = useState(''); const [referenceText, setReferenceText] = useState(VOICE_SAMPLE_TEXT); const [consent, setConsent] = useState(false);
  const stream = useRef(null); const recorder = useRef(null); const timer = useRef(null);
  const ref = useDialogFocus(onClose, phase === 'recording' || phase === 'saving');
  useEffect(() => () => { window.clearInterval(timer.current); stream.current?.getTracks().forEach(track => track.stop()); if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  const record = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador não permite gravar. Use “Usar take existente” com um áudio importado.'); return; }
    try { stream.current ||= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch { setError('Microfone negado ou indisponível. Libere o microfone para este endereço no navegador.'); return; }
    const chunks = []; const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(item => MediaRecorder.isTypeSupported?.(item)) || '';
    const media = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined); recorder.current = media;
    media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      window.clearInterval(timer.current); setPhase('saving');
      const blob = new Blob(chunks, { type: media.mimeType }); const extension = media.mimeType.includes('ogg') ? 'ogg' : media.mimeType.includes('mp4') ? 'm4a' : 'webm';
      try {
        const result = await localApi.uploadTake({ path: projectPath, blob, name: `amostra-de-voz.${extension}` });
        setTake(result.take); setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(blob); }); setPhase('review');
      } catch (issue) { setError(issue.message); setPhase('intro'); }
    };
    media.start(1000); setSeconds(0); setPhase('recording');
    timer.current = window.setInterval(() => setSeconds(value => { if (value + 1 >= SAMPLE_LIMIT) stop(); return value + 1; }), 1000);
  };
  const short = take && take.durationSeconds < 20;
  return <div className="dialog-backdrop" role="presentation"><div ref={ref} className="dialog guided-voice" role="dialog" aria-modal="true" aria-labelledby="guided-title">
    <div className="section-title"><div><span className="eyebrow">Perfil de voz · cerca de 60 s</span><h2 id="guided-title">Gravar minha voz</h2></div><button type="button" className="icon-button" aria-label="Fechar" disabled={phase === 'recording' || phase === 'saving'} onClick={onClose}><X/></button></div>
    {phase !== 'review' && <>
      <p className="hint">Lugar silencioso, microfone a um palmo da boca, sem música. Leia no seu ritmo normal de narração. A gravação para sozinha em {SAMPLE_LIMIT} s.</p>
      <blockquote className="reading-text" aria-label="Texto para ler">{VOICE_SAMPLE_TEXT}</blockquote>
      <div className="dialog-actions" aria-live="polite">
        {phase === 'recording' ? <><span className="recording-clock" role="timer" aria-label={`Gravando: ${seconds} de ${SAMPLE_LIMIT} segundos`}><span className="rec-dot" aria-hidden="true"/>{clock(seconds)} / {clock(SAMPLE_LIMIT)}</span><button className="button danger" onClick={stop} disabled={seconds < 3}><Square size={16}/> Parar</button></>
          : <button className="button primary" onClick={record} disabled={phase === 'saving'}><Mic size={17}/> {phase === 'saving' ? 'Salvando…' : 'Começar a gravar'}</button>}
      </div>
    </>}
    {phase === 'review' && <form onSubmit={event => { event.preventDefault(); onCreate({ takeId: take.id, name, holder, referenceText: referenceText.trim(), consent }); }}>
      <p>Amostra gravada: <strong>{clock(take.durationSeconds)}</strong>. Ouça antes de criar o perfil.</p>
      <audio controls src={preview} aria-label="Ouvir amostra gravada"/>
      {short && <p className="notice error" role="status">Amostra curta: com menos de 20 s a voz tende a soar mais robótica. Vale gravar de novo lendo o texto inteiro.</p>}
      <label>Texto lido na amostra (corrija se você mudou alguma palavra)<textarea rows="5" required value={referenceText} onChange={event => setReferenceText(event.target.value)}/></label>
      <label>Nome do perfil<input required value={name} onChange={event => setName(event.target.value)}/></label>
      <label>Titular da voz<input required value={holder} onChange={event => setHolder(event.target.value)} placeholder="Nome de quem gravou"/></label>
      <label className="check consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> Sou o titular desta voz (ou tenho autorização por escrito dele) e autorizo gerar narrações com ela neste computador.</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button quiet" onClick={() => { setTake(null); setPhase('intro'); }}>Gravar de novo</button><button className="button primary" disabled={!consent || !holder.trim()}>Criar perfil</button></div>
    </form>}
    {phase !== 'review' && error && <p className="notice error" role="alert">{error}</p>}
  </div></div>;
}
