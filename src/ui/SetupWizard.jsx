import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Pause, Play, RefreshCw, X } from 'lucide-react';
import { localApi } from './local-api.js';
import { formatBytes } from './ProjectManagement.jsx';

const ACTIVE = ['running', 'queued'];

/**
 * Assistente de primeira execução e tela de dependências. Nada é baixado sem
 * seleção e consentimento explícitos; pacotes do sistema só têm o comando exibido.
 */
export function SetupWizard({ firstRun = false, focus = [], onClose, onFinished, onChanged }) {
  const [status, setStatus] = useState(null); const [error, setError] = useState(''); const [selected, setSelected] = useState([]); const [consent, setConsent] = useState(false); const [showEssentials, setShowEssentials] = useState(false); const [copied, setCopied] = useState('');
  const load = useCallback(async () => { try { const value = await localApi.setupStatus(); setStatus(value); onChanged?.(value); return value; } catch (issue) { setError(issue.message); return null; } }, []);
  useEffect(() => { load().then(value => { if (value && focus.length) setSelected(value.items.filter(item => focus.includes(item.id) && item.installable && !item.ready).map(item => item.id)); }); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  const jobs = status?.jobs || [];
  const running = jobs.some(job => ACTIVE.includes(job.state));
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(async () => { try { const { jobs: next } = await localApi.setupJobs(); setStatus(previous => ({ ...previous, jobs: next })); if (!next.some(job => ACTIVE.includes(job.state))) load(); } catch (issue) { setError(issue.message); } }, 1000);
    return () => window.clearInterval(timer);
  }, [running, load]);

  if (!status) return <main id="main" className="workspace setup">{error ? <div className="notice error" role="alert"><X size={16}/>{error}</div> : <p className="empty-state" role="status">Verificando o computador…</p>}</main>;

  const essentials = status.items.filter(item => item.group === 'essential');
  const ai = status.items.filter(item => item.group === 'ai');
  const missingEssentials = essentials.filter(item => !item.ready);
  const essentialCommand = [...new Set(missingEssentials.map(item => item.systemCommand).filter(Boolean))].join(' && ');
  const jobFor = id => [...jobs].reverse().find(job => job.itemId === id);
  const chosen = ai.filter(item => selected.includes(item.id));
  const totalBytes = chosen.reduce((sum, item) => sum + (item.downloadBytes || 0), 0);
  const enoughSpace = status.freeBytes == null || totalBytes < status.freeBytes;
  const toggle = id => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  const act = async task => { setError(''); try { await task(); } catch (issue) { setError(issue.message); } await load(); };
  const install = () => act(async () => { await localApi.setupInstall({ ids: selected, consent: consent ? selected : [] }); setSelected([]); setConsent(false); });
  const copy = async text => { try { await navigator.clipboard.writeText(text); setCopied(text); } catch { setError('Não foi possível copiar; selecione o comando e copie manualmente.'); } };
  const choose = async choice => act(async () => { await localApi.setupOnboarding(choice); (choice === 'completed' ? onFinished : onClose)?.(); });

  return <main id="main" className="workspace setup">
    <header className="project-header"><div><span className="eyebrow">{firstRun ? 'Primeira execução' : 'Dependências'}</span><h1>Prepare seu computador</h1><p className="setup-meta">{status.platform.distro} · {status.platform.os}-{status.platform.arch} · {formatBytes(status.freeBytes)} livres em <code>{status.toolsDirectory}</code></p></div>{!firstRun && <button className="button quiet" onClick={onClose}>Voltar</button>}</header>
    {error && <div className="notice error" role="alert"><X size={16}/>{error}</div>}
    {focus.length > 0 && <FocusNotice focus={focus} items={status.items}/>}

    <section className="workflow-card" aria-labelledby="essentials-title">
      <div className="section-title"><div><span className="eyebrow">Obrigatório</span><h2 id="essentials-title">Essenciais</h2></div><button className="button quiet" onClick={() => load()}><RefreshCw size={16}/> Verificar novamente</button></div>
      <ul className="media-list">{essentials.map(item => <DependencyRow key={item.id} item={item}/>)}</ul>
      {missingEssentials.length ? <div className="setup-actions">
        <button className="button primary" onClick={() => setShowEssentials(true)} aria-expanded={showEssentials}>Instalar essenciais</button>
        {showEssentials && <div className="command-box"><p>Pacotes do sistema exigem sua senha de administrador. Execute no terminal e depois clique em “Verificar novamente”:</p>{essentialCommand ? <div className="command"><code>{essentialCommand}</code><button className="icon-button" aria-label="Copiar comando" onClick={() => copy(essentialCommand)}>{copied === essentialCommand ? <Check size={16}/> : <Copy size={16}/>}</button></div> : <p>Não identificamos o gerenciador de pacotes desta distribuição. Instale {missingEssentials.map(item => item.label).join(', ')} pelo gerenciador do sistema.</p>}</div>}
      </div> : <p className="notice" role="status"><Check size={16}/> Essenciais prontos. A interface funciona mesmo sem os recursos de IA.</p>}
    </section>

    <section className="workflow-card" aria-labelledby="ai-title">
      <div className="section-title"><div><span className="eyebrow">Opcional</span><h2 id="ai-title">Recursos de IA</h2></div></div>
      <ul className="media-list">{ai.map(item => {
        const job = jobFor(item.id); const busy = job && ACTIVE.includes(job.state);
        return <DependencyRow key={item.id} item={item} job={job} selectable={item.installable && !item.ready && !busy} checked={selected.includes(item.id)} onToggle={() => toggle(item.id)}
          controls={job && <JobControls job={job} onPause={() => act(() => localApi.setupPause({ jobId: job.id }))} onResume={() => act(() => localApi.setupResume({ jobId: job.id }))} onCancel={() => act(() => localApi.setupCancel({ jobId: job.id }))}/>}/>;
      })}</ul>
      {chosen.length > 0 && <div className="consent-box">
        <p><strong>Antes de baixar:</strong> {chosen.map(item => `${item.label} (${item.downloadBytes ? formatBytes(item.downloadBytes) : 'tamanho variável'}, ${item.license})`).join('; ')}. Total estimado {formatBytes(totalBytes)}. Destino: <code>{status.toolsDirectory}</code>. Nada no sistema é alterado.</p>
        {!enoughSpace && <p className="notice error" role="alert">Espaço insuficiente: libere {formatBytes(totalBytes - status.freeBytes)} ou desmarque itens.</p>}
        <label className="check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> Conferi origem, licença e tamanho e autorizo o download e a execução deste código de terceiros.</label>
      </div>}
      <div className="setup-actions"><button className="button primary" disabled={!chosen.length || !consent || !enoughSpace} title={!chosen.length ? 'Selecione ao menos um recurso' : !consent ? 'Confirme origem, licença e tamanho' : !enoughSpace ? 'Espaço em disco insuficiente' : ''} onClick={install}><Download size={17}/> Instalar recursos de IA</button></div>
    </section>

    {firstRun && <div className="dialog-actions setup-footer"><button className="button quiet" onClick={() => choose('dismissed')}>Agora não</button><button className="button primary" disabled={!status.essentialsReady || running} title={!status.essentialsReady ? 'Instale os essenciais primeiro' : running ? 'Aguarde as instalações em andamento' : ''} onClick={() => choose('completed')}>Começar a usar</button></div>}
  </main>;
}

function DependencyRow({ item, job, selectable, checked, onToggle, controls }) {
  const progress = job?.total ? Math.min(100, Math.round((100 * job.received) / job.total)) : null;
  return <li className="dependency">
    <span>
      {selectable ? <label className="check"><input type="checkbox" checked={checked} onChange={onToggle}/> <strong>{item.label}</strong></label> : <strong>{item.label}</strong>}
      <small>{item.description}</small>
      <small>{[item.version && `versão ${item.version}`, item.downloadBytes && formatBytes(item.downloadBytes), item.license && `licença ${item.license}`].filter(Boolean).join(' · ')}{item.origin && <> · <a href={item.origin} target="_blank" rel="noreferrer">origem</a></>}</small>
      {!item.ready && (item.installable ? null : item.systemCommand ? <small>Instale com <code>{item.systemCommand}</code></small> : item.manualSteps ? <small>{item.manualSteps}</small> : item.reason && <small>{item.reason}</small>)}
      {job && <span className="job" role="status" aria-live="polite"><span>{job.phase}{progress != null && ACTIVE.includes(job.state) ? ` · ${progress}%` : ''}{job.error ? ` — ${job.error}` : ''}</span>{progress != null && ['running', 'paused'].includes(job.state) && <span className="progress" aria-hidden="true"><i style={{ width: `${progress}%` }}/></span>}</span>}
    </span>
    <span className="dependency-side">{controls}<span className={item.ready ? 'available' : 'missing'}>{item.ready ? 'Pronto' : item.required ? 'Ausente' : 'Não instalado'}</span></span>
  </li>;
}

function JobControls({ job, onPause, onResume, onCancel }) {
  if (job.state === 'running') return <><button className="mini-button" onClick={onPause} aria-label={`Pausar ${job.label}`}><Pause size={14}/></button><button className="mini-button" onClick={onCancel} aria-label={`Cancelar ${job.label}`}><X size={14}/></button></>;
  if (job.state === 'paused') return <><button className="mini-button" onClick={onResume}><Play size={14}/> Retomar</button><button className="mini-button" onClick={onCancel}>Cancelar</button></>;
  if (job.state === 'failed') return <><button className="mini-button" onClick={onResume}><RefreshCw size={14}/> Tentar novamente</button><button className="mini-button" onClick={onCancel}>Descartar</button></>;
  return null;
}

function FocusNotice({ focus, items }) {
  const pending = items.filter(item => focus.includes(item.id));
  const ready = pending.every(item => item.ready);
  return <div className={`notice ${ready ? '' : 'error'}`} role="status">{ready ? <><Check size={16}/> Dependências instaladas. Volte ao projeto para continuar.</> : <span>Necessário para continuar: <strong>{pending.filter(item => !item.ready).map(item => item.label).join(', ')}</strong>. {pending.some(item => !item.ready && item.installable) ? 'Os itens instaláveis já estão marcados abaixo.' : 'Siga o comando indicado em cada item.'}</span>}</div>;
}
