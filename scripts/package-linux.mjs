#!/usr/bin/env node
// Gera release/contentlab-<versão>-linux-<arch>.tar.gz com Node embutido (sem npm para quem instala),
// o SHA-256 e o manifesto do canal. Assina o manifesto se CONTENTLAB_SIGNING_KEY apontar para a chave
// privada Ed25519 (guardada FORA do repositório; gere com `node scripts/release-keys.mjs`).
//   node scripts/package-linux.mjs [--channel stable|beta] [--notes "texto"] [--base-url https://…/]
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { chmod, copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical } from '../src/update/update-service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const channel = option('--channel', 'stable');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const target = `linux-${process.arch}`;
const name = `contentlab-${pkg.version}-${target}`;
const release = path.join(root, 'release');
const staging = path.join(release, 'staging', name);
const step = message => console.log(`• ${message}`);

if (process.platform !== 'linux') { console.error('Este empacotador gera o pacote Linux; rode em Linux.'); process.exit(2); }
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'app'), { recursive: true });

step('Compilando a interface');
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });

step('Copiando aplicativo');
const skipTests = source => !/\.test\.(js|jsx)$/.test(source) && !source.includes(`${path.sep}test${path.sep}`) && !source.includes(`${path.sep}e2e${path.sep}`);
await cp(path.join(root, 'dist'), path.join(staging, 'app', 'dist'), { recursive: true });
await cp(path.join(root, 'src'), path.join(staging, 'app', 'src'), { recursive: true, filter: skipTests });
await cp(path.join(root, 'tools'), path.join(staging, 'app', 'tools'), { recursive: true, filter: source => !source.includes('__pycache__') });
await mkdir(path.join(staging, 'app', 'scripts'), { recursive: true });
for (const file of ['contentlab-installer.mjs', 'bootstrap.mjs', 'start.mjs']) await copyFile(path.join(root, 'scripts', file), path.join(staging, 'app', 'scripts', file));
for (const file of ['package.json', 'package-lock.json', 'LICENSE']) await copyFile(path.join(root, file), path.join(staging, 'app', file));
await cp(path.join(root, 'licenses'), path.join(staging, 'licenses'), { recursive: true });
await mkdir(path.join(staging, 'app', 'packaging'), { recursive: true });
try { await copyFile(path.join(root, 'packaging', 'release-public-key.pem'), path.join(staging, 'app', 'packaging', 'release-public-key.pem')); } catch { step('Sem chave pública: este build só aceita atualização manual'); }

step('Instalando dependências de produção (npm ci --omit=dev)');
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: path.join(staging, 'app'), stdio: 'inherit' });

step(`Embutindo Node ${process.version}`);
await mkdir(path.join(staging, 'runtime'), { recursive: true });
await copyFile(process.execPath, path.join(staging, 'runtime', 'node')); await chmod(path.join(staging, 'runtime', 'node'), 0o755);

await mkdir(path.join(staging, 'bin'), { recursive: true }); await mkdir(path.join(staging, 'share'), { recursive: true });
await copyFile(path.join(root, 'packaging', 'linux', 'contentlab'), path.join(staging, 'bin', 'contentlab')); await chmod(path.join(staging, 'bin', 'contentlab'), 0o755);
await copyFile(path.join(root, 'packaging', 'linux', 'install.sh'), path.join(staging, 'install.sh')); await chmod(path.join(staging, 'install.sh'), 0o755);
await copyFile(path.join(root, 'packaging', 'linux', 'contentlab.svg'), path.join(staging, 'share', 'contentlab.svg'));
await writeFile(path.join(staging, 'LEIA-ME.txt'), `Content Lab ${pkg.version}\n\nInstalar: ./install.sh\nAbrir: menu de aplicativos ou ~/.local/bin/contentlab\nAtualizar: contentlab --update   Voltar versão: contentlab --rollback\nDesinstalar: contentlab --uninstall (pergunta separadamente sobre app, cache/modelos, dados e projetos)\n\nFFmpeg e zenity vêm do sistema; o app explica como instalar em Dependências.\nLicenças de terceiros: pasta licenses/.\n`);

step('Compactando');
const archive = path.join(release, `${name}.tar.gz`);
execFileSync('tar', ['-czf', archive, '--owner=0', '--group=0', '-C', path.dirname(staging), name]);
const sha256 = await new Promise((resolve, reject) => { const hash = createHash('sha256'); createReadStream(archive).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject); });
const { size } = await stat(archive);
await writeFile(`${archive}.sha256`, `${sha256}  ${path.basename(archive)}\n`);

const baseUrl = option('--base-url', `https://example.invalid/contentlab/${channel}/`);
const manifest = { schema: 'contentlab-update-v1', channel, version: pkg.version, published: new Date().toISOString(), notes: option('--notes', `Content Lab ${pkg.version}`), artifacts: { [target]: { url: new URL(path.basename(archive), baseUrl).href, sha256, size } } };
if (process.env.CONTENTLAB_SIGNING_KEY) {
  manifest.signature = sign(null, Buffer.from(canonical(manifest)), createPrivateKey(await readFile(process.env.CONTENTLAB_SIGNING_KEY))).toString('base64');
  step('Manifesto assinado (Ed25519)');
} else step('Manifesto NÃO assinado: defina CONTENTLAB_SIGNING_KEY para publicar atualizações');
await writeFile(path.join(release, `${channel}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
await rm(path.join(release, 'staging'), { recursive: true, force: true });
console.log(`\n${archive}\n  ${(size / 1024 ** 2).toFixed(1)} MB · sha256 ${sha256}`);
