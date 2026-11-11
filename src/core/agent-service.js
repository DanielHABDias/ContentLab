import { parseOperation, parseProject } from './contracts.js';
import { approveStage, reopenStage } from './workflow.js';

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
    if (current.revision !== operation.baseRevision) throw new Error(`Conflito de revisão: esperado ${operation.baseRevision}, atual ${current.revision}`);
    const next = applyActions(current, operation.actions);
    const diff = summarizeDiff(current, next);
    if (operation.dryRun) return { status: 'preview', operationId: operation.operationId, baseRevision: current.revision, diff };
    const saved = await this.store.update(operation.projectId, current.revision, () => next, { type: 'operation.applied', operationId: operation.operationId, actions: operation.actions.map(action => action.type) });
    return { status: 'applied', operationId: operation.operationId, revision: saved.revision, diff };
  }
}

function applyActions(project, actions) {
  let draft = structuredClone(project);
  for (const action of actions) {
    if (action.type === 'stage.approve') draft = approveStage(draft, action.stageId, action.expectedRevision);
    else if (action.type === 'stage.reopen') draft = reopenStage(draft, action.stageId, action.reason);
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

function summarizeDiff(before, after) {
  const clipsBefore = before.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  const clipsAfter = after.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  return { revision: [before.revision, after.revision], clips: [clipsBefore, clipsAfter], stagesChanged: after.stages.filter((stage, index) => JSON.stringify(stage) !== JSON.stringify(before.stages[index])).map(stage => ({ id: stage.id, state: stage.state, revision: stage.revision })) };
}

function compactProject(project) {
  return { id: project.id, title: project.title, revision: project.revision, type: project.type, aspectRatio: project.aspectRatio, mode: project.mode, stages: project.stages.map(({ id, state, revision }) => ({ id, state, revision })), mediaCount: project.media.length, trackCount: project.timeline.tracks.length, clipCount: project.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0) };
}
