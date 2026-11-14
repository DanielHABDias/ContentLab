import { useEffect, useState } from 'react';
import { localApi } from './local-api.js';

const labels = { queued: 'Na fila', running: 'Renderizando', completed: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado' };
const selectCurrent = result => {
  const job = result.current || result.jobs?.find(item => item.state === 'running') || result.jobs?.find(item => item.state === 'queued') || result.jobs?.[0];
  return job || null;
};

export function RenderPanel({ projectPath, blocked = [], onOpenSetup }) {
  const [presets, setPresets] = useState([]); const [presetId, setPresetId] = useState(''); const [job, setJob] = useState(null);
  const [outputDirectory, setOutputDirectory] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = async () => setJob(selectCurrent(await localApi.renderJobs(projectPath)));
  useEffect(() => {
    let live = true;
    Promise.all([localApi.renderPresets(projectPath), localApi.renderJobs(projectPath)]).then(([presetResult, jobResult]) => {
      if (!live) return; setPresets(presetResult.presets); setPresetId(presetResult.presets[0]?.id || ''); setJob(selectCurrent(jobResult));
    }).catch(issue => live && setError(issue.message));
    const timer = window.setInterval(async () => { try { const result = await localApi.renderJobs(projectPath); if (live) setJob(selectCurrent(result)); } catch { /* reconecta na próxima atualização */ } }, 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [projectPath]);
  const chooseOutput = async () => { try { const choice = await localApi.chooseDirectory('Onde salvar os vídeos renderizados?'); if (choice.path) setOutputDirectory(choice.path); } catch (issue) { setError(issue.message); } };
  const start = async () => { setBusy(true); setError(''); try { if (!outputDirectory) throw new Error('Escolha a pasta de saída'); await localApi.enqueueRender({ path: projectPath, outputDirectory, presetId }); await refresh(); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  const act = async task => { setError(''); try { await task(); await refresh(); } catch (issue) { setError(issue.message); } };
  const progress = Math.round((job?.progress || 0) * 100);
  return <section className="workflow-card render-panel" aria-labelledby="render-title">
    <div className="section-title"><div><h2 id="render-title">Render do projeto</h2><span>O trabalho atual ou o último render. O histórico fica na fila de processamento.</span></div><button className="button quiet" onClick={() => window.dispatchEvent(new Event('contentlab:open-queue'))}>Ver fila de processamento</button></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {blocked.length > 0 && <div className="notice error">Requer {blocked.map(item => item.label).join(', ')}. <button className="mini-button" onClick={() => onOpenSetup(blocked.map(item => item.id))}>Configurar</button></div>}
    <div className="render-controls"><label>Qualidade<select value={presetId} onChange={event => setPresetId(event.target.value)}>{presets.map(item => <option key={item.id} value={item.id}>{item.label} · {item.width}×{item.height}</option>)}</select></label><div className="location-picker"><span><strong>Pasta de saída</strong><small>{outputDirectory || 'Escolha onde salvar'}</small></span><button className="button quiet" onClick={chooseOutput}>Escolher</button></div><button className="button primary" disabled={busy || blocked.length > 0 || !presetId} onClick={start}>{busy ? 'Adicionando…' : 'Adicionar à fila'}</button></div>
    {job ? <ul className="render-jobs"><li><div><strong>{labels[job.state] || job.state} · {progress}%</strong><small>{job.phase} · tentativa {job.attempt}</small>{job.error && <small className="queue-error">{job.error}</small>}{job.output && <small>{job.output}</small>}</div><div className="progress" role="progressbar" aria-label="Progresso do render" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }}/></div><div className="take-actions">{['queued', 'running'].includes(job.state) && <button className="mini-button" onClick={() => act(() => localApi.cancelRender(job.id))}>Cancelar</button>}{job.state === 'completed' && <button className="mini-button" onClick={() => act(() => localApi.revealRender(job.id))}>Mostrar arquivo</button>}</div></li></ul> : <div className="empty-state"><strong>Nenhum render neste projeto.</strong><span>Escolha a qualidade e a pasta para enviar à fila.</span></div>}
  </section>;
}
