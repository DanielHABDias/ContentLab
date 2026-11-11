import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalApplicationService } from './local-application-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../..');
const defaultDataDirectory = path.join(repositoryRoot, '.contentlab');

export function createContentLabServer({ dataDirectory = process.env.CONTENTLAB_DATA_DIR || defaultDataDirectory, staticDirectory = path.join(repositoryRoot, 'dist') } = {}) {
  const application = new LocalApplicationService({ dataDirectory });
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/api/v1/health') return json(response, 200, await application.health());
      if (request.method === 'GET' && url.pathname === '/api/v1/projects') return json(response, 200, { projects: await application.listProjects() });
      if (request.method === 'POST' && url.pathname === '/api/v1/projects/open') {
        const body = await readJson(request);
        return json(response, 200, await application.registerProject(body.path));
      }
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Rota local desconhecida' });
      return await serveStatic(response, staticDirectory, url.pathname);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Requisição grande demais');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new Error('JSON inválido'); }
}

function json(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

async function serveStatic(response, directory, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = path.resolve(directory, relative);
  if (!file.startsWith(`${path.resolve(directory)}${path.sep}`)) return json(response, 404, { error: 'Arquivo não encontrado' });
  try { if (!(await stat(file)).isFile()) throw Object.assign(new Error(), { code: 'ENOENT' }); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    file = path.join(path.resolve(directory), 'index.html');
    try { await stat(file); } catch { return json(response, 503, { error: 'Interface ainda não compilada; execute npm run build' }); }
  }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CONTENTLAB_PORT || 4173);
  createContentLabServer().listen(port, '127.0.0.1', () => console.log(`Content Lab: http://127.0.0.1:${port}`));
}
