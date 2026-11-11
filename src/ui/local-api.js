async function request(pathname, options = {}) {
  const response = await fetch(`/api/v1${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(value.error || `Falha local (${response.status})`), { code: value.code, details: value.details });
  return value;
}

const post = (pathname, input) => request(pathname, { method: 'POST', body: JSON.stringify(input) });

export const localApi = {
  health: () => request('/health'),
  listProjects: () => request('/projects'),
  diagnostics: () => request('/diagnostics'),
  openProject: path => request('/projects/open', { method: 'POST', body: JSON.stringify({ path }) }),
  createProject: input => request('/projects/create', { method: 'POST', body: JSON.stringify(input) }),
  runProjectAction: input => request('/projects/action', { method: 'POST', body: JSON.stringify(input) }),
  chooseDirectory: title => request('/dialog/directory', { method: 'POST', body: JSON.stringify({ title }) }),
  choosePackage: title => request('/dialog/package', { method: 'POST', body: JSON.stringify({ title }) }),
  chooseMedia: title => request('/dialog/media', { method: 'POST', body: JSON.stringify({ title }) }),
  importPackage: input => request('/packages/import', { method: 'POST', body: JSON.stringify(input) }),
  importMedia: input => request('/media/import', { method: 'POST', body: JSON.stringify(input) }),
  render: input => request('/render', { method: 'POST', body: JSON.stringify(input) }),
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
};
