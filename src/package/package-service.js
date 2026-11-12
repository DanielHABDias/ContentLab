import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ZipFile } from 'yazl';
import yauzl from 'yauzl';

export class PackageService {
  async exportContentLab(sourceDirectory, output, { level = 6, include = () => true } = {}) {
    validateLevel(level); const started = performance.now(); const source = path.resolve(sourceDirectory); const files = (await walk(source)).filter(item => include(item.relative));
    const blobs = new Map(); const entries = [];
    for (const file of files) { const hash = await sha256(file.absolute); const info = await stat(file.absolute); entries.push({ path: file.relative, hash, size: info.size, mode: info.mode & 0o777 }); if (!blobs.has(hash)) blobs.set(hash, file.absolute); }
    const manifest = { schema: 'contentlab-package-v1', createdAt: new Date().toISOString(), compression: { algorithm: 'deflate', level }, entries };
    const temporary = `${path.resolve(output)}.partial`; await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    try { await writeArchive(temporary, level, archive => { archive.addBuffer(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'), 'contentlab-manifest.json'); for (const [hash, file] of blobs) archive.addFile(file, `blobs/${hash}`); }); await rm(path.resolve(output), { force: true }); const { rename } = await import('node:fs/promises'); await rename(temporary, path.resolve(output)); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
    const packed = await stat(path.resolve(output)); return { path: path.resolve(output), files: entries.length, blobs: blobs.size, size: packed.size, durationMs: Math.round(performance.now() - started), manifest };
  }

  async exportZip(sourceDirectory, output, { level = 6, include = () => true } = {}) {
    validateLevel(level); const source = path.resolve(sourceDirectory); const files = (await walk(source)).filter(item => include(item.relative)); const temporary = `${path.resolve(output)}.partial`;
    await writeArchive(temporary, level, archive => { for (const file of files) archive.addFile(file.absolute, file.relative); }); await rm(path.resolve(output), { force: true }); const { rename } = await import('node:fs/promises'); await rename(temporary, path.resolve(output)); return { path: path.resolve(output), files: files.length, size: (await stat(path.resolve(output))).size };
  }

  async inspect(packagePath) { const absolute = path.resolve(packagePath); const entries = await readZip(absolute); const manifestEntry = entries.get('contentlab-manifest.json'); if (!manifestEntry) throw new Error('Manifesto .contentlab ausente'); const manifest = JSON.parse(manifestEntry.toString('utf8')); validateManifest(manifest); const projectEntry = manifest.entries.find(entry => entry.path === 'project.json'); const projectBuffer = projectEntry && entries.get(`blobs/${projectEntry.hash}`); if (!projectBuffer) throw new Error('project.json ausente no pacote'); return { manifest, project: JSON.parse(projectBuffer.toString('utf8')), archiveEntries: entries.size, archiveSize: (await stat(absolute)).size, logicalSize: manifest.entries.reduce((sum, entry) => sum + entry.size, 0) }; }

  async inspectZip(packagePath) { const absolute = path.resolve(packagePath); const entries = await readZip(absolute); const project = entries.get('project.json'); if (!project) throw new Error('project.json ausente no ZIP'); return { project: JSON.parse(project.toString('utf8')), archiveEntries: entries.size, archiveSize: (await stat(absolute)).size, logicalSize: [...entries.values()].reduce((sum, entry) => sum + entry.length, 0) }; }

  async restore(packagePath, destination) {
    const target = path.resolve(destination); await mkdir(target, { recursive: true }); const entries = await readZip(path.resolve(packagePath)); const manifestBuffer = entries.get('contentlab-manifest.json'); if (!manifestBuffer) throw new Error('Manifesto .contentlab ausente'); const manifest = JSON.parse(manifestBuffer.toString('utf8')); validateManifest(manifest);
    const planned = [];
    for (const entry of manifest.entries) { const relative = safeRelative(entry.path); const blob = entries.get(`blobs/${entry.hash}`); if (!blob) throw new Error(`Blob ausente: ${entry.hash}`); const actual = createHash('sha256').update(blob).digest('hex'); if (actual !== entry.hash || blob.length !== entry.size) throw new Error(`Integridade inválida: ${entry.path}`); const output = path.resolve(target, relative); if (!output.startsWith(`${target}${path.sep}`)) throw new Error('Caminho fora do destino'); planned.push({ output, blob, mode: entry.mode }); }
    for (const item of planned) { await mkdir(path.dirname(item.output), { recursive: true }); await writeFile(item.output, item.blob, { flag: 'wx', mode: item.mode }); }
    return { destination: target, files: planned.length, schema: manifest.schema };
  }

  async restoreZip(packagePath, destination) {
    const target = path.resolve(destination); const entries = await readZip(path.resolve(packagePath));
    if (!entries.has('project.json')) throw new Error('project.json ausente no ZIP');
    await mkdir(target, { recursive: true });
    for (const [relative, contents] of entries) { const output = path.resolve(target, safeRelative(relative)); if (!output.startsWith(`${target}${path.sep}`)) throw new Error('Caminho fora do destino'); await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, contents, { flag: 'wx', mode: 0o600 }); }
    return { destination: target, files: entries.size, schema: 'zip' };
  }
}

async function walk(root, current = root) { const output = []; for (const name of await readdir(current)) { const absolute = path.join(current, name); const info = await lstat(absolute); if (info.isSymbolicLink()) throw new Error(`Symlink não permitido: ${absolute}`); if (info.isDirectory()) output.push(...await walk(root, absolute)); else if (info.isFile()) output.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/') }); } return output; }
async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
function validateLevel(value) { if (!Number.isInteger(value) || value < 0 || value > 9) throw new Error('Nível de compressão deve estar entre 0 e 9'); }
function safeRelative(value) { if (typeof value !== 'string' || !value || value.includes('\0') || path.posix.isAbsolute(value) || value.split('/').some(part => part === '..' || part === '')) throw new Error(`Caminho inseguro: ${value}`); return value.split('/').join(path.sep); }
function validateManifest(value) { if (value?.schema !== 'contentlab-package-v1' || !Array.isArray(value.entries)) throw new Error('Manifesto .contentlab inválido'); const paths = new Set(); for (const entry of value.entries) { safeRelative(entry.path); if (paths.has(entry.path)) throw new Error(`Caminho duplicado: ${entry.path}`); paths.add(entry.path); if (!/^[a-f0-9]{64}$/.test(entry.hash) || !Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error(`Entrada inválida: ${entry.path}`); } }

async function writeArchive(output, level, populate) { await mkdir(path.dirname(output), { recursive: true }); return await new Promise((resolve, reject) => { const stream = createWriteStream(output); const zip = new ZipFile(); const options = { compress: level > 0, compressionLevel: level }; const archive = { addBuffer: (buffer, name) => zip.addBuffer(buffer, name, options), addFile: (file, name) => zip.addFile(file, name, options) }; stream.on('close', resolve); stream.on('error', reject); zip.outputStream.on('error', reject); zip.outputStream.pipe(stream); populate(archive); zip.end(); }); }
async function readZip(file) { return await new Promise((resolve, reject) => { yauzl.open(file, { lazyEntries: true, decodeStrings: true }, (error, zip) => { if (error) return reject(error); const entries = new Map(); zip.on('error', reject); zip.on('entry', entry => { let name; try { name = safeRelative(entry.fileName); } catch (issue) { zip.close(); return reject(issue); } if (/\/$/.test(name)) return zip.readEntry(); if ((entry.externalFileAttributes >>> 16 & 0o170000) === 0o120000) { zip.close(); return reject(new Error('Symlink no pacote')); } zip.openReadStream(entry, (streamError, stream) => { if (streamError) return reject(streamError); const chunks = []; let size = 0; stream.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024 * 1024) stream.destroy(new Error('Entrada excede o limite')); else chunks.push(chunk); }); stream.on('error', reject); stream.on('end', () => { if (entries.has(name)) return reject(new Error(`Entrada ZIP duplicada: ${name}`)); entries.set(name, Buffer.concat(chunks)); zip.readEntry(); }); }); }); zip.on('end', () => resolve(entries)); zip.readEntry(); }); }); }
