import { FLOW_STAGES } from './contracts.js';

const defaultStageIds = FLOW_STAGES;

export function createWorkflow() {
  return defaultStageIds.map((id, index) => ({ id, state: index === 0 ? 'active' : 'pending', revision: 0, approvedRevision: null, dependsOn: index ? [defaultStageIds[index - 1]] : [] }));
}

export function approveStage(project, stageId, expectedRevision) {
  const stages = project.stages.map(stage => ({ ...stage }));
  const index = stages.findIndex(stage => stage.id === stageId);
  if (index < 0) throw new Error(`Etapa desconhecida: ${stageId}`);
  const stage = stages[index];
  if (stage.revision !== expectedRevision) throw new Error(`Revisão divergente em ${stageId}`);
  if (!['active', 'changes_requested', 'invalidated'].includes(stage.state)) throw new Error(`Etapa ${stageId} não pode ser aprovada em ${stage.state}`);
  const dependenciesReady = stage.dependsOn.every(id => stages.find(candidate => candidate.id === id)?.state === 'approved');
  if (!dependenciesReady) throw new Error(`Dependências de ${stageId} ainda não foram aprovadas`);
  const missing = missingStageArtifacts(project, stageId);
  if (missing.length) throw Object.assign(new Error(`A etapa ${stageId} não pode ser aprovada: faltam ${missing.join(', ')}`), { code: 'ARTIFACTS_MISSING', details: { stageId, missing } });
  stage.state = 'approved';
  stage.approvedRevision = stage.revision;
  const next = stages.find(candidate => candidate.state === 'pending' && candidate.dependsOn.every(id => stages.find(item => item.id === id)?.state === 'approved'));
  if (next) next.state = 'active';
  const now = new Date().toISOString();
  const changeRequests = (project.changeRequests || []).map(request => request.stageId === stageId && request.status === 'open' ? { ...request, status: 'resolved', resolution: 'Etapa aprovada após as alterações', resolvedRevision: project.revision + 1, resolvedAt: now } : request);
  return { ...project, revision: project.revision + 1, stages, changeRequests };
}

export function requestChanges(project, stageId, reason, { author = 'usuário', requestId = `change_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}` } = {}) {
  if (!reason?.trim()) throw new Error('O pedido de mudanças exige um motivo');
  const next = changeStage(project, stageId, stage => ({ ...stage, state: 'changes_requested', revision: stage.revision + 1 }));
  return { ...next, changeRequests: [...(project.changeRequests || []), changeRequest(project, stageId, reason, author, requestId)] };
}

export function reopenStage(project, stageId, reason, { author = 'usuário', requestId = `change_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}` } = {}) {
  if (!reason?.trim()) throw new Error('A reabertura exige um motivo');
  const stages = project.stages.map(stage => ({ ...stage }));
  const changed = new Set([stageId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const stage of stages) if (!changed.has(stage.id) && stage.dependsOn.some(id => changed.has(id))) { changed.add(stage.id); expanded = true; }
  }
  for (const stage of stages) {
    if (stage.id === stageId) { stage.state = 'active'; stage.revision += 1; stage.approvedRevision = null; }
    else if (changed.has(stage.id) && stage.state !== 'pending') { stage.state = 'invalidated'; stage.approvedRevision = null; }
  }
  return { ...project, revision: project.revision + 1, stages, changeRequests: [...(project.changeRequests || []), changeRequest(project, stageId, reason, author, requestId)] };
}

function changeRequest(project, stageId, reason, author, id) {
  return { id, stageId, reason: reason.trim(), author, requestedRevision: project.revision, requestedAt: new Date().toISOString(), status: 'open', resolution: null, resolvedRevision: null, resolvedAt: null };
}

/** Artefatos mínimos que tornam uma aprovação verdadeira, não apenas um clique. */
/** Variantes de embalagem: o Short não tem teste A/B (um título e uma thumbnail, a A); o vídeo longo tem A e B. */
export function packagingVariants(project) { return project?.type === 'short' ? ['A'] : ['A', 'B']; }

export function missingStageArtifacts(project, stageId) {
  const filled = value => Boolean(value?.trim());
  const creative = project.creative || { brief: {}, script: {}, packaging: {} };
  const visualClips = project.timeline.tracks.filter(track => track.kind === 'visual').flatMap(track => track.clips);
  const audioClips = project.timeline.tracks.filter(track => track.kind === 'audio').flatMap(track => track.clips);
  if (stageId === 'brief') return [['tese', creative.brief?.thesis], ['público', creative.brief?.audience], ['promessa', creative.brief?.promise]].filter(([, value]) => !filled(value)).map(([label]) => label);
  if (stageId === 'script' && Array.isArray(creative.script?.chapters)) {
    const blocks = creative.script.chapters.flatMap(chapter => chapter.blocks);
    if (!blocks.length) return ['bloco de roteiro'];
    if (blocks.some(block => !filled(block.text))) return ['texto dos blocos de roteiro'];
    return [];
  }
  if (stageId === 'script') return [['abertura', creative.script?.hook], ['desenvolvimento', creative.script?.development], ['payoff', creative.script?.payoff]].filter(([, value]) => !filled(value)).map(([label]) => label);
  // A descrição depende do roteiro: é conferida na entrega, não nesta etapa.
  if (stageId === 'packaging') return [['título A', creative.packaging?.titleA]].filter(([, value]) => !filled(value)).map(([label]) => label);
  if (stageId === 'media') return [...(!project.media.length ? ['mídia'] : []), ...(project.media.some(item => item.rights === 'pending') ? ['direitos das mídias'] : [])];
  // Modo composição (plano de motion): o vídeo é o plano; narração é opcional (vídeo só com som e texto).
  const motion = project.motion?.beats?.length ? project.motion : null;
  const narration = project.narrationMediaId ? project.media?.find(item => item.id === project.narrationMediaId) : project.media?.filter(item => item.role === 'narration').at(-1);
  const needsTranscript = narration && (narration.transcript?.model !== 'whisper-large-v3' || !(narration.transcript?.words > 0));
  if (stageId === 'narration') {
    if (narration) return [];
    if (project.narrationBy && motion?.narration !== false) return ['narração montada'];
    return audioClips.length || motion ? [] : ['narração montada'];
  }
  if (stageId === 'edit' && needsTranscript) return ['transcrição palavra por palavra da narração'];
  if (stageId === 'edit') return visualClips.length || motion ? [] : ['conteúdo visual na timeline'];
  if (stageId === 'review') return motion ? [] : [...(!visualClips.length ? ['conteúdo visual'] : []), ...(!audioClips.length ? ['áudio'] : [])];
  return ['etapa desconhecida'];
}

export function planAutonomousStage(project, stageId, { jobId, operationId }) {
  const stage = project.stages.find(item => item.id === stageId);
  if (!stage) throw new Error(`Etapa desconhecida: ${stageId}`);
  const missing = missingStageArtifacts(project, stageId);
  let state = missing.length ? 'waiting_input' : 'waiting_approval';
  let stopReason = missing.length ? 'missing_artifacts' : 'approval';
  const log = missing.length ? [`Faltam: ${missing.join(', ')}`] : ['Artefatos verificados', 'Aprovação humana necessária'];
  if (stageId === 'media' && project.media.some(item => item.rights === 'pending')) { state = 'waiting_rights'; stopReason = 'rights'; }
  else if (stageId === 'narration' && missing.length) { state = 'waiting_consent'; stopReason = 'consent'; log.splice(0, log.length, 'Escolha gravação/importação ou confirme consentimento antes de usar a voz clonada'); }
  else if (stageId === 'review' && !missing.length) { state = 'waiting_cost'; stopReason = 'cost'; log.splice(0, log.length, 'Render pode consumir tempo e recursos', 'Confirmação de custo necessária'); }
  return { id: jobId, stageId, state, baseRevision: project.revision, operationId, inputs: [`project@${project.revision}`, `stage:${stageId}@${stage.revision}`], outputs: missing.map(item => `missing:${item}`), log, stopReason, createdAt: new Date().toISOString(), finishedAt: new Date().toISOString() };
}

function changeStage(project, stageId, update) {
  let found = false;
  const stages = project.stages.map(stage => { if (stage.id !== stageId) return { ...stage }; found = true; return update(stage); });
  if (!found) throw new Error(`Etapa desconhecida: ${stageId}`);
  return { ...project, revision: project.revision + 1, stages };
}
