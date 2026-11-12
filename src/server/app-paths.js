import os from 'node:os';
import path from 'node:path';

/**
 * Pastas do Content Lab instalado, separadas do aplicativo para que atualizar
 * ou desinstalar o app não toque em dados, modelos nem projetos.
 *  - app: versões instaladas (substituíveis)
 *  - data: configurações, Recentes, perfis de voz, cache de mídias originais
 *  - tools: ferramentas e modelos baixados (grandes, reaproveitados entre versões)
 *  - cache: derivados recriáveis (render, prévias)
 *  - projects: pasta padrão de novos projetos, visível para a pessoa
 */
export function installedPaths({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  if (platform === 'win32') {
    const roaming = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return { app: path.join(local, 'ContentLab', 'app'), data: path.join(roaming, 'ContentLab'), tools: path.join(local, 'ContentLab', 'tools'), cache: path.join(local, 'ContentLab', 'cache'), projects: path.join(home, 'Documents', 'Content Lab') };
  }
  if (platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support', 'ContentLab');
    return { app: path.join(support, 'app'), data: support, tools: path.join(support, 'tools'), cache: path.join(home, 'Library', 'Caches', 'ContentLab'), projects: path.join(home, 'Documents', 'Content Lab') };
  }
  const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const cacheHome = env.XDG_CACHE_HOME || path.join(home, '.cache');
  return { app: path.join(dataHome, 'contentlab', 'app'), data: path.join(dataHome, 'contentlab', 'data'), tools: path.join(dataHome, 'contentlab', 'tools'), cache: path.join(cacheHome, 'contentlab'), projects: path.join(home, 'Content Lab') };
}

/** Raízes do servidor: variáveis explícitas > modo instalado > pasta do repositório (desenvolvimento). */
export function serverRoots({ env = process.env, repositoryRoot, platform, home } = {}) {
  const installed = env.CONTENTLAB_INSTALLED === '1' ? installedPaths({ env, platform, home }) : null;
  return {
    dataDirectory: env.CONTENTLAB_DATA_DIR || installed?.data || path.join(repositoryRoot, '.contentlab'),
    toolsDirectory: env.CONTENTLAB_TOOLS_DIR || installed?.tools || path.join(repositoryRoot, '.tools'),
    projectsDirectory: env.CONTENTLAB_PROJECTS_DIR || installed?.projects || null,
    renderCacheDirectory: installed ? path.join(installed.cache, 'render') : null,
  };
}
