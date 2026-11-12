import { cp, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { installedPaths } from '../server/app-paths.js';

const exists = async file => { try { await lstat(file); return true; } catch { return false; } };

export function linuxTargets({ env = process.env, home } = {}) {
  const paths = installedPaths({ env, platform: 'linux', home });
  const homeDir = home || env.HOME;
  const dataHome = env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  return { ...paths, binDir: path.join(homeDir, '.local', 'bin'), applications: path.join(dataHome, 'applications'), icons: path.join(dataHome, 'icons', 'hicolor', 'scalable', 'apps') };
}

/** Instala o pacote extraído em `source` (que contém app/, runtime/, bin/) para o usuário atual, sem sudo. */
export async function installLinux({ source, targets = linuxTargets() }) {
  const pkg = JSON.parse(await readFile(path.join(source, 'app', 'package.json'), 'utf8'));
  const version = pkg.version;
  const versionDir = path.join(targets.app, 'versions', version);
  if (path.resolve(source) !== path.resolve(versionDir)) {
    const staging = `${versionDir}.partial`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(path.dirname(staging), { recursive: true });
    await cp(source, staging, { recursive: true, verbatimSymlinks: true });
    await rm(versionDir, { recursive: true, force: true });
    await rename(staging, versionDir);
  }
  const current = path.join(targets.app, 'current');
  let previous = null;
  try { previous = path.basename(await readlink(current)); } catch { /* primeira instalação */ }
  if (previous && previous !== version) await replaceLink(path.join(targets.app, 'previous'), path.join('versions', previous));
  await replaceLink(current, path.join('versions', version));
  await mkdir(targets.binDir, { recursive: true });
  await replaceLink(path.join(targets.binDir, 'contentlab'), path.join(current, 'bin', 'contentlab'));
  await mkdir(targets.icons, { recursive: true });
  await cp(path.join(source, 'share', 'contentlab.svg'), path.join(targets.icons, 'contentlab.svg'));
  await mkdir(targets.applications, { recursive: true });
  await writeFile(path.join(targets.applications, 'contentlab.desktop'), desktopEntry(path.join(current, 'bin', 'contentlab')));
  for (const directory of [targets.data, targets.tools, targets.cache]) await mkdir(directory, { recursive: true });
  return { version, previous, launcher: path.join(targets.binDir, 'contentlab'), targets };
}

export function desktopEntry(exec) {
  return ['[Desktop Entry]', 'Type=Application', 'Name=Content Lab', 'Comment=Produção de vídeos local, da ideia ao render', `Exec="${exec}"`, 'Icon=contentlab', 'Terminal=false', 'Categories=AudioVideo;Video;', 'StartupNotify=true', ''].join('\n');
}

/** O que a desinstalação removeria, com tamanhos, para a pessoa escolher cada parte. */
export async function uninstallPlan({ targets = linuxTargets() } = {}) {
  const size = async target => { try { const { sizeOf } = await import('../server/storage-service.js'); return await sizeOf(target); } catch { return null; } };
  return {
    app: { paths: [targets.app, path.join(targets.binDir, 'contentlab'), path.join(targets.applications, 'contentlab.desktop'), path.join(targets.icons, 'contentlab.svg')], bytes: await size(targets.app) },
    cacheAndModels: { paths: [targets.cache, targets.tools], bytes: ((await size(targets.cache)) || 0) + ((await size(targets.tools)) || 0) },
    settings: { paths: [targets.data], bytes: await size(targets.data), note: 'Configurações, Recentes, perfis de voz e cache de mídias originais.' },
    projects: { paths: [targets.projects], bytes: await size(targets.projects), exists: await exists(targets.projects), note: 'Pasta padrão de projetos. Projetos em outras pastas nunca são tocados.' },
  };
}

/**
 * Remove só as partes escolhidas. Projetos exigem `confirmProjects` com a frase exata;
 * sem escolha explícita nada além do app é removido.
 */
export async function uninstallLinux({ targets = linuxTargets(), app = true, cacheAndModels = false, settings = false, projects = false, confirmProjects = '' } = {}) {
  if (projects && confirmProjects !== 'APAGAR PROJETOS') throw Object.assign(new Error('Para apagar projetos digite exatamente APAGAR PROJETOS'), { code: 'CONFIRMATION_REQUIRED' });
  const plan = await uninstallPlan({ targets });
  const removed = [];
  const remove = async list => { for (const item of list) if (await exists(item)) { await rm(item, { recursive: true, force: true }); removed.push(item); } };
  if (app) await remove(plan.app.paths);
  if (cacheAndModels) await remove(plan.cacheAndModels.paths);
  if (settings) await remove(plan.settings.paths);
  if (projects) await remove(plan.projects.paths);
  return { removed, kept: Object.entries({ app, cacheAndModels, settings, projects }).filter(([, chosen]) => !chosen).map(([key]) => key) };
}

async function replaceLink(link, target) {
  await mkdir(path.dirname(link), { recursive: true });
  const temporary = `${link}.${process.pid}.tmp`;
  await rm(temporary, { force: true });
  await symlink(target, temporary);
  await rename(temporary, link);
}


