import { readFile, stat } from 'node:fs/promises';
export const MIME = { folder: 'application/vnd.google-apps.folder', sheet: 'application/vnd.google-apps.spreadsheet', doc: 'application/vnd.google-apps.document' };
export const quote = v => String(v).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const fields = 'id,name,mimeType,parents,trashed,appProperties';
export class GoogleApi {
    constructor(auth, { fetcher = fetch } = {}) { this.auth = auth; this.fetcher = fetcher; }
    async request(url, { method = 'GET', body } = {}) {
        if ((await this.auth.status?.())?.mode === 'personal') return this.auth.bridgeRequest({action:'request',url,method,...(body===undefined?{}:{body})}); const r = await this.fetcher(url, { method, headers: { authorization: `Bearer ${await this.auth.accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) }); const v = await r.json().catch(() => ({})); if (!r.ok)
        throw Object.assign(new Error(({ 401: 'Reconecte sua conta Google.', 403: 'Confira as APIs habilitadas e selecione o arquivo em Escolher no Google.', 404: 'Arquivo ausente ou não autorizado. Selecione-o em Escolher no Google.', 429: 'Limite temporário do Google; tente novamente mais tarde.' })[r.status] || `Falha no Google (${r.status}). O projeto local está preservado.`), { code: 'GOOGLE_API_ERROR', status: r.status }); return v; }
    async atomicSheetUpdate(id, expected, requests) {
        if ((await this.auth.status?.())?.mode === 'personal') return this.auth.bridgeRequest({action:'sheetBatch',spreadsheetId:id,expected,requests});
        return this.sheets(id,':batchUpdate',{method:'POST',body:{requests}});
    }
    async reserveId(spreadsheetId,prefix,operationId) {
        if ((await this.auth.status?.())?.mode !== 'personal') return null;
        return (await this.auth.bridgeRequest({action:'reserve',spreadsheetId,prefix,operationId})).id;
    }
    async uploadImage(name,file,mime,parent,key) {
        const size=(await stat(file)).size;if(size>8*1024*1024)throw new Error('Thumbnail acima de 8 MB. Reduza a imagem antes de sincronizar.');
        const data=await readFile(file), body={name,mimeType:mime,parents:[parent],appProperties:{contentlabKey:key}};
        const url='https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,appProperties';
        if((await this.auth.status?.())?.mode==='personal')return this.auth.bridgeRequest({action:'request',url,method:'POST',body,upload:{mime,base64:data.toString('base64')}});
        const boundary='contentlab_'+Date.now();
        const payload=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(body)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),data,Buffer.from(`\r\n--${boundary}--`)]);
        const response=await this.fetcher(url,{method:'POST',headers:{authorization:`Bearer ${await this.auth.accessToken()}`,'content-type':`multipart/related; boundary=${boundary}`},body:payload,signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw new Error('Não foi possível enviar a thumbnail.');return response.json();
    }
    drive(route, o) { return this.request(`https://www.googleapis.com/drive/v3/${route}`, o); }
    sheets(id, route = '', o) { return this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${route}`, o); }
    docs(id, route = '', o) { return this.request(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(id)}${route}`, o); }
    file(id) { if (!/^[\w-]+$/.test(id))
        throw new Error('ID Google inválido.'); return this.drive(`files/${id}?fields=${fields}&supportsAllDrives=true`); }
    async list(q) { const files = []; let token; do {
        const p = new URLSearchParams({ q: `trashed=false and (${q})`, fields: `nextPageToken,incompleteSearch,files(${fields})`, pageSize: '1000', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true' });
        if (token)
            p.set('pageToken', token);
        const v = await this.drive(`files?${p}`);
        if (v.incompleteSearch) throw new Error('A busca Google está incompleta. Selecione uma pasta antes de criar novos itens.'); files.push(...v.files);
        token = v.nextPageToken;
    } while (token); return files; }
    async find(name, mime, parent) { const a = await this.list(`name='${quote(name)}' and mimeType='${quote(mime)}'${parent ? ` and '${quote(parent)}' in parents` : ''}`); if (a.length > 1)
        throw new Error(`Há itens duplicados chamados ${name}. Escolha a identidade correta; nada foi criado.`); return a[0] || null; }
    create(name, mime, parent, key) { return this.drive(`files?fields=${fields}&supportsAllDrives=true`, { method: 'POST', body: { name, mimeType: mime, ...(parent ? { parents: [parent] } : {}), appProperties: { contentlabKey: key } } }); }
}
