import { useCallback, useEffect, useState } from 'react';
import { Check, FolderOpen, HardDrive, RefreshCw, Trash2, X } from 'lucide-react';
import { localApi } from './local-api.js';
import { formatBytes, formatDate } from './ProjectManagement.jsx';

const ROOT_LABELS = {
  projects: ['Projetos', 'Onde novos projetos são criados. Projetos existentes continuam onde estão.'],
  media: ['Cache de mídia', 'Cópias deduplicadas por hash, cortes e índices.'],
  renderCache: ['Cache de render', 'Intermediários reaproveitáveis do render.'],
  tools: ['Ferramentas e modelos', 'yt-dlp, whisper.cpp, pesos e ambiente do Chatterbox.'],
  renderOutput: ['Saída padrão de render', 'Vazio = pasta output/ de cada projeto.'],
};
const USAGE_LABELS = { projects: 'Projetos', renders: 'Renders nos projetos', objects: 'Mídias originais (cache)', cuts: 'Cortes', staging: 'Downloads temporários', renderCache: 'Cache de render', models: 'Modelos de IA', tools: 'Ferramentas' };
const GB = 1024 ** 3;

export function SettingsScreen({ onBack }) {
  const [settings, setSettings] = useState(null); const [usage, setUsage] = useState(null); const [jobs, setJobs] = useState([]); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [decision, setDecision] = useState(null); const [orphans, setOrphans] = useState(null); const [backups, setBackups] = useState([]); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const [value, used, running, list] = await Promise.all([localApi.getSettings(), localApi.storageUsage(), localApi.storageJobs(), localApi.registryBackups()]); setSettings(value); setUsage(used); setJobs(running.jobs); setBackups(list.backups); }
    catch (issue) { setError(issue.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const migrating = jobs.some(job => job.state === 'running');
  useEffect(() => {
    if (!migrating) return undefined;
    const timer = window.setInterval(async () => { const { jobs: next } = await localApi.storageJobs(); setJobs(next); if (!next.some(job => job.state === 'running')) load(); }, 1000);
    return () => window.clearInterval(timer);
  }, [migrating, load]);
  const act = async (task, success) => { setBusy(true); setError(''); setStatus(''); try { await task(); if (success) setStatus(success); await load(); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };

  const change = kind => act(async () => {
    const choice = await localApi.chooseDirectory(`Nova pasta: ${ROOT_LABELS[kind][0]}`);
    if (!choice.path) return;
    await localApi.validateFolder(choice.path);
    try { await localApi.updateSettings({ baseRevision: settings.revision, roots: { [kind]: choice.path } }); setStatus(`${ROOT_LABELS[kind][0]}: ${choice.path}`); }
    catch (issue) {
      if (issue.code !== 'MIGRATION_DECISION_REQUIRED') throw issue;
      setDecision({ kind, target: choice.path, usedBytes: issue.details?.usedBytes, plan: await localApi.planMigration({ kind, target: choice.path }), removeSource: false });
    }
  });

  if (!settings) return <main id="main" className="workspace settings">{error ? <div className="notice error" role="alert"><X size={16}/>{error}</div> : <p className="empty-state" role="status">Carregando configurações…</p>}</main>;

  return <main id="main" className="workspace settings">
    <header className="project-header"><div><span className="eyebrow">Armazenamento e recuperação</span><h1>Configurações</h1></div><button className="button quiet" onClick={onBack}>Voltar</button></header>
    {error && <div className="notice error" role="alert"><X size={16}/>{error}</div>}
    <div aria-live="polite">{status && <div className="notice" role="status"><Check size={16}/>{status}</div>}</div>
    {(settings.recoveredFrom || settings.registryRecovery) && <div className="notice error" role="alert">{settings.recoveredFrom && 'As configurações estavam corrompidas e foram restauradas do backup. '}{settings.registryRecovery && `O registro de projetos estava corrompido e foi recuperado (${settings.registryRecovery.source === 'backup' ? 'do backup' : 'varrendo a pasta de projetos'}, ${settings.registryRecovery.recovered} projetos). O arquivo original foi preservado em ${settings.registryRecovery.corrupted}.`}</div>}

    <section className="workflow-card" aria-labelledby="roots-title">
      <div className="section-title"><h2 id="roots-title">Pastas</h2></div>
      <ul className="media-list">{Object.entries(ROOT_LABELS).map(([kind, [label, hint]]) => {
        const root = settings.roots[kind];
        return <li key={kind}><span><strong>{label}</strong><small>{hint}</small><small><code>{root.path || 'Pasta do projeto (output/)'}</code>{root.path && root.exists === false && <span className="muted"> · criada no primeiro uso</span>}</small></span>
          <span className="dependency-side">{kind === 'renderOutput' && root.path && <button className="mini-button" disabled={busy || migrating} onClick={() => act(() => localApi.updateSettings({ baseRevision: settings.revision, roots: { renderOutput: null } }), 'Render volta a usar a pasta de cada projeto.')}>Usar do projeto</button>}<button className="mini-button" disabled={busy || migrating} title={migrating ? 'Aguarde a migração em andamento' : ''} onClick={() => change(kind)} aria-label={`Alterar ${label}`}><FolderOpen size={14}/> Alterar…</button></span></li>;
      })}</ul>
      {jobs.map(job => <MigrationJob key={job.id} job={job} onCancel={() => act(() => localApi.cancelMigration(job.id))}/>)}
    </section>

    <section className="workflow-card" aria-labelledby="usage-title">
      <div className="section-title"><h2 id="usage-title"><HardDrive size={20}/> Uso de disco</h2><button className="button quiet" onClick={() => load()} disabled={busy}><RefreshCw size={16}/> Atualizar</button></div>
      {usage.warnings.map(warning => <div key={warning.code} className="notice error" role="alert">{warning.message}</div>)}
      <ul className="media-list">{Object.entries(usage.categories).map(([key, value]) => <li key={key}><span><strong>{USAGE_LABELS[key]}</strong><small><code>{value.path}</code>{value.count != null && ` · ${value.count} projetos`}</small></span><span>{formatBytes(value.bytes)}</span></li>)}</ul>
      <p className="setup-meta">Livre: {formatBytes(usage.freeBytes)}. Derivados recriáveis: {formatBytes(usage.derivedBytes)}.{usage.unanalyzedProjects > 0 && ` ${usage.unanalyzedProjects} projeto(s) dos Recentes não puderam ser analisados.`}</p>
      <div className="setup-actions">
        <button className="button quiet" disabled={busy || migrating} onClick={() => { if (window.confirm('Remover cortes, downloads temporários, cache de render e código-fonte de compilação? Originais e mídias de projetos não são tocados.')) act(async () => { const result = await localApi.storageCleanup({}); setStatus(`Liberado ${formatBytes(result.bytes)}.`); }); }}><Trash2 size={16}/> Limpar derivados</button>
        <button className="button quiet" disabled={busy} onClick={() => act(async () => setOrphans({ ...(await localApi.storageOrphans()), selected: [] }))}>Analisar mídias sem uso</button>
      </div>
      {orphans && <OrphanList orphans={orphans} busy={busy} onChange={setOrphans} onDelete={hashes => act(async () => { const result = await localApi.storageCleanup({ derived: false, orphanHashes: hashes }); setOrphans(null); setStatus(`Removidas ${hashes.length} mídias sem uso (${formatBytes(result.bytes)}).`); })}/>}
    </section>

    <Limits settings={settings} busy={busy} onSave={limits => act(() => localApi.updateSettings({ baseRevision: settings.revision, limits }), 'Limites salvos.')}/>

    <section className="workflow-card" aria-labelledby="registry-title">
      <div className="section-title"><h2 id="registry-title">Registro de projetos</h2><button className="button quiet" disabled={busy} onClick={() => act(async () => { const result = await localApi.backupRegistry(); setStatus(`Backup criado com ${result.projects} projetos.`); })}>Criar backup</button></div>
      <p className="setup-meta">O registro guarda só os caminhos dos Recentes; os projetos ficam nas próprias pastas. Uma cópia de segurança é mantida a cada alteração e o registro é reconstruído automaticamente se corromper.</p>
      {backups.length ? <ul className="media-list">{backups.slice(0, 5).map(backup => <li key={backup.name}><span><strong>{backup.name}</strong></span><button className="mini-button" disabled={busy} onClick={() => { if (window.confirm('Restaurar este backup dos Recentes? A lista atual é salva antes.')) act(() => localApi.restoreRegistry(backup.name), 'Registro restaurado.'); }}>Restaurar</button></li>)}</ul> : <div className="empty-state">Nenhum backup manual.</div>}
    </section>

    {decision && <MigrationDialog decision={decision} busy={busy} onChange={setDecision} onClose={() => setDecision(null)}
      onMigrate={() => act(async () => { await localApi.startMigration({ kind: decision.kind, target: decision.target, removeSource: decision.removeSource }); setDecision(null); setStatus('Migração iniciada.'); })}
      onEmpty={() => act(async () => { await localApi.updateSettings({ baseRevision: settings.revision, roots: { [decision.kind]: decision.target }, emptyRoots: [decision.kind] }); setDecision(null); setStatus(`Nova pasta em uso. Os dados antigos continuam em ${decision.plan.source}.`); })}/>}
  </main>;
}

function MigrationJob({ job, onCancel }) {
  const progress = job.total ? Math.round((100 * job.copied) / job.total) : 100;
  return <div className={`notice ${job.state === 'failed' ? 'error' : ''}`} role="status"><span><strong>{ROOT_LABELS[job.kind][0]}</strong>: {job.phase}{job.state === 'running' ? ` · ${progress}%` : ''}{job.error ? ` — ${job.error}` : ''}</span>{job.state === 'running' && <button className="mini-button" onClick={onCancel}>Cancelar</button>}</div>;
}

function MigrationDialog({ decision, busy, onChange, onClose, onMigrate, onEmpty }) {
  const { plan } = decision;
  useEffect(() => { const handle = event => { if (event.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', handle); return () => document.removeEventListener('keydown', handle); }, [busy, onClose]);
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="migration-title">
    <div className="section-title"><div><span className="eyebrow">{ROOT_LABELS[decision.kind][0]}</span><h2 id="migration-title">Mover dados?</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X/></button></div>
    <dl className="target"><dt>De</dt><dd><code>{plan.source}</code></dd><dt>Para</dt><dd><code>{plan.target}</code></dd><dt>Conteúdo</dt><dd>{plan.files} arquivos · {formatBytes(plan.bytes)}</dd><dt>Livre</dt><dd>{formatBytes(plan.freeBytes)}</dd></dl>
    {!plan.sufficient && <div className="notice error" role="alert">Espaço insuficiente no destino.</div>}
    {plan.conflicts.length > 0 && <div className="notice error" role="alert">O destino já tem arquivos diferentes ({plan.conflicts.length}). Escolha outra pasta.</div>}
    {plan.notRelocatable && <p className="hint">{plan.notRelocatable}</p>}
    <p className="hint">Migrar copia, confere cada arquivo por SHA-256 e só então passa a usar a nova pasta. Se algo falhar, o destino é revertido e nada muda.</p>
    <label className="check"><input type="checkbox" checked={decision.removeSource} onChange={event => onChange({ ...decision, removeSource: event.target.checked })}/> Remover a origem depois de verificar</label>
    <div className="dialog-actions"><button className="button quiet" onClick={onEmpty} disabled={busy}>Começar vazia</button><button className="button primary" onClick={onMigrate} disabled={busy || !plan.sufficient || plan.conflicts.length > 0}>Migrar dados</button></div>
  </div></div>;
}

function OrphanList({ orphans, busy, onChange, onDelete }) {
  if (!orphans.orphans.length) return <p className="notice" role="status">Nenhuma mídia sem uso encontrada.</p>;
  const toggle = hash => onChange({ ...orphans, selected: orphans.selected.includes(hash) ? orphans.selected.filter(value => value !== hash) : [...orphans.selected, hash] });
  return <div className="consent-box">
    <p><strong>{orphans.orphans.length} mídias sem uso</strong> ({formatBytes(orphans.bytes)}) em projetos conhecidos.{orphans.unanalyzedProjects > 0 && ` Atenção: ${orphans.unanalyzedProjects} projeto(s) ausentes não foram analisados e podem usar estas mídias.`} Projetos fora dos Recentes também não são analisados.</p>
    <ul className="media-list">{orphans.orphans.map(file => <li key={file.hash}><label className="check"><input type="checkbox" checked={orphans.selected.includes(file.hash)} onChange={() => toggle(file.hash)}/> <code>{file.hash.slice(0, 16)}…</code></label><span>{formatBytes(file.size)}</span></li>)}</ul>
    <button className="button danger" disabled={busy || !orphans.selected.length} onClick={() => { if (window.confirm(`Excluir ${orphans.selected.length} mídias sem uso? Isso não pode ser desfeito.`)) onDelete(orphans.selected); }}>Excluir selecionadas</button>
  </div>;
}

function Limits({ settings, busy, onSave }) {
  const toGb = value => (value == null ? '' : String(+(value / GB).toFixed(2)));
  const [cache, setCache] = useState(toGb(settings.limits.cacheMaxBytes)); const [free, setFree] = useState(toGb(settings.limits.minFreeBytes));
  const parse = value => (value.trim() === '' ? null : Math.round(Number(value.replace(',', '.')) * GB));
  const invalid = [cache, free].some(value => value.trim() !== '' && !(Number(value.replace(',', '.')) >= 0));
  return <section className="workflow-card" aria-labelledby="limits-title"><form className="limits" onSubmit={event => { event.preventDefault(); onSave({ cacheMaxBytes: parse(cache), minFreeBytes: parse(free) }); }}>
    <div className="section-title"><h2 id="limits-title">Limites de disco</h2></div>
    <label>Cache derivado máximo (GB)<input inputMode="decimal" value={cache} onChange={event => setCache(event.target.value)} placeholder="Sem limite"/></label>
    <label>Espaço livre mínimo (GB)<input inputMode="decimal" value={free} onChange={event => setFree(event.target.value)} placeholder="Sem aviso"/></label>
    <p className="setup-meta">Ao passar dos limites, o Content Lab avisa aqui; nada é apagado automaticamente. Última alteração das configurações: revisão {settings.revision}{settings.updatedAt ? ` · ${formatDate(settings.updatedAt)}` : ''}.</p>
    <button className="button primary" disabled={busy || invalid}>Salvar limites</button>
  </form></section>;
}
