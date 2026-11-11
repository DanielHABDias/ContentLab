const key = 'contentlab.projects.v1';

export function loadProjectCards(fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) && value.length ? value : fallback; } catch { return fallback; }
}

export function saveProjectCards(projects) {
  localStorage.setItem(key, JSON.stringify(projects));
}
