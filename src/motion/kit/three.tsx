import React, { useContext, useEffect, useState } from 'react';
import { ThreeCanvas, useOffthreadVideoTexture } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { AbsoluteFill, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import * as THREE from 'three';
import { ANTON, C, Punch, pop, slide } from './fx';
import { Assets, Background } from './scenes';

/*
 * Cenas 3D do kit (Three.js via @remotion/three). O render precisa de WebGL: o editor usa
 * `chromiumOptions.gl = "swangle"` quando o plano tem cena 3D. Padrão para novas cenas 3D:
 * tempos por useCurrentFrame(), câmera posicionada a cada frame (Rig) e texturas com delayRender.
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** A prop `camera` do canvas só vale na criação: a câmera animada é posicionada a cada frame aqui. */
const Rig: React.FC<{ position: [number, number, number]; target: [number, number, number] }> = ({ position, target }) => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  React.useLayoutEffect(() => { camera.position.set(...position); camera.lookAt(...target); camera.updateProjectionMatrix(); invalidate(); }, [camera, invalidate, ...position, ...target]);
  return null;
};
type Base = { len: number };

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

type PanelProps = { position: [number, number, number]; rotation: [number, number, number]; tint: string };
const PanelMesh: React.FC<PanelProps & { texture: THREE.Texture | null; aspect: number }> = ({ texture, aspect, position, rotation, tint }) => {
  const h = 2.6; const w = Math.min(4.8, h * aspect);
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0.16, -0.16, -0.06]}><planeGeometry args={[w + 0.3, h + 0.3]} /><meshBasicMaterial color={tint} /></mesh>
      <mesh position={[0, 0, -0.02]}><planeGeometry args={[w + 0.24, h + 0.24]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh><planeGeometry args={[w, h]} />{texture ? <meshBasicMaterial key="tex" map={texture} toneMapped={false} /> : <meshBasicMaterial key="plain" color="#22222b" />}</mesh>
    </group>
  );
};
const ImagePanel: React.FC<PanelProps & { src?: string }> = ({ src, ...rest }) => {
  const texture = useImageTexture(src);
  const image = texture?.image as HTMLImageElement | undefined;
  return <PanelMesh texture={texture} aspect={image?.width ? image.width / image.height : 16 / 9} {...rest} />;
};
/** Vídeo da obra como textura, quadro a quadro (o painel antes ficava vazio com vídeo). */
const VideoPanel: React.FC<PanelProps & { src: string; w?: number; h?: number }> = ({ src, w, h, ...rest }) => {
  const texture = useOffthreadVideoTexture({ src });
  const advance = useThree(state => state.advance);
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  // Como na imagem: o canvas só desenha quando o frame muda, então desenhar assim que o quadro do vídeo chega.
  React.useLayoutEffect(() => { if (texture) advance(performance.now()); }, [texture, advance]);
  return <PanelMesh texture={texture} aspect={w && h ? w / h : 16 / 9} {...rest} />;
};
const Panel3D: React.FC<PanelProps & { asset?: { src: string; kind: 'image' | 'video'; w?: number; h?: number } }> = ({ asset, ...rest }) =>
  asset?.kind === 'video' ? <VideoPanel src={asset.src} w={asset.w} h={asset.h} {...rest} /> : <ImagePanel src={asset?.src} {...rest} />;

/**
 * Voo de câmera por painéis HQ no espaço: cada painel é uma mídia da obra, em zigue-zague e
 * profundidade; a câmera para em cada um enquanto o rótulo entra. Aceita imagem ou vídeo.
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
          return <Panel3D key={k} asset={id ? assets[id] : undefined} position={place(k)} rotation={[0, (k % 2 ? -1 : 1) * 0.22, (k % 2 ? 1 : -1) * 0.04]} tint={tints[k % 3]} />;
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

export const SCENES_3D: Record<string, React.FC<any>> = { paineis3d: Paineis3D };
