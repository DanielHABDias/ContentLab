#!/usr/bin/env node
// Instalar, atualizar, voltar versão e desinstalar o Content Lab instalado (Linux, por usuário).
//   --install <pasta-extraída>
//   --status | --update | --rollback
//   --install-archive <arquivo.tar.gz> --version <v> --sha256 <hash>   (atualização manual)
//   --uninstall [--app] [--cache] [--settings] [--projects] [--yes]
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installLinux, linuxTargets, uninstallLinux, uninstallPlan } from '../src/update/installer.js';
import { UpdateService } from '../src/update/update-service.js';
import { formatSize } from '../src/setup/downloader.js';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = linuxTargets();
const updater = () => UpdateService.fromEnvironment({ repositoryRoot, env: { ...process.env, CONTENTLAB_INSTALLED: '1', CONTENTLAB_APP_DIR: targets.app } });

try {
  if (flag('--install')) {
    const result = await installLinux({ source: path.resolve(value('--install')), targets });
    console.log(`Content Lab ${result.version} instalado.${result.previous ? ` Versão anterior (${result.previous}) mantida para voltar.` : ''}`);
    console.log(`Abra pelo menu de aplicativos ou rode: ${result.launcher}`);
    console.log(`Projetos novos: ${targets.projects}\nDados: ${targets.data}\nModelos: ${targets.tools}`);
  } else if (flag('--status')) {
    console.log(JSON.stringify(await updater().status(), null, 2));
  } else if (flag('--update')) {
    const result = await updater().apply();
    console.log(result.status === 'up-to-date' ? `Já está na versão mais recente (${result.version}).` : `Versão ${result.version} instalada. Feche e abra o Content Lab.`);
  } else if (flag('--rollback')) {
    const result = await updater().rollback();
    console.log(`Voltou para ${result.version}. Feche e abra o Content Lab.`);
  } else if (flag('--install-archive')) {
    const result = await updater().installArchive({ archive: path.resolve(value('--install-archive')), version: value('--version'), sha256: value('--sha256') });
    console.log(`Versão ${result.version} instalada manualmente. Feche e abra o Content Lab.`);
  } else if (flag('--uninstall')) {
    const plan = await uninstallPlan({ targets });
    const describe = (label, part) => `${label} (${part.bytes == null ? 'tamanho desconhecido' : formatSize(part.bytes)}): ${part.paths.join(', ')}`;
    let choice = { app: flag('--app') || !['--cache', '--settings', '--projects'].some(flag), cacheAndModels: flag('--cache'), settings: flag('--settings'), projects: flag('--projects'), confirmProjects: '' };
    if (!flag('--yes')) {
      const io = createInterface({ input: process.stdin, output: process.stdout });
      const ask = async (question, fallback) => { const answer = (await io.question(`${question} ${fallback ? '[S/n]' : '[s/N]'} `)).trim().toLowerCase(); return answer ? answer.startsWith('s') : fallback; };
      console.log('Escolha o que remover. Cada parte é independente.\n');
      choice.app = await ask(`Remover o aplicativo?\n  ${describe('App', plan.app)}\n`, true);
      choice.cacheAndModels = await ask(`Remover cache e modelos baixados? Podem ser baixados de novo.\n  ${describe('Cache e modelos', plan.cacheAndModels)}\n`, false);
      choice.settings = await ask(`Remover configurações, Recentes, perfis de voz e mídias originais em cache?\n  ${describe('Dados', plan.settings)}\n`, false);
      if (plan.projects.exists) {
        choice.projects = await ask(`Apagar a pasta padrão de PROJETOS? Isso apaga seus vídeos e roteiros.\n  ${describe('Projetos', plan.projects)}\n`, false);
        if (choice.projects) choice.confirmProjects = (await io.question('Digite APAGAR PROJETOS para confirmar: ')).trim();
      }
      io.close();
    } else if (choice.projects) choice.confirmProjects = value('--confirm-projects') || '';
    const result = await uninstallLinux({ targets, ...choice });
    console.log(`Removido: ${result.removed.length ? result.removed.join(', ') : 'nada'}\nMantido: ${result.kept.join(', ') || 'nada'}`);
  } else {
    console.error('Use --install, --status, --update, --rollback, --install-archive ou --uninstall.');
    process.exit(2);
  }
} catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
}
