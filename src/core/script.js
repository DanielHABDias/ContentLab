import { z } from 'zod';

const scriptId = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/);
export const BLOCK_LABELS = { narration: 'Narração', scene: 'Cena / som original', direction: 'Direção visual' };
export const scriptBlockSchema = z.object({
  id: scriptId, type: z.enum(['narration', 'scene', 'direction']),
  title: z.string().max(200).default(''), text: z.string().default(''),
});
export const scriptChapterSchema = z.object({
  id: scriptId, title: z.string().max(200).default(''), blocks: z.array(scriptBlockSchema).max(1000),
});
export const scriptChaptersSchema = z.array(scriptChapterSchema).max(200).superRefine((chapters, ctx) => {
  const ids = new Set();
  for (const chapter of chapters) for (const item of [chapter, ...chapter.blocks]) {
    if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: `ID repetido no roteiro: ${item.id}` });
    ids.add(item.id);
  }
});

/** Roteiros antigos continuam legíveis; a primeira edição em blocos preserva seus textos e IDs de takes. */
export function scriptChapters(script = {}) {
  if (Array.isArray(script.chapters)) return script.chapters;
  const chapters = Object.entries({ hook: 'Abertura', development: 'Desenvolvimento', payoff: 'Payoff' }).map(([key, title]) => ({
    id: `chapter-${key}`, title,
    blocks: String(script[key] || '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean).map((text, i) => ({ id: `${key}-${i + 1}`, type: 'narration', title: '', text })),
  })).filter(chapter => chapter.blocks.length);
  if (script.visual?.trim()) chapters.push({ id: 'chapter-visual', title: 'Direção visual', blocks: [{ id: 'legacy-visual', type: 'direction', title: '', text: script.visual }] });
  return chapters;
}

export function scriptMarkdown(script = {}) {
  return [...scriptChapters(script).map(chapter => `## ${chapter.title || 'Capítulo'}\n\n${chapter.blocks.map(block => `### ${BLOCK_LABELS[block.type]}${block.title ? ` — ${block.title}` : ''}${block.type !== 'narration' ? ' — NÃO NARRAR' : ''}\n\n${block.text}`).join('\n\n')}`),
    ...(script.sources?.trim() ? [`## Fontes — NÃO NARRAR\n\n${script.sources}`] : []),
  ].join('\n\n');
}

export const scriptEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('chapter.add'), chapter: scriptChapterSchema, beforeId: scriptId.optional() }),
  z.object({ op: z.literal('chapter.update'), chapterId: scriptId, title: z.string().max(200) }),
  z.object({ op: z.literal('chapter.remove'), chapterId: scriptId }),
  z.object({ op: z.literal('chapter.move'), chapterId: scriptId, beforeId: scriptId.optional() }),
  z.object({ op: z.literal('block.add'), chapterId: scriptId, block: scriptBlockSchema, beforeId: scriptId.optional() }),
  z.object({ op: z.literal('block.update'), blockId: scriptId, changes: scriptBlockSchema.omit({ id: true }).partial() }),
  z.object({ op: z.literal('block.remove'), blockId: scriptId }),
  z.object({ op: z.literal('block.move'), blockId: scriptId, chapterId: scriptId, beforeId: scriptId.optional() }),
]);

/** Lote puro e atômico: IDs estáveis, ordem explícita; beforeId omitido significa o fim. */
export function editScript(script, operations) {
  const chapters = structuredClone(scriptChapters(script));
  const chapter = id => { const found = chapters.find(item => item.id === id); if (!found) throw new Error(`Capítulo desconhecido: ${id}`); return found; };
  const locate = id => { for (const parent of chapters) { const index = parent.blocks.findIndex(item => item.id === id); if (index >= 0) return { parent, index, block: parent.blocks[index] }; } throw new Error(`Bloco desconhecido: ${id}`); };
  const insert = (items, item, beforeId) => { const index = beforeId === undefined ? items.length : items.findIndex(candidate => candidate.id === beforeId); if (index < 0) throw new Error(`Destino desconhecido: ${beforeId}`); items.splice(index, 0, item); };
  for (const raw of operations) {
    const action = scriptEditSchema.parse(raw);
    if (action.op === 'chapter.add') insert(chapters, action.chapter, action.beforeId);
    if (action.op === 'chapter.update') chapter(action.chapterId).title = action.title;
    if (action.op === 'chapter.remove') chapters.splice(chapters.indexOf(chapter(action.chapterId)), 1);
    if (action.op === 'chapter.move') {
      const item = chapter(action.chapterId);
      if (action.beforeId === item.id) continue;
      chapters.splice(chapters.indexOf(item), 1); insert(chapters, item, action.beforeId);
    }
    if (action.op === 'block.add') insert(chapter(action.chapterId).blocks, action.block, action.beforeId);
    if (action.op === 'block.update') Object.assign(locate(action.blockId).block, action.changes);
    if (action.op === 'block.remove') { const { parent, index } = locate(action.blockId); parent.blocks.splice(index, 1); }
    if (action.op === 'block.move') {
      const { parent, index, block } = locate(action.blockId); const target = chapter(action.chapterId);
      if (target === parent && action.beforeId === block.id) continue;
      parent.blocks.splice(index, 1); insert(target.blocks, block, action.beforeId);
    }
    scriptChaptersSchema.parse(chapters);
  }
  return { ...script, chapters };
}
