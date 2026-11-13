import { execFileSync } from 'node:child_process';
import { BUNDLED_COMPONENTS } from '../timeline/components/catalog.js';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { LocalApplicationService } from './local-application-service.js';
import { TranscriptStore } from '../media/transcript-store.js';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const ALL = ['ffmpeg', 'ffprobe', 'zenity', 'yt-dlp', 'whisper-cli', 'whisper-large-v3', 'voxcpm2'];
const fakeSetup = () => ({ toolsDirectory: '/x', status: async () => ({ items: ALL.map(id => ({ id, label: id, ready: true })) }), toolPath: async name => name, modelPath: () => '/x', jobs: () => [] });
const service = root => new LocalApplicationService({ dataDirectory: path.join(root, 'data'), setup: fakeSetup() });

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'contentlab-edit-')); roots.push(root);
  const app = service(root);
  const project = await app.createProject({ title: 'Edição', type: 'long', aspectRatio: '16:9' });
  const video = path.join(root, 'cena.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
  await app.mediaOps.jobs.waitFor((await app.importMediaFiles({ path: project.path, sources: [video], rights: 'owned' })).id);
  const media = (await app.inspectProject(project.path)).project.media[0];
  return { root, app, project, media };
}
const revision = async (app, project) => (await app.inspectProject(project.path)).project.revision;
const clips = async (app, project, trackId = 'visual_main') => (await app.inspectProject(project.path)).project.timeline.tracks.find(track => track.id === trackId).clips;

test('adiciona, divide, apara com ripple e recusa sobreposição, track bloqueada e trecho além da mídia', async () => {
  const { app, project, media } = await setup();
  let state = await app.editAddMedia({ path: project.path, baseRevision: await revision(app, project), trackId: 'visual_main', mediaId: media.id });
  const [first] = state.project.timeline.tracks[0].clips;
  expect(first).toMatchObject({ durationInFrames: 120, sourceInFrame: 0 });
  state = await app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.split', trackId: 'visual_main', clipId: first.id, frame: 45, newClipId: 'clip_parte2' }], label: 'Dividir' });
  expect((await clips(app, project)).map(clip => [clip.id, clip.startFrame, clip.durationInFrames, clip.sourceInFrame])).toEqual([[first.id, 0, 45, 0], ['clip_parte2', 45, 75, 45]]);
  state = await app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.trim', trackId: 'visual_main', clipId: first.id, startFrame: 0, durationInFrames: 30, ripple: true }] });
  expect((await clips(app, project)).find(clip => clip.id === 'clip_parte2').startFrame).toBe(30);
  await expect(app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.move', trackId: 'visual_main', clipId: 'clip_parte2', startFrame: 10 }] })).rejects.toThrow(/sobrepostos/);
  await expect(app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.trim', trackId: 'visual_main', clipId: 'clip_parte2', startFrame: 30, durationInFrames: 200 }] })).rejects.toThrow(/passa do fim da mídia/);
  state = await app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'track.update', trackId: 'visual_main', locked: true }] });
  await expect(app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.remove', trackId: 'visual_main', clipId: first.id }] })).rejects.toThrow(/bloqueada/);
  await expect(app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.add', trackId: 'audio_main', clip: { id: 'clip_fantasma', type: 'media', sourceId: 'media_inexistente', startFrame: 0, durationInFrames: 10 } }] })).rejects.toThrow(/Mídia ausente/);
});

test('desfazer e refazer persistem ao reabrir e reiniciam após mudança externa', async () => {
  const { root, app, project, media } = await setup();
  let state = await app.editAddMedia({ path: project.path, baseRevision: await revision(app, project), trackId: 'visual_main', mediaId: media.id });
  const id = state.project.timeline.tracks[0].clips[0].id;
  state = await app.editTimeline({ path: project.path, baseRevision: state.project.revision, commands: [{ op: 'clip.move', trackId: 'visual_main', clipId: id, startFrame: 60 }], label: 'Mover' });
  expect(state.edit).toMatchObject({ canUndo: true, canRedo: false, undoLabel: 'Mover' });
  const reopened = service(root);
  state = await reopened.editUndo({ path: project.path, baseRevision: state.project.revision });
  expect(state.project.timeline.tracks[0].clips[0].startFrame).toBe(0);
  expect(state.edit).toMatchObject({ canRedo: true, redoLabel: 'Mover' });
  state = await reopened.editRedo({ path: project.path, baseRevision: state.project.revision });
  expect(state.project.timeline.tracks[0].clips[0].startFrame).toBe(60);
  await reopened.runProjectAction({ path: project.path, baseRevision: state.project.revision, action: { type: 'timeline.edit', commands: [{ op: 'clip.move', trackId: 'visual_main', clipId: id, startFrame: 90 }] } });
  await expect(reopened.editUndo({ path: project.path, baseRevision: state.project.revision + 1 })).rejects.toMatchObject({ code: 'HISTORY_STALE' });
  expect((await reopened.editState({ path: project.path })).edit.canUndo).toBe(false);
});

test('legendas a partir da transcrição e de SRT viram clips editáveis sem sobrepor', async () => {
  const { root, app, project, media } = await setup();
  await new TranscriptStore(project.path).saveRaw(media.id, { segments: [{ start: 0, end: 1.5, text: 'Primeira fala' }, { start: 1.2, end: 3, text: 'Segunda fala' }], srt: '', key: {} });
  let state = await app.editCaptions({ path: project.path, baseRevision: await revision(app, project), mediaId: media.id });
  const captions = await clips(app, project, 'captions_main');
  expect(captions.map(clip => [clip.text, clip.startFrame, clip.durationInFrames])).toEqual([['Primeira fala', 0, 36], ['Segunda fala', 36, 54]]);
  state = await app.editCaptions({ path: project.path, baseRevision: state.project.revision, mediaId: media.id, style: 'destaque' });
  expect((await clips(app, project, 'captions_main')).every(clip => clip.style === 'destaque')).toBe(true);
  const srt = path.join(root, 'legenda.srt');
  await writeFile(srt, '1\n00:00:00,500 --> 00:00:01,000\nConflito\n');
  await expect(app.editCaptions({ path: project.path, baseRevision: state.project.revision, srtPath: srt })).rejects.toThrow(/cairiam sobre/);
  await writeFile(srt, '1\n00:00:10,000 --> 00:00:11,000\nDepois\n');
  state = await app.editCaptions({ path: project.path, baseRevision: state.project.revision, srtPath: srt });
  expect((await clips(app, project, 'captions_main')).at(-1)).toMatchObject({ text: 'Depois', startFrame: 300, durationInFrames: 30 });
});

test('SRT enviado pela interface e componente Remotion entram na timeline e no preview real', async () => {
  const { app, project } = await setup();
  let state = await app.editCaptions({ path: project.path, baseRevision: await revision(app, project), srtName: 'ui.srt', srtText: '1\n00:00:00,000 --> 00:00:01,000\nLegenda da interface\n', startFrame: 30, style: 'titulo' });
  expect((await clips(app, project, 'captions_main'))[0]).toMatchObject({ text: 'Legenda da interface', startFrame: 30, style: 'titulo' });
  expect(state.components).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'kinetic_emphasis', exportName: 'KineticEmphasis' }), expect.objectContaining({ id: 'hq_imagem_frases_hq', use: expect.any(String) })]));
  expect(state.components).toHaveLength(BUNDLED_COMPONENTS.length);
  state = await app.editAddComponent({ path: project.path, baseRevision: state.project.revision, componentId: 'kinetic_emphasis', componentProps: { text: 'FUNCIONA', color: '#ff0000' }, startFrame: 0, durationInFrames: 30 });
  const component = state.project.timeline.tracks[0].clips.find(item => item.type === 'component');
  expect(component).toMatchObject({ componentId: 'kinetic_emphasis', componentProps: { text: 'FUNCIONA', color: '#ff0000' } });
  const frame = await app.editFrame({ path: project.path, frame: 10 });
  const preview = await app.editPreviewFile({ name: frame.name });
  expect((await stat(preview.file)).size).toBeGreaterThan(1000);
  const [cache] = await readdir(path.join(app.renderer.root, 'components'));
  const frames = (await readdir(path.join(app.renderer.root, 'components', cache))).filter(name => name.endsWith('.png')).sort();
  const corner = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(app.renderer.root, 'components', cache, frames[10]), '-vf', 'crop=1:1:0:0,format=rgba', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1']);
  expect(corner[3]).toBe(0);
}, 180_000);

test('troca de proporção pede confirmação com relatório e reabre edição aprovada', async () => {
  const { app, project, media } = await setup();
  let state = await app.editAddMedia({ path: project.path, baseRevision: await revision(app, project), trackId: 'visual_main', mediaId: media.id });
  state = await app.editAddMedia({ path: project.path, baseRevision: state.project.revision, trackId: 'audio_main', mediaId: media.id });
  state = await app.runProjectAction({ path: project.path, baseRevision: state.project.revision, action: { type: 'creative.update', creative: { brief: { thesis: 'Tese', audience: 'Público', promise: 'Promessa', notes: '' }, script: { hook: 'Gancho', development: 'Desenvolvimento', payoff: 'Final', visual: '', sources: '' }, packaging: { titleA: 'Título', titleB: '', description: 'Descrição', tags: '', seo: '', thumbnailMediaId: null } } } });
  for (let index = 0; index < 6; index += 1) {
    const current = (await app.inspectProject(project.path)).project; const stage = current.stages.find(item => ['active', 'changes_requested'].includes(item.state));
    if (!stage || stage.id === 'review') break;
    await app.runProjectAction({ path: project.path, baseRevision: current.revision, action: { type: 'stage.approve', stageId: stage.id, expectedRevision: stage.revision } });
  }
  state = await app.editState({ path: project.path });
  expect(state.project.stages.find(stage => stage.id === 'edit').state).toBe('approved');
  await expect(app.editAspect({ path: project.path, baseRevision: state.project.revision, aspectRatio: '9:16' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED', details: { clipsWithoutLayout: ['cena.mp4'], reopens: ['edit'] } });
  state = await app.editAspect({ path: project.path, baseRevision: state.project.revision, aspectRatio: '9:16', confirm: true });
  expect(state.project).toMatchObject({ aspectRatio: '9:16', timeline: { aspectRatio: '9:16' } });
  expect(state.project.stages.find(stage => stage.id === 'edit').state).not.toBe('approved');
});

test('preview de frame e de trecho saem do mesmo plano do render e ficam em cache', async () => {
  const { app, project, media } = await setup();
  await app.editAddMedia({ path: project.path, baseRevision: await revision(app, project), trackId: 'visual_main', mediaId: media.id });
  const frame = await app.editFrame({ path: project.path, frame: 30 });
  const file = await app.editPreviewFile({ name: frame.name });
  expect(file).toMatchObject({ contentType: 'image/png' });
  expect((await stat(file.file)).size).toBeGreaterThan(1000);
  const vertical = await app.editFrame({ path: project.path, frame: 30, aspectRatio: '9:16' });
  expect(vertical.name).toMatch(/9x16\.png$/);
  const job = await app.mediaOps.jobs.waitFor((await app.editClip({ path: project.path, frame: 0, seconds: 2 })).id);
  expect(job.state).toBe('completed');
  expect((await app.editPreviewFile({ name: job.result.name })).contentType).toBe('video/mp4');
  await expect(app.editPreviewFile({ name: '../../etc/passwd' })).rejects.toThrow(/inválido/);
}, 60_000);
