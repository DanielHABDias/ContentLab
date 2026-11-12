import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Film, Link2, Plus, Scissors, Search, Trash2, Upload, X } from 'lucide-react';
import { ConfirmDialog } from './Dialogs.jsx';
import { localApi } from './local-api.js';
import { DependencyNotice, FeatureList } from './DependencyGate.jsx';
import { STAGE_REQUIREMENTS, featureBlock } from '../core/capabilities.js';
import { formatBytes } from './ProjectManagement.jsx';

const RIGHTS = { pending: 'Pendente', owned: 'Própria', licensed: 'Licenciada', authorized: 'Autorizada' };
const KINDS = { video: 'Vídeo', audio: 'Áudio', image: 'Imagem', subtitle: 'Legenda', font: 'Fonte' };

export function clock(seconds) {
  if (seconds == null) return '—';
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60); const rest = (total - minutes * 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${rest.replace('.', ',')}`;
}
const mediaUrl = (project, mediaId, cutId) => `/api/v1/media/file?path=${encodeURIComponent(project)}&media=${encodeURIComponent(mediaId)}${cutId ? `&cut=${encodeURIComponent(cutId)}` : ''}`;

/** Catálogo de mídia do projeto: importação, URL, preview, cortes e transcrição. */
export function MediaLibrary({ details, onBack, onUpdated, setup, onOpenSetup }) {
  const { project, path: projectPath } = details;
  const [rights, setRights] = useState('pending'); const [error, setError] = useState(null); const [jobs, setJobs] = useState([]); const [uploads, setUploads] = useState([]);
  const [selected, setSelected] = useState(project.media[0]?.id || null); const [dragging, setDragging] = useState(false); const [removing, setRemoving] = useState(null); const [seek, setSeek] = useState(null);
  const availability = new Map((details.mediaStatus || []).map(item => [item.id, item.available]));
  const blocked = id => (setup ? featureBlock(id, setup.items) : []);
  const refresh = useCallback(async () => onUpdated(await localApi.openProject(projectPath)), [onUpdated, projectPath]);
  const loadJobs = useCallback(async () => { try { const value = await localApi.jobs(projectPath); setJobs(value.jobs); return value.jobs; } catch { return []; } }, [projectPath]);
  useEffect(() => { loadJobs(); }, [loadJobs]);
  const running = jobs.some(job => job.state === 'running');
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(async () => { const next = await loadJobs(); if (!next.some(job => job.state === 'running')) refresh(); }, 1000);
    return () => window.clearInterval(timer);
  }, [running, loadJobs, refresh]);
  const act = async task => { setError(null); try { await task(); } catch (issue) { setError(issue); } };

  const importFiles = () => act(async () => { const choice = await localApi.chooseMedia('Importar mídias', true); if (choice.paths?.length) { await localApi.importFiles({ path: projectPath, sources: choice.paths, rights }); await loadJobs(); } });
  const drop = event => {
    event.preventDefault(); setDragging(false);
    if (blocked('media.import').length) return setError(Object.assign(new Error('Instale FFmpeg/FFprobe para importar.'), { code: 'DEPENDENCY_MISSING', details: { missing: blocked('media.import').map(item => item.id) } }));
    [...event.dataTransfer.files].forEach(file => {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      setUploads(previous => [...previous, { id, name: file.name, loaded: 0, total: file.size, state: 'enviando' }]);
      localApi.upload({ path: projectPath, file, rights, onProgress: (loaded, total) => setUploads(previous => previous.map(item => (item.id === id ? { ...item, loaded, total } : item))) })
        .then(result => { setUploads(previous => previous.map(item => (item.id === id ? { ...item, state: result.status === 'duplicate' ? 'já estava no projeto' : 'importado' } : item))); refresh(); })
        .catch(issue => setUploads(previous => previous.map(item => (item.id === id ? { ...item, state: `falhou: ${issue.message}` } : item))));
    });
  };
  const current = project.media.find(item => item.id === selected);

  return <main id="main" className="workspace media-library" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <button className="text-button" onClick={onBack}><ArrowLeft size={16}/> Workflow</button>
    <header className="project-header"><div><span className="eyebrow">{project.title}</span><h1>Mídias locais</h1></div>
      <div className="header-actions"><label className="mode-select">Direitos <select value={rights} onChange={event => setRights(event.target.value)}>{Object.entries(RIGHTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button primary" onClick={importFiles} disabled={blocked('media.import').length > 0} title={blocked('media.import').length ? `Requer ${blocked('media.import').map(item => item.label).join(', ')}` : ''}><Plus size={18}/> Importar arquivos</button></div></header>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    <div className={`drop-zone ${dragging ? 'active' : ''}`} aria-hidden={!dragging}><Upload size={18}/> Solte arquivos aqui para importar com direitos “{RIGHTS[rights]}”.</div>
    <FeatureList features={STAGE_REQUIREMENTS.media.features} setup={setup} onOpenSetup={onOpenSetup}/>
    <UrlImport projectPath={projectPath} blocked={blocked('media.url')} onOpenSetup={onOpenSetup} onStarted={loadJobs}/>
    <JobsPanel jobs={jobs} uploads={uploads} onCancel={jobId => act(async () => { await localApi.cancelJob(jobId); await loadJobs(); })}/>
    <TranscriptSearch projectPath={projectPath} onPick={result => { setSelected(result.mediaId); setSeek({ mediaId: result.mediaId, time: result.start, at: Date.now() }); }}/>
    <section className="media-grid">
      <div className="workflow-card">{project.media.length ? <ul className="media-list" aria-label="Mídias do projeto">{project.media.map(item => <li key={item.id} className={item.id === selected ? 'selected' : ''}>
        <button className="media-pick" onClick={() => setSelected(item.id)} aria-pressed={item.id === selected}><strong>{item.name || item.uri.split('/').at(-1)}</strong><small>{KINDS[item.kind]} · {clock(item.metadata?.durationSeconds)}{item.metadata?.width ? ` · ${item.metadata.width}×${item.metadata.height}` : ''} · {formatBytes(item.metadata?.sizeBytes)} · direitos: {RIGHTS[item.rights]}{item.transcript ? ` · transcrição ${item.transcript.status === 'revised' ? 'revisada' : 'bruta'}` : ''}</small></button>
        <span className={availability.get(item.id) === false ? 'missing' : 'available'}>{availability.get(item.id) === false ? 'Arquivo ausente' : 'Disponível'}</span>
        <button className="icon-button" aria-label={`Remover ${item.name || item.id}`} onClick={() => act(async () => setRemoving({ media: item, usage: await localApi.mediaUsage({ path: projectPath, mediaId: item.id }) }))}><Trash2 size={16}/></button>
      </li>)}</ul> : <div className="empty-state"><strong>Nenhuma mídia importada.</strong><span>Use “Importar arquivos”, arraste arquivos para esta tela ou importe por URL. O Content Lab copia o conteúdo, calcula o hash e registra os direitos.</span></div>}</div>
      {current && <MediaDetail key={current.id} projectPath={projectPath} revision={project.revision} media={current} available={availability.get(current.id) !== false} setup={setup} onOpenSetup={onOpenSetup} seek={seek?.mediaId === current.id ? seek : null} onChanged={refresh} onJobs={loadJobs}/>}
    </section>
    {removing && <RemoveDialog removing={removing} onClose={() => setRemoving(null)} onConfirm={async detachUsages => { await localApi.removeMedia({ path: projectPath, baseRevision: project.revision, mediaId: removing.media.id, detachUsages }); setRemoving(null); if (selected === removing.media.id) setSelected(null); await refresh(); }}/>}
  </main>;
}

function UrlImport({ projectPath, blocked, onOpenSetup, onStarted }) {
  const [url, setUrl] = useState(''); const [rights, setRights] = useState('owned'); const [confirmed, setConfirmed] = useState(false); const [error, setError] = useState(null);
  const submit = async event => { event.preventDefault(); setError(null); try { await localApi.importUrl({ path: projectPath, url, rights, rightsConfirmed: confirmed }); setUrl(''); setConfirmed(false); await onStarted(); } catch (issue) { setError(issue); } };
  if (blocked.length) return null;
  return <form className="workflow-card url-import" onSubmit={submit} aria-label="Importar por URL">
    <label className="url-field"><Link2 size={16}/><span className="sr-only">Link do vídeo</span><input type="url" required placeholder="https://… (um único vídeo)" value={url} onChange={event => setUrl(event.target.value)}/></label>
    <label className="mode-select">Direitos <select value={rights} onChange={event => setRights(event.target.value)}><option value="owned">Própria</option><option value="licensed">Licenciada</option><option value="authorized">Autorizada</option></select></label>
    <label className="check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/> Tenho direito de usar este vídeo</label>
    <button className="button quiet" disabled={!url || !confirmed} title={!confirmed ? 'Confirme os direitos sobre o vídeo' : ''}><Download size={16}/> Baixar</button>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
  </form>;
}

export function JobsPanel({ jobs, uploads, onCancel }) {
  if (!jobs.length && !uploads.length) return null;
  return <section className="workflow-card jobs" aria-label="Tarefas de mídia" aria-live="polite"><ul className="media-list">
    {uploads.map(item => <li key={item.id}><span><strong>{item.name}</strong><small>{item.state === 'enviando' ? `Enviando ${Math.round((100 * item.loaded) / Math.max(1, item.total))}%` : item.state}</small></span></li>)}
    {jobs.slice(0, 8).map(job => <li key={job.id}><span><strong>{job.label}</strong><small>{job.progress.phase}{job.progress.total ? ` · ${job.progress.done}/${job.progress.total}` : ''}{job.error ? ` — ${job.error}` : ''}{job.result?.imported != null ? ` · ${job.result.imported} importado(s), ${job.result.duplicates} repetido(s), ${job.result.failed} com falha` : ''}{job.result?.generated != null ? ` · ${job.result.generated} gerada(s), ${job.result.cached} do cache` : ''}</small>{job.state === 'running' && job.progress.total ? <span className="progress"><i style={{ width: `${Math.round((100 * job.progress.done) / job.progress.total)}%` }}/></span> : null}</span>
      {job.state === 'running' ? <button className="mini-button" onClick={() => onCancel(job.id)}>Cancelar</button> : <span className={job.state === 'completed' ? 'available' : 'missing'}>{({ completed: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado' })[job.state]}</span>}</li>)}
  </ul></section>;
}

function TranscriptSearch({ projectPath, onPick }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState(null);
  const submit = async event => { event.preventDefault(); setResults((await localApi.searchTranscripts({ path: projectPath, query })).results); };
  return <form className="transcript-search" role="search" onSubmit={submit}><Search size={16}/><label className="sr-only" htmlFor="transcript-query">Buscar nas transcrições</label><input id="transcript-query" placeholder="Buscar fala ou tempo (ex.: 1:23)" value={query} onChange={event => setQuery(event.target.value)}/><button className="mini-button">Buscar</button>
    {results && <ul className="search-results" aria-label="Resultados da busca">{results.length ? results.map((result, index) => <li key={`${result.mediaId}-${index}`}><button className="text-button" onClick={() => onPick(result)}><strong>{clock(result.start)}</strong> {result.name}: {result.text}</button></li>) : <li className="muted">Nada encontrado.</li>}</ul>}
  </form>;
}

function MediaDetail({ projectPath, revision, media, available, setup, onOpenSetup, seek, onChanged, onJobs }) {
  const player = useRef(null); const [start, setStart] = useState('0'); const [end, setEnd] = useState(''); const [name, setName] = useState('corte'); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (seek && player.current) { player.current.currentTime = seek.time; player.current.play?.().catch(() => {}); } }, [seek]);
  const act = async task => { setBusy(true); setError(null); try { await task(); } catch (issue) { setError(issue); } finally { setBusy(false); } };
  const source = mediaUrl(projectPath, media.id);
  const playable = ['video', 'audio'].includes(media.kind);
  const position = () => String(Math.round((player.current?.currentTime || 0) * 10) / 10);
  const cutBlocked = setup ? featureBlock('media.import', setup.items) : [];
  return <section className="workflow-card media-detail" aria-label={`Detalhes de ${media.name || media.id}`}>
    <div className="preview">{!available ? <div className="empty-state">Arquivo ausente: reimporte ou relocalize o cache.</div> : media.kind === 'video' ? <video ref={player} src={source} controls preload="metadata"/> : media.kind === 'audio' ? <audio ref={player} src={source} controls preload="metadata"/> : <img src={source} alt={media.name || 'Imagem importada'}/>}</div>
    <dl className="target"><dt>Original</dt><dd><code>{media.source?.value || '—'}</code></dd><dt>Cache</dt><dd><code>{media.uri}</code></dd><dt>Formato</dt><dd>{[media.metadata?.videoCodec, media.metadata?.audioCodec, media.metadata?.sampleRate && `${media.metadata.sampleRate} Hz`].filter(Boolean).join(' · ') || '—'}</dd><dt>SHA-256</dt><dd><code>{media.sha256?.slice(0, 16)}…</code></dd></dl>
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>
    {playable && <div className="cuts"><h3><Scissors size={16}/> Cortes</h3>
      {media.cuts?.length ? <ul className="media-list">{media.cuts.map(cut => <li key={cut.id}><span><strong>{cut.name}</strong><small>{clock(cut.start)} → {clock(cut.end)} · arquivo em cache, original intacto</small></span><audio src={mediaUrl(projectPath, media.id, cut.id)} controls preload="none" aria-label={`Ouvir corte ${cut.name}`}/><button className="icon-button" aria-label={`Remover corte ${cut.name}`} disabled={busy} onClick={() => act(async () => { await localApi.removeCut({ path: projectPath, baseRevision: revision, mediaId: media.id, cutId: cut.id }); await onChanged(); })}><X size={14}/></button></li>)}</ul> : <p className="muted">Nenhum corte.</p>}
      <form className="cut-form" onSubmit={event => { event.preventDefault(); act(async () => { await localApi.createCut({ path: projectPath, baseRevision: revision, mediaId: media.id, start: Number(start.replace(',', '.')), end: Number(end.replace(',', '.')), name }); await onChanged(); }); }}>
        <label>Nome<input value={name} onChange={event => setName(event.target.value)} required/></label>
        <label>Início (s)<input inputMode="decimal" value={start} onChange={event => setStart(event.target.value)} required/></label><button type="button" className="mini-button" onClick={() => setStart(position())}>Posição atual</button>
        <label>Fim (s)<input inputMode="decimal" value={end} onChange={event => setEnd(event.target.value)} required/></label><button type="button" className="mini-button" onClick={() => setEnd(position())}>Posição atual</button>
        <button className="button quiet" disabled={busy || cutBlocked.length > 0} title={cutBlocked.length ? 'Requer FFmpeg' : ''}><Film size={16}/> Criar corte</button>
      </form></div>}
    {playable && <TranscriptPanel projectPath={projectPath} media={media} setup={setup} onOpenSetup={onOpenSetup} onChanged={onChanged} onJobs={onJobs} onSeek={time => { if (player.current) player.current.currentTime = time; }}/>}
  </section>;
}

function TranscriptPanel({ projectPath, media, setup, onOpenSetup, onChanged, onJobs, onSeek }) {
  const [transcript, setTranscript] = useState(null); const [draft, setDraft] = useState(null); const [redo, setRedo] = useState(false); const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const blocked = setup ? featureBlock('transcription', setup.items) : [];
  const load = useCallback(async () => { const value = (await localApi.transcript({ path: projectPath, mediaId: media.id })).transcript; setTranscript(value); setDraft(value ? value.current.map(segment => ({ ...segment })) : null); }, [projectPath, media.id]);
  useEffect(() => { load().catch(issue => setError(issue)); }, [load, media.transcript?.updatedAt]);
  const start = async force => { setError(null); setStatus(''); try { const result = await localApi.transcribe({ path: projectPath, mediaId: media.id, force }); if (result.status === 'unchanged') setStatus('Já transcrita com o mesmo áudio e modelo.'); else { setStatus('Transcrição na fila.'); await onJobs(); } } catch (issue) { setError(issue); } };
  const save = async () => { setError(null); try { await localApi.saveTranscript({ path: projectPath, mediaId: media.id, baseRevision: transcript.revision, segments: draft }); setStatus('Revisão salva. A saída original do Whisper foi preservada.'); await load(); await onChanged(); } catch (issue) { setError(issue); } };
  const changed = draft && transcript && JSON.stringify(draft) !== JSON.stringify(transcript.current);
  return <div className="transcript"><h3>Transcrição PT-BR</h3>
    {blocked.length ? <FeatureList features={['transcription']} setup={setup} onOpenSetup={onOpenSetup}/> : <div className="setup-actions"><button className="button quiet" onClick={() => start(false)}>{transcript ? 'Verificar transcrição' : 'Transcrever'}</button>{transcript && <button className="button quiet" onClick={() => setRedo(true)}>Transcrever de novo</button>}</div>}
    {redo && <ConfirmDialog title="Transcrever de novo" message="A revisão manual continua salva, mas a saída bruta será substituída." confirm="Transcrever" tone="primary" onClose={() => setRedo(false)} onConfirm={async () => { setRedo(false); await start(true); }}/>}
    <DependencyNotice error={error} onOpenSetup={onOpenSetup}/>{status && <p className="notice" role="status">{status}</p>}
    {draft && <>
      <ol className="segments">{draft.map((segment, index) => <li key={index}><button type="button" className="mini-button" onClick={() => onSeek(segment.start)} aria-label={`Ir para ${clock(segment.start)}`}>{clock(segment.start)}</button><label className="sr-only" htmlFor={`segment-${index}`}>Trecho {index + 1}</label><textarea id={`segment-${index}`} rows="2" value={segment.text} onChange={event => setDraft(previous => previous.map((item, position) => (position === index ? { ...item, text: event.target.value } : item)))}/>{transcript.raw[index] && transcript.raw[index].text !== segment.text && <small className="muted">Original: {transcript.raw[index].text}</small>}</li>)}</ol>
      <div className="setup-actions"><button className="button primary" disabled={!changed} onClick={save}>Salvar revisão</button><a className="button quiet" download={`${media.name || media.id}.srt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(transcript.srt)}`}>Baixar SRT</a><small className="muted">Revisão {transcript.revision} · {transcript.raw.length} trechos</small></div>
    </>}
  </div>;
}

function RemoveDialog({ removing, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const { media, usage } = removing;
  useEffect(() => { const handle = event => { if (event.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', handle); return () => document.removeEventListener('keydown', handle); }, [busy, onClose]);
  const confirm = async () => { setBusy(true); setError(''); try { await onConfirm(usage.total > 0); } catch (issue) { setError(issue.message); setBusy(false); } };
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-media-title">
    <div className="section-title"><div><span className="eyebrow">Mídia</span><h2 id="remove-media-title">Remover do projeto</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X/></button></div>
    <p className="hint"><strong>{media.name || media.id}</strong> sai deste projeto. O arquivo original não é apagado; a cópia no cache só é removida pela limpeza de mídias sem uso.</p>
    {usage.total > 0 ? <div className="notice error" role="alert">Em uso: {[usage.thumbnail && 'thumbnail da embalagem', usage.clips.length && `${usage.clips.length} clip(s) na timeline`].filter(Boolean).join(' e ')}. Esses usos serão desfeitos.</div> : <p className="hint">Não é usada na timeline nem na thumbnail.</p>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="dialog-actions"><button className="button quiet" onClick={onClose} disabled={busy}>Cancelar</button><button className="button danger" onClick={confirm} disabled={busy}>{usage.total ? 'Desassociar e remover' : 'Remover'}</button></div>
  </div></div>;
}
