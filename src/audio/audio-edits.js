// Tempos do arquivo original; os intervalos mantidos fecham os espaços na reprodução.
export const editDuration = segments => segments.reduce((sum, item) => sum + item.end - item.start, 0);
export const takeSegments = take => take.segments || (take.trim ? [take.trim] : [{ start: 0, end: take.durationSeconds }]);

export function validateSegments(segments, duration) {
  if (!Array.isArray(segments) || !segments.length || segments.length > 500) throw new Error('Mantenha de 1 a 500 trechos no áudio');
  let previous = 0;
  const result = segments.map(item => {
    const start = item?.start; const end = item?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < previous || end - start < 0.01 || end > duration + 0.001) throw new Error('Trechos inválidos: use tempos em ordem, dentro do áudio e sem sobreposição');
    previous = end;
    return { start, end: Math.min(duration, end) };
  });
  if (editDuration(result) < 0.1) throw new Error('Mantenha ao menos 0,1 s de áudio');
  return result;
}

export function sourceTime(segments, time) {
  let offset = 0;
  for (const part of segments) {
    const length = part.end - part.start;
    if (time < offset + length) return part.start + Math.max(0, time - offset);
    offset += length;
  }
  return segments.at(-1)?.end || 0;
}

export function editedTime(segments, source) {
  let offset = 0;
  for (const part of segments) {
    if (source < part.start) return offset;
    if (source <= part.end) return offset + source - part.start;
    offset += part.end - part.start;
  }
  return offset;
}

export function selectSegments(segments, start, end) {
  let offset = 0;
  return segments.flatMap(part => {
    const length = part.end - part.start;
    const a = Math.max(0, start - offset); const b = Math.min(length, end - offset);
    offset += length;
    return b - a > 0.0000001 ? [{ start: part.start + a, end: part.start + b }] : [];
  });
}

export function deleteSelection(segments, start, end) {
  return [...selectSegments(segments, 0, start), ...selectSegments(segments, end, editDuration(segments))];
}
