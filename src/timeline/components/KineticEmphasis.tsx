import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const KineticEmphasis = ({ text, color = '#d8ff48' }: { text: string; color?: string }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 180 } });
  return <div style={{ color, opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), translate: `0 ${(1 - entrance) * 32}px`, scale: .96 + entrance * .04, fontFamily: 'Arial, sans-serif', fontSize: 86, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' }}>{text}</div>;
};
