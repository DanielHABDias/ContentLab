import { z } from 'zod';
import kitCatalog from '../motion/kit/catalog.json' with { type: 'json' };

export const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/);
export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);
export const stageStateSchema = z.enum(['pending', 'active', 'changes_requested', 'approved', 'invalidated']);

// Embalagem (título e thumbnail) antes do roteiro: o roteiro cumpre o que eles prometem.
export const FLOW_STAGES = ['brief', 'packaging', 'script', 'media', 'narration', 'edit', 'review'];

/**
 * Põe as etapas na ordem de FLOW_STAGES, refaz as dependências e deixa ativa só a primeira etapa
 * não aprovada cujas dependências estão aprovadas. Migra projetos com a ordem antiga (roteiro antes
 * da embalagem) sem perder aprovações.
 */
export function normalizeStages(stages) {
  const byId = new Map(stages.map(stage => [stage.id, stage]));
  const ordered = [...FLOW_STAGES.filter(id => byId.has(id)).map(id => byId.get(id)), ...stages.filter(stage => !FLOW_STAGES.includes(stage.id))];
  const result = ordered.map((stage, index) => ({ ...stage, dependsOn: index ? [ordered[index - 1].id] : [] }));
  const approved = id => result.find(stage => stage.id === id)?.state === 'approved';
  let opened = false;
  for (const stage of result) {
    if (stage.state === 'approved') continue;
    const ready = stage.dependsOn.every(approved);
    if (!ready && ['active', 'changes_requested'].includes(stage.state)) stage.state = 'pending';
    else if (ready && !opened && stage.state === 'pending') stage.state = 'active';
    if (ready) opened = true;
  }
  return result;
}

export const workflowStageSchema = z.object({
  id: idSchema,
  state: stageStateSchema,
  revision: z.number().int().nonnegative(),
  approvedRevision: z.number().int().nonnegative().nullable(),
  dependsOn: z.array(idSchema).default([]),
});

export const changeRequestSchema = z.object({
  id: idSchema,
  stageId: idSchema,
  reason: z.string().min(1),
  author: z.string().min(1).max(120),
  requestedRevision: z.number().int().positive(),
  requestedAt: z.string(),
  status: z.enum(['open', 'resolved']),
  resolution: z.string().min(1).nullable(),
  resolvedRevision: z.number().int().positive().nullable(),
  resolvedAt: z.string().nullable(),
});

export const workflowJobSchema = z.object({
  id: idSchema,
  stageId: idSchema,
  state: z.enum(['waiting_input', 'waiting_rights', 'waiting_consent', 'waiting_cost', 'waiting_approval', 'completed', 'failed']),
  baseRevision: z.number().int().positive(),
  operationId: idSchema,
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  log: z.array(z.string()).max(20),
  stopReason: z.enum(['missing_artifacts', 'rights', 'consent', 'cost', 'approval']).nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
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
  source: z.object({ type: z.enum(['file', 'url', 'upload', 'generated']), value: z.string().max(4096) }).optional(),
  role: z.enum(['content', 'thumbnail', 'slide', 'narration', 'music', 'sfx', 'background', 'character']).optional(),
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

/** Valor JSON de prop de componente (cenas do plugin usam listas e objetos), com profundidade limitada. */
const componentValue = z.lazy(() => z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null(), z.array(componentValue).max(64), z.record(z.string().max(64), componentValue)]));

export const clipSchema = z.object({
  id: idSchema,
  type: z.enum(['media', 'text', 'shape', 'caption', 'component']),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  sourceId: idSchema.optional(),
  // Migração: as cenas HQ embutidas tinham o prefixo `dv_` até a 2.1; hoje é `hq_`.
  componentId: z.preprocess(value => (typeof value === 'string' && value.startsWith('dv_') ? `hq_${value.slice(3)}` : value), idSchema).optional(),
  componentProps: z.record(z.string(), componentValue).refine(value => JSON.stringify(value).length <= 64_000, 'Props de componente grandes demais').default({}),
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

/**
 * Plano de motion (roteiro em beats do kit de motion do Content Lab): o vídeo inteiro vira uma composição Remotion única.
 * Tempos em segundos; props das cenas são JSON e citam mídia como `media:<id>`.
 */
const motionValue = z.lazy(() => z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null(), z.array(motionValue).max(40), z.record(z.string().max(64), motionValue)]));
export const MOTION_SCENES = ['titulo', 'frase', 'personagem', 'evidencia', 'pagina', 'numero', 'ficha', 'formula', 'lista', 'comparacao', 'cta', 'aparte', 'paineis3d'];
/** Nomes de SFX do kit (lista `sfx` de src/motion/kit/catalog.json; o arquivo fica em assets/kit/sfx). */
export const MOTION_SFX = kitCatalog.sfx;
export const motionBeatSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/i),
  // Migração de projetos antigos: a cena do personagem se chamava `nox` (contentlab-motion-v1 até a 2.1).
  scene: z.preprocess(value => (value === 'nox' ? 'personagem' : value), z.enum(MOTION_SCENES)),
  at: z.number().min(0).max(7200),
  duration: z.number().min(0.2).max(120),
  props: z.record(z.string().max(64), motionValue).default({}),
  sfx: z.array(z.object({ name: z.enum(MOTION_SFX), at: z.number().min(-2).max(120).default(0), volume: z.number().min(0).max(1).default(0.5) })).max(16).default([]),
  flash: z.boolean().default(true),
  legenda: z.boolean().optional(),
  // Por cima da cena: caixinhas HQ de lembrete e recortes PNG do que está sendo falado (tempos relativos ao beat).
  extras: z.array(z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('caixinha'), preset: z.enum(['inscricao', 'like', 'sininho', 'opiniao', 'spoiler', 'fonte', 'comenta', 'livre']).default('inscricao'), texto: z.string().max(40).optional(), canto: z.enum(['superior-esquerdo', 'superior-direito', 'inferior-esquerdo', 'inferior-direito']).optional(), at: z.number().min(0).max(120).default(0), duracao: z.number().min(0.5).max(10).default(3) }),
    z.object({ tipo: z.literal('recorte'), midia: z.string().regex(/^media:[\w.-]+$/), lado: z.enum(['esquerda', 'direita', 'centro']).optional(), tamanho: z.number().min(0.1).max(0.9).optional(), at: z.number().min(0).max(120).default(0), duracao: z.number().min(0.3).max(30).optional(), giro: z.number().min(-45).max(45).optional() }),
  ])).max(6).optional(),
});
export const motionPlanSchema = z.object({
  schema: z.literal('contentlab-motion-v1'),
  beats: z.array(motionBeatSchema).min(1).max(600),
  narration: z.boolean().default(true),
  captions: z.boolean().default(true),
  music: z.object({ volume: z.number().min(0).max(1).default(0.5), duck: z.number().min(0).max(1).default(0.25) }).nullable().default({ volume: 0.5, duck: 0.25 }),
  source: z.enum(['auto', 'agent', 'user']).default('agent'),
}).superRefine((plan, ctx) => {
  const ids = new Set();
  for (const [index, beat] of plan.beats.entries()) {
    if (ids.has(beat.id)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'id'], message: `id repetido: ${beat.id}` });
    ids.add(beat.id);
    const previous = plan.beats[index - 1];
    if (previous && beat.at < previous.at + previous.duration - 0.05) ctx.addIssue({ code: 'custom', path: ['beats', index, 'at'], message: `beat ${beat.id} começa antes do fim de ${previous.id}` });
  }
});

/**
 * Personagem do projeto (pacote importado com `character_import`): poses em PNG prontos, guardados como
 * mídia com papel `character`, e o catálogo pose → arquivos, gesto e tons. O plano automático e o kit
 * escolhem a pose pelo tom da fala; sem personagem, o plano não tem apartes nem a cena `personagem`.
 */
export const POSE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
export const characterSchema = z.object({
  schema: z.literal('contentlab-character-v1'),
  name: z.string().min(1).max(80),
  tons: z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), z.string().max(200)).default({}),
  poses: z.record(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), z.object({
    arquivos: z.array(z.string().regex(POSE_FILE)).min(1).max(12),
    gesto: z.string().max(300).default(''),
    olhos: z.string().max(200).optional(),
    tons: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(16).default([]),
  })).refine(value => Object.keys(value).length >= 1 && Object.keys(value).length <= 80, 'De 1 a 80 poses'),
  /** Arquivo da pose → id da mídia no projeto. */
  files: z.record(z.string().regex(POSE_FILE), idSchema),
  importedAt: z.string(),
});

export const projectSchema = z.object({
  schema: z.literal('contentlab-project-v1'),
  id: idSchema,
  title: z.string().min(1),
  type: z.enum(['long', 'short', 'custom']),
  aspectRatio: aspectRatioSchema,
  mode: z.enum(['review', 'autonomous']),
  // Fluxo combinado com a pessoa: etapas em que o agente para mesmo no modo autônomo, e quem grava a narração.
  pauseAt: z.array(z.enum(FLOW_STAGES)).default([]),
  // Decidido na etapa Narração, não ao criar o projeto: `null` = ainda não escolhido.
  narrationBy: z.enum(['ai', 'creator']).nullable().default(null),
  revision: z.number().int().positive(),
  stages: z.array(workflowStageSchema).transform(normalizeStages),
  changeRequests: z.array(changeRequestSchema).default([]),
  workflowJobs: z.array(workflowJobSchema).default([]),
  media: z.array(mediaRefSchema),
  timeline: timelineSchema,
  motion: motionPlanSchema.nullable().default(null),
  character: characterSchema.nullable().default(null),
  creative: z.object({
    brief: z.object({ thesis: z.string(), audience: z.string(), promise: z.string(), notes: z.string() }),
    script: z.object({ hook: z.string(), development: z.string(), payoff: z.string(), visual: z.string(), sources: z.string() }),
    packaging: z.object({ titleA: z.string(), titleB: z.string(), description: z.string(), tags: z.string(), seo: z.string(), thumbnailMediaId: idSchema.nullable(), thumbnailA: idSchema.nullable().default(null), thumbnailB: idSchema.nullable().default(null) }),
  }).default({
    brief: { thesis: '', audience: '', promise: '', notes: '' },
    script: { hook: '', development: '', payoff: '', visual: '', sources: '' },
    packaging: { titleA: '', titleB: '', description: '', tags: '', seo: '', thumbnailMediaId: null, thumbnailA: null, thumbnailB: null },
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
    z.object({ type: z.literal('stage.approve'), stageId: idSchema, expectedRevision: z.number().int().nonnegative(), author: z.string().min(1).max(120).default('usuário') }),
    z.object({ type: z.literal('stage.reopen'), stageId: idSchema, reason: z.string().min(1), author: z.string().min(1).max(120).default('usuário'), requestId: idSchema.optional() }),
    z.object({ type: z.literal('stage.request_changes'), stageId: idSchema, reason: z.string().min(1), author: z.string().min(1).max(120).default('usuário'), requestId: idSchema.optional() }),
    z.object({ type: z.literal('workflow.run'), stageId: idSchema.optional(), jobId: idSchema, author: z.string().min(1).max(120).default('Content Lab') }),
    z.object({ type: z.literal('project.update'), title: z.string().min(1).optional(), projectType: z.enum(['long', 'short', 'custom']).optional(), aspectRatio: aspectRatioSchema.optional(), mode: z.enum(['review', 'autonomous']).optional(), pauseAt: z.array(z.enum(FLOW_STAGES)).optional(), narrationBy: z.enum(['ai', 'creator']).nullable().optional() }),
    z.object({ type: z.literal('creative.update'), creative: projectSchema.shape.creative }),
    z.object({ type: z.literal('motion.set'), motion: motionPlanSchema.nullable() }),
    z.object({ type: z.literal('character.set'), character: characterSchema.nullable() }),
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
