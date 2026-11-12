#!/usr/bin/env node
// Importa as cenas HQ do plugin Diazverso (repositório do mesmo criador) para o Content Lab:
// cada cena TSX vira um arquivo único (só React/Remotion), com o catálogo de props tirado
// dos exemplos do plugin, e os assets de marca (Anton, Nox, página HQ, ícones) são copiados.
//   node scripts/build-diazverso-scenes.mjs [caminho-do-plugin]
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.resolve(process.argv[2] || path.join(root, '..', 'DiazVerso-Plugin'));
const scenesDir = path.join(plugin, 'skills/diazverso-decupagem/references/scenes');
const examplesDir = path.join(plugin, 'skills/diazverso-decupagem/examples/scenes');
const outDir = path.join(root, 'src/timeline/components/diazverso');
const brandOut = path.join(root, 'assets/brand');
const version = JSON.parse(await readFile(path.join(plugin, 'plugin.json'), 'utf8')).version;

// Função editorial de cada cena (de references/scenes.md do plugin).
const USES = {
  BrainstormHQ: 'Grafo de ideias, evidências e percurso entre casos',
  ComparativoIdeiasHQ: 'Comparação visual de duas ideias ou consequências, com imagens',
  GaleriaCartasHQ: 'Galeria de cartas com imagem, título e legenda (evidências em sequência)',
  ImagemFrasesHQ: 'Imagem do assunto com frases de impacto reveladas junto da fala',
  PaginaHQCenas: 'Página HQ multipainel com imagens ou clipes e foco por painel',
  TextoHQ: 'Texto/palavras cinéticas de ênfase curta (até 3 s)',
  CarrosselFrasesHQ: 'Carrossel de frases-chave',
  LinhaDoTempoHQ: 'Linha do tempo com clipes por marco',
  PersonagemEspiralLegenda: 'Personagem recortado com espiral e legenda',
  DialogoHQ: 'Diálogo contextual entre dois personagens/ideias (Nox pode participar)',
  QuadroHQSobreCena: 'Quadro de texto sobre a cena (tese, pergunta)',
  ComicPageCTA: 'CTA de encerramento em página HQ com o Nox',
  CaixinhaHQ: 'Caixa contextual de informação',
  BarraLoadingHQ: 'Barra de progresso para orientar capítulos',
};
const BRAND = { 'assets/brand/nox/Nox.png': 'brand:nox', 'assets/brand/backgrounds/comic-page.png': 'brand:comic-page', 'fonts/Anton-Regular.ttf': 'brand:anton' };
const brandRef = value => BRAND[value] || (/^assets\/graphics\/([a-z-]+)\.svg$/.exec(value) ? `brand:${RegExp.$1}` : 'brand:nox');

/** Props desestruturadas na assinatura do componente exportado: nome e tipo pelo valor padrão literal. */
function signatureProps(source, name) {
  const start = source.search(new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\s*\\(\\s*\\{`));
  if (start < 0) return [];
  let index = source.indexOf('{', start) + 1; let depth = 0; let part = ''; const parts = [];
  for (; index < source.length; index += 1) {
    const char = source[index];
    if ('{[('.includes(char)) depth += 1;
    if ('}])'.includes(char)) { if (depth === 0) { parts.push(part); break; } depth -= 1; }
    if (char === ',' && depth === 0) { parts.push(part); part = ''; } else part += char;
  }
  return parts.map(item => item.trim()).filter(item => /^[A-Za-z_$]/.test(item) && !item.startsWith('...')).map(item => {
    const [key, ...rest] = item.split('='); const value = rest.join('=').trim();
    const type = /^['"`]#[0-9a-f]{6}['"`]$/i.test(value) ? 'color' : /^['"`]/.test(value) ? 'string' : /^-?[\d.]+$/.test(value) ? 'number' : /^(true|false)$/.test(value) ? 'boolean' : 'json';
    return { key: key.split(':')[0].trim(), type };
  }).filter(item => /^[A-Za-z_$][\w$]*$/.test(item.key));
}

// As cenas TSX avulsas foram aposentadas no plugin (o kit de motion as substitui). Sem elas, as cópias
// atuais do modo antigo de clips ficam como estão.
const legacy = existsSync(scenesDir);
const catalog = [];
if (legacy) { await rm(outDir, { recursive: true, force: true }); await mkdir(outDir, { recursive: true }); }
for (const file of legacy ?  (await readdir(scenesDir)).filter(name => name.endsWith('.tsx')).sort() : []) {
  const name = path.basename(file, '.tsx');
  if (!USES[name]) continue; // utilitários (HQMotion, fundo, página) entram embutidos nas cenas
  const result = await build({ entryPoints: [path.join(scenesDir, file)], bundle: true, format: 'esm', jsx: 'automatic', write: false, logLevel: 'error', external: ['react', 'react/jsx-runtime', 'remotion'], target: 'es2020' });
  let code = result.outputFiles[0].text.replaceAll('requires the render browser', 'precisa do navegador de render');
  const clause = /export\s*\{([^}]*)\};?\s*$/.exec(code);
  if (!clause) throw new Error(`Export não encontrado em ${name}`);
  const entries = clause[1].split(',').map(item => item.trim()).filter(Boolean).map(item => { const [local, , exported] = item.split(/\s+/); return { local, exported: exported || local }; });
  const chosen = entries.find(item => item.exported === 'default') || entries.find(item => item.exported === name);
  if (!chosen) throw new Error(`Componente ${name} sem export principal`);
  code = `${code.slice(0, clause.index)}export const ${name}Cena = ${chosen.local};\n`;
  await writeFile(path.join(outDir, `${name}.tsx`), `// Cena ${name} do plugin Diazverso ${version}, compilada por scripts/build-diazverso-scenes.mjs. Não editar à mão.\n${code}`);
  const example = JSON.parse(await readFile(path.join(examplesDir, `${name}.json`), 'utf8'));
  const props = structuredClone(example.props);
  if (props.assets) props.assets = Object.fromEntries(Object.entries(props.assets).map(([key, value]) => [key, brandRef(value)]));
  for (const panel of props.panels || []) panel.mediaType = 'image';
  const typeOf = value => typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : typeof value === 'string' ? (/^#[0-9a-f]{6}$/i.test(value) ? 'color' : 'string') : 'json';
  // Exemplo primeiro (com default), depois as demais props da assinatura da cena (sem default: o componente usa o próprio).
  const signature = signatureProps(await readFile(path.join(scenesDir, file), 'utf8'), name);
  const schemaEntries = [...Object.entries(props).map(([key, value]) => [key, { type: typeOf(value), label: key, default: value }]), ...signature.filter(item => !(item.key in props)).map(item => [item.key, { type: item.type, label: item.key }])];
  const propsSchema = Object.fromEntries(schemaEntries.slice(0, 32));
  catalog.push({ id: `dv_${name.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase()}`, file: `diazverso/${name}.tsx`, exportName: `${name}Cena`, label: `Diazverso · ${name}`, use: USES[name], propsSchema });
}
if (legacy) await writeFile(path.join(outDir, 'catalog.json'), `${JSON.stringify({ plugin: version, components: catalog }, null, 2)}\n`);

for (const [from, to] of [['assets/brand/fonts/anton/Anton-Regular.ttf', 'fonts/Anton-Regular.ttf'], ['assets/brand/fonts/anton/OFL.txt', 'fonts/OFL.txt'], ['assets/brand/nox/Nox.png', 'nox/Nox.png'], ['assets/brand/backgrounds/comic-page.png', 'backgrounds/comic-page.png'], ...(await readdir(path.join(plugin, 'assets/graphics'))).map(file => [`assets/graphics/${file}`, `graphics/${file}`])]) {
  await mkdir(path.dirname(path.join(brandOut, to)), { recursive: true }); await copyFile(path.join(plugin, from), path.join(brandOut, to));
}
// Kit de motion (composição única): copiado como está, com os assets que ele usa.
const kitSource = path.join(plugin, 'skills/diazverso-motion/kit'); const kitOut = path.join(root, 'src/motion/kit');
await rm(kitOut, { recursive: true, force: true }); await mkdir(kitOut, { recursive: true });
for (const file of await readdir(kitSource)) await copyFile(path.join(kitSource, file), path.join(kitOut, file));
await copyFile(path.join(plugin, 'assets/brand/nox/nox-sem-olhos.png'), path.join(brandOut, 'nox/nox-sem-olhos.png'));
// Poses do Nox para o stop motion (quando o plugin tiver).
await rm(path.join(brandOut, 'nox/poses'), { recursive: true, force: true });
if (existsSync(path.join(plugin, 'assets/brand/nox/poses'))) { await mkdir(path.join(brandOut, 'nox/poses'), { recursive: true }); for (const file of (await readdir(path.join(plugin, 'assets/brand/nox/poses'))).filter(name => name.endsWith('.png'))) await copyFile(path.join(plugin, 'assets/brand/nox/poses', file), path.join(brandOut, 'nox/poses', file)); }
await mkdir(path.join(brandOut, 'sfx'), { recursive: true });
for (const file of (await readdir(path.join(plugin, 'assets/sfx/motion'))).filter(name => name.endsWith('.wav'))) await copyFile(path.join(plugin, 'assets/sfx/motion', file), path.join(brandOut, 'sfx', file));
await writeFile(path.join(kitOut, 'VERSION'), `${version}\n`);
console.log(`${legacy ? `${catalog.length} cenas avulsas e ` : ''}kit de motion do plugin ${version} em ${path.relative(root, kitOut)}; marca em ${path.relative(root, brandOut)}`);
