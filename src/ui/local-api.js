export const OFFLINE_EVENT = 'contentlab:connection';
const signal = online => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail: { online } })); };

async function request(pathname, options = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${pathname}`, { ...options, headers: { 'content-type': 'application/json', 'x-contentlab-client': '1', ...options.headers } });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    signal(false);
    throw Object.assign(new Error('Servidor local fora do ar. Reabra o Content Lab e tente de novo.'), { code: 'OFFLINE' });
  }
  signal(true);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `Falha local (${response.status})`), { code: value.code, details: value.details });
  return value;
}

const post = (pathname, input) => request(pathname, { method: 'POST', body: JSON.stringify(input) });

export const localApi = {
  health: () => request('/health'),
  listProjects: () => request('/projects'),
  diagnostics: () => request('/diagnostics'),
  about: () => request('/about'),
  serverWork: () => request('/server/work'),
  productionSlides: input => post('/production/slides', input),
  productionThumbnails: input => post('/production/thumbnails', input),
  productionAssemble: input => post('/production/assemble', input),
  productionAudio: input => post('/production/audio', input),
  productionScenes: input => post('/production/scenes', input),
  productionChapters: input => post('/production/chapters', input),
  productionSummary: input => post('/production/summary', input),
  productionDeliverable: input => post('/production/deliverable', input),
  shutdown: (force = false) => post('/server/shutdown', { force }),
  updateStatus: () => request('/update/status'),
  updateCheck: () => post('/update/check', {}),
  updateApply: () => post('/update/apply', {}),
  updateRollback: () => post('/update/rollback', {}),
  updateConfigure: input => post('/update/configure', input),
  openProject: path => request('/projects/open', { method: 'POST', body: JSON.stringify({ path }) }),
  createProject: input => request('/projects/create', { method: 'POST', body: JSON.stringify(input) }),
  runProjectAction: input => request('/projects/action', { method: 'POST', body: JSON.stringify(input) }),
  chooseDirectory: title => request('/dialog/directory', { method: 'POST', body: JSON.stringify({ title }) }),
  choosePackage: title => request('/dialog/package', { method: 'POST', body: JSON.stringify({ title }) }),
  chooseMedia: (title, multiple = false) => request('/dialog/media', { method: 'POST', body: JSON.stringify({ title, multiple }) }),
  importPackage: input => request('/packages/import', { method: 'POST', body: JSON.stringify(input) }),
  inspectPackage: input => post('/packages/inspect', input),
  importMedia: input => request('/media/import', { method: 'POST', body: JSON.stringify(input) }),
  render: input => request('/render', { method: 'POST', body: JSON.stringify(input) }),
  renderPresets: path => post('/render/presets', { path }),
  renderJobs: path => post('/render/jobs', { path }),
  enqueueRender: input => post('/render/start', input),
  cancelRender: jobId => post('/render/cancel', { jobId }),
  retryRender: jobId => post('/render/retry', { jobId }),
  revealRender: jobId => post('/render/reveal', { jobId }),
  renderLog: jobId => post('/render/log', { jobId }),
  forgetProject: path => post('/projects/forget', { path }),
  revealProject: path => post('/projects/reveal', { path }),
  renameProject: input => post('/projects/rename', input),
  changeProjectId: input => post('/projects/change-id', input),
  duplicateProject: input => post('/projects/duplicate', input),
  exportProject: input => post('/projects/export', input),
  deleteProject: input => post('/projects/delete', input),
  restoreProject: path => post('/projects/restore', { path }),
  projectActivities: path => post('/projects/activities', { path }),
  cancelProjectActivities: path => post('/projects/cancel', { path }),
  setupStatus: () => request('/setup/status'),
  setupJobs: () => request('/setup/jobs'),
  setupInstall: input => post('/setup/install', input),
  setupPause: input => post('/setup/pause', input),
  setupResume: input => post('/setup/resume', input),
  setupCancel: input => post('/setup/cancel', input),
  setupOnboarding: choice => post('/setup/onboarding', { choice }),
  relocateProject: input => post('/projects/relocate', input),
  getSettings: () => request('/settings'),
  validateFolder: path => post('/settings/validate', { path }),
  updateSettings: input => post('/settings/update', input),
  storageUsage: () => request('/storage/usage'),
  storageOrphans: () => request('/storage/orphans'),
  storageCleanup: input => post('/storage/cleanup', input),
  planMigration: input => post('/storage/plan', input),
  startMigration: input => post('/storage/migrate', input),
  storageJobs: () => request('/storage/jobs'),
  cancelMigration: jobId => post('/storage/cancel', { jobId }),
  backupRegistry: () => post('/registry/backup', {}),
  registryBackups: () => request('/registry/backups'),
  restoreRegistry: name => post('/registry/restore', { name }),
  importFiles: input => post('/media/import-files', input),
  importUrl: input => post('/media/import-url', input),
  mediaUsage: input => post('/media/usage', input),
  removeMedia: input => post('/media/remove', input),
  createCut: input => post('/media/cut', input),
  removeCut: input => post('/media/cut-remove', input),
  transcribe: input => post('/media/transcribe', input),
  transcript: input => post('/media/transcript', input),
  saveTranscript: input => post('/media/transcript-save', input),
  searchTranscripts: input => post('/media/search', input),
  jobs: path => request(`/jobs?path=${encodeURIComponent(path)}`),
  cancelJob: jobId => post('/jobs/cancel', { jobId }),
  editState: path => post('/edit/state', { path }),
  editApply: input => post('/edit/apply', input),
  editUndo: input => post('/edit/undo', input),
  editRedo: input => post('/edit/redo', input),
  editAddMedia: input => post('/edit/add-media', input),
  editAddComponent: input => post('/edit/add-component', input),
  editComponents: () => post('/edit/components', {}),
  editCaptions: input => post('/edit/captions', input),
  editAspect: input => post('/edit/aspect', input),
  editFrame: input => post('/edit/frame', input),
  editClip: input => post('/edit/clip', input),
  narration: path => post('/narration/state', { path }),
  narrationImport: input => post('/narration/import', input),
  updateTake: input => post('/narration/take-update', input),
  reorderTakes: input => post('/narration/reorder', input),
  deleteTake: input => post('/narration/take-delete', input),
  narrationPreview: input => post('/narration/preview', input),
  assembleNarration: input => post('/narration/assemble', input),
  createVoiceProfile: input => post('/narration/profile-create', input),
  voiceProfileReport: profileId => post('/narration/profile-report', { profileId }),
  deleteVoiceProfile: profileId => post('/narration/profile-delete', { profileId, confirm: true }),
  generateVoice: input => post('/narration/generate', input),
  voicePlan: () => post('/narration/voice-plan', {}),
  /** Gravação do microfone (Blob) enviada como corpo bruto. */
  uploadTake: async ({ path, blob, name, origin = 'recording' }) => {
    const response = await fetch(`/api/v1/narration/upload?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}&origin=${origin}`, { method: 'POST', body: blob, headers: { 'x-contentlab-client': '1', 'content-type': 'application/octet-stream' } });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(value.error || `Falha no envio (${response.status})`), { code: value.code, details: value.details });
    return value;
  },
  /** Envio com progresso (arrastar e soltar): o navegador não expõe o caminho do arquivo. */
  upload: ({ path, file, rights, onProgress = () => {} }) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/v1/media/upload?path=${encodeURIComponent(path)}&name=${encodeURIComponent(file.name)}&rights=${encodeURIComponent(rights)}`);
    xhr.setRequestHeader('x-contentlab-client', '1');
    xhr.upload.onprogress = event => onProgress(event.loaded, event.total);
    xhr.onload = () => { let value = {}; try { value = JSON.parse(xhr.responseText); } catch { /* resposta vazia */ } xhr.status < 300 ? resolve(value) : reject(Object.assign(new Error(value.error || `Falha no envio (${xhr.status})`), { code: value.code, details: value.details })); };
    xhr.onerror = () => reject(new Error('Servidor local indisponível'));
    xhr.send(file);
  }),
};
