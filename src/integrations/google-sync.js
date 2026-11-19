import path from 'node:path';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { GoogleAuth, readPrivate, writePrivate } from './google-auth.js';
import { GoogleApi, MIME, quote } from './google-api.js';
import { HEADERS, PROFILES } from './google-schema.js';
import { scriptChapters, BLOCK_LABELS } from '../core/script.js';
import { withProjectLock } from '../core/project-lock.js';
import { readProjectDirectory } from '../server/project-registry.js';
const hash = v => createHash('sha256').update(String(v)).digest('hex');
const profileFor = cfg => cfg.channelName ? {rootName:cfg.channelName,sheetName:`Canal do YT — V1.0 (${cfg.channelName})`} : PROFILES[cfg.profile];
const cell = v => ({ userEnteredValue: { stringValue: String(v ?? '') } });
export function googleId(v) { const s = String(v || '').trim(); if (!s || /^[\w-]+$/.test(s))
    return s; const u = new URL(s); if (!['drive.google.com', 'docs.google.com'].includes(u.hostname))
    throw new Error('Use um link Google válido.'); const m = u.pathname.match(/\/(?:folders|d)\/([\w-]+)/); if (!m)
    throw new Error('Link Google inválido.'); return m[1]; }
export function documentContent(project) { const p = []; const add = (text, style = 'NORMAL_TEXT') => p.push({ text: String(text || '') + '\n', style }); add(project.title, 'TITLE'); add('Briefing — NÃO NARRAR', 'HEADING_1'); for (const k of ['thesis', 'audience', 'promise', 'notes'])
    if (project.creative?.brief?.[k])
        add(project.creative.brief[k]); add('Embalagem — NÃO NARRAR', 'HEADING_1'); for (const k of ['titleA', ...(project.type === 'short' ? [] : ['titleB']), 'description'])
    if (project.creative?.packaging?.[k])
        add(project.creative.packaging[k]); for (const c of scriptChapters(project.creative?.script || {})) {
    add(c.title, 'HEADING_1');
    for (const b of c.blocks) {
        add(`${BLOCK_LABELS[b.type]}${b.type === 'narration' ? '' : ' — NÃO NARRAR'}`, 'HEADING_2');
        add(b.text);
    }
} if (project.creative?.script?.sources) {
    add('Fontes — NÃO NARRAR', 'HEADING_1');
    add(project.creative.script.sources);
} return p; }
export const docText = doc => (doc.body?.content || []).map(x => (x.paragraph?.elements || []).map(e => e.textRun?.content || '').join('')).join('');
export function schemaIssues(meta, values) { return Object.entries(HEADERS).flatMap(([name, headers]) => { const props = meta.sheets.find(s => s.properties.title === name)?.properties; if (!props)
    return [{ name, kind: 'missing' }]; const rows = values[name] || []; return JSON.stringify(rows[0]?.slice(0, headers.length) || []) === JSON.stringify(headers) ? [] : [{ name, kind: rows.length ? 'mismatch' : 'empty' }]; }); }
const sheetUrl = value => {const s=String(value||'');const formula=s.match(/^=\s*(?:HYPERLINK|HIPERLINK)\(\s*"((?:[^"]|"")*)"\s*[,;]/i);return formula?formula[1].replaceAll('""','"'):s;};
export function safeGoogleLink(value){try{const u=new URL(sheetUrl(value));return u.protocol==='https:'&&['docs.google.com','drive.google.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function safeVideoLink(value){try{const u=new URL(sheetUrl(value));return u.protocol==='https:'&&['youtube.com','www.youtube.com','youtu.be'].includes(u.hostname)&&!u.port&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export class GoogleSync {
    constructor(app, { auth = null, api = null } = {}) { this.app = app; this.directory = path.join(app.dataDirectory, 'google'); this.file = path.join(this.directory, 'sync.json'); this.auth = auth || new GoogleAuth(this.directory); this.api = api || new GoogleApi(this.auth); this.chain = Promise.resolve(); this.running = false; }
    async exclusive(task) { const run = async () => { await mkdir(this.directory, { recursive: true, mode: 0o700 }); return withProjectLock(this.directory, 'sincronização Google', task); }; const p = this.chain.then(run, run); this.chain = p.catch(() => { }); return p; }
    config() { return readPrivate(this.file, { installation: randomUUID(), profile: 'contentlab', automatic: false, projects: {} }); }
    async status() { const cfg = await this.config(); const a = await this.auth.status(); const credentials = await readPrivate(this.auth.file, {}); return { ...a, profile: cfg.profile, channelName: cfg.channelName || a.channelName || '', automatic: cfg.automatic, rootId: cfg.rootId || '', spreadsheetId: cfg.spreadsheetId || '', prepared: Boolean(cfg.prepared), pickedIds: credentials.pickedIds || [], running: this.running, lastSync: cfg.lastSync || null, warnings:cfg.warnings||[], error: a.error || cfg.error || null, projects: Object.values(cfg.projects).map(({ id, docId, revision, syncedAt }) => ({ id, docId, revision, syncedAt })) }; }
    async configure({ credentials, profile, automatic, resetStructure = false } = {}) {
        let bootstrap=false;
        await this.exclusive(async () => {
            if(profile!==undefined&&!PROFILES[profile])throw new Error('Perfil inválido.');
            let cfg=await this.config();
            if(resetStructure){await writePrivate(path.join(this.directory,`sync-archive-${Date.now()}.json`),cfg);cfg={installation:randomUUID(),profile:profile||cfg.profile,automatic:false,projects:{}};}
            if(credentials){
                await this.auth.configure(credentials);
                const authFile=await readPrivate(this.auth.file,{}), conn=authFile.connection;
                if(conn){
                    if(cfg.rootId&&cfg.rootId!==conn.rootId){await writePrivate(path.join(this.directory,`sync-archive-${Date.now()}.json`),cfg);cfg={projects:{}};}
                    cfg={...cfg,installation:conn.installation,profile:'contentlab',channelName:conn.channel.name,rootId:conn.rootId,spreadsheetId:conn.spreadsheetId||cfg.spreadsheetId||'',automatic:true};
                    bootstrap=true;
                } else cfg.automatic=false;
            }
            if(profile!==undefined){if(cfg.folders&&cfg.profile!==profile)throw new Error('Escolha outro destino antes de alterar o perfil vinculado.');cfg.profile=profile;}
            if(automatic!==undefined){if(typeof automatic!=='boolean')throw new Error('Opção automática inválida.');cfg.automatic=automatic;}
            await writePrivate(this.file,cfg);
        });
        if(bootstrap){await this.prepare();await this.sync();}
        return this.status();
    }
    connect(input = {}) { return this.exclusive(() => this.auth.authorize({ picker: input.picker === true })); }
    disconnect() { return this.exclusive(async () => {
        await this.auth.disconnect();
        const cfg = await this.config();
        cfg.automatic = false; cfg.error = null;
        await writePrivate(this.file, cfg);
        return this.status();
    }); }
    inspect(input = {}) { return this.exclusive(async () => { const found = await this.discover(await this.config(), input); return { root: found.root, sheet: found.sheet, issues: found.issues, visibility: 'A busca encontra apenas arquivos autorizados para este app. Se já existe uma estrutura, selecione-a no Google antes de criar.' }; }); }
    async discover(cfg,{rootId='',spreadsheetId=''}={}) {
        const profile=profileFor(cfg), rid=googleId(rootId)||cfg.rootId;
        const root=rid?await this.api.file(rid):await this.api.find(profile.rootName,MIME.folder);
        if(root&&(root.mimeType!==MIME.folder||root.trashed))throw new Error('Escolha uma pasta raiz válida.');
        const sid=googleId(spreadsheetId)||cfg.spreadsheetId;
        let sheet=sid?await this.api.file(sid):root?await this.api.find(profile.sheetName,MIME.sheet,root.id):null;
        if(!sheet&&root){
            const candidates=await this.api.list(`mimeType='${MIME.sheet}' and '${quote(root.id)}' in parents`),compatible=[];
            for(const candidate of candidates){const snapshot=await this.snapshot(candidate.id);const recognizable=snapshot.meta.sheets.some(s=>['Produções','Ideias'].includes(s.properties.title));if(recognizable){const issues=schemaIssues(snapshot.meta,snapshot.values);if(issues.some(i=>i.kind==='mismatch'))throw new Error('Já existe uma planilha do canal com cabeçalhos incompatíveis. Confira-a antes de criar outra.');compatible.push(candidate);}}
            if(compatible.length>1)throw new Error('Há mais de uma planilha no padrão do canal. Informe a planilha correta no JSON.');
            sheet=compatible[0]||null;
        }
        if(sheet&&(sheet.mimeType!==MIME.sheet||sheet.trashed))throw new Error('Escolha uma planilha nativa Google Sheets.');
        if(sheet&&root&&!sheet.parents?.includes(root.id))throw new Error('A planilha precisa estar dentro da raiz escolhida.');
        if(sheet&&!root)throw new Error('Informe a pasta raiz que já contém essa planilha.');
        const snapshot=sheet?await this.snapshot(sheet.id):null;
        return {root,sheet,issues:snapshot?schemaIssues(snapshot.meta,snapshot.values):[]};
    }
    async snapshot(id) { const meta = await this.api.sheets(id, '?fields=spreadsheetId,sheets.properties'); const names = Object.keys(HEADERS).filter(n => meta.sheets.some(s => s.properties.title === n)); const v = names.length ? await this.api.sheets(id, '/values:batchGet?' + names.map(n => `ranges=${encodeURIComponent("'" + n + "'!A:AZ")}`).join('&') + '&valueRenderOption=FORMULA') : { valueRanges: [] }; return { meta, values: Object.fromEntries(names.map((n, i) => [n, v.valueRanges[i]?.values || []])) }; }
    async ensure(name, mime, parent, key) { let f = await this.api.find(name, mime, parent); if (!f)
        f = await this.api.create(name, mime, parent, key); const verified = await this.api.file(f.id); if (verified.mimeType !== mime || verified.trashed || parent && !verified.parents?.includes(parent))
        throw new Error('Arquivo Google com identidade/pasta incompatível.'); return verified; }
    prepare(input = {}) { return this.exclusive(async () => { if ((await this.auth.status()).authorizing) throw new Error('Conclua a autorização Google antes de preparar a estrutura.'); const cfg = await this.config(); if (cfg.prepared && ((input.rootId && googleId(input.rootId) !== cfg.rootId) || (input.spreadsheetId && googleId(input.spreadsheetId) !== cfg.spreadsheetId)))
        throw new Error('Desconecte antes de trocar a estrutura vinculada.'); const found = await this.discover(cfg, input); if (found.issues.some(i => i.kind === 'mismatch'))
        throw new Error('Cabeçalhos incompatíveis. Nenhum dado foi sobrescrito.'); const profile = profileFor(cfg); const save = () => writePrivate(this.file, cfg); const root = found.root || await this.ensure(profile.rootName, MIME.folder, null, `${cfg.installation}:root`); cfg.rootId = root.id; await save(); const sheet = found.sheet || await this.ensure(profile.sheetName, MIME.sheet, root.id, `${cfg.installation}:sheet`); cfg.spreadsheetId = sheet.id; await save(); cfg.folders ||= {};
        cfg.folders.Backgrounds = (await this.ensure('Backgrounds', MIME.folder, root.id, `${cfg.installation}:Backgrounds`)).id; await save(); for (const group of ['Roteiros', 'Thumbnails']) {
        const p = await this.ensure(group, MIME.folder, root.id, `${cfg.installation}:${group}`);
        for (const kind of ['Longos', 'Shorts']) {
            cfg.folders[`${group}/${kind}`] = (await this.ensure(kind, MIME.folder, p.id, `${cfg.installation}:${group}:${kind}`)).id;
            await save();
        }
    } await this.repair(cfg); cfg.prepared = true; cfg.error = null; await save(); return this.status(); }); }
    row(sheetId, row, values) { return { updateCells: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: values.length }, rows: [{ values: values.map(cell) }], fields: 'userEnteredValue' } }; }
    async repair(cfg) {
        let snap = await this.snapshot(cfg.spreadsheetId);
        const issues = schemaIssues(snap.meta, snap.values);
        if (issues.some(i => i.kind === 'mismatch'))
            throw new Error('Cabeçalhos incompatíveis.');
        const rows = snap.values.Config || [];
        if (new Set(rows.slice(1).filter(r => r[0]).map(r => r[0])).size !== rows.slice(1).filter(r => r[0]).length)
            throw new Error('Chaves duplicadas na aba Config.');
        const binding = rows.find(r => r[0] === 'CURRENT_SPREADSHEET_ID');
        if (binding && binding[1] !== cfg.spreadsheetId)
            throw new Error('Config aponta para outra planilha. Repare o vínculo da cópia antes de continuar.');
        const owner = rows.find(r => r[0] === 'CONTENTLAB_INSTALLATION_ID');
        if (owner && owner[1] !== cfg.installation)
            throw new Error('Esta planilha pertence a outra instalação do Content Lab.');
        let sid = Math.max(0, ...snap.meta.sheets.map(s => s.properties.sheetId)) + 1;
        const requests = [];
        for (const [name, headers] of Object.entries(HEADERS)) {
            let props = snap.meta.sheets.find(s => s.properties.title === name)?.properties;
            if (!props) {
                props = { sheetId: sid++, title: name, gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 }, hidden: name === 'Config' };
                requests.push({ addSheet: { properties: props } });
            }
            else
                requests.push({ updateSheetProperties: { properties: { sheetId: props.sheetId, gridProperties: { frozenRowCount: 1 }, ...(name === 'Config' ? { hidden: true } : {}) }, fields: name === 'Config' ? 'gridProperties.frozenRowCount,hidden' : 'gridProperties.frozenRowCount' } });
            if (issues.some(i => i.name === name))
                requests.push(this.row(props.sheetId, 0, headers));
        }
        if (requests.length)
            await this.api.sheets(cfg.spreadsheetId, ':batchUpdate', { method: 'POST', body: { requests } });
        snap = await this.snapshot(cfg.spreadsheetId);
        if (schemaIssues(snap.meta, snap.values).length)
            throw new Error('Falha ao validar as abas criadas.');
        const config = snap.values.Config;
        const props = snap.meta.sheets.find(s => s.properties.title === 'Config').properties;
        const links = { CURRENT_SPREADSHEET_ID: cfg.spreadsheetId, CONTENTLAB_INSTALLATION_ID: cfg.installation, ROOT_FOLDER_ID: cfg.rootId, ...Object.fromEntries(Object.entries(cfg.folders).map(([k, v]) => ['FOLDER_' + k.replace('/', '_'), v])) };
        const updates = [];
        for (const [k, v] of Object.entries(links)) {
            let i = config.findIndex(r => r[0] === k);
            if (i < 0) {
                i = config.length;
                config.push([k, v, 'Content Lab']);
            }
            else
                config[i] = [k, v, config[i][2] || 'Content Lab'];
            updates.push(this.row(props.sheetId, i, config[i]));
        }
        await this.api.sheets(cfg.spreadsheetId, ':batchUpdate', { method: 'POST', body: { requests: updates } });
        const check = await this.snapshot(cfg.spreadsheetId);
        for (const [k, v] of Object.entries(links))
            if (check.values.Config.find(r => r[0] === k)?.[1] !== v)
                throw new Error('Vínculos Google não conferem após a escrita.');
    }
    sync({ path: directory } = {}) { return this.exclusive(async () => { this.running = true; const cfg = await this.config(); try {
        if ((await this.auth.status()).authorizing) throw new Error('Conclua a autorização Google antes de sincronizar.');
        if (!cfg.prepared)
            throw new Error('Prepare a estrutura primeiro.');
        const projects = directory ? [{ path: directory }] : await this.app.registry.list({ withSize: false, discover: true });
        cfg.warnings=[];
        const results = [], failures = [];
        for (const entry of projects) {
            if (['missing', 'invalid'].includes(entry.status))
                continue;
            try { results.push(await this.syncProject(cfg, await readProjectDirectory(entry.path))); }
            catch (error) { failures.push(`${entry.title || path.basename(entry.path)}: ${error.message}`); }
            await writePrivate(this.file, cfg);
        }
        if (failures.length) throw new Error(`${results.length} projeto(s) conferido(s); ${failures.length} pendência(s): ${failures.join(' · ')}`);
        cfg.lastSync = new Date().toISOString();
        cfg.error = null;
        await writePrivate(this.file, cfg);
        return { results, status: await this.status() };
    }
    catch (e) {
        cfg.error = e.message;
        await writePrivate(this.file, cfg);
        throw e;
    }
    finally {
        this.running = false;
    } }); }
    async syncProject(cfg, project) {
        const key = hash(project.id);
        const prior = cfg.projects[key];
        if (prior?.revision === project.revision)
            return { id: prior.id, unchanged: true };
        if (!prior?.id && !/\b(?:VD|SH)_\d{4,}\b/.test(project.title) && this.api.reserveId) { const reserved = await this.api.reserveId(cfg.spreadsheetId,project.type==='short'?'SH':'VD',key); if(reserved){cfg.projects[key]={id:reserved};await writePrivate(this.file,cfg);} }
        const snap = await this.snapshot(cfg.spreadsheetId);
        if (schemaIssues(snap.meta, snap.values).length)
            throw new Error('As abas mudaram. Valide a estrutura novamente.');
        const config = structuredClone(snap.values.Config);
        if (new Set(config.slice(1).filter(r => r[0]).map(r => r[0])).size !== config.slice(1).filter(r => r[0]).length)
            throw new Error('Chaves duplicadas na aba Config.');
        if (config.find(r => r[0] === 'CURRENT_SPREADSHEET_ID')?.[1] !== cfg.spreadsheetId || config.find(r => r[0] === 'CONTENTLAB_INSTALLATION_ID')?.[1] !== cfg.installation)
            throw new Error('Vínculo da planilha alterado.');
        const rows = snap.values['Produções'];
        const prefix = project.type === 'short' ? 'SH' : 'VD';
        const labels = project.title.match(/\b(?:VD|SH)_\d{4,}\b/g) || [];
        if (labels.length > 1)
            throw new Error('Título com IDs ambíguos.');
        let id = cfg.projects[key]?.id || labels[0];
        if (id && !id.startsWith(prefix + '_'))
            throw new Error('ID incompatível com o tipo do projeto.');
        const counter = config.find(r => r[0] === `LAST_ID_${prefix}`);
        if (!id && !counter && rows.slice(1).some(r => String(r[0] || '').startsWith(prefix + '_'))) throw new Error('Inicialize o contador com o histórico completo de IDs antes de reservar uma nova produção.');
        let last = Number(counter?.[1] || 0);
        if (!Number.isSafeInteger(last) || last < 0)
            throw new Error('Contador de produção inválido.');
        for (const v of [...rows, ...snap.values.Ideias, ...config].flat())
            for (const m of String(v).matchAll(new RegExp(`\\b${prefix}_(\\d+)\\b`, 'g')))
                last = Math.max(last, Number(m[1]));
        if (!id) id = `${prefix}_${String(last + 1).padStart(4, '0')}`;
        if (!prior) { cfg.projects[key] = {id}; await writePrivate(this.file,cfg); }
        last = Math.max(last, Number(id.split('_')[1]));
        if (!Number.isSafeInteger(last)) throw new Error('ID de produção fora do intervalo suportado.');
        const hits = rows.map((r, i) => r[0] === id ? i : -1).filter(i => i >= 0);
        if (hits.length > 1)
            throw new Error(`${id} duplicado na planilha.`);
        const index = hits[0] ?? rows.length;
        const ledgerKey = `CONTENTLAB_PROJECT_${key}`;
        if (index < rows.length && !prior?.managed && config.find(r=>r[0]===ledgerKey)?.[1]!==id) {
            const row=rows[index], pack=project.creative?.packaging||{}, thesis=project.creative?.brief?.thesis||'';
            const agrees=row[1]===(project.type==='short'?'SHORT':'LONGO')&&((pack.titleA&&row[5]===pack.titleA)||(thesis&&row[2]===thesis));
            if(!agrees)throw new Error(`${id} já existe na planilha com outro conteúdo. Confira o vínculo; não foi sobrescrito.`);
            const url=safeGoogleLink(row[9]);
            if(row[9]&&!url)throw new Error(`${id}: vínculo de roteiro inválido na planilha.`);
            if(url){const docId=googleId(url), expectedFolder=cfg.folders[`Roteiros/${project.type==='short'?'Shorts':'Longos'}`], f=await this.api.file(docId);if(f.mimeType!==MIME.doc||f.trashed||!f.parents?.includes(expectedFolder))throw new Error(`${id}: confira a identidade e pasta do roteiro existente.`);const remote=await this.api.docs(docId);cfg.projects[key]={id,docId,docHash:hash(docText(remote)),docRevision:remote.revisionId};await writePrivate(this.file,cfg);}
        }
        const existing = rows[index] || [];
        if (prior?.managed)
            for (const [c, v] of Object.entries(prior.managed).filter(([c]) => c !== '3'))
                if (String(existing[Number(c)] ?? '') !== v)
                    throw new Error(`${id}: célula editada no Google. Reconcilie antes de sincronizar.`);
        const folder = cfg.folders[`Roteiros/${project.type === 'short' ? 'Shorts' : 'Longos'}`];
        let checkpoint = cfg.projects[key];
        if (!checkpoint?.docId) {
            const documentKey = `${cfg.installation}:${key}:script`;
            const files = await this.api.list(`appProperties has { key='contentlabKey' and value='${quote(documentKey)}' }`);
            if (files.length > 1)
                throw new Error('Documentos duplicados.');
            const f = files[0] || await this.api.create(`${id} — ${project.title}`, MIME.doc, folder, documentKey);
            checkpoint = cfg.projects[key] = { id, docId: f.id };
            await writePrivate(this.file, cfg);
        }
        const docId = checkpoint.docId;
        const f = await this.api.file(docId);
        if (f.trashed || f.mimeType !== MIME.doc || !f.parents?.includes(folder))
            throw new Error('Roteiro movido ou substituído no Google.');
        const doc = await this.api.docs(docId);
        const current = docText(doc);
        if (checkpoint.pendingDocHash && checkpoint.pendingDocHash === hash(current)) {
            checkpoint.docHash = hash(current);
            checkpoint.docRevision = doc.revisionId;
            delete checkpoint.pendingDocHash;
            await writePrivate(this.file, cfg);
        }
        if (checkpoint.docHash && (checkpoint.docHash !== hash(current) || checkpoint.docRevision && checkpoint.docRevision !== doc.revisionId) || !checkpoint.docHash && current.trim())
            throw new Error(`${id}: roteiro editado no Google ou escrita anterior não confirmada. Não foi sobrescrito.`);
        const paragraphs = documentContent(project);
        const text = paragraphs.map(p => p.text).join('');
        const requests = [];
        const end = doc.body?.content?.at(-1)?.endIndex || 1;
        if (end > 2)
            requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } });
        requests.push({ insertText: { location: { index: 1 }, text } });
        requests.push({ updateParagraphStyle: { range: { startIndex: 1, endIndex: text.length + 1 }, paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }, fields: 'namedStyleType' } });
        let offset = 1;
        for (const p of paragraphs) {
            if (p.style !== 'NORMAL_TEXT')
                requests.push({ updateParagraphStyle: { range: { startIndex: offset, endIndex: offset + p.text.length }, paragraphStyle: { namedStyleType: p.style }, fields: 'namedStyleType' } });
            offset += p.text.length;
        }
        let verified = doc;
        if (current !== text + '\n') {
            checkpoint.pendingDocHash = hash(text + '\n');
            await writePrivate(this.file, cfg);
            await this.api.docs(docId, ':batchUpdate', { method: 'POST', body: { writeControl: { requiredRevisionId: doc.revisionId }, requests } });
            verified = await this.api.docs(docId);
            if (docText(verified) !== text + '\n') throw new Error('Texto do roteiro divergiu na leitura de retorno.');
        }
        checkpoint.docHash = hash(docText(verified));
        checkpoint.docRevision = verified.revisionId;
        delete checkpoint.pendingDocHash;
        await writePrivate(this.file, cfg);
        const pack = project.creative?.packaging || {};
        const managed = { 0: id, 1: project.type === 'short' ? 'SHORT' : 'LONGO', 2: project.creative?.brief?.thesis || project.title, 5: pack.titleA || '', 6: project.type === 'short' ? '' : pack.titleB || '', 9: `https://docs.google.com/document/d/${docId}/edit` };
        if (project.type === 'short') managed[8] = '';
        for(const [variant,mediaId] of [['A',pack.thumbnailA||pack.thumbnailMediaId],...(project.type==='short'?[]:[['B',pack.thumbnailB]])]) {
            if(!mediaId)continue;
            const media=project.media?.find(m=>m.id===mediaId);
            if(!media||media.kind!=='image'||!['owned','licensed','authorized'].includes(media.rights)){cfg.warnings||=[];cfg.warnings.push(`${id}: thumbnail ${variant} aguarda arquivo e direitos confirmados.`);continue;}
            const file=await this.app.resolveMediaPath(media);if(!file)throw new Error(`${id}: arquivo da thumbnail ${variant} não encontrado.`);
            if((await stat(file)).size>8*1024*1024)throw new Error(`${id}: thumbnail acima de 8 MB.`);const bytes=await readFile(file);const digest=createHash('sha256').update(bytes).digest('hex');
            const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
            if(!mime)throw new Error(`${id}: formato da thumbnail ${variant} inválido.`);
            const parent=cfg.folders[`Thumbnails/${project.type==='short'?'Shorts':'Longos'}`],keyName=`${cfg.installation}:${key.slice(0,24)}:${variant}:${digest.slice(0,16)}`;
            const files=await this.api.list(`appProperties has { key='contentlabKey' and value='${quote(keyName)}' }`);if(files.length>1)throw new Error('Thumbnails duplicadas no Drive.');
            const uploaded=files[0]||await this.api.uploadImage(`${id} — Thumbnail ${variant}`,file,mime,parent,keyName);
            const verified=await this.api.file(uploaded.id);if(verified.mimeType!==mime||!verified.parents?.includes(parent)||verified.trashed)throw new Error('Thumbnail enviada para um destino incompatível.');
            managed[variant==='A'?7:8]=`https://drive.google.com/file/d/${uploaded.id}/view`;
        }
        const stage = project.stages?.find(s => s.state === 'active' || s.state === 'changes_requested')?.id;
        const status = ({ brief: 'PESQUISA', packaging: 'PLANEJADO', script: 'ROTEIRO', media: 'ASSETS', narration: 'ASSETS', edit: 'EDIÇÃO', review: 'REVISÃO FINAL' })[stage] || (project.stages?.length && project.stages.every(s => s.state === 'approved') ? 'PRONTO' : 'PLANEJADO');
        if (index === rows.length || prior?.managed?.[3] !== undefined && String(existing[3] ?? '') === prior.managed[3])
            managed[3] = status;
        const props = snap.meta.sheets.find(s => s.properties.title === 'Produções').properties;
        const cp = snap.meta.sheets.find(s => s.properties.title === 'Config').properties;
        const updates = Object.entries(managed).map(([c, v]) => ({ updateCells: { range: { sheetId: props.sheetId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: Number(c), endColumnIndex: Number(c) + 1 }, rows: [{ values: [cell(v)] }], fields: 'userEnteredValue' } }));
        if (index >= props.gridProperties.rowCount)
            updates.unshift({ appendDimension: { sheetId: props.sheetId, dimension: 'ROWS', length: 100 } });
        for (const [k, v] of [[`LAST_ID_${prefix}`, String(last)], [ledgerKey, id]]) {
            let i = config.findIndex(r => r[0] === k);
            if (i < 0) {
                i = config.length;
                config.push([k, v, 'Content Lab']);
            }
            else
                config[i] = [k, v, config[i][2] || 'Content Lab'];
            updates.push(this.row(cp.sheetId, i, config[i]));
        }
        const fresh = await this.snapshot(cfg.spreadsheetId);
        if (JSON.stringify(fresh.values) !== JSON.stringify(snap.values))
            throw new Error('A planilha mudou durante a sincronização. Releia e tente novamente.');
        if(this.api.atomicSheetUpdate)await this.api.atomicSheetUpdate(cfg.spreadsheetId,snap.values,updates);else await this.api.sheets(cfg.spreadsheetId, ':batchUpdate', { method: 'POST', body: { requests: updates } });
        const check = await this.snapshot(cfg.spreadsheetId);
        const confirmed = check.values['Produções'].filter(r => r[0] === id);
        if (confirmed.length !== 1 || Object.entries(managed).some(([c, v]) => String(confirmed[0][Number(c)] ?? '') !== v))
            throw new Error('Linha da produção divergiu na leitura de retorno.');
        cfg.projects[key] = { ...checkpoint, managed, revision: project.revision, syncedAt: new Date().toISOString() };
        return { id, docId, revision: project.revision };
    }
    async archive({query='',type='',status=''}={}) {
        const cfg=await this.config();
        if(!cfg.spreadsheetId||!cfg.prepared)return {connected:false,records:[],next:{VD:1,SH:1},channelName:cfg.channelName||''};
        const snapshot=await this.snapshot(cfg.spreadsheetId);
        if(schemaIssues(snapshot.meta,snapshot.values).length)throw new Error('A planilha está fora do padrão. Confira os cabeçalhos.');
        const records=snapshot.values['Produções'].slice(1).filter(row=>/^(VD|SH)_\d+$/.test(row[0]||'')).map(row=>Object.fromEntries(HEADERS['Produções'].map((name,i)=>[name,row[i]??''])));
        const next={VD:1,SH:1};
        for(const prefix of Object.keys(next)){
            let last=Number(snapshot.values.Config.find(r=>r[0]==='LAST_ID_'+prefix)?.[1]||0);
            for(const row of Object.values(snapshot.values).flat())for(const value of row)for(const m of String(value).matchAll(new RegExp('\\b'+prefix+'_(\\d+)\\b','g')))last=Math.max(last,Number(m[1]));
            next[prefix]=last+1;
        }
        const localProjects=await this.app.registry.list({withSize:false,discover:true});
        const linked=Object.entries(cfg.projects).map(([key,p])=>({...p,key}));
        const enriched=records.map(row=>{const link=linked.find(p=>p.id===row.ID);const local=link&&localProjects.find(p=>hash(p.id)===link.key&&!['missing','invalid'].includes(p.status));return {id:row.ID,type:row.TIPO,title:row['TÍTULO A']||row['TEMA / CONTEXTO']||row.ID,status:row.STATUS,topic:row['TEMA / CONTEXTO'],scriptUrl:safeGoogleLink(row.ROTEIRO),thumbnailA:safeGoogleLink(row['THUMBNAIL A']),thumbnailB:safeGoogleLink(row['THUMBNAIL B']),videoUrl:safeVideoLink(row['LINK YOUTUBE']),kitUrl:safeGoogleLink(row['KIT PUBLICAÇÃO']),notes:row['OBSERVAÇÕES'],localPath:local?.path||null};});
        const search=String(query).toLocaleLowerCase('pt-BR');
        return {connected:true,channelName:cfg.channelName||profileFor(cfg).rootName,next,records:enriched.filter(r=>(!type||r.type===type)&&(!status||r.status===status)&&(!search||[r.id,r.title,r.topic,r.notes].join(' ').toLocaleLowerCase('pt-BR').includes(search)))};
    }
    async reserveTitle(title,type,operationId) {
        const cfg=await this.config();
        if(!cfg.prepared||/\b(?:VD|SH)_\d{4,}\b/.test(title))return title;
        return this.exclusive(async()=>{const prefix=type==='short'?'SH':'VD';const id=await this.api.reserveId?.(cfg.spreadsheetId,prefix,hash(operationId));return id?`${id} — ${title}`:title;});
    }
    schedule(){clearTimeout(this.scheduled);this.scheduled=setTimeout(()=>this.tick(),2000);this.scheduled.unref();}
    start() { if (this.timer)
        return; this.timer = setInterval(() => this.tick(), 60000); this.timer.unref(); }
    async tick() { if (this.ticking)
        return; this.ticking = true; try {
        const cfg = await this.config();
        const auth = await this.auth.status();
        if (cfg.automatic && cfg.prepared && auth.connected && !auth.authorizing)
            await this.sync();
    }
    catch { /* erro visível no status, trabalho local preservado */ }
    finally {
        this.ticking = false;
    } }
    close() { clearTimeout(this.scheduled); clearInterval(this.timer); this.timer = null; this.auth.close(); }
}
