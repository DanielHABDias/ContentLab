import { useEffect, useState } from 'react';

/** Monitor real do microfone. Não reproduz o som nem envia amostras para fora do navegador. */
export function RecordingWave({ stream, paused }) {
  const [peaks, setPeaks] = useState([]);
  useEffect(() => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context || !stream || paused) return;
    const context = new Context(); const analyser = context.createAnalyser(); analyser.fftSize = 1024;
    const source = context.createMediaStreamSource(stream); source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    context.resume().catch(() => {});
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      let peak = 0; for (const value of data) peak = Math.max(peak, Math.abs(value));
      setPeaks(previous => [...previous.slice(-159), peak]);
    }, 100);
    return () => { clearInterval(timer); source.disconnect(); context.close().catch(() => {}); };
  }, [stream, paused]);
  return <span className="recording-wave" role="img" aria-label={paused ? 'Onda do microfone pausada' : 'Onda do microfone ao vivo'}><svg viewBox="0 0 320 56" preserveAspectRatio="none" aria-hidden="true">{peaks.map((peak, i) => <rect key={i} x={i * 2} y={28 - Math.max(1, peak * 27)} width="1.5" height={Math.max(2, peak * 54)}/>)}</svg></span>;
}
