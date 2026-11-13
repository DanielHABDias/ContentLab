import { useRef, useState } from 'react';
import { RotateCcw, Scissors, Undo2, Redo2, X } from 'lucide-react';
import { deleteSelection, editDuration, selectSegments, takeSegments, validateSegments } from '../audio/audio-edits.js';
import { WaveAudioPlayer } from './WaveAudioPlayer.jsx';
import { useDialogFocus } from './Dialogs.jsx';

export function AudioTakeEditor({ take, src, onClose, onSave }) {
  const [name, setName] = useState(take.name);
  const [history, setHistory] = useState([takeSegments(take)]); const [cursor, setCursor] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 }); const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const ref = useDialogFocus(onClose, busy); const player = useRef(null);
  const segments = history[cursor]; const duration = editDuration(segments);
  const selected = selection.end - selection.start >= 0.01;
  const apply = next => {
    try { validateSegments(next, take.durationSeconds); }
    catch (issue) { setError(issue.message); return; }
    setError(''); setHistory(previous => [...previous.slice(0, cursor + 1), next]); setCursor(cursor + 1); setSelection({ start: 0, end: 0 });
  };
  const remove = () => { if (selected) apply(deleteSelection(segments, selection.start, selection.end)); };
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { validateSegments(segments, take.durationSeconds); await onSave({ name, segments }); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog audio-take-editor" role="dialog" aria-modal="true" aria-label="Editar take" onSubmit={save} onKeyDown={event => {
    if (event.key === 'Delete' && !busy && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); remove(); }
  }}>
    <div className="section-title"><div><span className="eyebrow">Estúdio de áudio</span><h2>Editar gravação</h2></div><button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X/></button></div>
    <label>Nome<input required value={name} onChange={event => setName(event.target.value)} disabled={busy}/></label>
    <p className="hint">Arraste sobre a onda para selecionar um erro e excluí-lo. Os trechos se juntam; o original fica preservado. Clique na onda para posicionar a reprodução.</p>
    <fieldset disabled={busy} className="audio-editor-workspace">
      <div className="audio-editor-tools"><button type="button" className="button quiet" disabled={!selected} onClick={remove}><Scissors size={16}/> Excluir seleção</button><button type="button" className="button quiet" disabled={!selected} onClick={() => apply(selectSegments(segments, selection.start, selection.end))}>Manter seleção</button>
        <button type="button" className="icon-button" aria-label="Desfazer corte" disabled={!cursor} onClick={() => { setCursor(cursor - 1); setSelection({ start: 0, end: 0 }); }}><Undo2 size={17}/></button><button type="button" className="icon-button" aria-label="Refazer corte" disabled={cursor === history.length - 1} onClick={() => { setCursor(cursor + 1); setSelection({ start: 0, end: 0 }); }}><Redo2 size={17}/></button>
        <button type="button" className="button quiet" onClick={() => apply([{ start: 0, end: take.durationSeconds }])}><RotateCcw size={16}/> Restaurar original</button>
        <label>Zoom<select value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[1, 2, 4, 8, 16].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
      </div>
      <div tabIndex="0" aria-label="Área de edição: Delete exclui a seleção" className="audio-editor-timeline">
        <div className="audio-time-ruler"><span>0:00</span><span>{duration.toFixed(2)} s · {segments.length} {segments.length === 1 ? 'trecho' : 'trechos'}</span></div>
        <WaveAudioPlayer ref={player} src={src} label="Ouvir edição do take" duration={take.durationSeconds} segments={segments} selection={selection} onSelect={setSelection} zoom={zoom}/>
      </div>
      <div className="audio-selection-info"><output aria-label="Duração da seleção">{Math.max(0, selection.end - selection.start).toFixed(2)} s selecionados</output><button type="button" className="mini-button" disabled={!selected} onClick={() => { if (player.current) player.current.currentTime = selectSegments(segments, selection.start, selection.end)[0]?.start || 0; player.current?.play().catch(() => {}); }}>Ouvir a partir da seleção</button><small>Selecionar não altera o áudio. Salvar guarda os cortes já aplicados.</small></div>
    </fieldset>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="dialog-actions"><span className="hint">{duration.toFixed(2)} s após os cortes · original {take.durationSeconds.toFixed(2)} s</span><button type="button" className="button quiet" disabled={busy} onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
  </form></div>;
}
