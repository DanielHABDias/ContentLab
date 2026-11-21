import { useState } from 'react';
import { CalendarCheck, CheckCircle2, ExternalLink, Pencil, Rocket, Undo2, X } from 'lucide-react';
import { useDialogFocus } from './Dialogs.jsx';

/** Data da publicação para exibir (aceita só a data ou ISO completo). */
export function publishedDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

const today = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/** Selo verde de vídeo publicado, usado no card e no fluxo. */
export function PublishedBadge({ at, compact = false }) {
  const date = publishedDate(at);
  return <span className={`published-badge ${compact ? 'compact' : ''}`}><CheckCircle2 size={compact ? 13 : 15} aria-hidden="true"/> Publicado{date && <span className="published-date"> · {date}</span>}</span>;
}

/** Marca (ou edita) a publicação: data e link opcionais. O Content Lab nunca publica nada sozinho. */
export function PublicationDialog({ publication, title, onClose, onSave }) {
  const [date, setDate] = useState(() => String(publication?.publishedAt || today()).slice(0, 10));
  const [url, setUrl] = useState(publication?.url || '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const ref = useDialogFocus(onClose, busy);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ published: true, publishedAt: date, url: url.trim() || null }); } catch (issue) { setError(issue.message); setBusy(false); }
  };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog publication-dialog" role="dialog" aria-modal="true" aria-labelledby="publication-title" onSubmit={submit}>
    <div className="section-title"><div><span className="eyebrow">Publicação</span><h2 id="publication-title">{publication?.published ? 'Editar publicação' : 'Marcar como publicado'}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}><X/></button></div>
    <p className="publication-target"><Rocket size={16} aria-hidden="true"/> <span>{title}</span></p>
    {error && <div className="notice error" role="alert">{error}</div>}
    <label>Data de publicação<input type="date" required value={date} max={today()} onChange={event => setDate(event.target.value)}/></label>
    <label><span>Link do vídeo <span className="optional">(opcional)</span></span><input type="url" inputMode="url" placeholder="https://youtube.com/…" value={url} onChange={event => setUrl(event.target.value)}/></label>
    <p className="hint">Projetos publicados saem da lista “Em produção” e ficam no filtro “Publicados”. Dá para desfazer quando quiser.</p>
    <div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose} disabled={busy}>Cancelar</button><button className="button publish-confirm" disabled={busy || !date}><CalendarCheck size={17} aria-hidden="true"/> {busy ? 'Salvando…' : publication?.published ? 'Salvar' : 'Marcar como publicado'}</button></div>
  </form></div>;
}

/**
 * Controle da publicação: botão para marcar quando ainda não foi publicado; com o vídeo no ar,
 * o selo, o link, editar e desfazer.
 */
export function PublicationControl({ project, busy, onSet, layout = 'inline', showBadge = true }) {
  const [editing, setEditing] = useState(false);
  const publication = project.publication || {};
  const save = async value => { await onSet(value); setEditing(false); };
  const dialog = editing && <PublicationDialog publication={publication} title={project.title} onClose={() => setEditing(false)} onSave={save}/>;
  if (!publication.published) return <div className={`publication-control ${layout}`}>
    <button type="button" className="button publish-mark" disabled={busy} onClick={() => setEditing(true)}><Rocket size={17} aria-hidden="true"/> Marcar como publicado</button>{dialog}
  </div>;
  return <div className={`publication-control is-published ${layout}`}>
    {showBadge && <PublishedBadge at={publication.publishedAt}/>}
    {publication.url && <a className="mini-button" href={publication.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true"/> Ver vídeo</a>}
    <button type="button" className="mini-button" disabled={busy} onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true"/> Editar</button>
    <button type="button" className="mini-button" disabled={busy} onClick={() => onSet({ published: false })}><Undo2 size={14} aria-hidden="true"/> Desfazer</button>
    {dialog}
  </div>;
}

export const PROJECT_FILTERS = [['production', 'Em produção'], ['published', 'Publicados'], ['all', 'Todos']];
export const matchesFilter = (project, filter) => filter === 'all' || (filter === 'published' ? Boolean(project.published) : !project.published);

/** Filtro segmentado da lista de projetos; o padrão esconde os publicados. */
export function ProjectFilter({ value, items, onChange }) {
  return <div className="project-filter" role="radiogroup" aria-label="Filtrar projetos">
    {PROJECT_FILTERS.map(([id, label]) => {
      const count = items.filter(item => matchesFilter(item, id)).length;
      return <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
        {id === 'published' && <CheckCircle2 size={14} aria-hidden="true"/>}{label}<span className="count">{count}</span>
      </button>;
    })}
  </div>;
}
