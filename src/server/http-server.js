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
      if (request.method === 'GET' && url.pathname === '/api/v1/diagnostics') return json(response, 200, await application.diagnostics());
      if (request.method === 'POST' && url.pathname === '/api/v1/projects/open') {
        const body = await readJson(request);
        return json(response, 200, await application.registerProject(body.path));
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/projects/create') return json(response, 201, await application.createProject(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/projects/action') return json(response, 200, await application.runProjectAction(await readJson(request)));
      const lifecycle = { forget: 'forgetProject', reveal: 'revealProject', rename: 'renameProject', 'change-id': 'changeProjectId', duplicate: 'duplicateProject', export: 'exportProject', delete: 'deleteProject', restore: 'restoreProject', activities: 'listActivities', cancel: 'cancelActivities' };
      const lifecycleMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/projects\/([a-z-]+)$/);
      if (lifecycleMatch && lifecycle[lifecycleMatch[1]]) return json(response, 200, await application[lifecycle[lifecycleMatch[1]]](await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/directory') return json(response, 200, await application.chooseDirectory(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/package') return json(response, 200, await application.choosePackage(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/media') return json(response, 200, await application.chooseMedia(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/packages/import') return json(response, 201, await application.importPackage(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/media/import') return json(response, 201, await application.importMedia(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/render') return json(response, 201, await application.renderProject(await readJson(request)));
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Rota local desconhecida' });
      return await serveStatic(response, staticDirectory, url.pathname);
    } catch (error) {
      const status = error.code === 'PROJECT_BUSY' || /Conflito de revisão/.test(error.message) ? 409 : 400;
      return json(response, status, { error: error.message, ...(typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? { code: error.code } : {}), ...(error.details ? { details: error.details } : {}) });
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
