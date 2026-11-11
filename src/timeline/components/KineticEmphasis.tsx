import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const KineticEmphasis = ({ text, color = '#d8ff48' }: { text: string; color?: string }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 180 } });
  const opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ color, opacity, transform: `translateY(${(1 - entrance) * 32}px) scale(${.96 + entrance * .04})`, fontSize: 86, fontWeight: 900, textTransform: 'uppercase' }}>{text}</div>;
};
