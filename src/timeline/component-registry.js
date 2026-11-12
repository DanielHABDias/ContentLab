import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';
import { createHash } from 'node:crypto';

export const allowedComponentImports = new Set(['react', 'remotion', '@remotion/shapes', '@remotion/transitions']);
const SOURCE_LIMIT = 256 * 1024;

export class ComponentRegistry {
  constructor(root) { this.root = path.resolve(root); }
  async register({ id, source, label = id, exportName, propsSchema = {}, replace = false }) {
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(id)) throw new Error('ID de componente inválido');
    if (typeof source !== 'string' || !source.trim() || Buffer.byteLength(source) > SOURCE_LIMIT) throw new Error('Fonte TSX vazia ou grande demais');
    exportName ||= source.match(/export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)\b/)?.[1] || (source.match(/export\s+default\b/) ? 'default' : null);
    if ((!exportName || !/^[A-Za-z_$][\w$]*$/.test(exportName)) && exportName !== 'default') throw new Error('Export do componente inválido');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) if (!allowedComponentImports.has(match[1])) throw new Error(`Import não permitido: ${match[1]}`);
    if (/\b(?:eval|Function|process|globalThis|fetch|XMLHttpRequest|WebSocket|require|child_process|node:|fs\b)/.test(source) || /\bimport\s*\(/.test(source)) throw new Error('API não permitida no componente');
    const result = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
    const errors = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(`TSX inválido: ${errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
    const exportPattern = exportName === 'default' ? /export\s+default\b/ : new RegExp(`export\\s+(?:const|function|class)\\s+${exportName}\\b`);
    if (!exportPattern.test(source)) throw new Error(`Componente precisa exportar ${exportName}`);
    validatePropsSchema(propsSchema);
    const hash = createHash('sha256').update(source).digest('hex');
    const directory = path.join(this.root, id); const temporary = `${directory}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(this.root, { recursive: true });
    if (!replace && await exists(directory)) throw new Error(`Componente já existe: ${id}`);
    const manifest = { schema: 'contentlab-component-v1', id, label: String(label).slice(0, 80), entry: 'index.tsx', exportName, hash, propsSchema };
    try {
      await mkdir(temporary); await writeFile(path.join(temporary, 'index.tsx'), source, { mode: 0o600 }); await writeFile(path.join(temporary, 'component.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
      if (replace) await rm(directory, { recursive: true, force: true });
      await rename(temporary, directory);
    } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
    return manifest;
  }
  async inspect(id) {
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(id)) throw new Error('ID de componente inválido');
    const directory = path.join(this.root, id); const manifest = JSON.parse(await readFile(path.join(directory, 'component.json'), 'utf8'));
    const source = await readFile(path.join(directory, manifest.entry), 'utf8');
    if (manifest.schema !== 'contentlab-component-v1' || manifest.id !== id || createHash('sha256').update(source).digest('hex') !== manifest.hash) throw new Error(`Componente adulterado ou corrompido: ${id}`);
    return { ...manifest, sourcePath: path.join(directory, manifest.entry) };
  }
  async list() {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
    const results = [];
    for (const entry of entries) if (entry.isDirectory() && /^[a-z][a-z0-9_-]{2,63}$/.test(entry.name)) {
      try { results.push(await this.inspect(entry.name)); } catch { /* item corrompido não é oferecido */ }
    }
    return results.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(({ sourcePath, ...manifest }) => manifest);
  }
}

function validatePropsSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || Object.keys(schema).length > 32) throw new Error('Schema de propriedades inválido');
  for (const [key, descriptor] of Object.entries(schema)) {
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) throw new Error(`Propriedade inválida: ${key}`);
    const type = typeof descriptor === 'string' ? descriptor : descriptor?.type;
    if (!['string', 'text', 'number', 'boolean', 'color'].includes(type)) throw new Error(`Tipo de propriedade não permitido: ${key}`);
  }
}
async function exists(target) { return Boolean(await stat(target).catch(() => null)); }
