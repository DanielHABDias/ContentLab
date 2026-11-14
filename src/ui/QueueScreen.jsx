import { useEffect, useState } from 'react';
import { ListOrdered, Trash2, XCircle, FolderOpen } from 'lucide-react';
import { localApi } from './local-api.js';

const active = job => ['queued', 'running'].includes(job.state);
const states = { queued: 'Aguardando', running: 'Em execução', completed: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado' };
const kinds = { render: 'Render', transcription: 'Transcrição', 'voice.generate': 'Voz de IA', 'voice.check': 'Amostra de voz', 'narration.assemble': 'Montagem de áudio', 'media.import': 'Importação', 'media.url': 'Download' };
const percent = job => typeof job.progress === 'number' ? Math.round(job.progress * 100) : job.progress?.total ? Math.round(100 * job.progress.done / job.progress.total) : null;

export function QueueScreen({ onOpenProject }) {
  const [jobs, setJobs] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    const load = async () => { try { const result = await localApi.processingQueue(); if (live) { setJobs(result.jobs); setError(''); setLoaded(true); } } catch (issue) { if (live) { setError(issue.message); setLoaded(true); } } };
    load(); const timer = window.setInterval(load, 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  const act = async task => { setBusy(true); setError(''); try { await task(); setJobs((await localApi.processingQueue()).jobs); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  const pending = jobs.filter(active); const history = jobs.filter(job => !active(job));
  const rows = list => <ul className="processing-jobs">{list.map(job => {
    const progress = percent(job); const phase = job.phase || job.progress?.phase;
    return <li key={job.id} className={`processing-job ${job.state}`}>
      <div className="processing-job-heading"><span className={`queue-state ${job.state}`}>{states[job.state] || job.state}{job.state === 'queued' && job.queuePosition ? ` · posição ${job.queuePosition}` : ''}</span><span className="muted">{kinds[job.kind] || job.kind}</span></div>
      <h3>{job.projectTitle}</h3><p>{job.label}</p>
      <small>{phase}{job.state === 'running' && progress != null ? ` · ${progress}%` : ''}</small>
      {job.state === 'running' && progress != null && <div className="progress" role="progressbar" aria-label={`Progresso de ${job.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }}/></div>}
      {job.error && <p className="queue-error">{job.error}</p>}
      <div className="take-actions">
        {active(job) && <button className="mini-button" disabled={busy} onClick={() => act(() => localApi.cancelProcessingJob(job.id))}>Cancelar trabalho</button>}
        {job.kind === 'render' && ['failed', 'cancelled'].includes(job.state) && <button className="mini-button" disabled={busy} onClick={() => act(() => localApi.retryRender(job.id))}>Tentar novamente</button>}
        {job.output && <button className="mini-button" disabled={busy} onClick={() => act(() => localApi.revealRender(job.id))}>Mostrar arquivo</button>}
        {job.projectTitle !== 'Minha voz' && <button className="mini-button" onClick={() => onOpenProject(job.projectPath)}><FolderOpen size={14}/> Abrir projeto</button>}
      </div>
    </li>;
  })}</ul>;
  return <main id="main" className="project-home processing-queue">
    <header className="home-header"><div><span className="eyebrow">Todos os projetos</span><h1><ListOrdered size={28}/> Fila de processamento</h1><p>Um trabalho por vez, na ordem de envio. Render, transcrição e voz compartilham a mesma fila.</p></div><div className="take-actions"><button className="button quiet" disabled={busy || !history.length} onClick={() => act(() => localApi.clearProcessingHistory())}><Trash2 size={17}/> Limpar histórico</button><button className="button quiet" disabled={busy || !pending.length} onClick={() => act(() => localApi.cancelProcessingQueue())}><XCircle size={17}/> Cancelar todos</button></div></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    <section aria-labelledby="pending-queue-title"><div className="section-title"><h2 id="pending-queue-title">Em execução e aguardando</h2><span>{pending.length} {pending.length === 1 ? 'trabalho' : 'trabalhos'}</span></div>{pending.length ? rows(pending) : <div className="empty-state"><strong>{loaded ? 'Nenhum trabalho aguardando.' : 'Carregando fila…'}</strong><span>Envie trabalhos pelos projetos. Eles aparecem aqui automaticamente.</span></div>}</section>
    <section aria-labelledby="queue-history-title"><div className="section-title"><h2 id="queue-history-title">Histórico</h2><span>{history.length} encerrados</span></div>{history.length ? rows(history) : <p className="empty-state">O histórico de trabalhos concluídos, cancelados e com falha aparece aqui. Limpar o histórico mantém a fila ativa e os arquivos produzidos.</p>}</section>
  </main>;
}
