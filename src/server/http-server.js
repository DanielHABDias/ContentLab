import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalApplicationService } from './local-application-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../..');
const defaultDataDirectory = path.join(repositoryRoot, '.contentlab');

export function createContentLabServer({ dataDirectory = process.env.CONTENTLAB_DATA_DIR || defaultDataDirectory, staticDirectory = path.join(repositoryRoot, 'dist'), toolsDirectory = process.env.CONTENTLAB_TOOLS_DIR || path.join(repositoryRoot, '.tools'), application = new LocalApplicationService({ dataDirectory, toolsDirectory }) } = {}) {
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
      if (request.method === 'GET' && url.pathname === '/api/v1/setup/status') return json(response, 200, await application.setupStatus());
      if (request.method === 'GET' && url.pathname === '/api/v1/setup/jobs') return json(response, 200, application.setupJobs());
      const setupRoutes = { install: 'setupInstall', pause: 'setupPause', resume: 'setupResume', cancel: 'setupCancel', onboarding: 'setupOnboarding' };
      const setupMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/setup\/([a-z]+)$/);
      if (setupMatch && setupRoutes[setupMatch[1]]) return json(response, 200, await application[setupRoutes[setupMatch[1]]](await readJson(request)));
      if (request.method === 'GET' && url.pathname === '/api/v1/media/file') return await serveMedia(request, response, await application.mediaFile({ path: url.searchParams.get('path'), mediaId: url.searchParams.get('media'), cutId: url.searchParams.get('cut') || undefined }));
      if (request.method === 'GET' && url.pathname === '/api/v1/jobs') return json(response, 200, application.listJobs({ path: url.searchParams.get('path') || undefined }));
      if (request.method === 'POST' && url.pathname === '/api/v1/media/upload') return json(response, 201, await application.importMediaUpload({ path: url.searchParams.get('path'), name: url.searchParams.get('name'), rights: url.searchParams.get('rights') || 'pending', size: Number(request.headers['content-length']), stream: request }));
      const mediaRoutes = { 'import-files': 'importMediaFiles', 'import-url': 'importMediaUrl', usage: 'mediaUsage', remove: 'removeMedia', cut: 'createMediaCut', 'cut-remove': 'removeMediaCut', transcribe: 'transcribeMedia', transcript: 'mediaTranscript', 'transcript-save': 'saveMediaTranscript', search: 'searchTranscripts' };
      const mediaMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/media\/([a-z-]+)$/);
      if (mediaMatch && mediaRoutes[mediaMatch[1]]) return json(response, 200, await application[mediaRoutes[mediaMatch[1]]](await readJson(request)));
      if (request.method === 'GET' && url.pathname === '/api/v1/edit/preview') return await serveMedia(request, response, await application.editPreviewFile({ name: url.searchParams.get('name') }));
      const editRoutes = { state: 'editState', apply: 'editTimeline', undo: 'editUndo', redo: 'editRedo', 'add-media': 'editAddMedia', 'add-component': 'editAddComponent', components: 'editComponents', captions: 'editCaptions', aspect: 'editAspect', frame: 'editFrame', clip: 'editClip' };
      const editMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/edit\/([a-z-]+)$/);
      if (editMatch && editRoutes[editMatch[1]]) return json(response, 200, await application[editRoutes[editMatch[1]]](await readJson(request)));
      if (request.method === 'GET' && url.pathname === '/api/v1/narration/file') return await serveMedia(request, response, await application.narrationFile({ path: url.searchParams.get('path'), takeId: url.searchParams.get('take') || undefined, preview: url.searchParams.get('preview') || undefined, assembled: url.searchParams.get('assembled') === '1', profileId: url.searchParams.get('profile') || undefined, original: url.searchParams.get('original') === '1' }));
      if (request.method === 'POST' && url.pathname === '/api/v1/narration/upload') return json(response, 201, await application.narrationUpload({ path: url.searchParams.get('path'), name: url.searchParams.get('name'), origin: url.searchParams.get('origin') || 'recording', size: Number(request.headers['content-length']), stream: request }));
      const narrationRoutes = { state: 'narrationState', import: 'narrationImport', 'take-update': 'narrationUpdateTake', reorder: 'narrationReorder', 'take-delete': 'narrationDeleteTake', preview: 'narrationPreview', assemble: 'narrationAssemble', 'profile-create': 'voiceProfileCreate', 'profile-report': 'voiceProfileReport', 'profile-delete': 'voiceProfileDelete', generate: 'voiceGenerate', 'voice-plan': 'voicePlan' };
      const narrationMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/narration\/([a-z-]+)$/);
      if (narrationMatch && narrationRoutes[narrationMatch[1]]) return json(response, 200, await application[narrationRoutes[narrationMatch[1]]](await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/jobs/cancel') return json(response, 200, application.cancelJob(await readJson(request)));
      const getRoutes = { '/api/v1/settings': 'getSettings', '/api/v1/storage/usage': 'storageUsage', '/api/v1/storage/orphans': 'storageOrphans', '/api/v1/storage/jobs': 'storageJobs', '/api/v1/registry/backups': 'listRegistryBackups' };
      if (request.method === 'GET' && getRoutes[url.pathname]) return json(response, 200, await application[getRoutes[url.pathname]]());
      const postRoutes = { '/api/v1/settings/validate': 'validateFolder', '/api/v1/settings/update': 'updateSettings', '/api/v1/storage/cleanup': 'storageCleanup', '/api/v1/storage/plan': 'planMigration', '/api/v1/storage/migrate': 'startMigration', '/api/v1/storage/cancel': 'cancelMigration', '/api/v1/registry/backup': 'backupRegistry', '/api/v1/registry/restore': 'restoreRegistry' };
      if (request.method === 'POST' && postRoutes[url.pathname]) return json(response, 200, await application[postRoutes[url.pathname]](await readJson(request)));
      const lifecycle = { relocate: 'relocateProject', forget: 'forgetProject', reveal: 'revealProject', rename: 'renameProject', 'change-id': 'changeProjectId', duplicate: 'duplicateProject', export: 'exportProject', delete: 'deleteProject', restore: 'restoreProject', activities: 'listActivities', cancel: 'cancelActivities' };
      const lifecycleMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/projects\/([a-z-]+)$/);
      if (lifecycleMatch && lifecycle[lifecycleMatch[1]]) return json(response, 200, await application[lifecycle[lifecycleMatch[1]]](await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/directory') return json(response, 200, await application.chooseDirectory(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/package') return json(response, 200, await application.choosePackage(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/dialog/media') return json(response, 200, await application.chooseMedia(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/packages/import') return json(response, 201, await application.importPackage(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/packages/inspect') return json(response, 200, await application.inspectPackage(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/media/import') return json(response, 201, await application.importMedia(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/render') return json(response, 201, await application.renderProject(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/render/presets') return json(response, 200, await application.renderPresets(await readJson(request)));
      if (request.method === 'POST' && url.pathname === '/api/v1/render/jobs') return json(response, 200, await application.listRenderJobs(await readJson(request)));
      const renderRoutes = { start: 'enqueueRender', cancel: 'cancelRenderJob', retry: 'retryRenderJob', reveal: 'revealRenderJob', log: 'renderJobLog' };
      const renderMatch = request.method === 'POST' && url.pathname.match(/^\/api\/v1\/render\/([a-z]+)$/);
      if (renderMatch && renderRoutes[renderMatch[1]]) return json(response, renderMatch[1] === 'start' ? 201 : 200, await application[renderRoutes[renderMatch[1]]](await readJson(request)));
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Rota local desconhecida' });
      return await serveStatic(response, staticDirectory, url.pathname);
    } catch (error) {
      const status = ['PROJECT_BUSY', 'PROJECT_LOCKED', 'SETTINGS_CONFLICT', 'MIGRATION_RUNNING', 'NARRATION_CONFLICT', 'TRANSCRIPT_CONFLICT', 'VOICE_BUSY', 'HISTORY_STALE'].includes(error.code) || /Conflito de revisão/.test(error.message) ? 409 : 400;
      return json(response, status, { error: error.message, ...(typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? { code: error.code } : {}), ...(error.details ? { details: error.details } : {}) });
    }
  });
}

/** Envia mídia com suporte a Range (necessário para avançar no player). */
async function serveMedia(request, response, { file, size, contentType }) {
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (!(start <= end) || start >= size) { response.writeHead(416, { 'content-range': `bytes */${size}` }); return response.end(); }
    response.writeHead(206, { 'content-type': contentType, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    return createReadStream(file, { start, end }).pipe(response);
  }
  response.writeHead(200, { 'content-type': contentType, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  createReadStream(file).pipe(response);
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
