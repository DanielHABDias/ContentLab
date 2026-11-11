export const mediaDefaultsToFullFrame = (type, cells) =>
  (type === 'image' || type === 'video') && !Array.isArray(cells);

export function elementDimensions({type, cells, regionWidth, regionHeight, frameWidth, frameHeight, isWordStack = false}) {
  if (type === 'filter') return {width: frameWidth, height: frameHeight};
  if (isWordStack) return {width: frameWidth, height: Array.isArray(cells) ? regionHeight : frameHeight * 0.8};
  if (mediaDefaultsToFullFrame(type, cells)) return {width: frameWidth, height: frameHeight};
  if (Array.isArray(cells)) return {width: regionWidth, height: regionHeight};
  return {width: frameWidth * 0.8, height: frameHeight * 0.8};
}
