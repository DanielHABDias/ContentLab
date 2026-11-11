/** Encaixa um frame na borda mais próxima (outros clips, playhead) dentro da tolerância. */
export function snapFrame(frame, edges, tolerance) {
  let best = frame; let distance = tolerance + 1;
  for (const edge of edges) { const gap = Math.abs(edge - frame); if (gap <= tolerance && gap < distance) { best = edge; distance = gap; } }
  return best;
}
