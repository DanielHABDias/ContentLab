import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = import.meta.url.startsWith('file:') ? path.dirname(fileURLToPath(import.meta.url)) : path.join(process.cwd(), 'src/render');
export const BRAND_ROOT = path.resolve(here, '../../assets/kit');
const BRAND_FILES = { anton: 'fonts/Anton-Regular.ttf', 'comic-page': 'backgrounds/comic-page.png' };
const BRAND_VERSION = 'kit-2';
const worker = import.meta.url.startsWith('file:') ? path.join(path.dirname(fileURLToPath(import.meta.url)), 'remotion-worker.js') : path.join(process.cwd(), 'src/render/remotion-worker.js');

/** Renderiza TSX validado fora do processo principal e guarda o WebM transparente por fingerprint. */
export class RemotionComponentRuntime {
  constructor(root, registry, { timeoutMs = 120_000, memoryMb = 1024 } = {}) { this.root = path.resolve(root); this.registry = registry; this.timeoutMs = timeoutMs; this.memoryMb = memoryMb; this.inflight = new Map(); }

  async prepare(plan, { signal, onProgress = () => {} } = {}) {
    const layers = plan.layers.filter(layer => layer.type === 'component');
    for (const [index, layer] of layers.entries()) {
      if (!layer.componentId) throw componentError(layer.id, 'Clip sem componente selecionado');
      try {
        const manifest = await this.registry.inspect(layer.componentId);
        const key = createHash('sha256').update(JSON.stringify({ runtime: 'png-v2', hash: manifest.hash, props: layer.componentProps, media: layer.componentMedia || {}, brand: BRAND_VERSION, fps: plan.fps, duration: layer.durationInFrames, canvas: renderSize(layer, plan) })).digest('hex');
        const output = path.join(this.root, 'components', key); const complete = path.join(output, 'complete.json');
        if (!(await stat(complete).catch(() => null))) {
          let pending = this.inflight.get(output);
          if (!pending) {
            pending = this.#render({ manifest, layer, plan, output, signal }); this.inflight.set(output, pending);
            pending.finally(() => { if (this.inflight.get(output) === pending) this.inflight.delete(output); }).catch(() => {});
          }
          await pending;
        }
        const digits = String(Math.max(0, layer.durationInFrames - 1)).length;
        layer.source = path.join(output, `frame-%0${digits}d.png`); layer.mediaKind = 'component-sequence';
        onProgress({ phase: `Componente ${index + 1}/${layers.length}`, progress: layers.length ? (index + 1) / layers.length : 1 });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw componentError(layer.id, error.message);
      }
    }
    return plan;
  }

  async #render({ manifest, layer, plan, output, signal }) {
    await mkdir(path.dirname(output), { recursive: true });
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'contentlab-remotion-'));
    const request = path.join(temporary, 'request.json'); const partial = `${output}.${randomUUID()}.partial`;
    const publicDir = path.join(temporary, 'public');
    const props = await stageAssets(sanitizeProps(manifest.propsSchema, layer.componentProps), layer.componentMedia || {}, publicDir);
    await writeFile(request, JSON.stringify({ sourcePath: manifest.sourcePath, exportName: manifest.exportName, props, publicDir, fps: plan.fps, durationInFrames: layer.durationInFrames, width: renderSize(layer, plan).width, height: renderSize(layer, plan).height, output: partial, workDirectory: temporary }));
    try {
      await runWorker(request, { timeoutMs: this.timeoutMs, memoryMb: this.memoryMb, signal, cacheDirectory: this.root });
      const digits = String(Math.max(0, layer.durationInFrames - 1)).length;
      const first = await stat(path.join(partial, `frame-${String(0).padStart(digits, '0')}.png`)).catch(() => null);
      const last = await stat(path.join(partial, `frame-${String(layer.durationInFrames - 1).padStart(digits, '0')}.png`)).catch(() => null);
      if (!first || !last || first.size < 100 || last.size < 100) throw new Error('Remotion não produziu a sequência de frames completa');
      await writeFile(path.join(partial, 'complete.json'), `${JSON.stringify({ frames: layer.durationInFrames, fps: plan.fps })}\n`);
      const { rename } = await import('node:fs/promises'); await rename(partial, output);
    } finally { await rm(partial, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); }
  }
}

/** O componente é renderizado no tamanho da caixa do clip (ex.: Short com a faixa da legenda reservada), sem distorcer. */
export function renderSize(layer, plan) {
  const even = value => Math.max(2, Math.round(value / 2) * 2);
  return layer.box ? { width: even(layer.box.width), height: even(layer.box.height) } : plan.canvas;
}

export function sanitizeProps(schema, values = {}) {
  const result = {};
  // Padrões JSON (exemplos completos do plugin) só valem quando nenhuma prop foi passada:
  // misturá-los a props parciais criaria listas incoerentes (ex.: foco num painel que não existe).
  const empty = !values || Object.keys(values).length === 0;
  for (const [key, descriptor] of Object.entries(schema || {})) {
    const spec = typeof descriptor === 'string' ? { type: descriptor } : descriptor;
    const value = values?.[key] ?? (spec.type === 'json' && !empty ? undefined : spec.default);
    if (value === undefined) continue;
    if (spec.type === 'number') { const number = Number(value); if (!Number.isFinite(number)) throw new Error(`Valor inválido para ${key}`); result[key] = number; }
    else if (spec.type === 'boolean') result[key] = value === true || value === 'true';
    else if (spec.type === 'json') {
      let parsed = value;
      // Texto que não é JSON fica como texto (props livres das cenas do plugin, ex.: panelLayout).
      if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch { parsed = value; } }
      if (parsed === undefined || JSON.stringify(parsed).length > 32_000) throw new Error(`Valor inválido para ${key}`);
      result[key] = parsed;
    }
    else { const text = String(value); if (text.length > 4000) throw new Error(`Valor grande demais para ${key}`); result[key] = text; }
  }
  return result;
}

/**
 * Referências de arquivo nas props: `brand:<nome>` (Anton, página HQ, ícones do kit) e
 * `media:<id>` (mídia do projeto). Copia só o necessário para a pasta pública do render e troca
 * por `public:<caminho>`, que o worker resolve com staticFile.
 */
export async function stageAssets(props, media, publicDir) {
  const staged = new Map();
  const place = async (ref) => {
    if (staged.has(ref)) return staged.get(ref);
    let source; let target;
    if (ref.startsWith('brand:')) {
      const name = ref.slice(6); const file = BRAND_FILES[name] || (/^[a-z-]{2,32}$/.test(name) ? `graphics/${name}.svg` : null);
      if (!file) throw new Error(`Asset de marca desconhecido: ${name}`);
      source = path.join(BRAND_ROOT, file); target = `brand/${file}`;
    } else {
      const item = media[ref.slice(6)];
      if (!item?.source) throw new Error(`Mídia não encontrada no projeto: ${ref.slice(6)}`);
      source = item.source; target = `media/${ref.slice(6).replace(/[^\w-]/g, '_')}${path.extname(item.source).toLowerCase()}`;
    }
    if (!(await stat(source).catch(() => null))) throw new Error(`Arquivo ausente: ${path.basename(source)}`);
    await mkdir(path.dirname(path.join(publicDir, target)), { recursive: true });
    await copyFile(source, path.join(publicDir, target));
    const value = `public:${target}`; staged.set(ref, value); return value;
  };
  const walk = async (value) => {
    if (typeof value === 'string') return /^(brand|media):[\w.-]+$/.test(value) ? place(value) : value;
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await walk(item)])));
    return value;
  };
  await mkdir(path.join(publicDir, 'assets/kit/backgrounds'), { recursive: true });
  // A página HQ (dentro das cenas HQ) é lida deste caminho fixo.
  await copyFile(path.join(BRAND_ROOT, BRAND_FILES['comic-page']), path.join(publicDir, 'assets/kit/backgrounds/comic-page.png'));
  return walk(props);
}

/** IDs `media:<id>` citados nas props de um componente. */
export function mediaRefs(props) {
  const found = new Set();
  const walk = value => { if (typeof value === 'string') { const match = /^media:([\w.-]+)$/.exec(value); if (match) found.add(match[1]); } else if (value && typeof value === 'object') Object.values(value).forEach(walk); };
  walk(props); return [...found];
}

function runWorker(request, { timeoutMs, memoryMb, signal, cacheDirectory }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
    const child = spawn(process.execPath, [`--max-old-space-size=${memoryMb}`, worker, request], { cwd: cacheDirectory, env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', TMPDIR: process.env.TMPDIR || os.tmpdir(), NODE_ENV: 'production' }, detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; let settled = false;
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12_000); });
    const signalChild = kind => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, kind); } catch { try { child.kill(kind); } catch { /* processo já terminou */ } } };
    const stop = () => { signalChild('SIGTERM'); const forced = setTimeout(() => signalChild('SIGKILL'), 2000); forced.unref?.(); };
    const timer = setTimeout(() => { stop(); finish(new Error(`Componente excedeu ${Math.round(timeoutMs / 1000)} s`)); }, timeoutMs);
    const abort = () => { stop(); finish(new DOMException('Cancelado', 'AbortError')); };
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', finish); child.on('close', code => finish(code === 0 ? null : new Error(lastLines(stderr) || `Processo Remotion saiu com código ${code}`)));
  });
}

function componentError(clipId, message) { return Object.assign(new Error(`Componente ${clipId} falhou: ${message}. Edite ou remova o clip e tente novamente.`), { code: 'COMPONENT_RENDER_FAILED', details: { clipId, recoverable: true } }); }
function lastLines(value) { return String(value).trim().split(/\r?\n/).slice(-4).join(' '); }
