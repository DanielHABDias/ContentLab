import { parseOperation, parseProject } from './contracts.js';
import { approveStage, planAutonomousStage, reopenStage, requestChanges } from './workflow.js';
import { applyTimelineCommands, validateTimeline } from '../timeline/timeline-engine.js';

export class AgentService {
  constructor(store) { this.store = store; }

  async create(input) { return compactProject(await this.store.create(parseProject(input))); }

  async inspect(projectId, { compact = true } = {}) {
    const project = await this.store.read(projectId);
    return compact ? compactProject(project) : project;
  }

  async run(input) {
    const operation = parseOperation(input);
    const current = await this.store.read(operation.projectId);
    const previous = await this.store.history(operation.projectId);
    const duplicate = previous.find(event => event.operationId === operation.operationId);
    if (duplicate) return { status: 'unchanged', operationId: operation.operationId, revision: duplicate.revision };
    if (current.revision !== operation.baseRevision) throw revisionConflict(operation.baseRevision, current.revision, current);
    const next = applyActions(current, operation.actions, operation.operationId);
    const diff = summarizeDiff(current, next);
    if (operation.dryRun) return { status: 'preview', operationId: operation.operationId, baseRevision: current.revision, diff };
    const saved = await this.store.update(operation.projectId, current.revision, () => next, { type: 'operation.applied', operationId: operation.operationId, actions: operation.actions.map(action => action.type) });
    return { status: 'applied', operationId: operation.operationId, revision: saved.revision, diff };
  }
}

function applyActions(project, actions, operationId) {
  let draft = structuredClone(project);
  for (const action of actions) {
    if (action.type === 'stage.approve') draft = approveStage(draft, action.stageId, action.expectedRevision);
    else if (action.type === 'stage.reopen') draft = reopenStage(draft, action.stageId, action.reason, action);
    else if (action.type === 'stage.request_changes') draft = requestChanges(draft, action.stageId, action.reason, action);
    else if (action.type === 'workflow.run') {
      if (draft.mode !== 'autonomous') throw new Error('Ative o modo autônomo antes de executar o workflow');
      const stageId = action.stageId || draft.stages.find(stage => ['active', 'changes_requested', 'invalidated'].includes(stage.state))?.id;
      if (!stageId) throw new Error('Não há etapa disponível para execução');
      const job = planAutonomousStage(draft, stageId, { jobId: action.jobId, operationId });
      draft.workflowJobs = [job, ...(draft.workflowJobs || []).filter(item => item.id !== job.id)].slice(0, 100);
    }
    else if (action.type === 'project.update') {
      if (action.title !== undefined) draft.title = action.title;
      if (action.projectType !== undefined) draft.type = action.projectType;
      if (action.aspectRatio !== undefined) { draft.aspectRatio = action.aspectRatio; draft.timeline.aspectRatio = action.aspectRatio; }
      if (action.mode !== undefined) draft.mode = action.mode;
    }
    else if (action.type === 'creative.update') draft.creative = structuredClone(action.creative);
    else if (action.type === 'media.add') {
      const existing = draft.media.findIndex(item => item.id === action.media.id);
      if (existing >= 0) draft.media[existing] = action.media;
      else draft.media.push(action.media);
    }
    else if (action.type === 'media.remove') {
      const usages = mediaUsages(draft, action.mediaId);
      if (!draft.media.some(item => item.id === action.mediaId)) throw new Error(`Mídia desconhecida: ${action.mediaId}`);
      if (usages.total && !action.detachUsages) throw Object.assign(new Error(`Mídia em uso: ${describeUsages(usages)}. Confirme para desassociar.`), { code: 'MEDIA_IN_USE', details: { usages } });
      if (usages.thumbnail) draft.creative.packaging.thumbnailMediaId = null;
      for (const track of draft.timeline.tracks) track.clips = track.clips.filter(clip => clip.sourceId !== action.mediaId);
      draft.media = draft.media.filter(item => item.id !== action.mediaId);
    }
    else if (action.type === 'media.cut.add' || action.type === 'media.cut.remove' || action.type === 'media.transcript.set') {
      const media = draft.media.find(item => item.id === action.mediaId);
      if (!media) throw new Error(`Mídia desconhecida: ${action.mediaId}`);
      if (action.type === 'media.cut.add') {
        if (action.cut.end <= action.cut.start) throw new Error('O fim do corte deve ser depois do início');
        if (media.metadata?.durationSeconds != null && action.cut.end > media.metadata.durationSeconds + 0.05) throw new Error('O corte passa da duração da mídia');
        media.cuts = [...(media.cuts || []).filter(cut => cut.id !== action.cut.id), action.cut];
      } else if (action.type === 'media.cut.remove') {
        if (!(media.cuts || []).some(cut => cut.id === action.cutId)) throw new Error(`Corte desconhecido: ${action.cutId}`);
        media.cuts = media.cuts.filter(cut => cut.id !== action.cutId);
      } else media.transcript = action.transcript;
    }
    else if (action.type === 'timeline.edit') draft.timeline = applyTimelineCommands(draft.timeline, action.commands, { media: draft.media });
    else if (action.type === 'timeline.replace') {
      if (action.timeline.aspectRatio !== draft.timeline.aspectRatio) throw new Error('Desfazer não muda a proporção do projeto');
      validateTimeline(action.timeline, draft.media);
      draft.timeline = structuredClone(action.timeline);
    }
    else {
      const track = draft.timeline.tracks.find(candidate => candidate.id === action.trackId);
      if (!track) throw new Error(`Track desconhecida: ${action.trackId}`);
      if (action.type === 'clip.add') {
        if (track.clips.some(clip => clip.id === action.clip.id)) throw new Error(`Clip já existe: ${action.clip.id}`);
        track.clips.push(action.clip);
      }
      if (action.type === 'clip.remove') {
        const index = track.clips.findIndex(clip => clip.id === action.clipId);
        if (index < 0) throw new Error(`Clip desconhecido: ${action.clipId}`);
        track.clips.splice(index, 1);
      }
      if (action.type === 'clip.move') {
        const clip = track.clips.find(candidate => candidate.id === action.clipId);
        if (!clip) throw new Error(`Clip desconhecido: ${action.clipId}`);
        clip.startFrame = action.startFrame;
      }
    }
  }
  draft.revision = project.revision + 1;
  return draft;
}

/** Onde uma mídia é usada no projeto (thumbnail e clips da timeline). */
export function mediaUsages(project, mediaId) {
  const thumbnail = project.creative?.packaging?.thumbnailMediaId === mediaId;
  const clips = project.timeline.tracks.flatMap(track => track.clips.filter(clip => clip.sourceId === mediaId).map(clip => ({ trackId: track.id, clipId: clip.id })));
  return { thumbnail, clips, total: clips.length + (thumbnail ? 1 : 0) };
}

function describeUsages(usages) {
  return [usages.thumbnail && 'thumbnail', usages.clips.length && `${usages.clips.length} clip(s) na timeline`].filter(Boolean).join(' e ');
}

function summarizeDiff(before, after) {
  const clipsBefore = before.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  const clipsAfter = after.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  return { revision: [before.revision, after.revision], clips: [clipsBefore, clipsAfter], stagesChanged: after.stages.filter((stage, index) => JSON.stringify(stage) !== JSON.stringify(before.stages[index])).map(stage => ({ id: stage.id, state: stage.state, revision: stage.revision })) };
}

function compactProject(project) {
  return { id: project.id, title: project.title, revision: project.revision, type: project.type, aspectRatio: project.aspectRatio, mode: project.mode, stages: project.stages.map(({ id, state, revision }) => ({ id, state, revision })), openChangeRequests: (project.changeRequests || []).filter(item => item.status === 'open').length, latestWorkflowJob: project.workflowJobs?.[0] || null, mediaCount: project.media.length, trackCount: project.timeline.tracks.length, clipCount: project.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0) };
}

function revisionConflict(expected, actual, current) {
  return Object.assign(new Error(`Conflito de revisão: esperado ${expected}, atual ${actual}`), { code: 'REVISION_CONFLICT', details: { expected, actual, compare: { title: current.title, stageStates: current.stages.map(({ id, state, revision }) => ({ id, state, revision })) } } });
}
