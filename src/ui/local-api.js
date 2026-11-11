async function request(pathname, options = {}) {
  const response = await fetch(`/api/v1${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `Falha local (${response.status})`);
  return value;
}

export const localApi = {
  health: () => request('/health'),
  listProjects: () => request('/projects'),
  openProject: path => request('/projects/open', { method: 'POST', body: JSON.stringify({ path }) }),
  createProject: input => request('/projects/create', { method: 'POST', body: JSON.stringify(input) }),
  runProjectAction: input => request('/projects/action', { method: 'POST', body: JSON.stringify(input) }),
  chooseDirectory: title => request('/dialog/directory', { method: 'POST', body: JSON.stringify({ title }) }),
  choosePackage: title => request('/dialog/package', { method: 'POST', body: JSON.stringify({ title }) }),
  chooseMedia: title => request('/dialog/media', { method: 'POST', body: JSON.stringify({ title }) }),
  importPackage: input => request('/packages/import', { method: 'POST', body: JSON.stringify(input) }),
  importMedia: input => request('/media/import', { method: 'POST', body: JSON.stringify(input) }),
};
