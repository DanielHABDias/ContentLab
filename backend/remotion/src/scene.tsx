import React from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {loadFont} from '@remotion/fonts';
import type {Element, Keyframe, SceneProps, Word} from './types';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number, name?: string) => {
  const x = clamp(n);
  if (name === 'ease_in') return x * x;
  if (name === 'ease_out') return 1 - (1 - x) ** 2;
  if (name === 'ease_in_out') return x * x * (3 - 2 * x);
  return x;
};
const stateAt = (initial: Record<string, number>, frames: Keyframe[] = [], time: number) => {
  let previous = 0;
  let state = {...initial};
  for (const frame of frames) {
    const next = {...state, ...Object.fromEntries(Object.entries(frame).filter(([k, value]) => k !== 't' && typeof value === 'number'))} as Record<string, number>;
    if (time < frame.t && frame.t > previous) {
      const mix = ease((time - previous) / (frame.t - previous), frame.easing);
      return Object.fromEntries(Object.keys(state).map((key) => [key, state[key] + (next[key] - state[key]) * mix])) as Record<string, number>;
    }
    state = next;
    previous = frame.t;
  }
  return state;
};
const fit = (name?: string): 'fill' | 'contain' | 'cover' => name === 'stretch' ? 'fill' : name === 'contain' ? 'contain' : 'cover';
const captionChunk = (item: Element, absolute: number, words: Word[]) => {
  const range = item.data.range ?? {};
  const start = Number(range.start ?? item.start), end = Number(range.end ?? item.end);
  if (absolute < start || absolute >= end) return null;
  const candidates = words.filter((word) => word.end > start && word.start < end);
  if (!candidates.length) return null;
  let active = candidates.findIndex((word) => word.start <= absolute && absolute < word.end);
  if (active < 0) {
    const started = candidates.map((word, index) => ({word, index})).filter(({word}) => word.start <= absolute);
    if (!started.length) return null;
    active = started[started.length - 1].index;
  }
  const maxWords = Math.max(2, Math.min(12, Math.round(Number(item.data.config?.maxWords ?? 7))));
  let chunkStart = 0;
  for (let index = 0; index < candidates.length; index++) {
    const terminal = /[,.!?;:][\"'”’)]*$/.test(String(candidates[index].word).trim());
    if (index - chunkStart + 1 >= maxWords || terminal || index === candidates.length - 1) {
      const chunkEnd = index + 1;
      if (chunkStart <= active && active < chunkEnd) return {words: candidates.slice(chunkStart, chunkEnd), active: active - chunkStart, globalActive: active};
      chunkStart = chunkEnd;
    }
  }
  return null;
};
const wordStackState = (item: Element, absolute: number, words: Word[]) => {
  const configuredItems = Array.isArray(item.data.config?.items)
    ? item.data.config.items
        .filter((entry: unknown) => entry && typeof entry === 'object')
        .map((entry: any) => ({
          word: String(entry.text ?? ''),
          start: Number(entry.start),
          end: Number(entry.end),
        }))
        .filter((entry: Word) => entry.word && Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
    : [];
  const candidates: Word[] = configuredItems.length
    ? configuredItems
    : item.data.phraseWords ?? words.filter((word) => word.end > item.start && word.start < item.end);
  if (!candidates.length) return null;
  let activeIndex = candidates.findIndex((word) => word.start <= absolute && absolute < word.end);
  if (activeIndex < 0) {
    const started = candidates.map((word, index) => ({word, index})).filter(({word}) => word.start <= absolute);
    activeIndex = started.length ? started[started.length - 1].index : 0;
  }
  const active = candidates[activeIndex];
  const configured = Number(item.data.config?.transitionDuration ?? 0.18);
  const duration = Math.max(0.05, Math.min(configured, Math.max(0.05, (active.end - active.start) * 0.45)));
  const raw = activeIndex === 0 ? 1 : clamp((absolute - active.start) / duration);
  const progress = ease(raw, 'ease_out');
  return {
    previous: activeIndex > 0 ? candidates[activeIndex - 1] : null,
    active,
    next: activeIndex + 1 < candidates.length ? candidates[activeIndex + 1] : null,
    progress,
  };
};
const styles: Record<string, {color: string; stroke: string; strokeWidth: number}> = {
  impact: {color: '#fff', stroke: '#000', strokeWidth: 6},
  impact_yellow: {color: '#ffd400', stroke: '#000', strokeWidth: 6},
  paper_word: {color: '#111', stroke: '#f5e8ce', strokeWidth: 10},
  versus_big: {color: '#ff334f', stroke: '#fff', strokeWidth: 5},
  word_pop: {color: '#fff', stroke: '#000', strokeWidth: 7},
  anton_karaoke: {color: '#fff', stroke: '#000', strokeWidth: 5},
  anton: {color: '#fff', stroke: '#fff', strokeWidth: 0},
  anton_white: {color: '#fff', stroke: '#fff', strokeWidth: 0}, // Legacy alias.
  bangers: {color: '#fff', stroke: '#000', strokeWidth: 4},
  bangers_highlight_block: {color: '#fff', stroke: '#000', strokeWidth: 4},
  word_stack_vertical: {color: '#fff', stroke: '#fff', strokeWidth: 0},
  word_stream_horizontal: {color: '#fff', stroke: '#fff', strokeWidth: 0},
};
const visibleText = (item: Element, absolute: number, words: Word[]) => {
  if (item.type === 'text') {
    const text = String(item.data.text ?? '');
    const reveal = item.data.reveal;
    if (!reveal) return text;
    const elapsed = absolute - item.start - (reveal.delay ?? 0);
    return elapsed < 0 ? '' : Array.from(text).slice(0, Math.floor(elapsed * reveal.charactersPerSecond) + 1).join('');
  }
  if (item.type === 'kinetic_text') {
    const candidates: Word[] = item.data.phraseWords ?? words.filter((word) => word.end > item.start && word.start < item.end);
    const active = candidates.find((word) => word.start <= absolute && absolute < word.end);
    if (item.data.phraseWords) return active?.word ?? '';
    if (active) return active.word;
    const tokens = String(item.data.text ?? '').split(/\s+/).filter(Boolean);
    const index = Math.floor((absolute - item.start) / (item.end - item.start) * tokens.length);
    return tokens[Math.max(0, Math.min(tokens.length - 1, index))] ?? '';
  }
  if (item.type === 'caption') {
    const range = item.data.range ?? {};
    if (absolute < (range.start ?? item.start) || absolute >= (range.end ?? item.end)) return '';
    const active = words.findIndex((word) => word.start <= absolute && absolute < word.end);
    return active < 0 ? '' : words.slice(Math.floor(active / 4) * 4, Math.floor(active / 4) * 4 + 4).map((word) => word.word).join(' ');
  }
  return '';
};
const wrappedFontSize = (text: string, baseSize: number, width: number, height: number) => {
  const paragraphs = String(text).split('\n');
  const tokens = paragraphs.flatMap((line) => line.split(/\s+/).filter(Boolean));
  const longest = tokens.reduce((best, token) => token.length > best.length ? token : best, '');
  let size = Math.max(12, baseSize);
  while (size > 12) {
    const charsPerLine = Math.max(1, Math.floor(width * 0.90 / Math.max(1, size * 0.56)));
    if (longest.length > charsPerLine) {
      size *= 0.90;
      continue;
    }
    let lines = 0;
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines += 1;
        continue;
      }
      let used = 0;
      lines += 1;
      for (const word of words) {
        const needed = word.length + (used ? 1 : 0);
        if (used && used + needed > charsPerLine) {
          lines += 1;
          used = word.length;
        } else {
          used += needed;
        }
      }
    }
    const maxLines = Math.max(1, Math.floor(height * 0.90 / Math.max(1, size * 1.12)));
    if (lines <= maxLines) break;
    size *= 0.90;
  }
  return Math.max(12, size);
};
const Media = ({
  src,
  isVideo,
  loop,
  style,
  objectFit,
}: {
  src: string;
  isVideo: boolean;
  loop?: boolean;
  style: React.CSSProperties;
  objectFit: 'fill' | 'contain' | 'cover';
}) =>
  isVideo ? (
    <Video
      src={staticFile(src)}
      loop={loop}
      muted
      style={style}
      objectFit={objectFit}
      delayRenderTimeoutInMilliseconds={90_000}
      delayRenderRetries={2}
    />
  ) : (
    <Img src={staticFile(src)} style={{...style, objectFit}}/>
  );

const Layer = ({item, props, time, absolute, camera}: {item: Element; props: SceneProps; time: number; absolute: number; camera: Record<string, number>}) => {
  if (item.type === 'sfx' || absolute < item.start || absolute >= item.end) return null;
  const [rx, ry, rw, rh] = item.region;
  const width = props.width, height = props.height;
  const anchorX = 0.25 + (rx + rw / 2) / (2 * width);
  const anchorY = 0.25 + (ry + rh / 2) / (2 * height);
  const state = stateAt({x: anchorX, y: anchorY, scale: 1, rotation: 0, opacity: 1, ...item.data.transform}, item.data.keyframes, time);
  const motion = item.data.animation ?? {};
  const elapsed = absolute - item.start, remaining = item.end - absolute, total = item.end - item.start;
  const enterDuration = Math.min(motion.enterDuration ?? 0.45, total);
  const exitDuration = Math.min(motion.exitDuration ?? 0.35, total);
  let centerVisibility = 1;
  if (enterDuration && elapsed < enterDuration) {
    const p = ease(elapsed / enterDuration, 'ease_out');
    if (motion.enter === 'slide_from_left') state.x = 0.08 + (state.x - 0.08) * p;
    if (motion.enter === 'slide_from_right') state.x = 0.92 + (state.x - 0.92) * p;
    if (motion.enter === 'slide_up') state.y = 0.92 + (state.y - 0.92) * p;
    if (motion.enter === 'slide_down') state.y = 0.08 + (state.y - 0.08) * p;
    if (motion.enter === 'fade' || motion.enter === 'pop_in') state.opacity *= p;
    if (motion.enter === 'pop_in') state.scale *= 0.65 + 0.35 * p + 0.13 * Math.sin(Math.PI * p);
    if (motion.enter === 'center_reveal') centerVisibility = p;
  }
  if (exitDuration && remaining < exitDuration) {
    const p = ease(1 - remaining / exitDuration, 'ease_in');
    if (motion.exit === 'slide_to_left') state.x += (0.08 - state.x) * p;
    if (motion.exit === 'slide_to_right') state.x += (0.92 - state.x) * p;
    if (motion.exit === 'slide_to_bottom') state.y += (0.92 - state.y) * p;
    if (motion.exit === 'fade' || motion.exit === 'fade_out') state.opacity *= 1 - p;
    if (motion.exit === 'center_close') centerVisibility = 1 - p;
  }
  if (motion.idle === 'float_soft') state.y += 0.005 * Math.sin(elapsed * 2);
  if (motion.idle === 'wiggle_soft') {
    state.x += 0.0025 * Math.sin(elapsed * 2.4);
    state.y += 0.0018 * Math.sin(elapsed * 3.1 + 0.7);
    state.rotation += 0.35 * Math.sin(elapsed * 2.1);
  }
  if (motion.idle === 'pulse_soft') state.scale *= 1 + 0.025 * Math.sin(elapsed * 3);
  if (motion.idle === 'slow_zoom_in') state.scale *= 1 + 0.06 * elapsed / Math.max(total, 0.01);
  if (motion.idle === 'slow_zoom_out') state.scale *= 1.06 - 0.06 * elapsed / Math.max(total, 0.01);
  if (motion.idle === 'pan') state.x += 0.015 * elapsed / Math.max(total, 0.01);
  const box = item.data.box && typeof item.data.box === 'object' ? item.data.box : {};
  const card = box.preset === 'floating_card' || box.background;
  const elementWidth = item.type === 'filter' ? width : item.data.cells ? rw : width * 0.8;
  const elementHeight = item.type === 'filter' ? height : item.data.cells ? rh : height * 0.8;
  const x = (state.x - camera.x) * width * 2 * camera.scale + width / 2;
  const y = (state.y - camera.y) * height * 2 * camera.scale + height / 2;
  const half = centerVisibility * 50;
  const feather = Math.min(2.5, Math.max(0.6, half * 0.15));
  const leftEdge = 50 - half;
  const rightEdge = 50 + half;
  const centerMask = centerVisibility >= 0.999 ? undefined :
    centerVisibility <= 0.001 ? 'linear-gradient(90deg, transparent, transparent)' :
    `linear-gradient(90deg, transparent 0%, transparent ${Math.max(0, leftEdge - feather)}%, black ${leftEdge}%, black ${rightEdge}%, transparent ${Math.min(100, rightEdge + feather)}%, transparent 100%)`;
  const common: React.CSSProperties = {
    position: 'absolute', left: x, top: y, width: elementWidth, height: elementHeight,
    translate: '-50% -50%', scale: state.scale * camera.scale, rotate: `${state.rotation}deg`,
    opacity: centerVisibility <= 0.001 ? 0 : state.opacity, overflow: 'hidden',
    maskImage: centerMask, WebkitMaskImage: centerMask,
    borderRadius: card ? (box.radius ?? 28) : undefined,
    background: card ? (box.background ?? 'transparent') : undefined,
    padding: card ? (box.padding ?? 20) : undefined,
    boxShadow: card && box.shadow !== 'none' ? '5px 8px 16px #0007' : undefined,
  };
  if (item.type === 'filter') {
    const config = item.data.config ?? {};
    const style = item.data.style;
    const opacity = Number(config.opacity ?? (style === 'dim' ? 0.45 : 1));
    if (style === 'dim') {
      return <div style={{...common, backgroundColor: '#000000', opacity: state.opacity * opacity}}/>;
    }
    if (style === 'crt_tv') {
      const scanlineOpacity = Number(config.scanlineOpacity ?? 0.18);
      const vignette = Number(config.vignette ?? 0.42);
      const flicker = Number(config.flicker ?? 0.035);
      const jitter = Number(config.jitter ?? 1.5);
      const phase = Math.sin(elapsed * 19.0) * flicker;
      const shift = Math.sin(elapsed * 11.5) * jitter;
      return <div style={{
        ...common,
        opacity: state.opacity * opacity * (1 + phase),
        backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,0) 48%, rgba(0,0,0,${vignette}) 100%), repeating-linear-gradient(to bottom, rgba(0,0,0,${scanlineOpacity}) 0px, rgba(0,0,0,${scanlineOpacity}) 1px, rgba(255,255,255,0.02) 2px, rgba(0,0,0,0) 4px)`,
        backgroundPosition: `center, 0 ${shift}px`,
        backgroundSize: '100% 100%, 100% 4px',
      }}/>;
    }
    return null;
  }
  if (item.src) {
    const isVideo = item.type === 'video' || (item.type === 'overlay' && /\.(mp4|mov|mkv|webm)$/i.test(item.src));
    return <div style={common}><Media src={item.src} isVideo={isVideo} loop={item.data.loop} objectFit={fit(item.data.fit)} style={{width: '100%', height: '100%'}}/></div>;
  }
  if (item.type === 'kinetic_text' && item.data.style === 'word_stream_horizontal') {
    const candidates: Word[] = item.data.phraseWords ?? props.words.filter((word) => word.end > item.start && word.start < item.end);
    if (!candidates.length) return null;
    let activeIndex = candidates.findIndex((word) => word.start <= absolute && absolute < word.end);
    if (activeIndex < 0) {
      const started = candidates.map((word, index) => ({word, index})).filter(({word}) => word.start <= absolute);
      if (!started.length) return null;
      activeIndex = started[started.length - 1].index;
    }
    const active = candidates[activeIndex];
    const previous = activeIndex > 0 ? candidates[activeIndex - 1] : null;
    const configured = Number(item.data.config?.transitionDuration ?? 0.16);
    const duration = Math.max(0.06, Math.min(configured, Math.max(0.06, (active.end - active.start) * 0.55)));
    const p = ease(clamp((absolute - active.start) / duration), 'ease_out');
    const appearance = item.data.textStyle ?? {};
    const look = styles.word_stream_horizontal;
    const uppercase = appearance.uppercase ?? true;
    const fontScale = Number(item.data.fontScale ?? 1);
    const activeLabel = uppercase ? String(active.word).toLocaleUpperCase('pt-BR') : String(active.word);
    const previousLabel = previous ? (uppercase ? String(previous.word).toLocaleUpperCase('pt-BR') : String(previous.word)) : '';
    const longest = [activeLabel, previousLabel].reduce((best, value) => value.length > best.length ? value : best, '');
    const baseSize = Math.min(rh * 0.72, rw * 0.30) * fontScale;
    const maxByWidth = rw * 0.78 / Math.max(1, Array.from(longest).length * 0.54);
    const fontSize = Math.max(32, Math.min(baseSize, maxByWidth));
    const activeX = 1.12 - 0.62 * p;
    const previousX = 0.50 - 0.68 * p;
    const activeOpacity = Math.min(1, 0.35 + p * 0.9);
    const previousOpacity = previous ? Math.max(0, 1 - p * 0.85) : 0;
    const textBase: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      translate: '-50% -50%',
      whiteSpace: 'nowrap',
      fontFamily: item.fontSrc ? item.fontFamily + ', Arial, sans-serif' : 'Arial, sans-serif',
      fontWeight: item.fontSrc ? 400 : 900,
      fontSize,
      color: appearance.color ?? look.color,
      WebkitTextStroke: (appearance.outlineWidth ?? look.strokeWidth) + 'px ' + (appearance.outlineColor ?? look.stroke),
      paintOrder: 'stroke fill',
      textShadow: appearance.shadow ? (appearance.shadow.offsetX ?? 3) + 'px ' + (appearance.shadow.offsetY ?? 4) + 'px ' + (appearance.shadow.blur ?? 8) + 'px ' + (appearance.shadow.color ?? '#00000099') : undefined,
    };
    return <div style={{...common, position: 'absolute', overflow: 'hidden'}}>
      {previous && <div style={{...textBase, left: (previousX * 100) + '%', opacity: previousOpacity}}>{previousLabel}</div>}
      <div style={{...textBase, left: (activeX * 100) + '%', opacity: activeOpacity}}>{activeLabel}</div>
    </div>;
  }
  if (item.type === 'kinetic_text' && item.data.style === 'word_stack_vertical') {
    const stack = wordStackState(item, absolute, props.words);
    if (!stack) return null;
    const look = styles.word_stack_vertical;
    const appearance = item.data.textStyle ?? {};
    const uppercase = appearance.uppercase ?? true;
    const config = item.data.config ?? {};
    const inactiveOpacity = Number(config.inactiveOpacity ?? 0.36);
    const gap = rh * Number(config.slotGap ?? 0.24);
    const activeScale = Number(config.activeScale ?? 1.45);
    const inactiveScale = Number(config.inactiveScale ?? 0.72);
    const direction = config.direction === 'up' ? -1 : 1;
    const align = config.align === 'center' ? 'center' : 'left';
    const inactiveColor = typeof config.inactiveColor === 'string' ? config.inactiveColor : '#777777';
    const panelColor = typeof config.panelColor === 'string' ? config.panelColor : '#D9D9D9';
    const panelOpacity = Number(config.panelOpacity ?? 0.18);
    const panelRadius = Number(config.panelRadius ?? 28);
    const panelPaddingX = Number(config.panelPaddingX ?? Math.max(28, rw * 0.045));
    const panelPaddingY = Number(config.panelPaddingY ?? Math.max(20, rh * 0.045));
    const scaleFactor = Number(item.data.fontScale ?? 1);
    const wordsToMeasure = [stack.previous, stack.active, stack.next].filter(Boolean).map((word) => String(word!.word));
    const longest = wordsToMeasure.reduce((best, value) => value.length > best.length ? value : best, '');
    const baseSize = Math.min(rh * 0.28, rw * 0.18) * scaleFactor;
    const maxBaseByWidth = rw * 0.78 / Math.max(1, Array.from(longest).length * 0.52 * activeScale);
    const fontSize = Math.max(18, Math.min(baseSize, maxBaseByWidth));
    const shadow = appearance.shadow;
    const p = stack.progress;
    const slots = [
      stack.previous ? {
        word: stack.previous,
        y: rh / 2 + direction * gap * p,
        opacity: 1 - (1 - inactiveOpacity) * p,
        scale: activeScale - (activeScale - inactiveScale) * p,
        color: inactiveColor,
      } : null,
      {
        word: stack.active,
        y: rh / 2 - direction * gap + direction * gap * p,
        opacity: inactiveOpacity + (1 - inactiveOpacity) * p,
        scale: inactiveScale + (activeScale - inactiveScale) * p,
        color: appearance.color ?? look.color,
      },
      stack.next ? {
        word: stack.next,
        y: rh / 2 - direction * gap * 2 + direction * gap * p,
        opacity: inactiveOpacity * p,
        scale: inactiveScale,
        color: inactiveColor,
      } : null,
    ].filter(Boolean) as Array<{word: Word; y: number; opacity: number; scale: number; color: string}>;
    const panelRgba = /^#[0-9A-Fa-f]{6}$/.test(panelColor)
      ? `rgba(${parseInt(panelColor.slice(1, 3), 16)}, ${parseInt(panelColor.slice(3, 5), 16)}, ${parseInt(panelColor.slice(5, 7), 16)}, ${panelOpacity})`
      : panelColor;
    return <div style={{
      ...common,
      position: 'absolute',
      boxSizing: 'border-box',
      background: panelRgba,
      borderRadius: panelRadius,
      padding: `${panelPaddingY}px ${panelPaddingX}px`,
    }}>
      {slots.map((slot, index) => {
        const label = uppercase ? String(slot.word.word).toLocaleUpperCase('pt-BR') : String(slot.word.word);
        const isLeft = align === 'left';
        return <div key={index + '-' + label} style={{
          position: 'absolute',
          left: isLeft ? panelPaddingX : '50%',
          top: slot.y,
          translate: isLeft ? '0 -50%' : '-50% -50%',
          width: isLeft ? `calc(100% - ${panelPaddingX * 2}px)` : '92%',
          textAlign: isLeft ? 'left' : 'center',
          whiteSpace: 'nowrap',
          fontFamily: item.fontSrc ? item.fontFamily + ', Arial, sans-serif' : 'Arial, sans-serif',
          fontWeight: item.fontSrc ? 400 : 900,
          fontSize: fontSize * slot.scale,
          color: slot.color,
          WebkitTextStroke: (appearance.outlineWidth ?? look.strokeWidth) + 'px ' + (appearance.outlineColor ?? look.stroke),
          paintOrder: 'stroke fill',
          opacity: slot.opacity,
          textShadow: shadow ? (shadow.offsetX ?? 3) + 'px ' + (shadow.offsetY ?? 4) + 'px ' + (shadow.blur ?? 8) + 'px ' + (shadow.color ?? '#00000099') : undefined,
        }}>{label}</div>;
      })}
    </div>;
  }
  if (item.type === 'caption' && item.data.style === 'bangers_highlight_block') {
    const caption = captionChunk(item, absolute, props.words);
    if (!caption) return null;
    const look = styles.bangers_highlight_block;
    const appearance = item.data.textStyle ?? {};
    const shadow = appearance.shadow ?? {color: '#000000', blur: 8, offsetX: 3, offsetY: 4};
    const uppercase = appearance.uppercase ?? true;
    const labels = caption.words.map((word) => uppercase ? String(word.word).toLocaleUpperCase('pt-BR') : String(word.word));
    const fullText = labels.join(' ');
    const scaleFactor = Number(item.data.fontScale ?? 0.5);
    const baseSize = Math.min(rh * 0.42, rw * 0.075) * scaleFactor;
    const fontSize = Math.max(16, Math.min(baseSize, rw * 0.86 / Math.max(1, Array.from(fullText).length * 0.43)));
    const configuredColors = Array.isArray(item.data.config?.highlightColors) ? item.data.config.highlightColors.filter((color: unknown) => typeof color === 'string') : [];
    const colors = configuredColors.length ? configuredColors : ['#2563EB', '#E53935', '#111111'];
    const activeColor = colors[caption.globalActive % colors.length];
    const padX = Number(item.data.config?.highlightPaddingX ?? Math.max(7, fontSize * 0.13));
    const padY = Number(item.data.config?.highlightPaddingY ?? Math.max(3, fontSize * 0.07));
    const radius = Number(item.data.config?.highlightRadius ?? Math.max(8, fontSize * 0.18));
    return <div style={{...common, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5%', boxSizing: 'border-box'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: Math.max(4, fontSize * 0.12), lineHeight: 1.14, maxWidth: '100%'}}>
        {labels.map((label, index) => <span key={index + '-' + label} style={{
          display: 'inline-block', boxSizing: 'border-box', whiteSpace: 'nowrap',
          padding: padY + 'px ' + padX + 'px', borderRadius: radius,
          backgroundColor: index === caption.active ? activeColor : 'transparent',
          fontFamily: item.fontSrc ? item.fontFamily + ', Arial, sans-serif' : 'Arial, sans-serif',
          fontWeight: item.fontSrc ? 400 : 900, fontSize, color: appearance.color ?? look.color,
          WebkitTextStroke: (appearance.outlineWidth ?? look.strokeWidth) + 'px ' + (appearance.outlineColor ?? look.stroke),
          paintOrder: 'stroke fill',
          textShadow: (shadow.offsetX ?? 3) + 'px ' + (shadow.offsetY ?? 4) + 'px ' + (shadow.blur ?? 8) + 'px ' + (shadow.color ?? '#00000099'),
        }}>{label}</span>)}
      </div>
    </div>;
  }
  const value = visibleText(item, absolute, props.words);
  if (!value) return null;
  const look = styles[item.data.style ?? (item.type === 'caption' ? 'anton_karaoke' : 'impact')] ?? styles.impact;
  const appearance = item.data.textStyle ?? {};
  const fullText = String(item.data.text ?? value);
  const baseSize = Math.min(rh * 0.6, rw * 0.26) * Number(item.data.fontScale ?? 1);
  const fontSize = wrappedFontSize(fullText, baseSize, rw, rh);
  const shadow = appearance.shadow;
  const uppercase = appearance.uppercase ?? (item.data.style === 'anton_white' || item.data.style === 'bangers');
  return <div style={{...common, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', hyphens: 'none', lineHeight: 1.08, fontFamily: item.fontSrc ? `${item.fontFamily}, Arial, sans-serif` : 'Arial, sans-serif', fontWeight: item.fontSrc ? 400 : 900, fontSize, color: appearance.color ?? look.color, WebkitTextStroke: `${appearance.outlineWidth ?? look.strokeWidth}px ${appearance.outlineColor ?? look.stroke}`, paintOrder: 'stroke fill', textShadow: shadow ? `${shadow.offsetX ?? 3}px ${shadow.offsetY ?? 4}px ${shadow.blur ?? 8}px ${shadow.color ?? '#00000099'}` : undefined}}>{uppercase ? value.toLocaleUpperCase('pt-BR') : value}</div>;
};

export const Scene = (props: SceneProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fonts = props.scene.elements.filter((item) => item.fontSrc);
  const [fontHandle] = React.useState(() => fonts.length ? delayRender('Carregando fontes do projeto') : null);
  React.useEffect(() => {
    if (fontHandle === null) return;
    Promise.all(fonts.map((item) => loadFont({family: item.fontFamily!, url: staticFile(item.fontSrc!)})))
      .then(() => continueRender(fontHandle))
      .catch((error) => cancelRender(error));
  }, [fontHandle, props.scene.elements]);
  const time = frame / fps, absolute = props.scene.start + time;
  const camera = stateAt({x: 0.5, y: 0.5, scale: 1}, props.scene.camera.keyframes, time);
  for (const shake of props.scene.camera.shake ?? []) {
    if (shake.start <= time && time < shake.end) {
      const fade = Math.max(0, Math.min(1, (time - shake.start) / 0.15, (shake.end - time) / 0.15));
      const amplitude = (shake.amplitude ?? 0.003) * fade, frequency = shake.frequency ?? 2.5;
      camera.x += amplitude * Math.sin(2 * Math.PI * frequency * time);
      camera.y += amplitude * Math.sin(2 * Math.PI * frequency * 1.37 * time);
    }
  }
  const backgroundStyle: React.CSSProperties = {position: 'absolute', width: '100%', height: '100%'};
  const worldStyle: React.CSSProperties = {
    position: 'absolute', width: props.width * 2 * camera.scale, height: props.height * 2 * camera.scale,
    left: props.width / 2 - camera.x * props.width * 2 * camera.scale,
    top: props.height / 2 - camera.y * props.height * 2 * camera.scale,
    backgroundColor: props.scene.background.color ?? '#000',
  };
  return <AbsoluteFill style={{backgroundColor: props.scene.background.color ?? '#000', overflow: 'hidden'}}>
    <div style={worldStyle}>{props.scene.backgroundSrc && <Media src={props.scene.backgroundSrc} isVideo={/\.(mp4|mov|mkv|webm)$/i.test(props.scene.backgroundSrc)} loop={props.scene.background.loop} objectFit={fit(props.scene.background.fit)} style={backgroundStyle}/>}</div>
    {props.scene.elements.map((item) => <Sequence key={item.id} from={Math.round((item.start - props.scene.start) * fps)} layout="none"><Layer item={item} props={props} time={time} absolute={absolute} camera={camera}/></Sequence>)}
  </AbsoluteFill>;
};
