import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Prende o foco no diálogo, fecha com Esc e devolve o foco a quem abriu. */
export function useDialogFocus(onClose, busy = false) {
  const ref = useRef(null);
  const openerRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const latest = useRef({ onClose, busy }); latest.current = { onClose, busy };
  useEffect(() => {
    const opener = openerRef.current;
    const handle = event => {
      if (event.key === 'Escape' && !latest.current.busy) { event.stopPropagation(); latest.current.onClose(); return; }
      if (event.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle, true);
    return () => { document.removeEventListener('keydown', handle, true); if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus(); };
  }, []);
  return ref;
}

export function ConfirmDialog({ title, message, details = [], confirm, tone = 'danger', onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const ref = useDialogFocus(onClose, busy);
  return <div className="dialog-backdrop" role="presentation"><div ref={ref} className="dialog" role="alertdialog" aria-modal="true" aria-label={title} aria-describedby="confirm-message">
    <div className="section-title"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X/></button></div>
    <p id="confirm-message">{message}</p>{details.length > 0 && <ul>{details.map(item => <li key={item}>{item}</li>)}</ul>}
    <div className="dialog-actions"><button type="button" className="button quiet" autoFocus disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className={`button ${tone}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirm}</button></div>
  </div></div>;
}

/** Pede um motivo obrigatório (pedir mudanças, reabrir etapa). */
export function ReasonDialog({ title, label, confirm, onClose, onSubmit }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const ref = useDialogFocus(onClose, busy);
  const submit = async event => {
    event.preventDefault();
    if (!reason.trim()) { setError('Escreva o motivo para continuar.'); return; }
    setBusy(true); setError('');
    try { await onSubmit(reason.trim()); } catch (failure) { setError(failure.message); setBusy(false); }
  };
  return <div className="dialog-backdrop" role="presentation"><form ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} noValidate>
    <div className="section-title"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X/></button></div>
    <label>{label}<textarea rows="4" autoFocus value={reason} aria-invalid={Boolean(error)} aria-describedby={error ? 'reason-error' : undefined} onChange={event => setReason(event.target.value)}/></label>
    {error && <p id="reason-error" className="notice error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="button quiet" disabled={busy} onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{confirm}</button></div>
  </form></div>;
}
