import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { editDuration, editedTime, selectSegments, sourceTime } from '../audio/audio-edits.js';

const timeLabel = time => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;

async function readWaveform(src, signal) {
  if (src.startsWith('blob:')) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Ondas indisponíveis neste navegador');
    const context = new Context();
    try {
      const response = await fetch(src, { signal });
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const peaks = Array.from({ length: 2000 }, (_, bin) => {
        let peak = 0;
        const start = Math.floor(bin * buffer.length / 2000); const end = Math.floor((bin + 1) * buffer.length / 2000);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
        }
        return peak;
      });
      const maximum = Math.max(...peaks, 0.001);
      return { duration: buffer.duration, peaks: peaks.map(value => value / maximum) };
    } finally { await context.close(); }
  }
  const url = new URL(src, window.location.href); url.searchParams.set('waveform', '1');
  const response = await fetch(`${url.pathname}${url.search}`, { signal });
  if (!response.ok) throw new Error('Não foi possível carregar as ondas');
  return response.json();
}

function displayPeaks(wave, spans, duration, count) {
  if (!wave || !duration) return [];
  return Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (const part of selectSegments(spans, i * duration / count, (i + 1) * duration / count)) {
      const a = Math.floor(part.start / wave.duration * wave.peaks.length);
      const b = Math.min(wave.peaks.length, Math.max(a + 1, Math.ceil(part.end / wave.duration * wave.peaks.length)));
      for (let j = a; j < b; j++) peak = Math.max(peak, wave.peaks[j] || 0);
    }
    return peak;
  });
}

/** Mesmo player em takes, previews, biblioteca e amostras; áudio real, sem ondas decorativas. */
export const WaveAudioPlayer = forwardRef(function WaveAudioPlayer({ src, label, duration: knownDuration = 0, segments, selection, onSelect, zoom = 1 }, forwardedRef) {
  const audio = useRef(null); const root = useRef(null); const drag = useRef(null);
  const [wave, setWave] = useState(null); const [waveError, setWaveError] = useState('');
  const [error, setError] = useState(''); const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(knownDuration); const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1); const [rate, setRate] = useState(1); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true; let started = false;
    setWave(null); setWaveError(''); setError(''); setPlaying(false); setPosition(0); setDuration(knownDuration);
    const load = () => {
      if (started) return; started = true;
      readWaveform(src, controller.signal).then(value => { if (active) { setWave(value); setDuration(value.duration); } }).catch(issue => { if (active && issue.name !== 'AbortError') setWaveError('Ondas indisponíveis. Você ainda pode ouvir o áudio.'); });
    };
    let observer;
    if (typeof IntersectionObserver !== 'undefined') { observer = new IntersectionObserver(entries => { if (entries.some(item => item.isIntersecting)) { load(); observer.disconnect(); } }, { rootMargin: '100px' }); observer.observe(root.current); }
    else load();
    return () => { active = false; controller.abort(); observer?.disconnect(); };
  }, [src, retry]);
  const signature = JSON.stringify(segments);
  const spans = useMemo(() => segments || [{ start: 0, end: duration }], [signature, duration]);
  const length = editDuration(spans);
  const peaks = useMemo(() => displayPeaks(wave, spans, length, Math.min(4000, 480 * zoom)), [wave, spans, length, zoom]);
  const seek = time => { if (audio.current && length > 0) { const at = Math.max(0, Math.min(length, time)); audio.current.currentTime = sourceTime(spans, at); setPosition(at); } };
  useEffect(() => { if (audio.current) { if (!audio.current.paused) audio.current.pause(); setPlaying(false); seek(0); } }, [signature]);
  const toggle = async () => {
    setError('');
    if (!audio.current) return;
    if (!audio.current.paused) { audio.current.pause(); return; }
    if (position >= length - 0.02 || audio.current.currentTime < spans[0].start) seek(0);
    try { await audio.current.play(); } catch { setError('Não foi possível reproduzir este áudio. Tente novamente.'); }
  };
  const trackTime = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(length, (event.clientX - bounds.left) / Math.max(1, bounds.width) * length));
  };
  const updatePlayback = () => {
    const node = audio.current; if (!node) return;
    const current = node.currentTime;
    const part = spans.find(item => current >= item.start && current < item.end - 0.005);
    if (!part && segments) {
      const next = spans.find(item => item.start > current);
      if (next) node.currentTime = next.start;
      else { node.pause(); setPosition(length); return; }
    }
    setPosition(editedTime(spans, node.currentTime));
  };
  useEffect(() => {
    if (!playing || !segments) return;
    let frame;
    const tick = () => { updatePlayback(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, signature, length]);
  return <div className={`wave-player ${onSelect ? 'wave-editable' : ''}`} ref={root} role="group" aria-label={label}>
    <audio ref={node => { audio.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} src={src} preload="metadata" onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); event.currentTarget.volume = volume; event.currentTarget.playbackRate = rate; }} onTimeUpdate={updatePlayback} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPosition(length); }} onError={() => setError('Áudio indisponível ou em formato não suportado.')}/>
    <div className="wave-scroll"><div className="wave-track" style={{ width: `${zoom * 100}%` }} aria-label={`Onda do áudio: ${label}`} role="group"
      onPointerDown={event => { if (event.button !== 0 || !length) return; const start = trackTime(event); drag.current = start; event.currentTarget.setPointerCapture?.(event.pointerId); if (onSelect) onSelect({ start, end: start }); else seek(start); }}
      onPointerMove={event => { if (drag.current === null) return; const end = trackTime(event); if (onSelect) onSelect({ start: Math.min(drag.current, end), end: Math.max(drag.current, end) }); else seek(end); }}
      onPointerUp={event => { if (drag.current === null) return; const start = drag.current; const end = trackTime(event); drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); if (Math.abs(end - start) < 0.025) seek(end); else if (onSelect) onSelect({ start: Math.min(start, end), end: Math.max(start, end) }); }}
      onPointerCancel={() => { drag.current = null; }}>
      <svg viewBox="0 0 960 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="960" y1="50" y2="50" className="wave-baseline"/>{peaks.map((peak, i) => <rect key={i} x={i * 960 / peaks.length} y={50 - Math.max(1, peak * 44)} width={Math.max(0.1, 960 / peaks.length * 0.7)} height={Math.max(2, peak * 88)} className={i / peaks.length * length <= position ? 'wave-played' : 'wave-bar'}/>)}</svg>
      {selection && length > 0 && <div className="wave-selection" style={{ left: `${selection.start / length * 100}%`, width: `${(selection.end - selection.start) / length * 100}%` }}/>}
      {length > 0 && <div className="wave-playhead" style={{ left: `${Math.min(100, position / length * 100)}%` }}/>}
      {!wave && !waveError && <span className="wave-loading">Carregando ondas…</span>}
    </div></div>
    <input className="wave-seek" type="range" aria-label={`Posição: ${label}`} min="0" max={length || 0} step="0.01" value={Math.min(length, position)} onChange={event => seek(Number(event.target.value))}/>
    <div className="wave-controls"><button type="button" className="icon-button" onClick={toggle} aria-label={playing ? `Pausar: ${label}` : `Reproduzir: ${label}`}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button><output className="wave-clock">{timeLabel(position)} / {timeLabel(length)}</output>
      <label className="wave-volume"><Volume2 size={15} aria-hidden="true"/><span className="sr-only">Volume: {label}</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); audio.current.volume = value; }}/></label>
      <label><span className="sr-only">Velocidade: {label}</span><select aria-label={`Velocidade: ${label}`} value={rate} onChange={event => { const value = Number(event.target.value); setRate(value); audio.current.playbackRate = value; }}>{[0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
    {waveError && <small className="wave-error">{waveError} <button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>Tentar carregar ondas</button></small>}
    {error && <small role="alert" className="missing">{error}</small>}
  </div>;
});
