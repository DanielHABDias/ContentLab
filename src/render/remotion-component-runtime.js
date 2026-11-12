import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
        const key = createHash('sha256').update(JSON.stringify({ runtime: 'png-v1', hash: manifest.hash, props: layer.componentProps, fps: plan.fps, duration: layer.durationInFrames, canvas: plan.canvas })).digest('hex');
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
    await writeFile(request, JSON.stringify({ sourcePath: manifest.sourcePath, exportName: manifest.exportName, props: sanitizeProps(manifest.propsSchema, layer.componentProps), fps: plan.fps, durationInFrames: layer.durationInFrames, width: plan.canvas.width, height: plan.canvas.height, output: partial, workDirectory: temporary }));
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

export function sanitizeProps(schema, values = {}) {
  const result = {};
  for (const [key, descriptor] of Object.entries(schema || {})) {
    const spec = typeof descriptor === 'string' ? { type: descriptor } : descriptor;
    const value = values[key] ?? spec.default;
    if (value === undefined) continue;
    if (spec.type === 'number') { const number = Number(value); if (!Number.isFinite(number)) throw new Error(`Valor inválido para ${key}`); result[key] = number; }
    else if (spec.type === 'boolean') result[key] = value === true || value === 'true';
    else { const text = String(value); if (text.length > 4000) throw new Error(`Valor grande demais para ${key}`); result[key] = text; }
  }
  return result;
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
