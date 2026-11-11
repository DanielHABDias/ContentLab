import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/);
export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);
export const stageStateSchema = z.enum(['pending', 'active', 'changes_requested', 'approved', 'invalidated']);

export const workflowStageSchema = z.object({
  id: idSchema,
  state: stageStateSchema,
  revision: z.number().int().nonnegative(),
  approvedRevision: z.number().int().nonnegative().nullable(),
  dependsOn: z.array(idSchema).default([]),
});

export const mediaCutSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  uri: z.string().min(1),
  createdAt: z.string(),
});

export const mediaRefSchema = z.object({
  id: idSchema,
  kind: z.enum(['video', 'audio', 'image', 'subtitle', 'font']),
  uri: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  rights: z.enum(['owned', 'licensed', 'authorized', 'pending']),
  name: z.string().max(255).optional(),
  source: z.object({ type: z.enum(['file', 'url', 'upload']), value: z.string().max(4096) }).optional(),
  importedAt: z.string().optional(),
  metadata: z.object({
    durationSeconds: z.number().nonnegative().nullable(),
    sizeBytes: z.number().int().nonnegative().nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    videoCodec: z.string().nullable(),
    audioCodec: z.string().nullable(),
    sampleRate: z.number().int().positive().nullable(),
  }).optional(),
  cuts: z.array(mediaCutSchema).default([]),
  transcript: z.object({ status: z.enum(['raw', 'revised']), model: z.string(), language: z.string(), segments: z.number().int().nonnegative(), updatedAt: z.string() }).nullable().default(null),
});

const keyframeSchema = z.object({
  frame: z.number().int().nonnegative(),
  value: z.union([z.number(), z.string(), z.boolean(), z.array(z.number())]),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('linear'),
});

export const clipSchema = z.object({
  id: idSchema,
  type: z.enum(['media', 'text', 'shape', 'caption', 'component']),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  sourceId: idSchema.optional(),
  componentId: idSchema.optional(),
  fit: z.enum(['cover', 'contain', 'stretch']).default('cover'),
  anchor: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
  layout: z.partialRecord(aspectRatioSchema, z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })).optional(),
  keyframes: z.record(z.string(), z.array(keyframeSchema)).default({}),
  effects: z.array(z.object({ id: idSchema, type: z.string().min(1), enabled: z.boolean().default(true), params: z.record(z.string(), z.unknown()).default({}) })).default([]),
  /** Ponto de entrada na mídia (frames do projeto): corte sem alterar o arquivo. */
  sourceInFrame: z.number().int().nonnegative().default(0),
  name: z.string().max(120).optional(),
  text: z.string().max(2000).optional(),
  volume: z.number().min(0).max(4).default(1),
  style: z.enum(['legenda', 'destaque', 'titulo']).default('legenda'),
});

export const trackSchema = z.object({
  id: idSchema,
  kind: z.enum(['visual', 'audio', 'caption']),
  name: z.string().min(1),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
  clips: z.array(clipSchema),
});

export const timelineSchema = z.object({
  schema: z.literal('contentlab-timeline-v1'),
  fps: z.number().int().min(1).max(120),
  durationInFrames: z.number().int().positive(),
  aspectRatio: aspectRatioSchema,
  safeArea: z.object({ top: z.number().min(0).max(1), right: z.number().min(0).max(1), bottom: z.number().min(0).max(1), left: z.number().min(0).max(1) }),
  tracks: z.array(trackSchema),
});

export const projectSchema = z.object({
  schema: z.literal('contentlab-project-v1'),
  id: idSchema,
  title: z.string().min(1),
  type: z.enum(['long', 'short', 'custom']),
  aspectRatio: aspectRatioSchema,
  mode: z.enum(['review', 'autonomous']),
  revision: z.number().int().positive(),
  stages: z.array(workflowStageSchema),
  media: z.array(mediaRefSchema),
  timeline: timelineSchema,
  creative: z.object({
    brief: z.object({ thesis: z.string(), audience: z.string(), promise: z.string(), notes: z.string() }),
    script: z.object({ hook: z.string(), development: z.string(), payoff: z.string(), visual: z.string(), sources: z.string() }),
    packaging: z.object({ titleA: z.string(), titleB: z.string(), description: z.string(), tags: z.string(), seo: z.string(), thumbnailMediaId: idSchema.nullable() }),
  }).default({
    brief: { thesis: '', audience: '', promise: '', notes: '' },
    script: { hook: '', development: '', payoff: '', visual: '', sources: '' },
    packaging: { titleA: '', titleB: '', description: '', tags: '', seo: '', thumbnailMediaId: null },
  }),
});

export const operationSchema = z.object({
  schema: z.literal('contentlab-operation-v1'),
  operationId: idSchema,
  projectId: idSchema,
  baseRevision: z.number().int().positive(),
  dryRun: z.boolean().default(false),
  actions: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('clip.add'), trackId: idSchema, clip: clipSchema }),
    z.object({ type: z.literal('clip.remove'), trackId: idSchema, clipId: idSchema }),
    z.object({ type: z.literal('clip.move'), trackId: idSchema, clipId: idSchema, startFrame: z.number().int().nonnegative() }),
    z.object({ type: z.literal('stage.approve'), stageId: idSchema, expectedRevision: z.number().int().nonnegative() }),
    z.object({ type: z.literal('stage.reopen'), stageId: idSchema, reason: z.string().min(1) }),
    z.object({ type: z.literal('stage.request_changes'), stageId: idSchema, reason: z.string().min(1) }),
    z.object({ type: z.literal('project.update'), title: z.string().min(1).optional(), projectType: z.enum(['long', 'short', 'custom']).optional(), aspectRatio: aspectRatioSchema.optional(), mode: z.enum(['review', 'autonomous']).optional() }),
    z.object({ type: z.literal('creative.update'), creative: projectSchema.shape.creative }),
    z.object({ type: z.literal('media.add'), media: mediaRefSchema }),
    z.object({ type: z.literal('media.remove'), mediaId: idSchema, detachUsages: z.boolean().default(false) }),
    z.object({ type: z.literal('media.cut.add'), mediaId: idSchema, cut: mediaCutSchema }),
    z.object({ type: z.literal('media.cut.remove'), mediaId: idSchema, cutId: idSchema }),
    z.object({ type: z.literal('timeline.edit'), commands: z.array(timelineCommandSchema()).min(1).max(500) }),
    z.object({ type: z.literal('timeline.replace'), timeline: z.lazy(() => timelineSchema), reason: z.enum(['undo', 'redo', 'restore']) }),
    z.object({ type: z.literal('media.transcript.set'), mediaId: idSchema, transcript: mediaRefSchema.shape.transcript }),
  ])).min(1).max(100),
});

/** Comandos de edição da timeline (aplicados em ordem, validados no fim). */
function timelineCommandSchema() {
  const ref = { trackId: idSchema, clipId: idSchema };
  const patch = z.object({ fit: clipSchema.shape.fit.optional(), anchor: clipSchema.shape.anchor.optional(), layout: clipSchema.shape.layout, keyframes: clipSchema.shape.keyframes.optional(), effects: clipSchema.shape.effects.optional(), text: z.string().max(2000).optional(), name: z.string().max(120).optional(), volume: z.number().min(0).max(4).optional(), style: clipSchema.shape.style.optional() }).strict();
  return z.discriminatedUnion('op', [
    z.object({ op: z.literal('clip.add'), trackId: idSchema, clip: clipSchema }),
    z.object({ op: z.literal('clip.update'), ...ref, patch }),
    z.object({ op: z.literal('clip.move'), ...ref, startFrame: z.number().int().nonnegative(), toTrackId: idSchema.optional() }),
    z.object({ op: z.literal('clip.trim'), ...ref, startFrame: z.number().int().nonnegative(), durationInFrames: z.number().int().positive(), sourceInFrame: z.number().int().nonnegative().optional(), ripple: z.boolean().default(false) }),
    z.object({ op: z.literal('clip.split'), ...ref, frame: z.number().int().positive(), newClipId: idSchema }),
    z.object({ op: z.literal('clip.remove'), ...ref, ripple: z.boolean().default(false) }),
    z.object({ op: z.literal('track.add'), track: trackSchema }),
    z.object({ op: z.literal('track.update'), trackId: idSchema, name: z.string().min(1).max(80).optional(), muted: z.boolean().optional(), locked: z.boolean().optional() }),
    z.object({ op: z.literal('timeline.update'), durationInFrames: z.number().int().positive().optional(), safeArea: timelineSchema.shape.safeArea.optional() }),
  ]);
}

export function parseProject(value) { return projectSchema.parse(value); }
export function parseOperation(value) { return operationSchema.parse(value); }
