import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { AbsoluteFill, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import * as THREE from 'three';
import { ANTON, C, Punch, pop, slide } from './fx';
import type { Mood } from './Nox';
import { Assets, Background } from './scenes';

/*
 * Cenas 3D do kit (Three.js via @remotion/three). O render precisa de WebGL: o editor usa
 * `chromiumOptions.gl = "swangle"` quando o plano tem cena 3D.
 *
 * Nox 3D é uma releitura procedural do Nox canônico (assets/brand/nox/Nox.png): capuz preto com
 * ponta para trás, rosto vazio, olhos amarelos luminosos por expressão, gola, sobretudo, punhos
 * dourados, emblema, luvas e botas; material toon com contorno e luz de recorte vermelha/azul,
 * que traduz o deslocamento cromático do 2D. Não acrescentar boca, nariz, armas ou acessórios.
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** A prop `camera` do canvas só vale na criação: a câmera animada é posicionada a cada frame aqui. */
const Rig: React.FC<{ position: [number, number, number]; target: [number, number, number] }> = ({ position, target }) => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  React.useLayoutEffect(() => { camera.position.set(...position); camera.lookAt(...target); camera.updateProjectionMatrix(); invalidate(); }, [camera, invalidate, ...position, ...target]);
  return null;
};
const INK = '#26262c';

const gradient = (() => {
  let map: THREE.DataTexture | null = null;
  return () => {
    if (!map) { map = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat); map.minFilter = map.magFilter = THREE.NearestFilter; map.needsUpdate = true; }
    return map;
  };
})();
const toon = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: gradient() });

/** Malha com contorno preto (casco invertido), como a linha de tinta do desenho. */
const Inked: React.FC<{ geo: THREE.BufferGeometry; mat: THREE.Material; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; line?: number }> = ({ geo, mat, position, rotation, scale, line = 0.045 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh geometry={geo} material={mat} />
    <mesh geometry={geo} scale={1 + line}><meshBasicMaterial color="#000" side={THREE.BackSide} /></mesh>
  </group>
);

/** Formato do olho por expressão: elipse recortada por linhas (sobrancelha implícita), ou arco fechado. */
function eyeShape(mood: Mood, side: -1 | 1): THREE.Shape {
  const rx = 0.17; const ry = mood === 'surpreso' ? 0.15 : mood === 'determinado' ? 0.1 : 0.12;
  const arc = (outer: number, inner: number) => {
    const s = new THREE.Shape(); const n = 24;
    for (let i = 0; i <= n; i++) { const t = Math.PI * i / n; s[i ? 'lineTo' : 'moveTo'](Math.cos(t) * rx, Math.sin(t) * outer - 0.04); }
    for (let i = n; i >= 0; i--) { const t = Math.PI * i / n; s.lineTo(Math.cos(t) * rx * 0.62, Math.sin(t) * inner - 0.04); }
    return s;
  };
  if (mood === 'feliz' || (mood === 'piscada' && side === 1)) return arc(0.14, 0.06);
  const u = (x: number) => -side * x; // positivo na direção do centro do rosto
  const cut = (x: number) => {
    if (mood === 'bravo') return 0.05 - 0.42 * u(x);
    if (mood === 'determinado') return 0.035 - 0.25 * u(x);
    if (mood === 'triste') return 0.05 + 0.4 * u(x);
    if (mood === 'tedio') return 0.01;
    if (mood === 'confuso' && side === 1) return 0.06 - 0.3 * u(x);
    return 1;
  };
  const scale = mood === 'confuso' ? (side === -1 ? 0.8 : 1.12) : 1;
  const s = new THREE.Shape(); const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = 2 * Math.PI * i / n; const x = Math.cos(t) * rx * scale; const y = Math.min(Math.sin(t) * ry * scale, cut(x));
    s[i ? 'lineTo' : 'moveTo'](x, y);
  }
  return s;
}

const Eye: React.FC<{ mood: Mood; side: -1 | 1; blink: number; look: number }> = ({ mood, side, blink, look }) => {
  const geo = useMemo(() => new THREE.ShapeGeometry(eyeShape(mood, side), 4), [mood, side]);
  return (
    <group position={[side * 0.27 + look * 0.05, -0.02, 1.04]} rotation={[0, side * 0.32, 0]} scale={[1, Math.max(0.06, blink), 1]}>
      <mesh geometry={geo} scale={1.45} position={[0, 0, -0.012]}><meshBasicMaterial color="#F5C518" transparent opacity={0.28} toneMapped={false} /></mesh>
      <mesh geometry={geo}><meshBasicMaterial color="#FFE45A" toneMapped={false} /></mesh>
    </group>
  );
};

export type Gesture = 'parado' | 'acenar' | 'apontar' | 'pular' | 'pensar';

/** Modelo do Nox 3D. `frame` dirige respiração, piscada e gesto; unidades em metros de cena (altura ~3,1). */
export const Nox3DModel: React.FC<{ frame: number; mood?: Mood; gesture?: Gesture; look?: number }> = ({ frame, mood = 'feliz', gesture = 'parado', look = 0 }) => {
  const m = useMemo(() => ({ ink: toon(INK), coat: toon('#2c2c33'), gold: toon('#F5C518'), boot: toon('#121217') }), []);
  const g = useMemo(() => ({
    hood: new THREE.SphereGeometry(1, 56, 40),
    tip: new THREE.ConeGeometry(0.36, 0.95, 32),
    face: new THREE.SphereGeometry(0.74, 48, 32),
    rim: new THREE.TorusGeometry(0.74, 0.07, 14, 64),
    collar: new THREE.TorusGeometry(0.56, 0.17, 18, 48),
    coat: new THREE.CylinderGeometry(0.56, 0.98, 1.45, 48),
    hem: new THREE.TorusGeometry(0.98, 0.05, 8, 48),
    arm: new THREE.CapsuleGeometry(0.17, 0.6, 8, 20),
    cuff: new THREE.TorusGeometry(0.19, 0.04, 10, 28),
    hand: new THREE.SphereGeometry(0.23, 28, 20),
    leg: new THREE.CylinderGeometry(0.16, 0.16, 0.42, 20),
    boot: new THREE.CapsuleGeometry(0.21, 0.26, 8, 20),
    emblem: new THREE.TorusGeometry(0.075, 0.016, 6, 3),
  }), []);
  const breathe = Math.sin(frame / 11) * 0.025;
  const blinkT = frame % 84; const blink = mood === 'feliz' || mood === 'piscada' ? 1 : blinkT < 5 ? Math.abs(blinkT - 2.5) / 2.5 : 1;
  const jump = gesture === 'pular' ? Math.abs(Math.sin(frame / 7)) * 0.55 : 0;
  const squash = gesture === 'pular' ? 1 - Math.max(0, 0.12 - jump) : 1;
  const wave = Math.sin(frame / 4.5);
  // Ombro direito (x>0) e esquerdo: rotação em z (abre) e x (para frente).
  const right: [number, number, number] = gesture === 'acenar' ? [0, 0, 2.5 + wave * 0.35] : gesture === 'apontar' ? [-1.35, 0, 0.55] : gesture === 'pensar' ? [-1.9, 0, 0.9] : gesture === 'pular' ? [0, 0, 2.3] : [0, 0, 0.32 + Math.sin(frame / 13) * 0.05];
  const left: [number, number, number] = gesture === 'pular' ? [0, 0, -2.3] : [0, 0, -0.32 - Math.sin(frame / 13) * 0.05];
  const headTilt = gesture === 'pensar' ? 0.18 : mood === 'confuso' ? 0.2 : mood === 'triste' ? -0.08 : 0;
  const headDrop = mood === 'triste' || mood === 'tedio' ? 0.12 : 0;
  return (
    <group position={[0, -0.15 + jump, 0]} scale={[1 / squash, squash, 1 / squash]}>
      <group position={[0, 1.15 + breathe, 0]} rotation={[headDrop, look * 0.35 + Math.sin(frame / 40) * 0.12, headTilt]}>
        <Inked geo={g.hood} mat={m.ink} scale={[1, 1.06, 0.96]} />
        <Inked geo={g.tip} mat={m.ink} position={[-0.18, 0.86, -0.38]} rotation={[-1.0, 0, 0.42]} />
        {/* rosto: oval vazio na frente do capuz, com a borda do capuz em volta */}
        <mesh geometry={g.face} position={[0, -0.06, 0.8]} scale={[0.92, 1, 0.3]}><meshBasicMaterial color="#020203" /></mesh>
        <mesh geometry={g.rim} material={m.ink} position={[0, -0.06, 0.84]} scale={[0.95, 1.03, 1]} />
        <Eye mood={mood} side={-1} blink={mood === 'piscada' ? 1 : blink} look={look} />
        <Eye mood={mood} side={1} blink={blink} look={look} />
      </group>
      <Inked geo={g.collar} mat={m.ink} position={[0, 0.33 + breathe * 0.5, 0.02]} rotation={[Math.PI / 2 - 0.15, 0, 0]} />
      <Inked geo={g.coat} mat={m.coat} position={[0, -0.42, 0]} />
      <mesh geometry={g.hem} position={[0, -1.14, 0]} rotation={[Math.PI / 2, 0, 0]}><meshBasicMaterial color="#000" /></mesh>
      <mesh geometry={g.emblem} position={[0.24, 0.02, 0.66]} rotation={[0.25, 0.3, Math.PI / 2]}><meshBasicMaterial color="#F5C518" toneMapped={false} /></mesh>
      {([[-1, left], [1, right]] as Array<[number, [number, number, number]]>).map(([s, rot]) => (
        <group key={s} position={[0.6 * s, 0.18, 0]} rotation={rot}>
          <Inked geo={g.arm} mat={m.coat} position={[0, -0.38, 0]} />
          <mesh geometry={g.cuff} material={m.gold} position={[0, -0.71, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <Inked geo={g.hand} mat={m.ink} position={[0, -0.9, 0]} scale={gesture === 'apontar' && s > 0 ? [0.85, 1.15, 0.85] : [1, 1, 1]} />
        </group>
      ))}
      {[-1, 1].map(s => (
        <group key={s} position={[0.3 * s, -1.28, 0]}>
          <mesh geometry={g.leg} material={m.ink} />
          <Inked geo={g.boot} mat={m.boot} position={[0, -0.3, 0.1]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  );
};

const Lights: React.FC = () => (
  <>
    <hemisphereLight args={['#f0f0f4', '#1c1c22', 1.5]} />
    <directionalLight position={[2.5, 4, 6]} intensity={3.2} />
    <directionalLight position={[-4, 2, 3]} intensity={0.9} color="#ffe9c4" />
    <pointLight position={[-2.6, 1.6, -1.8]} intensity={60} color={C.red} distance={6} />
    <pointLight position={[2.6, 1.6, -1.8]} intensity={60} color={C.blue} distance={6} />
  </>
);

/** Sombra de contato: elipse escura no chão. */
const Shadow: React.FC<{ y: number; scale?: number }> = ({ y, scale = 1 }) => (
  <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[scale, scale, 1]}>
    <circleGeometry args={[1.1, 40]} />
    <meshBasicMaterial color="#000" transparent opacity={0.45} />
  </mesh>
);

type Base = { len: number };

/** Nox 3D: cai em cena com quique, gira a câmera em volta dele e faz o gesto; texto opcional ao lado. */
export const Nox3DCena: React.FC<Base & { humor?: Mood; gesto?: Gesture; texto?: string; subtexto?: string; fundo?: 'estrelas' | 'explosao' | 'meio-tom' | 'papel' | 'escuro' | 'branco'; tom?: string; lado?: 'direita' | 'esquerda' }> = ({ len, humor = 'feliz', gesto = 'acenar', texto, subtexto, fundo = 'estrelas', tom, lado = 'direita' }) => {
  const frame = useCurrentFrame(); const { fps, width, height } = useVideoConfig();
  const drop = spring({ frame, fps, config: { damping: 9, mass: 0.8 } });
  const orbit = interpolate(frame, [0, len], [lado === 'direita' ? -0.5 : 0.5, lado === 'direita' ? 0.25 : -0.25], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const dolly = interpolate(frame, [0, len], [10.5, 8.8], clamp);
  const offset = texto ? (lado === 'direita' ? 2.3 : -2.3) : 0;
  return (
    <AbsoluteFill>
      <Background kind={fundo} tint={tom} />
      <ThreeCanvas width={width} height={height} camera={{ fov: 30, position: [0, 0.25, dolly] }}>
        <Rig position={[Math.sin(orbit) * dolly + offset, 0.35, Math.cos(orbit) * dolly]} target={[offset, -0.05, 0]} />
        <Lights />
        <group position={[0, (1 - drop) * 6, 0]} rotation={[0, -orbit * 0.6, 0]}>
          <Nox3DModel frame={frame} mood={humor} gesture={gesto} look={texto ? (lado === 'direita' ? -0.6 : 0.6) : 0} />
        </group>
        <Shadow y={-1.75} scale={0.6 + drop * 0.4} />
      </ThreeCanvas>
      {texto && (
        <div style={{ position: 'absolute', top: '24%', [lado === 'direita' ? 'right' : 'left']: 110, maxWidth: 820, transform: `scale(${pop(frame, 6)}) rotate(${lado === 'direita' ? 2 : -2}deg)`, textAlign: lado === 'direita' ? 'right' : 'left' } as React.CSSProperties}>
          <Punch size={150}>{texto}</Punch>
          {subtexto && frame >= 14 && <div style={{ marginTop: 26, fontFamily: ANTON, fontSize: 58, color: C.ink, background: C.yellow, display: 'inline-block', padding: '2px 22px', boxShadow: `8px 8px 0 ${C.ink}`, transform: `scale(${pop(frame, 14)})` }}>{subtexto}</div>}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Textura de imagem com delayRender: o frame só renderiza depois de a imagem carregar. */
const useImageTexture = (src?: string) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const advance = useThree(state => state.advance);
  const [handle] = useState(() => (src ? delayRender(`textura ${src}`) : null));
  useEffect(() => {
    if (!src || handle === null) return;
    new THREE.TextureLoader().load(src, tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; setTexture(tex); }, undefined, error => { console.error('textura não carregou', src, error); continueRender(handle); });
  }, [src, handle]);
  // O canvas do Remotion só desenha quando o frame muda: com a textura aplicada, desenhar e liberar o frame.
  React.useLayoutEffect(() => { if (texture && handle !== null) { advance(performance.now()); continueRender(handle); } }, [texture, handle, advance]);
  return texture;
};

const Panel3D: React.FC<{ src?: string; position: [number, number, number]; rotation: [number, number, number]; tint: string }> = ({ src, position, rotation, tint }) => {
  const texture = useImageTexture(src);
  const aspect = texture?.image ? (texture.image as HTMLImageElement).width / (texture.image as HTMLImageElement).height : 16 / 9;
  const h = 2.6; const w = Math.min(4.8, h * aspect);
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0.16, -0.16, -0.06]}><planeGeometry args={[w + 0.3, h + 0.3]} /><meshBasicMaterial color={tint} /></mesh>
      <mesh position={[0, 0, -0.02]}><planeGeometry args={[w + 0.24, h + 0.24]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh><planeGeometry args={[w, h]} />{texture ? <meshBasicMaterial key="tex" map={texture} toneMapped={false} /> : <meshBasicMaterial key="plain" color="#22222b" />}</mesh>
    </group>
  );
};

/**
 * Voo de câmera por painéis HQ no espaço: cada painel é uma mídia da obra, em zigue-zague e
 * profundidade; a câmera para em cada um enquanto o rótulo entra. Só imagens.
 */
export const Paineis3D: React.FC<Base & { paineis: Array<{ midia?: string; rotulo?: string }>; conclusao?: string; fundo?: 'estrelas' | 'meio-tom' | 'escuro'; tom?: string }> = ({ len, paineis, conclusao, fundo = 'estrelas', tom }) => {
  const frame = useCurrentFrame(); const { width, height } = useVideoConfig();
  const assets = useContext(Assets);
  const n = Math.max(1, paineis.length);
  const gap = 7; const tints = [C.yellow, C.red, C.blue];
  const place = (i: number): [number, number, number] => [(i % 2 ? 1 : -1) * 1.5, (i % 3 - 1) * 0.35, -i * gap];
  const step = len / n; const i = Math.min(n - 1, Math.floor(frame / step)); const local = frame - i * step;
  // Câmera viaja do painel anterior ao atual nos primeiros 40% do passo e deriva devagar no resto.
  const travel = interpolate(local, [0, step * 0.4], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const from = place(Math.max(0, i - 1)); const to = place(i);
  const lerp = (a: number, b: number) => (i === 0 ? b : a + (b - a) * travel);
  const drift = (local / Math.max(1, step)) * 0.5;
  const cam: [number, number, number] = [lerp(from[0], to[0]) * 0.75, lerp(from[1], to[1]), lerp(from[2], to[2]) + 5.2 - drift];
  const current = paineis[i];
  return (
    <AbsoluteFill>
      <Background kind={fundo} tint={tom} />
      <ThreeCanvas width={width} height={height} camera={{ fov: 42, position: cam }}>
        <Rig position={cam} target={[cam[0] * 0.9, cam[1], cam[2] - 6]} />
        {paineis.map((panel, k) => {
          const id = panel.midia?.startsWith('media:') ? panel.midia.slice(6) : panel.midia;
          return <Panel3D key={k} src={id ? assets[id]?.src : undefined} position={place(k)} rotation={[0, (k % 2 ? -1 : 1) * 0.22, (k % 2 ? 1 : -1) * 0.04]} tint={tints[k % 3]} />;
        })}
      </ThreeCanvas>
      {current?.rotulo && local > step * 0.3 && (
        <div style={{ position: 'absolute', left: 120, bottom: 110, transform: `translateX(${(1 - slide(local, step * 0.3, 8)) * -500}px) rotate(-2deg)` }}>
          <span style={{ fontFamily: ANTON, fontSize: 70, color: C.ink, background: C.yellow, padding: '4px 26px', boxShadow: `10px 10px 0 ${C.ink}`, textTransform: 'uppercase' }}>{current.rotulo}</span>
        </div>
      )}
      {conclusao && i === n - 1 && local > step * 0.65 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `scale(${pop(local, step * 0.65)})` }}><Punch size={150} color={C.yellow}>{conclusao}</Punch></AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const SCENES_3D: Record<string, React.FC<any>> = { nox3d: Nox3DCena, paineis3d: Paineis3D };
