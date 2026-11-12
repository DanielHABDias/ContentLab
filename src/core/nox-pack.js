import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pacote do Nox (mascote do Diazverso): `Nox.png`, `nox-sem-olhos.png` e `poses/` com `catalogo.json`.
 * O Nox é propriedade do Diazverso e NÃO faz parte do Content Lab: os arquivos ficam no plugin Diazverso,
 * no computador do criador, e são lidos de lá a cada uso. Ordem de busca:
 *   1. CONTENTLAB_NOX_DIR (pasta com Nox.png);
 *   2. DIAZVERSO_PLUGIN_DIR/assets/brand/nox;
 *   3. pasta DiazVerso-Plugin ao lado do Content Lab (desenvolvimento);
 *   4. ~/Documentos/Projects/DiazVerso-Plugin e ~/DiazVerso-Plugin (app instalado).
 * Sem o pacote, `noxDir()` devolve null e quem precisa do Nox avisa como conectar.
 */
const here = import.meta.url.startsWith('file:') ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();

export function noxCandidates(env = process.env) {
  const fromPlugin = dir => dir && path.join(dir, 'assets', 'brand', 'nox');
  return [
    env.CONTENTLAB_NOX_DIR,
    fromPlugin(env.DIAZVERSO_PLUGIN_DIR),
    fromPlugin(path.resolve(here, '..', '..', '..', 'DiazVerso-Plugin')),
    fromPlugin(path.join(os.homedir(), 'Documentos', 'Projects', 'DiazVerso-Plugin')),
    fromPlugin(path.join(os.homedir(), 'DiazVerso-Plugin')),
  ].filter(Boolean).map(dir => path.resolve(dir));
}

export function noxDir(env = process.env) {
  return noxCandidates(env).find(dir => existsSync(path.join(dir, 'Nox.png'))) || null;
}

export const NOX_MISSING = 'Pacote do Nox não encontrado. Ele fica no plugin Diazverso: defina DIAZVERSO_PLUGIN_DIR (ou CONTENTLAB_NOX_DIR) com a pasta do plugin.';

/** Pasta do pacote ou erro acionável (para render e thumbnail, que precisam do Nox). */
export function requireNoxDir(env = process.env) {
  const dir = noxDir(env);
  if (!dir) throw Object.assign(new Error(NOX_MISSING), { code: 'NOX_PACK_MISSING' });
  return dir;
}
