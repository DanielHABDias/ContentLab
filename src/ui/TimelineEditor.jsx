import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, LockOpen, Magnet, Play, Redo2, Scissors, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { localApi } from './local-api.js';
import { ConfirmDialog } from './Dialogs.jsx';
import { clock } from './MediaLibrary.jsx';
import { snapFrame } from '../timeline/snap.js';

const RATIOS = ['16:9', '9:16', '1:1', '4:5'];
const HEAD = 150;
const STYLES = { legenda: 'Legenda', destaque: 'Destaque', titulo: 'Título' };
const newId = prefix => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

/** Editor da timeline: mesmos comandos versionados do núcleo, preview pelo grafo do render final. */
export function TimelineEditor({ details, onUpdated }) {
  const { project, path } = details;
  const timeline = project.timeline; const fps = timeline.fps;
  const [edit, setEdit] = useState(details.edit || null); const [components, setComponents] = useState(details.components || []); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [playhead, setPlayhead] = useState(0); const [selected, setSelected] = useState(null); const [zoom, setZoom] = useState(40);
  const [snap, setSnap] = useState(true); const [ripple, setRipple] = useState(false); const [ratio, setRatio] = useState(project.aspectRatio); const [safe, setSafe] = useState(true);
  const [aspectReport, setAspectReport] = useState(null);
  useEffect(() => { localApi.editState(path).then(state => { setEdit(state.edit); setComponents(state.components || []); }).catch(() => {}); }, [path]);
  const accept = state => { setEdit(state.edit); if (state.components) setComponents(state.components); onUpdated(state); };
  const call = async (task, { quiet = false } = {}) => { setBusy(true); setError(''); try { const state = await task(); if (state?.project) accept(state); return state; } catch (issue) { if (!quiet) setError(issue.message); throw issue; } finally { setBusy(false); } };
  const apply = (commands, label) => call(() => localApi.editApply({ path, baseRevision: project.revision, commands, label })).catch(() => null);
  const located = useMemo(() => { if (!selected) return null; for (const track of timeline.tracks) { const clip = track.clips.find(item => item.id === selected); if (clip) return { track, clip }; } return null; }, [selected, timeline]);

  const undo = () => edit?.canUndo && call(() => localApi.editUndo({ path, baseRevision: project.revision })).catch(() => null);
  const redo = () => edit?.canRedo && call(() => localApi.editRedo({ path, baseRevision: project.revision })).catch(() => null);
  const split = () => { if (!located) return; apply([{ op: 'clip.split', trackId: located.track.id, clipId: located.clip.id, frame: playhead, newClipId: newId('clip') }], 'Dividir'); };
  const remove = () => { if (!located) return; apply([{ op: 'clip.remove', trackId: located.track.id, clipId: located.clip.id, ripple }], ripple ? 'Excluir com ripple' : 'Excluir'); setSelected(null); };
  useEffect(() => {
    const onKey = event => {
      if (event.target.closest?.('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (event.key === 's' && located) { event.preventDefault(); split(); }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && located) { event.preventDefault(); remove(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const step = (event.shiftKey ? fps : 1) * (event.key === 'ArrowLeft' ? -1 : 1);
        if (located && event.altKey) { event.preventDefault(); apply([{ op: 'clip.move', trackId: located.track.id, clipId: located.clip.id, startFrame: Math.max(0, located.clip.startFrame + step) }], 'Mover'); }
        else { event.preventDefault(); setPlayhead(value => Math.min(timeline.durationInFrames - 1, Math.max(0, value + step))); }
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const changeRatio = async confirm => {
    try { await call(() => localApi.editAspect({ path, baseRevision: project.revision, aspectRatio: ratio, confirm }), { quiet: true }); setAspectReport(null); }
    catch (issue) { if (issue.code === 'CONFIRMATION_REQUIRED') setAspectReport(issue.details); else setError(issue.message); }
  };

  return <section className="timeline-editor" aria-label="Editor de timeline">
    <div className="editor-toolbar" role="toolbar" aria-label="Ferramentas da timeline">
      <button className="mini-button" onClick={undo} disabled={!edit?.canUndo || busy} title={edit?.undoLabel ? `Desfazer: ${edit.undoLabel} (Ctrl+Z)` : 'Nada para desfazer'}><Undo2 size={15}/> Desfazer</button>
      <button className="mini-button" onClick={redo} disabled={!edit?.canRedo || busy} title={edit?.redoLabel ? `Refazer: ${edit.redoLabel} (Ctrl+Shift+Z)` : 'Nada para refazer'}><Redo2 size={15}/> Refazer</button>
      <button className="mini-button" onClick={split} disabled={!located || busy} title="Dividir no playhead (S)"><Scissors size={15}/> Dividir</button>
      <button className="mini-button" onClick={remove} disabled={!located || busy} title="Excluir clip (Delete)"><Trash2 size={15}/> Excluir</button>
      <label className="check"><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)}/> <Magnet size={14}/> Encaixe</label>
      <label className="check"><input type="checkbox" checked={ripple} onChange={event => setRipple(event.target.checked)}/> Ripple</label>
      <label>Zoom<input type="range" min="8" max="160" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label="Zoom da timeline"/></label>
      <label>Proporção<select value={ratio} onChange={event => setRatio(event.target.value)}>{RATIOS.map(item => <option key={item} value={item}>{item}{item === project.aspectRatio ? ' (projeto)' : ''}</option>)}</select></label>
      {ratio !== project.aspectRatio && <button className="mini-button" onClick={() => changeRatio(false)}>Usar {ratio} no projeto</button>}
      <label className="check"><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)}/> Área segura</label>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="editor-main">
      <Preview path={path} project={project} frame={playhead} ratio={ratio} safe={safe}/>
      <Inspector key={located?.clip.id || 'none'} located={located} ratio={ratio} fps={fps} playhead={playhead} media={project.media} components={components} busy={busy} onApply={apply}/>
    </div>
    <AddPanel path={path} project={project} playhead={playhead} components={components} call={call}/>
    <Tracks timeline={timeline} zoom={zoom} playhead={playhead} setPlayhead={setPlayhead} selected={selected} setSelected={setSelected} snap={snap} busy={busy} onApply={apply}/>
    {aspectReport && <ConfirmDialog title="Trocar proporção do projeto" message={`De ${aspectReport.from} para ${aspectReport.to}. ${aspectReport.clipsWithoutLayout.length ? `${aspectReport.clipsWithoutLayout.length} clip(s) sem enquadramento próprio para ${aspectReport.to} vão ocupar a tela inteira.` : ''} ${aspectReport.reopens.length ? 'A edição aprovada será reaberta para revisão.' : ''}`} details={aspectReport.clipsWithoutLayout.slice(0, 8)} confirm={`Usar ${aspectReport.to}`} onClose={() => setAspectReport(null)} onConfirm={() => changeRatio(true)}/>}
  </section>;
}

function Preview({ path, project, frame, ratio, safe }) {
  const [image, setImage] = useState(null); const [video, setVideo] = useState(null); const [state, setState] = useState(''); const timer = useRef(null);
  const fingerprint = JSON.stringify(project.timeline);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => { try { const result = await localApi.editFrame({ path, frame, aspectRatio: ratio }); setImage(`/api/v1/edit/preview?name=${encodeURIComponent(result.name)}`); setState(''); } catch (issue) { setState(issue.message); } }, 250);
    return () => window.clearTimeout(timer.current);
  }, [path, frame, ratio, fingerprint]);
  const playClip = async () => {
    setState('Renderizando prévia com áudio…'); setVideo(null);
    try {
      const job = await localApi.editClip({ path, frame, seconds: 5, aspectRatio: ratio });
      for (let attempt = 0; attempt < 240; attempt += 1) {
        const { jobs } = await localApi.jobs(path); const current = jobs.find(item => item.id === job.id);
        if (current?.state === 'completed') { setVideo(`/api/v1/edit/preview?name=${encodeURIComponent(current.result.name)}`); setState(''); return; }
        if (current && current.state !== 'running') { setState(current.error || 'Prévia cancelada'); return; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (issue) { setState(issue.message); }
  };
  const area = project.timeline.safeArea; const [w, h] = ratio.split(':').map(Number);
  return <div className="preview-pane">
    <div className="preview-frame" style={{ aspectRatio: `${w} / ${h}` }}>
      {video ? <video src={video} controls autoPlay aria-label="Prévia com áudio"/> : image ? <img src={image} alt={`Frame ${frame} em ${ratio}`}/> : <span className="plan-line">Gerando preview…</span>}
      {safe && !video && <span className="safe-area" aria-hidden="true" style={{ top: `${area.top * 100}%`, right: `${area.right * 100}%`, bottom: `${area.bottom * 100}%`, left: `${area.left * 100}%` }}/>}
    </div>
    <div className="preview-actions"><span>{clock(frame / project.timeline.fps)} · frame {frame}</span>{video ? <button className="mini-button" onClick={() => setVideo(null)}>Voltar ao frame</button> : <button className="mini-button" onClick={playClip}><Play size={14}/> Prévia com áudio (5 s)</button>}</div>
    {state && <small className="plan-line" role="status">{state}</small>}
  </div>;
}

function Inspector({ located, ratio, fps, playhead, media, components, busy, onApply }) {
  const clip = located?.clip; const track = located?.track;
  const effect = type => Number(clip?.effects?.find(item => item.type === type && item.enabled !== false)?.params?.seconds || 0);
  const box = clip?.layout?.[ratio] || { x: 0, y: 0, width: 1, height: 1 };
  const [form, setForm] = useState(() => clip ? { name: clip.name || '', start: clip.startFrame / fps, duration: clip.durationInFrames / fps, sourceIn: (clip.sourceInFrame || 0) / fps, fit: clip.fit, anchor: clip.anchor, text: clip.text || '', style: clip.style || 'legenda', componentProps: clip.componentProps || {}, volume: clip.volume ?? 1, fadeIn: effect('fade-in'), fadeOut: effect('fade-out'), custom: Boolean(clip.layout?.[ratio]), x: box.x * 100, y: box.y * 100, w: box.width * 100, h: box.height * 100, opacity: 1 } : null);
  if (!clip) return <aside className="inspector"><h3>Propriedades</h3><p className="plan-line">Selecione um clip. Atalhos: S divide, Delete exclui, Alt+setas move, setas andam o playhead, Ctrl+Z desfaz.</p></aside>;
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const item = media.find(entry => entry.id === clip.sourceId);
  const save = event => {
    event.preventDefault();
    const effects = [...(clip.effects || []).filter(entry => !['fade-in', 'fade-out'].includes(entry.type)), ...(form.fadeIn > 0 ? [{ id: 'fx_fade_in', type: 'fade-in', enabled: true, params: { seconds: Number(form.fadeIn) } }] : []), ...(form.fadeOut > 0 ? [{ id: 'fx_fade_out', type: 'fade-out', enabled: true, params: { seconds: Number(form.fadeOut) } }] : [])];
    const layout = { ...(clip.layout || {}) };
    if (form.custom) layout[ratio] = { x: Number(form.x) / 100, y: Number(form.y) / 100, width: Math.max(0.01, Number(form.w) / 100), height: Math.max(0.01, Number(form.h) / 100) }; else delete layout[ratio];
    const patch = { name: form.name, fit: form.fit, anchor: form.anchor, effects, layout, volume: Number(form.volume), ...(['text', 'caption', 'shape'].includes(clip.type) ? { text: form.text, style: form.style } : {}), ...(clip.type === 'component' ? { componentProps: form.componentProps } : {}) };
    onApply([
      { op: 'clip.trim', trackId: track.id, clipId: clip.id, startFrame: Math.max(0, Math.round(form.start * fps)), durationInFrames: Math.max(1, Math.round(form.duration * fps)), sourceInFrame: Math.max(0, Math.round(form.sourceIn * fps)) },
      { op: 'clip.update', trackId: track.id, clipId: clip.id, patch },
    ], `Propriedades de ${form.name || clip.id}`);
  };
  const addKeyframe = () => { const frame = playhead - clip.startFrame; if (frame < 0 || frame >= clip.durationInFrames) return; const points = [...(clip.keyframes?.opacity || []).filter(point => point.frame !== frame), { frame, value: Number(form.opacity), easing: 'linear' }].sort((a, b) => a.frame - b.frame); onApply([{ op: 'clip.update', trackId: track.id, clipId: clip.id, patch: { keyframes: { ...clip.keyframes, opacity: points } } }], 'Keyframe de opacidade'); };
  const number = (key, label, step = 0.1) => <label>{label}<input type="number" step={step} value={form[key]} onChange={event => set(key, event.target.value)}/></label>;
  return <aside className="inspector"><h3>Propriedades</h3><form onSubmit={save} className="inspector-form">
    <label>Nome<input value={form.name} onChange={event => set('name', event.target.value)}/></label>
    {item && <small className="plan-line">{item.name || item.id}{item.metadata?.durationSeconds ? ` · mídia de ${clock(item.metadata.durationSeconds)}` : ''}</small>}
    {number('start', 'Início (s)')}{number('duration', 'Duração (s)')}{clip.type === 'media' && item?.kind !== 'image' && number('sourceIn', 'Entrada na mídia (s)')}
    {track.kind === 'visual' && <>
      <label>Enquadramento<select value={form.fit} onChange={event => set('fit', event.target.value)}><option value="cover">Preencher (corta)</option><option value="contain">Caber inteiro</option><option value="stretch">Esticar</option></select></label>
      <label>Âncora<select value={form.anchor} onChange={event => set('anchor', event.target.value)}><option value="center">Centro</option><option value="top">Topo</option><option value="bottom">Base</option><option value="left">Esquerda</option><option value="right">Direita</option></select></label>
      <label className="check"><input type="checkbox" checked={form.custom} onChange={event => set('custom', event.target.checked)}/> Posição própria em {ratio}</label>
      {form.custom && <div className="layout-grid">{number('x', 'X %', 1)}{number('y', 'Y %', 1)}{number('w', 'Largura %', 1)}{number('h', 'Altura %', 1)}</div>}
      <div className="layout-grid"><label>Opacidade<input type="number" min="0" max="1" step="0.05" value={form.opacity} onChange={event => set('opacity', event.target.value)}/></label><button type="button" className="mini-button" onClick={addKeyframe} disabled={busy}>Keyframe no playhead</button></div>
      {clip.keyframes?.opacity?.length > 0 && <small className="plan-line">{clip.keyframes.opacity.length} keyframe(s) de opacidade</small>}
    </>}
    {['text', 'caption', 'shape'].includes(clip.type) && <><label>Texto<textarea rows="3" value={form.text} onChange={event => set('text', event.target.value)}/></label><label>Estilo<select value={form.style} onChange={event => set('style', event.target.value)}>{Object.entries(STYLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></>}
    {clip.type === 'component' && <ComponentFields manifest={components.find(item => item.id === clip.componentId)} values={form.componentProps} onChange={(key, value) => setForm(previous => ({ ...previous, componentProps: { ...previous.componentProps, [key]: value } }))}/>}
    {clip.type === 'media' && (track.kind === 'audio' || item?.metadata?.audioCodec) && <label>Volume<input type="number" min="0" max="4" step="0.05" value={form.volume} onChange={event => set('volume', event.target.value)}/></label>}
    <div className="layout-grid">{number('fadeIn', 'Fade in (s)')}{number('fadeOut', 'Fade out (s)')}</div>
    <button className="button primary" disabled={busy}>Aplicar</button>
  </form></aside>;
}

function AddPanel({ path, project, playhead, components, call }) {
  const visual = project.media.filter(item => ['video', 'image'].includes(item.kind)); const audio = project.media.filter(item => ['audio', 'video'].includes(item.kind)); const transcribed = project.media.filter(item => item.transcript);
  const [mediaId, setMediaId] = useState(''); const [trackId, setTrackId] = useState('visual_main'); const [source, setSource] = useState(''); const [componentId, setComponentId] = useState(''); const [componentProps, setComponentProps] = useState({}); const [captionStyle, setCaptionStyle] = useState('legenda');
  const tracks = project.timeline.tracks.filter(track => track.kind !== 'caption');
  const options = (project.timeline.tracks.find(track => track.id === trackId)?.kind === 'audio' ? audio : visual);
  return <div className="add-panel">
    <label>Track<select value={trackId} onChange={event => { setTrackId(event.target.value); setMediaId(''); }}>{tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
    <label>Mídia<select value={mediaId} onChange={event => setMediaId(event.target.value)}><option value="">Escolha…</option>{options.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
    <button className="mini-button" disabled={!mediaId} onClick={() => call(() => localApi.editAddMedia({ path, baseRevision: project.revision, trackId, mediaId, startFrame: playhead })).catch(() => null)}>Adicionar no playhead</button>
    <label>Legendas de<select value={source} onChange={event => setSource(event.target.value)}><option value="">Transcrição…</option>{transcribed.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
    <button className="mini-button" disabled={!source} onClick={() => call(() => localApi.editCaptions({ path, baseRevision: project.revision, mediaId: source })).catch(() => null)}>Gerar legendas</button>
    <label className="mini-button file-button">Importar SRT<input type="file" accept=".srt,application/x-subrip" aria-label="Importar arquivo SRT" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 900 * 1024) { event.target.value = ''; return call(() => Promise.reject(new Error('Escolha um arquivo SRT de até 900 KB'))).catch(() => null); } const srtText = await file.text(); await call(() => localApi.editCaptions({ path, baseRevision: project.revision, srtText, srtName: file.name, startFrame: playhead, style: captionStyle })).catch(() => null); event.target.value = ''; }}/></label>
    <label>Estilo<select value={captionStyle} onChange={event => setCaptionStyle(event.target.value)}>{Object.entries(STYLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>Componente<select value={componentId} onChange={event => { const id = event.target.value; setComponentId(id); const manifest = components.find(item => item.id === id); setComponentProps(defaultProps(manifest)); }}><option value="">Escolha…</option>{components.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {componentId && <ComponentFields manifest={components.find(item => item.id === componentId)} values={componentProps} onChange={(key, value) => setComponentProps(previous => ({ ...previous, [key]: value }))}/>}
    <button className="mini-button" disabled={!componentId} onClick={() => call(() => localApi.editAddComponent({ path, baseRevision: project.revision, componentId, componentProps, startFrame: playhead })).catch(() => null)}>Adicionar componente</button>
  </div>;
}

function defaultProps(manifest) { return Object.fromEntries(Object.entries(manifest?.propsSchema || {}).flatMap(([key, value]) => { const descriptor = typeof value === 'string' ? { type: value } : value; return descriptor.default === undefined ? [] : [[key, descriptor.default]]; })); }
function ComponentFields({ manifest, values, onChange }) {
  return Object.entries(manifest?.propsSchema || {}).map(([key, value]) => { const spec = typeof value === 'string' ? { type: value, label: key } : value; const label = spec.label || key; if (spec.type === 'boolean') return <label className="check" key={key}><input type="checkbox" checked={Boolean(values[key])} onChange={event => onChange(key, event.target.checked)}/>{label}</label>; if (spec.type === 'json') { const current = values[key] ?? spec.default ?? ''; return <label key={key}>{label} (JSON)<textarea aria-label={label} rows="5" spellCheck="false" value={typeof current === 'string' ? current : JSON.stringify(current, null, 2)} onChange={event => onChange(key, event.target.value)}/></label>; } if (spec.type === 'text') return <label key={key}>{label}<textarea aria-label={label} rows="3" value={values[key] ?? spec.default ?? ''} onChange={event => onChange(key, event.target.value)}/></label>; return <label key={key}>{label}<input aria-label={label} type={spec.type === 'color' ? 'color' : spec.type === 'number' ? 'number' : 'text'} value={values[key] ?? spec.default ?? ''} onChange={event => onChange(key, spec.type === 'number' ? Number(event.target.value) : event.target.value)}/></label>; });
}

function Tracks({ timeline, zoom, playhead, setPlayhead, selected, setSelected, snap, busy, onApply }) {
  const fps = timeline.fps; const toPx = frame => (frame / fps) * zoom; const toFrame = px => Math.max(0, Math.round((px / zoom) * fps));
  const [drag, setDrag] = useState(null);
  const edges = exceptId => [0, playhead, ...timeline.tracks.flatMap(track => track.clips.filter(clip => clip.id !== exceptId).flatMap(clip => [clip.startFrame, clip.startFrame + clip.durationInFrames]))];
  const begin = (event, track, clip, mode) => { if (track.locked || busy) return; event.preventDefault(); event.stopPropagation(); setSelected(clip.id); event.currentTarget.setPointerCapture?.(event.pointerId); setDrag({ track, clip, mode, originX: event.clientX, preview: mode === 'move' ? clip.startFrame : clip.durationInFrames }); };
  const moveDrag = event => {
    if (!drag) return;
    const delta = toFrame(Math.abs(event.clientX - drag.originX)) * Math.sign(event.clientX - drag.originX);
    const tolerance = Math.round((8 / zoom) * fps);
    if (drag.mode === 'move') { let start = Math.max(0, drag.clip.startFrame + delta); if (snap) { const end = snapFrame(start + drag.clip.durationInFrames, edges(drag.clip.id), tolerance); start = end !== start + drag.clip.durationInFrames ? end - drag.clip.durationInFrames : snapFrame(start, edges(drag.clip.id), tolerance); } setDrag({ ...drag, preview: Math.max(0, start) }); }
    else { let end = Math.max(drag.clip.startFrame + 1, drag.clip.startFrame + drag.clip.durationInFrames + delta); if (snap) end = snapFrame(end, edges(drag.clip.id), tolerance); setDrag({ ...drag, preview: Math.max(1, end - drag.clip.startFrame) }); }
  };
  const endDrag = () => {
    if (!drag) return; const { track, clip, mode, preview } = drag; setDrag(null);
    if (mode === 'move' && preview !== clip.startFrame) onApply([{ op: 'clip.move', trackId: track.id, clipId: clip.id, startFrame: preview }], 'Mover');
    if (mode === 'trim' && preview !== clip.durationInFrames) onApply([{ op: 'clip.trim', trackId: track.id, clipId: clip.id, startFrame: clip.startFrame, durationInFrames: preview }], 'Aparar');
  };
  const width = HEAD + toPx(timeline.durationInFrames) + 200;
  const seconds = Math.ceil(timeline.durationInFrames / fps); const every = zoom >= 40 ? 1 : zoom >= 16 ? 5 : 10;
  return <div className="tracks" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
    <div className="track-scroll"><div style={{ width }}>
      <div className="ruler" role="slider" tabIndex={0} aria-label="Playhead" aria-valuemin={0} aria-valuemax={timeline.durationInFrames - 1} aria-valuenow={playhead} aria-valuetext={clock(playhead / fps)} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); setPlayhead(Math.min(timeline.durationInFrames - 1, toFrame(event.clientX - rect.left))); }}>
        {Array.from({ length: Math.floor(seconds / every) + 1 }, (_, index) => <span key={index} style={{ left: index * every * zoom }}>{clock(index * every)}</span>)}
      </div>
      {timeline.tracks.map(track => <div key={track.id} className={`track-row ${track.kind} ${track.locked ? 'locked' : ''} ${track.muted ? 'muted' : ''}`}>
        <div className="track-head"><strong>{track.name}</strong>
          <button className="icon-button" aria-label={`${track.muted ? 'Ativar' : 'Silenciar'} ${track.name}`} aria-pressed={track.muted} onClick={() => onApply([{ op: 'track.update', trackId: track.id, muted: !track.muted }], track.muted ? 'Ativar track' : 'Silenciar track')}>{track.kind === 'audio' ? (track.muted ? <VolumeX size={14}/> : <Volume2 size={14}/>) : (track.muted ? <EyeOff size={14}/> : <Eye size={14}/>)}</button>
          <button className="icon-button" aria-label={`${track.locked ? 'Desbloquear' : 'Bloquear'} ${track.name}`} aria-pressed={track.locked} onClick={() => onApply([{ op: 'track.update', trackId: track.id, locked: !track.locked }], track.locked ? 'Desbloquear track' : 'Bloquear track')}>{track.locked ? <Lock size={14}/> : <LockOpen size={14}/>}</button>
        </div>
        <div className="track-lane">
          {track.clips.map(clip => { const live = drag?.clip.id === clip.id; const start = live && drag.mode === 'move' ? drag.preview : clip.startFrame; const duration = live && drag.mode === 'trim' ? drag.preview : clip.durationInFrames; return <div key={clip.id} role="button" tabIndex={0} aria-pressed={selected === clip.id} aria-label={`${clip.name || clip.text || clip.id}, ${clock(start / fps)} a ${clock((start + duration) / fps)}`} className={`clip ${selected === clip.id ? 'selected' : ''}`} style={{ left: toPx(start), width: Math.max(6, toPx(duration)) }} onPointerDown={event => begin(event, track, clip, 'move')} onClick={() => setSelected(clip.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(clip.id); } }}>
            <span>{clip.text || clip.name || clip.id}</span>
            {!track.locked && <i className="trim-handle" aria-hidden="true" onPointerDown={event => begin(event, track, clip, 'trim')}/>}
          </div>; })}
        </div>
      </div>)}
      <span className="playhead" style={{ left: HEAD + toPx(playhead) }} aria-hidden="true"/>
    </div></div>
  </div>;
}
