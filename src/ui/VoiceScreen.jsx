import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AudioLines, CheckCircle2, Headphones, Mic, Play, RotateCcw, ShieldCheck, Square, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { localApi } from './local-api.js';
import { ConfirmDialog, useDialogFocus } from './Dialogs.jsx';
import { JobsPanel, clock } from './MediaLibrary.jsx';
import { DependencyNotice } from './DependencyGate.jsx';
import { featureBlock } from '../core/capabilities.js';

const mmss = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const profileSampleUrl = (profileId, check = false) => `/api/v1/narration/file?profile=${encodeURIComponent(profileId)}${check ? '&check=1' : ''}`;

/**
 * “Minha voz”: perfis de voz do computador, fora de qualquer projeto. A pessoa lê o texto
 * de cerca de 60 s, confere a gravação, registra o consentimento e pode ouvir como a voz
 * clonada ficou. Sem nenhum perfil aqui, a narração por voz de IA fica bloqueada nos projetos.
 */
export function VoiceScreen({ setup, onOpenSetup, onBack, onProfilesChanged }) {
  const [state, setState] = useState(null); const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const [jobs, setJobs] = useState([]); const [recording, setRecording] = useState(false); const [removing, setRemoving] = useState(null);
  const missing = setup ? featureBlock('voice.synthetic', setup.items) : [];

  const load = async () => { try { const value = await localApi.voiceStudio(); setState(value); onProfilesChanged?.(value.profiles); } catch (issue) { setError(issue); } };
  const refreshJobs = async () => {
    const { jobs: list } = await localApi.jobs().catch(() => ({ jobs: [] }));
    const mine = list.filter(job => job.kind === 'voice.check');
    setJobs(previous => { if (previous.some(job => job.state === 'running') && !mine.some(job => job.state === 'running')) load(); return mine; });
  };
  useEffect(() => { load(); refreshJobs(); }, []);
  const running = jobs.some(job => job.state === 'running');
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(refreshJobs, 1500); return () => window.clearInterval(timer); }, [running]);

  const act = async (task, done) => { setError(null); setStatus(''); try { const result = await task(); await load(); if (done) setStatus(done); return result; } catch (issue) { setError(issue); return null; } };
  const askRemove = async profile => { const report = await act(() => localApi.voiceProfileReport(profile.id)); if (report) setRemoving(report); };
  const check = async profile => { const job = await act(() => localApi.generateVoiceCheck(profile.id)); if (job?.id) { setJobs(previous => [job, ...previous]); refreshJobs(); } };

  if (!state) return <main id="main" className="project-home"><p className="empty-state">{error ? error.message : 'Carregando perfis de voz…'}</p></main>;
  return <main id="main" className="project-home voice-screen">
    {onBack && <button className="text-button back-link" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/> Projetos</button>}
    <header className="home-header">
      <div>
        <span className="eyebrow">Voz do criador</span>
        <h1>Minha voz</h1>
        <p>A narração por voz de IA do Content Lab é a <strong>sua</strong> voz, clonada de uma amostra gravada aqui. Enquanto não houver nenhum perfil, os projetos só aceitam narração gravada por você.</p>
      </div>
      <button className="button primary" disabled={Boolean(missing.length)} onClick={() => setRecording(true)}><Mic size={19} aria-hidden="true"/> Gravar nova voz</button>
    </header>

    <div aria-live="polite">{status && <div className="notice" role="status">{status}</div>}</div>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    {missing.length > 0 && <div className="notice error" role="alert">
      <span>Para clonar a voz, instale: {missing.map(item => item.label).join(', ')}. Dá para gravar a amostra depois de instalar.</span>
      <button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))}>Instalar dependências</button>
    </div>}
    <JobsPanel jobs={jobs} uploads={[]} onCancel={async jobId => { await localApi.cancelJob(jobId); refreshJobs(); }}/>

    <section aria-labelledby="profiles-title">
      <div className="section-title"><h2 id="profiles-title">Perfis de voz</h2><span>{state.profiles.length} {state.profiles.length === 1 ? 'perfil' : 'perfis'}</span></div>
      {state.profiles.length ? <ul className="voice-profiles">{state.profiles.map(profile => <li key={profile.id} className="voice-card">
        <div className="voice-card-head">
          <span className="voice-avatar" aria-hidden="true"><AudioLines size={20}/></span>
          <div>
            <h3>{profile.name}</h3>
            <small>Titular: {profile.consent.holder} · consentimento em {new Date(profile.consent.grantedAt).toLocaleDateString('pt-BR')} · amostra de {clock(profile.durationSeconds)}</small>
          </div>
          <button className="icon-button danger-hover" aria-label={`Excluir perfil ${profile.name}`} onClick={() => askRemove(profile)}><Trash2 size={16} aria-hidden="true"/></button>
        </div>
        <div className="voice-tracks">
          <div className="voice-track">
            <span className="voice-track-label"><Mic size={14} aria-hidden="true"/> Amostra gravada</span>
            <audio controls preload="none" src={profileSampleUrl(profile.id)} aria-label={`Ouvir a amostra gravada de ${profile.name}`}/>
          </div>
          <div className="voice-track">
            <span className="voice-track-label"><Headphones size={14} aria-hidden="true"/> Voz clonada</span>
            {profile.checkSample
              ? <><audio controls preload="none" src={profileSampleUrl(profile.id, true)} aria-label={`Ouvir a voz clonada de ${profile.name}`}/><small>Gerada em {new Date(profile.checkSample.generatedAt).toLocaleDateString('pt-BR')}</small></>
              : <small className="field-hint">Ainda sem amostra da voz clonada.</small>}
            <button className="mini-button" disabled={running || Boolean(missing.length)} onClick={() => check(profile)}><Play size={15} aria-hidden="true"/> {profile.checkSample ? 'Gerar de novo' : 'Ouvir como ficou'}</button>
          </div>
        </div>
      </li>)}</ul> : <div className="empty-state voice-empty">
        <strong>Nenhuma voz gravada ainda.</strong>
        <span>Grave uma amostra lendo um texto curto (cerca de 60 s). Depois disso a narração por voz de IA fica disponível nos seus projetos.</span>
        <ol className="voice-steps" aria-label="Como funciona">
          <li><Mic size={16} aria-hidden="true"/><span><strong>Grave</strong> lendo o texto na tela</span></li>
          <li><ShieldCheck size={16} aria-hidden="true"/><span><strong>Confira</strong> e registre o consentimento</span></li>
          <li><Headphones size={16} aria-hidden="true"/><span><strong>Use</strong> na etapa Narração</span></li>
        </ol>
        <button className="button primary" disabled={Boolean(missing.length)} onClick={() => setRecording(true)}><Mic size={17} aria-hidden="true"/> Gravar a primeira voz</button>
      </div>}
      <p className="hint">Dá para ter mais de um perfil (voz calma, voz animada, outra pessoa com autorização) e escolher qual usar em cada projeto, na etapa Narração.</p>
    </section>

    {recording && <RecordProfileDialog
      sampleText={state.sampleText}
      limitSeconds={state.sampleLimitSeconds}
      onClose={() => setRecording(false)}
      onCreated={async message => { setRecording(false); await load(); setStatus(message); }}
    />}
    {removing && <ConfirmDialog
      title="Excluir perfil de voz"
      message={`O perfil “${removing.profile.name}” e a amostra serão apagados. ${removing.takes ? `Também serão apagados ${removing.takes} take(s) gerado(s) em ${removing.projects.length} projeto(s)${removing.projects.some(item => item.assembled) ? ', e as montagens que os usam saem do catálogo' : ''}.` : 'Nenhum áudio gerado com ele.'}`}
      details={removing.projects.map(item => `${item.title}: ${item.takes.length} take(s)${item.assembled ? ' + montagem' : ''}`)}
      confirm="Excluir perfil e áudios"
      onClose={() => setRemoving(null)}
      onConfirm={async () => { const result = await act(() => localApi.deleteVoiceProfile(removing.profile.id)); setRemoving(null); if (result) setStatus(result.deleted ? 'Perfil e áudios gerados excluídos.' : `Alguns itens falharam: ${result.failures.map(item => item.error).join('; ')}`); }}
    />}
  </main>;
}

/**
 * Gravação guiada da amostra: o microfone só liga depois do clique, a gravação para sozinha
 * no limite do VoxCPM2 e a amostra fica fora de qualquer projeto até virar perfil.
 */
function RecordProfileDialog({ sampleText, limitSeconds, onClose, onCreated }) {
  const [phase, setPhase] = useState('intro'); const [seconds, setSeconds] = useState(0); const [error, setError] = useState('');
  const [sample, setSample] = useState(null); const [preview, setPreview] = useState('');
  const [name, setName] = useState('Minha voz'); const [holder, setHolder] = useState(''); const [referenceText, setReferenceText] = useState(sampleText); const [consent, setConsent] = useState(false);
  const stream = useRef(null); const recorder = useRef(null); const timer = useRef(null);
  const ref = useDialogFocus(onClose, phase === 'recording' || phase === 'saving');

  useEffect(() => () => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  const record = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador não permite gravar. Abra o Content Lab no navegador padrão do sistema.'); return; }
    try { stream.current ||= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch { setError('Microfone negado ou indisponível. Libere o microfone para este endereço no navegador.'); return; }
    const chunks = []; const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(item => MediaRecorder.isTypeSupported?.(item)) || '';
    const media = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined); recorder.current = media;
    media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      window.clearInterval(timer.current); setPhase('saving');
      const blob = new Blob(chunks, { type: media.mimeType });
      const extension = media.mimeType.includes('ogg') ? 'ogg' : media.mimeType.includes('mp4') ? 'm4a' : 'webm';
      try {
        const result = await localApi.uploadVoiceSample({ blob, name: `amostra-de-voz.${extension}` });
        setSample(result); setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(blob); }); setPhase('review');
      } catch (issue) { setError(issue.message); setPhase('intro'); }
    };
    media.start(1000); setSeconds(0); setPhase('recording');
    timer.current = window.setInterval(() => setSeconds(value => { if (value + 1 >= limitSeconds) stop(); return value + 1; }), 1000);
  };

  const again = async () => { if (sample) await localApi.discardVoiceSample(sample.sampleId).catch(() => null); setSample(null); setPhase('intro'); };
  const close = async () => { if (sample) await localApi.discardVoiceSample(sample.sampleId).catch(() => null); onClose(); };
  const create = async event => {
    event.preventDefault(); setError(''); setPhase('creating');
    try {
      const { profile } = await localApi.createVoiceProfile({ sampleId: sample.sampleId, name, holder, referenceText: referenceText.trim(), consent });
      await onCreated(`Perfil “${profile.name}” criado. Use “Ouvir como ficou” para conferir a voz clonada.`);
    } catch (issue) { setError(issue.message); setPhase('review'); }
  };

  const short = sample && sample.measures.durationSeconds < 20;
  const reviewing = phase === 'review' || phase === 'creating';
  return <div className="dialog-backdrop" role="presentation"><div ref={ref} className="dialog guided-voice" role="dialog" aria-modal="true" aria-labelledby="record-voice-title">
    <div className="voice-dialog-head">
      <div><span className="eyebrow">Perfil de voz · cerca de 60 s</span><h2 id="record-voice-title">Gravar minha voz</h2></div>
      <button type="button" className="icon-button" aria-label="Fechar" disabled={phase === 'recording' || phase === 'saving' || phase === 'creating'} onClick={close}><X aria-hidden="true"/></button>
    </div>
    <ol className="voice-progress" aria-label="Etapas">
      <li className={reviewing ? 'done' : 'current'} aria-current={reviewing ? undefined : 'step'}>{reviewing ? <CheckCircle2 size={15} aria-hidden="true"/> : <span>1</span>} Gravar</li>
      <li className={reviewing ? 'current' : ''} aria-current={reviewing ? 'step' : undefined}><span>2</span> Conferir e autorizar</li>
    </ol>
    {!reviewing && <>
      <ul className="voice-tips" aria-label="Antes de gravar">
        <li><VolumeX size={15} aria-hidden="true"/> Lugar silencioso, sem música</li>
        <li><Mic size={15} aria-hidden="true"/> Microfone a um palmo da boca</li>
        <li><Volume2 size={15} aria-hidden="true"/> Ritmo normal de narração, com as pausas</li>
      </ul>
      <blockquote className="reading-text" aria-label="Texto para ler">{sampleText}</blockquote>
      <div className="voice-record-bar" aria-live="polite">
        {phase === 'recording'
          ? <>
            <span className="recording-clock" role="timer" aria-label={`Gravando: ${seconds} de ${limitSeconds} segundos`}><span className="rec-dot" aria-hidden="true"/>{mmss(seconds)} / {mmss(limitSeconds)}</span>
            <span className="rec-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (seconds / limitSeconds) * 100)}%` }}/></span>
            <button className="button danger" onClick={stop} disabled={seconds < 3}><Square size={16} aria-hidden="true"/> Parar</button>
          </>
          : <>
            <span className="hint">A gravação para sozinha em {limitSeconds} s.</span>
            <button className="button primary" onClick={record} disabled={phase === 'saving'}><Mic size={17} aria-hidden="true"/> {phase === 'saving' ? 'Salvando…' : 'Começar a gravar'}</button>
          </>}
      </div>
    </>}
    {reviewing && <form className="voice-review" onSubmit={create}>
      <div className="voice-sample">
        <div className="voice-sample-head">
          <span><AudioLines size={16} aria-hidden="true"/> Amostra gravada</span>
          <strong>{clock(sample.measures.durationSeconds)}</strong>
        </div>
        <audio controls src={preview} aria-label="Ouvir amostra gravada"/>
        <small>Ouça antes de criar o perfil.</small>
      </div>
      {short && <p className="notice error" role="status">Amostra curta: com menos de 20 s a voz clonada tende a soar mais robótica. Vale gravar de novo lendo o texto inteiro.</p>}
      <div className="voice-fields">
        <label>Nome do perfil<input required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Minha voz calma"/></label>
        <label>Titular da voz<input required value={holder} onChange={event => setHolder(event.target.value)} placeholder="Nome de quem gravou"/></label>
        <label className="wide">Texto lido na amostra<span className="field-hint">Corrija se você trocou alguma palavra.</span><textarea rows="4" required value={referenceText} onChange={event => setReferenceText(event.target.value)}/></label>
      </div>
      <label className={`voice-consent ${consent ? 'checked' : ''}`}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span><ShieldCheck size={16} aria-hidden="true"/> Sou o titular desta voz (ou tenho autorização por escrito dele) e autorizo gerar narrações com ela neste computador.</span></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="button quiet" disabled={phase === 'creating'} onClick={again}><RotateCcw size={16} aria-hidden="true"/> Gravar de novo</button>
        <button className="button primary" disabled={!consent || !holder.trim() || phase === 'creating'}>{phase === 'creating' ? 'Criando…' : 'Criar perfil'}</button>
      </div>
    </form>}
    {!reviewing && error && <p className="notice error" role="alert">{error}</p>}
  </div></div>;
}
