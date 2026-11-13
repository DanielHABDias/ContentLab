import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const STYLES = {
  // Legenda pelo lado menor: ≈67 px em 1920×1080 e 1080×1920 (padrão do kit: ≥56 px no 16:9, ≥64 px no 9:16).
  legenda: { size: 0.062, relative: 'short', position: 'bottom', box: 0.6 },
  destaque: { size: 0.06, position: 'top', box: 0.75 },
  titulo: { size: 0.085, position: 'center', box: 0 },
};

/**
 * Monta os argumentos do FFmpeg para uma janela [from, to) do plano.
 * Render final, trecho de preview e frame único usam esta mesma função.
 * `textDirectory` recebe os arquivos de texto do drawtext (evita escapes).
 */
export async function buildFfmpegArgs(plan, { from = 0, to = plan.duration, scale = 1, output, still = false, fontFile, textDirectory }) {
  const window = Math.max(1 / plan.fps, to - from);
  const { width, height } = plan.canvas;
  const inputs = [['-f', 'lavfi', '-i', `color=c=0x0b0b10:s=${width}x${height}:r=${plan.fps}:d=${window.toFixed(4)}`]];
  const filters = [];
  const audio = [];
  let video = '[0:v]';
  let label = 0;
  const next = () => `[v${label++}]`;
  const active = plan.layers.filter(layer => layer.start < to && layer.start + layer.duration > from);

  for (const layer of active) {
    const localStart = Math.max(0, layer.start - from);
    const offset = Math.max(0, from - layer.start);
    const duration = Math.min(layer.start + layer.duration, to) - Math.max(layer.start, from);
    const end = localStart + duration;
    if ((layer.type === 'media' || layer.type === 'component') && layer.source) {
      const index = inputs.length;
      if (layer.mediaKind === 'image') inputs.push(['-loop', '1', '-framerate', String(plan.fps), '-t', duration.toFixed(4), '-i', layer.source]);
      else if (layer.mediaKind === 'component-sequence') inputs.push(['-framerate', String(plan.fps), '-start_number', String(Math.round(offset * plan.fps)), '-t', duration.toFixed(4), '-i', layer.source]);
      else inputs.push(['-ss', (layer.sourceIn + offset).toFixed(4), '-t', duration.toFixed(4), '-i', layer.source]);
      if (layer.trackKind === 'visual' && layer.mediaKind !== 'audio') {
        const box = layer.box; const w = even(box.width); const h = even(box.height);
        const fit = layer.type === 'component' || layer.fit === 'stretch' ? `scale=${w}:${h}` : layer.fit === 'contain' ? `scale=${w}:${h}:force_original_aspect_ratio=decrease` : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
        const chain = [`fps=${plan.fps}`, fit, 'setsar=1', 'format=yuva420p'];
        if (layer.opacity.length) chain.push(`geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='alpha(X,Y)*(${opacityExpression(layer.opacity, -offset)})'`);
        if (layer.fadeIn > offset) chain.push(`fade=t=in:st=0:d=${(layer.fadeIn - offset).toFixed(4)}:alpha=1`);
        if (layer.fadeOut) chain.push(`fade=t=out:st=${Math.max(0, layer.duration - layer.fadeOut - offset).toFixed(4)}:d=${layer.fadeOut}:alpha=1`);
        chain.push(`setpts=PTS-STARTPTS+${localStart.toFixed(4)}/TB`);
        const scaled = next();
        filters.push(`[${index}:v]${chain.join(',')}${scaled}`);
        const x = layer.fit === 'contain' ? `${Math.round(box.x)}+(${w}-overlay_w)/2` : String(Math.round(box.x));
        const y = layer.fit === 'contain' ? `${Math.round(box.y)}+(${h}-overlay_h)/2` : String(Math.round(box.y));
        const out = next();
        filters.push(`${video}${scaled}overlay=x=${x}:y=${y}:eof_action=pass:enable='between(t,${localStart.toFixed(4)},${(end - 0.0001).toFixed(4)})'${out}`);
        video = out;
      }
      if (!still && layer.type === 'media' && layer.hasAudio && layer.volume > 0) audio.push({ index, localStart, duration, layer, offset });
    } else if ((layer.type === 'caption' || layer.type === 'text') && layer.text?.trim()) {
      if (!fontFile) throw new Error('Nenhuma fonte encontrada para desenhar textos');
      const style = STYLES[layer.style] || STYLES.legenda;
      const size = Math.round((style.relative === 'short' ? Math.min(width, height) : height) * style.size);
      const lines = wrap(layer.text.trim(), Math.floor((width * (1 - plan.safeArea.left - plan.safeArea.right)) / (size * 0.55))).split('\n');
      const lineHeight = Math.round(size * (style.box ? 1.6 : 1.3));
      const top = style.position === 'bottom' ? `h*${(1 - plan.safeArea.bottom).toFixed(4)}-${lines.length * lineHeight}` : style.position === 'top' ? `h*${plan.safeArea.top.toFixed(4)}` : `(h-${lines.length * lineHeight})/2`;
      for (const [line, content] of lines.entries()) {
        const textFile = path.join(textDirectory, `${layer.id}-${line}.txt`);
        await writeFile(textFile, content);
        const out = next();
        filters.push(`${video}drawtext=fontfile=${escapePath(fontFile)}:textfile=${escapePath(textFile)}:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${top}+${line * lineHeight}+(${lineHeight}-text_h)/2${style.box ? `:box=1:boxcolor=black@${style.box}:boxborderw=${Math.round(size * 0.25)}` : ':borderw=3:bordercolor=black@0.8'}:enable='between(t,${localStart.toFixed(4)},${(end - 0.0001).toFixed(4)})'${out}`);
        video = out;
      }
    }
  }

  if (scale !== 1) { const out = next(); filters.push(`${video}scale=${even(width * scale)}:${even(height * scale)}${out}`); video = out; }
  const args = ['-hide_banner', '-loglevel', 'error', ...inputs.flat()];
  if (still) {
    filters.push(`${video}null[vout]`);
    return [...args, '-filter_complex', filters.join(';'), '-map', '[vout]', '-frames:v', '1', '-update', '1', '-y', output];
  }
  // Trilha com `duck` abaixa sozinha enquanto há fala (sidechain na mistura das outras faixas).
  const chains = audio.map((item, position) => {
    const delay = Math.round(item.localStart * 1000);
    const chain = ['aresample=48000', 'aformat=channel_layouts=stereo', 'asetpts=PTS-STARTPTS', `volume=${item.layer.volume}`];
    if (item.layer.fadeIn > item.offset) chain.push(`afade=t=in:st=0:d=${(item.layer.fadeIn - item.offset).toFixed(4)}`);
    if (item.layer.fadeOut) chain.push(`afade=t=out:st=${Math.max(0, item.duration - item.layer.fadeOut).toFixed(4)}:d=${item.layer.fadeOut}`);
    if (delay) chain.push(`adelay=${delay}|${delay}`);
    filters.push(`[${item.index}:a]${chain.join(',')}[a${position}]`);
    return { label: `[a${position}]`, duck: item.layer.duck, level: item.layer.duckLevel };
  });
  const voices = chains.filter(item => !item.duck); const beds = chains.filter(item => item.duck);
  const mixes = chains.map(item => item.label);
  if (voices.length && beds.length) {
    const ratio = Math.min(20, Math.max(2, 1 / Math.max(0.05, beds[0].level)));
    filters.push(`${voices.map(item => item.label).join('')}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,apad,asplit=2[voice][key]`);
    filters.push(`${beds.map(item => item.label).join('')}amix=inputs=${beds.length}:normalize=0:dropout_transition=0[bed]`);
    filters.push(`[bed][key]sidechaincompress=threshold=0.02:ratio=${ratio.toFixed(1)}:attack=15:release=450:makeup=1[ducked]`);
    filters.push(`[voice][ducked]amix=inputs=2:normalize=0:dropout_transition=0:duration=longest,alimiter=limit=0.95,apad,atrim=0:${window.toFixed(4)}[aout]`);
  } else if (mixes.length) filters.push(`${mixes.join('')}amix=inputs=${mixes.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95,apad,atrim=0:${window.toFixed(4)}[aout]`);
  else { inputs.push(['-f', 'lavfi', '-t', window.toFixed(4), '-i', 'anullsrc=r=48000:cl=stereo']); }
  filters.push(`${video}null[vout]`);
  const audioMap = mixes.length ? '[aout]' : `${inputs.length - 1}:a`;
  return [...['-hide_banner', '-loglevel', 'error', ...inputs.flat()], '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', audioMap, '-t', window.toFixed(4), '-r', String(plan.fps), '-c:v', 'libx264', '-preset', scale < 1 ? 'ultrafast' : 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-y', output];
}

/** Expressão FFmpeg de opacidade por keyframes (tempos relativos ao clip; `T` é o tempo do trecho lido, deslocado por `shift`). */
export function opacityExpression(points, shift) {
  const at = point => (point.time + shift).toFixed(4);
  let expression = String(points.at(-1).value);
  for (let index = points.length - 1; index > 0; index -= 1) {
    const [a, b] = [points[index - 1], points[index]];
    const span = Math.max(0.0001, b.time - a.time);
    expression = `if(lt(T,${at(b)}),${a.value}+(${b.value - a.value})*(T-${at(a)})/${span.toFixed(4)},${expression})`;
  }
  return `if(lt(T,${at(points[0])}),${points[0].value},${expression})`;
}

export function wrap(text, perLine) {
  const limit = Math.max(8, perLine);
  return text.split(/\n/).map(line => line.split(/\s+/).reduce((lines, word) => { const last = lines.at(-1); if (last && `${last} ${word}`.length <= limit) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word); return lines; }, []).join('\n')).join('\n');
}

function even(value) { return Math.max(2, Math.round(value / 2) * 2); }
function escapePath(value) { return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,'); }
