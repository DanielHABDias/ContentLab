import { z } from 'zod';
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const box = z.object({ x: z.number().min(-1280).max(1280), y: z.number().min(-720).max(720), width: z.number().positive().max(2560), height: z.number().positive().max(2160) });
export const thumbnailVariantSchema = z.object({
  label: z.enum(['A', 'B']), title: z.string().optional(), text: z.string().max(100).optional(),
  mediaId: z.string().optional(), mediaIdB: z.string().optional(),
  humor: z.enum(['bravo', 'feliz', 'surpreso', 'tedio', 'confuso', 'piscada', 'determinado', 'triste']).optional(),
  side: z.enum(['esquerda', 'direita']).optional(), tone: z.enum(['amarelo', 'vermelho', 'azul', 'branco', 'verde']).optional(),
  badge: z.string().max(18).optional(), layout: z.enum(['lado', 'centro', 'palavra']).optional(),
  outline: z.enum(['branco', 'cor']).optional(), texture: z.enum(['tv', 'halftone', 'nenhuma']).optional(),
  backgroundMediaId: z.string().optional(), textY: z.number().min(.15).max(.85).optional(),
  focus: z.string().max(20).optional(), pose: z.string().max(40).optional(), zoom: z.number().min(.5).max(3).optional(),
  background: z.enum(['preto', 'branco', 'cena', 'quadrinhos']).optional(), frameSeconds: z.number().nonnegative().optional(),
  backgroundEffects: z.object({ blur: z.number().min(0).max(40).optional(), brightness: z.number().min(0).max(2).optional(), saturation: z.number().min(0).max(2).optional(), vignette: z.number().min(0).max(1).optional() }).optional(),
  halftone: z.object({ spacing: z.number().min(3).max(50).optional(), radius: z.number().min(.05).max(.45).optional(), opacity: z.number().min(0).max(1).optional(), color: hex.optional(), full: z.boolean().optional() }).optional(),
  border: z.object({ width: z.number().min(0).max(30), radius: z.number().min(0).max(120).optional(), colors: z.array(hex).min(1).max(6), angle: z.number().min(0).max(360).optional(), stops: z.array(z.number().min(0).max(100)).min(1).max(6).optional() }).refine(v => !v.stops || (v.stops.length === v.colors.length && v.stops.every((s,i) => i === 0 || s >= v.stops[i-1])), 'As posições do gradiente devem corresponder às cores, em ordem crescente.').optional(),
  subject: box.optional(),
  textStyle: z.object({ size: z.number().min(20).max(500).optional(), letterSpacing: z.number().min(-10).max(30).optional() }).optional(),
  foregroundText: z.object({ text: z.string().min(1).max(60), x: z.number().min(0).max(1280), y: z.number().min(0).max(720), width: z.number().positive().max(1280), size: z.number().min(20).max(300), letterSpacing: z.number().min(-10).max(30).optional(), stretch: z.number().min(.5).max(2).optional(), tone: z.enum(['amarelo', 'vermelho', 'azul', 'branco', 'verde']).optional() }).optional(),
});

/** A API e o MCP usam o mesmo contrato; as medidas de estilo são relativas a1280×720. */
export function thumbnailProps(v) {
  return { label: v.label, texto: String(v.text || v.title || '').toUpperCase().replace(/\s*\/\s*/g, '\n'), midia: v.mediaId ? `media:${v.mediaId}` : undefined, midiaB: v.mediaIdB ? `media:${v.mediaIdB}` : undefined,
    humor: v.humor, lado: v.side, tom: v.tone, selo: v.badge, fundo: v.background, layout: v.layout, foco: v.focus, pose: v.pose, zoom: v.zoom, textura: v.texture, midiaFundo: v.backgroundMediaId ? `media:${v.backgroundMediaId}` : undefined, alturaTexto: v.textY, contorno: v.outline,
    backgroundEffects: v.backgroundEffects, halftone: v.halftone, border: v.border, subject: v.subject, textStyle: v.textStyle, foregroundText: v.foregroundText };
}
