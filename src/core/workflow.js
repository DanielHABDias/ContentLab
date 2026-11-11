const defaultStageIds = ['brief', 'script', 'packaging', 'media', 'narration', 'edit', 'review'];

export function createWorkflow() {
  return defaultStageIds.map((id, index) => ({ id, state: index === 0 ? 'active' : 'pending', revision: 0, approvedRevision: null, dependsOn: index ? [defaultStageIds[index - 1]] : [] }));
}

export function approveStage(project, stageId, expectedRevision) {
  const stages = project.stages.map(stage => ({ ...stage }));
  const index = stages.findIndex(stage => stage.id === stageId);
  if (index < 0) throw new Error(`Etapa desconhecida: ${stageId}`);
  const stage = stages[index];
  if (stage.revision !== expectedRevision) throw new Error(`Revisão divergente em ${stageId}`);
  if (!['active', 'changes_requested'].includes(stage.state)) throw new Error(`Etapa ${stageId} não pode ser aprovada em ${stage.state}`);
  const dependenciesReady = stage.dependsOn.every(id => stages.find(candidate => candidate.id === id)?.state === 'approved');
  if (!dependenciesReady) throw new Error(`Dependências de ${stageId} ainda não foram aprovadas`);
  stage.state = 'approved';
  stage.approvedRevision = stage.revision;
  if (stages[index + 1]?.state === 'pending') stages[index + 1].state = 'active';
  return { ...project, revision: project.revision + 1, stages };
}

export function requestChanges(project, stageId, reason) {
  if (!reason?.trim()) throw new Error('O pedido de mudanças exige um motivo');
  return changeStage(project, stageId, stage => ({ ...stage, state: 'changes_requested', revision: stage.revision + 1 }));
}

export function reopenStage(project, stageId, reason) {
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
  return { ...project, revision: project.revision + 1, stages };
}

function changeStage(project, stageId, update) {
  let found = false;
  const stages = project.stages.map(stage => { if (stage.id !== stageId) return { ...stage }; found = true; return update(stage); });
  if (!found) throw new Error(`Etapa desconhecida: ${stageId}`);
  return { ...project, revision: project.revision + 1, stages };
}
