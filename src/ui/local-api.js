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
};
