import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';
import { createHash } from 'node:crypto';

const allowedImports = new Set(['react', 'remotion', '@remotion/shapes', '@remotion/transitions']);

export class ComponentRegistry {
  constructor(root) { this.root = path.resolve(root); }
  async register({ id, source, propsSchema = {} }) {
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(id)) throw new Error('ID de componente inválido');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) if (!allowedImports.has(match[1])) throw new Error(`Import não permitido: ${match[1]}`);
    if (/\b(?:eval|Function|process|globalThis|fetch|XMLHttpRequest|WebSocket|child_process|node:|fs\b)/.test(source)) throw new Error('API não permitida no componente');
    const result = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
    const errors = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(`TSX inválido: ${errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
    if (!/export\s+(?:default|const|function)/.test(source)) throw new Error('Componente precisa exportar uma função');
    const hash = createHash('sha256').update(source).digest('hex'); const directory = path.join(this.root, id); await mkdir(directory, { recursive: true });
    const manifest = { schema: 'contentlab-component-v1', id, entry: 'index.tsx', hash, propsSchema };
    await writeFile(path.join(directory, 'index.tsx'), source, { flag: 'wx' }); await writeFile(path.join(directory, 'component.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' }); return manifest;
  }
  async inspect(id) { return JSON.parse(await readFile(path.join(this.root, id, 'component.json'), 'utf8')); }
}
