import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Clock3, Copy, Download, FolderOpen, FolderSearch, MoreHorizontal, Pencil, Trash2, X, XCircle } from 'lucide-react';
import { localApi } from './local-api.js';

const stageLabels = { brief: 'Ideia e brief', script: 'Roteiro', packaging: 'Embalagem', media: 'Mídia', narration: 'Narração', edit: 'Edição', review: 'Revisão e render' };
const typeLabels = { long: 'Vídeo longo', short: 'Short', custom: 'Personalizado' };

export function formatBytes(value) {
  if (value == null) return 'tamanho desconhecido';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value; let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size.toLocaleString('pt-BR', { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ProjectCard({ project, onOpen, onAction }) {
  const ready = project.status !== 'missing' && project.status !== 'invalid';
  return <article className={`project-card ${ready ? '' : 'unavailable'}`} aria-label={project.title}>
    <button className="project-open" onClick={() => onOpen(project)} disabled={!ready} title={ready ? '' : `${project.problem}. Remova dos Recentes ou abra a pasta em outro local.`} aria-label={`Abrir ${project.title}`}>
      <span className="poster poster-blue" aria-hidden="true"><span>{ready ? project.progress : '!'}</span></span>
      <span className="project-copy">
        {ready ? <span className="eyebrow">{typeLabels[project.type]} · {project.aspectRatio}</span> : <span className="eyebrow missing"><AlertTriangle size={13}/> {project.problem}</span>}
        <strong>{project.title}</strong>
        {ready && <><span className="step"><Clock3 size={14}/> {stageLabels[project.stage]}</span><span className="progress"><i style={{ width: `${project.progress}%` }}/></span></>}
        <small className="project-meta">{ready ? <>{project.progress}% · revisão {project.revision} · {formatBytes(project.sizeBytes)} · modificado {formatDate(project.modifiedAt)} · aberto {formatDate(project.openedAt)}</> : <span className="project-path">{project.path}</span>}</small>
      </span>
      {ready && <ChevronRight className="project-arrow" aria-hidden="true"/>}
    </button>
    <ActionsMenu project={project} ready={ready} onAction={onAction}/>
  </article>;
}

function ActionsMenu({ project, ready, onAction }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null); const menu = useRef(null); const id = useId();
  const items = [
    ['open', 'Abrir', FolderOpen, ready],
    ['reveal', 'Revelar pasta', FolderSearch, ready],
    ['rename', 'Renomear', Pencil, ready],
    ['duplicate', 'Duplicar', Copy, ready],
    ['export-contentlab', 'Exportar .contentlab', Download, ready],
    ['export-zip', 'Exportar ZIP', Download, ready],
    ['forget', 'Remover de Recentes', XCircle, true],
    ['delete', 'Excluir projeto…', Trash2, ready],
  ];
  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    const close = event => { if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const keyDown = event => {
    const enabled = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const index = enabled.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); enabled[(index + 1) % enabled.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); enabled[(index - 1 + enabled.length) % enabled.length]?.focus(); }
    if (event.key === 'Home') { event.preventDefault(); enabled[0]?.focus(); }
    if (event.key === 'End') { event.preventDefault(); enabled.at(-1)?.focus(); }
    if (event.key === 'Tab') setOpen(false);
  };
  return <div className="card-menu">
    <button ref={trigger} className="icon-button" aria-label={`Ações de ${project.title}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><MoreHorizontal size={18}/></button>
    {open && <div ref={menu} id={id} role="menu" aria-label={`Ações de ${project.title}`} className="menu" onKeyDown={keyDown}>
      {items.map(([action, label, Icon, enabled]) => <button key={action} role="menuitem" className={action === 'delete' ? 'danger' : ''} disabled={!enabled} title={enabled ? '' : 'Indisponível: a pasta do projeto não foi encontrada'} onClick={() => { setOpen(false); trigger.current?.focus(); onAction(action, project); }}><Icon size={16}/> {label}</button>)}
    </div>}
  </div>;
}

function useEscape(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handle = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose, enabled]);
}

export function RenameDialog({ project, onClose, onDone }) {
  const [title, setTitle] = useState(project.title); const [changeId, setChangeId] = useState(false); const [id, setId] = useState(project.id);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEscape(onClose, !busy);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let details = null; let { revision } = project; let directory = project.path;
      if (title.trim() !== project.title) { details = await localApi.renameProject({ path: directory, baseRevision: revision, title }); revision = details.project.revision; }
      if (changeId && id !== project.id) { details = await localApi.changeProjectId({ path: directory, baseRevision: revision, id }); directory = details.path; }
      onDone(details, project.path);
    } catch (issue) { setError(issue.message); setBusy(false); }
  };
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={submit}>
    <div className="section-title"><div><span className="eyebrow">Projeto</span><h2 id="rename-title">Renomear</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X/></button></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <label>Título<input autoFocus required value={title} onChange={event => setTitle(event.target.value)}/></label>
    <p className="hint">O título muda sem alterar a pasta nem o ID.</p>
    <label className="check"><input type="checkbox" checked={changeId} onChange={event => setChangeId(event.target.checked)}/> Também mudar a pasta e o ID (avançado)</label>
    {changeId && <><label>Novo ID da pasta<input value={id} onChange={event => setId(event.target.value)} pattern="[a-z][a-z0-9_\-]{2,63}" aria-describedby="id-hint"/></label><p className="hint" id="id-hint">Letras minúsculas, números, _ ou -. A pasta será renomeada para <code>{id || '…'}</code>.</p></>}
    <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy || !title.trim() || (title.trim() === project.title && (!changeId || id === project.id))}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
  </form></div>;
}

/**
 * Exclusão em etapas: confirmação pelo ID → lixeira. Operação ativa mostra
 * cancelar/tentar de novo. Sem lixeira, oferece backup e pede nova confirmação.
 */
export function DeleteDialog({ project, onClose, onDeleted }) {
  const [step, setStep] = useState('confirm'); const [typed, setTyped] = useState(''); const [permanentTyped, setPermanentTyped] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [activities, setActivities] = useState([]); const [backup, setBackup] = useState(null);
  useEscape(onClose, !busy);
  const attempt = async input => {
    setBusy(true); setError('');
    try { onDeleted(await localApi.deleteProject({ path: project.path, confirmation: typed, ...input })); }
    catch (issue) {
      if (issue.code === 'PROJECT_BUSY') { setActivities(issue.details?.activities || []); setStep('busy'); }
      else if (issue.code === 'TRASH_UNAVAILABLE') { setStep('permanent'); setError(issue.message); }
      else setError(issue.message);
      setBusy(false);
    }
  };
  const cancelActivities = async () => { setBusy(true); setError(''); try { await localApi.cancelProjectActivities(project.path); const { activities: remaining } = await localApi.projectActivities(project.path); setActivities(remaining); if (!remaining.length) setStep('confirm'); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  const retry = async () => { setBusy(true); try { const { activities: remaining } = await localApi.projectActivities(project.path); setActivities(remaining); if (!remaining.length) { setStep('confirm'); setBusy(false); await attempt({ mode: 'trash' }); return; } } catch (issue) { setError(issue.message); } setBusy(false); };
  const makeBackup = async () => { setBusy(true); setError(''); try { const choice = await localApi.chooseDirectory('Onde salvar o backup?'); if (choice.path) setBackup(await localApi.exportProject({ path: project.path, outputDirectory: choice.path, format: 'contentlab' })); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  const confirmed = typed === project.id;
  return <div className="dialog-backdrop" role="presentation"><form className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-target" onSubmit={event => { event.preventDefault(); if (step === 'confirm' && confirmed) attempt({ mode: 'trash' }); }}>
    <div className="section-title"><div><span className="eyebrow">Ação destrutiva</span><h2 id="delete-title">Excluir projeto</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X/></button></div>
    <dl className="target" id="delete-target"><dt>Projeto</dt><dd>{project.title}</dd><dt>ID</dt><dd><code>{project.id}</code></dd><dt>Pasta</dt><dd><code>{project.path}</code></dd></dl>
    {error && <div className="notice error" role="alert">{error}</div>}
    {step === 'confirm' && <>
      <p className="hint">A pasta inteira vai para a lixeira do sistema e poderá ser restaurada. Mídias compartilhadas do catálogo não são apagadas.</p>
      <label><span>Digite <code>{project.id}</code> para confirmar</span><input autoFocus value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" spellCheck="false"/></label>
      <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancelar</button><button className="button danger" disabled={busy || !confirmed} title={confirmed ? '' : 'Digite o ID exato para habilitar'}>{busy ? 'Movendo…' : 'Mover para a lixeira'}</button></div>
    </>}
    {step === 'busy' && <>
      <div className="notice error" role="alert">Há operações em andamento neste projeto: {activities.map(item => item.kind).join(', ') || 'nenhuma'}.</div>
      <p className="hint">Aguarde terminar e tente de novo, ou cancele as operações canceláveis (render).</p>
      <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Fechar</button><button type="button" className="button quiet" onClick={cancelActivities} disabled={busy || !activities.some(item => item.cancellable)} title={activities.some(item => item.cancellable) ? '' : 'Nenhuma operação ativa pode ser cancelada; aguarde terminar'}>Cancelar operações</button><button type="button" className="button primary" onClick={retry} disabled={busy}>Tentar novamente</button></div>
    </>}
    {step === 'permanent' && <>
      <p className="hint">A lixeira do sistema não está disponível. Exclusão permanente não pode ser desfeita: recomendamos exportar um backup antes.</p>
      <div className="location-picker"><span><strong>Backup</strong><small>{backup ? backup.path : 'Nenhum backup exportado'}</small></span><button type="button" className="button quiet" onClick={makeBackup} disabled={busy}>{backup ? 'Exportar outro' : 'Exportar backup…'}</button></div>
      <label><span>Digite <code>EXCLUIR {project.id}</code> para excluir permanentemente</span><input value={permanentTyped} onChange={event => setPermanentTyped(event.target.value)} autoComplete="off" spellCheck="false"/></label>
      <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="button danger" disabled={busy || permanentTyped !== `EXCLUIR ${project.id}`} onClick={() => attempt({ mode: 'permanent', permanentConfirmation: permanentTyped, backupPath: backup?.path || null })}>{busy ? 'Excluindo…' : 'Excluir permanentemente'}</button></div>
    </>}
  </form></div>;
}
