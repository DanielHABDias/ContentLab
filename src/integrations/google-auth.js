import { createServer } from 'node:http';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, chmod, rm } from 'node:fs/promises';
import path from 'node:path';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export async function readPrivate(file, fallback = null) {
    try {
        return JSON.parse(await readFile(file, 'utf8'));
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return fallback;
        throw new Error('Configuração Google ilegível; preserve o arquivo e reconecte.');
    }
}
export async function writePrivate(file, value) {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await chmod(path.dirname(file), 0o700);
    const tmp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    await rename(tmp, file);
    await chmod(file, 0o600);
}
export class GoogleAuth {
    constructor(directory, { fetcher = fetch } = {}) { this.file = path.join(directory, 'credentials.json'); this.fetcher = fetcher; this.pending = null; this.lastError = null; }
    async configure(json) {
        const c = typeof json === 'string' ? JSON.parse(json) : json;
        if (c?.schema === 'contentlab-google-connection-v1') {
            const url = new URL(c.bridge?.url || '');
            if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) || url.search || url.hash) throw new Error('URL do conector pessoal inválida.');
            if (!/^[a-f0-9]{64}$/.test(c.bridge?.secret || '') || typeof c.channel?.name !== 'string' || !c.channel.name.trim() || c.channel.name.length > 100 || /[\r\n]/.test(c.channel.name) || !/^[\w-]+$/.test(c.rootId || '') || !/^[\w-]+$/.test(c.installation || '')) throw new Error('JSON de conexão incompleto. Gere-o pelo conector do Content Lab.');
            if (c.spreadsheetId && !/^[\w-]+$/.test(c.spreadsheetId)) throw new Error('ID de planilha inválido.');
            this.close();
            const previous = await readPrivate(this.file,null);
            try {
                await writePrivate(this.file, { connection: { schema:c.schema, channel:{name:c.channel.name.trim()}, installation:c.installation, rootId:c.rootId, spreadsheetId:c.spreadsheetId||'', bridge:{url:url.href,secret:c.bridge.secret} } });
                const ping = await this.bridgeRequest({action:'ping'});
                if (ping.rootId !== c.rootId || ping.installation !== c.installation) throw new Error('O JSON não corresponde ao conector desta pasta.');
            } catch(error) { if(previous)await writePrivate(this.file,previous);else await rm(this.file,{force:true});throw error; }
            return {configured:true, mode:'personal', channelName:c.channel.name.trim()};
        }
        if (c?.type === 'service_account')
            throw new Error('Este JSON é de conta de serviço. Ela não possui armazenamento no Drive pessoal. Importe um cliente OAuth do tipo Aplicativo para computador.');
        if (!c?.installed?.client_id?.endsWith('.apps.googleusercontent.com') || !c.installed.client_secret)
            throw new Error('Baixe o JSON OAuth do tipo Aplicativo para computador.');
        this.close();
        await writePrivate(this.file, { client: { client_id: c.installed.client_id, client_secret: c.installed.client_secret } });
        return { configured: true };
    }
    async status() {
        const c=await readPrivate(this.file,{});
        return {configured:Boolean(c.client||c.connection),connected:Boolean(c.connection||c.tokens?.refresh_token),mode:c.connection?'personal':'desktop',channelName:c.connection?.channel?.name||'',authorizing:Boolean(this.pending),error:this.lastError};
    }
    async bridgeRequest(packet) {
        const cfg=await readPrivate(this.file,{}), connection=cfg.connection;
        if(!connection)throw new Error('Importe o JSON do conector pessoal.');
        const payload=JSON.stringify({...packet,timestamp:Date.now(),nonce:randomBytes(16).toString('hex')});
        const signature=createHmac('sha256',connection.bridge.secret).update(payload).digest('base64url');
        let response=await this.fetcher(connection.bridge.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload,signature}),redirect:'manual',signal:AbortSignal.timeout(60000)});
        if([301,302,303].includes(response.status)) {
            const next=new URL(response.headers.get('location')||'');
            if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com'||next.port||next.username||next.password)throw new Error('O conector redirecionou para um destino inesperado. Confira a implantação.');
            response=await this.fetcher(next.href,{redirect:'error',signal:AbortSignal.timeout(60000)});
        }
        const result=await response.json().catch(()=>{throw new Error('O conector não respondeu em JSON. Confira a URL /exec e a implantação como você.');});
        if(!response.ok||!result.ok)throw Object.assign(new Error(result.error||'Falha no conector pessoal.'),{code:'GOOGLE_CONNECTOR_ERROR',status:result.status||response.status});
        return result.value;
    }
    async tokenRequest(values) {
        const r = await this.fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values), signal: AbortSignal.timeout(30000) });
        const v = await r.json();
        if (!r.ok)
            throw new Error(v.error === 'invalid_grant' ? 'A autorização Google expirou ou foi revogada. Conecte novamente.' : 'Não foi possível autorizar o Google. Confira o cliente e as APIs habilitadas.');
        return v;
    }
    async authorize({ picker = false } = {}) {
        const cfg = await readPrivate(this.file, {});
        if (!cfg.client)
            throw new Error('Importe primeiro o JSON do aplicativo para computador.');
        this.close();
        this.lastError = null;
        const state = randomBytes(32).toString('hex'), verifier = randomBytes(48).toString('base64url');
        const server = createServer(async (req, res) => {
            const u = new URL(req.url, 'http://127.0.0.1');
            res.setHeader('content-type', 'text/plain; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.setHeader('referrer-policy', 'no-referrer');
            if (u.pathname !== '/callback' || u.searchParams.get('state') !== state) {
                res.writeHead(400);
                res.end('Retorno de autorização inválido.');
                return;
            }
            try {
                if (u.searchParams.has('error') || !u.searchParams.get('code'))
                    throw new Error('Autorização cancelada.');
                const tokens = await this.tokenRequest({ ...cfg.client, code: u.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
                if (this.pending?.server !== server) throw new Error('Conexão cancelada.');
                if (tokens.scope && !tokens.scope.split(' ').includes(DRIVE_SCOPE))
                    throw new Error('Permissão para os arquivos do Drive não concedida.');
                const refresh = tokens.refresh_token || cfg.tokens?.refresh_token;
                if (!refresh)
                    throw new Error('Reconecte e permita acesso contínuo.');
                await writePrivate(this.file, { client: cfg.client, tokens: { ...tokens, refresh_token: refresh, expires_at: Date.now() + tokens.expires_in * 1000 }, pickedIds: (u.searchParams.get('picked_file_ids') || '').split(',').filter(Boolean) });
                res.end('Google conectado. Pode voltar ao Content Lab.');
            }
            catch (e) {
                this.lastError = e.message;
                res.writeHead(400);
                res.end(e.message);
            }
            finally {
                this.close();
            }
        });
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const redirect = `http://127.0.0.1:${server.address().port}/callback`;
        const timer = setTimeout(() => { this.lastError = 'A conexão expirou. Tente novamente.'; this.close(); }, 5 * 60000);
        timer.unref();
        server.unref();
        this.pending = { server, timer };
        const params = new URLSearchParams({ ...cfg.client, redirect_uri: redirect, response_type: 'code', scope: DRIVE_SCOPE, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
        params.delete('client_secret');
        if (picker) {
            params.set('trigger_onepick', 'true');
            params.set('allow_folder_selection', 'true');
            params.set('allow_multiple', 'true');
            params.set('mimetypes', 'application/vnd.google-apps.folder,application/vnd.google-apps.spreadsheet');
        }
        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
    }
    async accessToken() {
        const c = await readPrivate(this.file, {});
        if (!c.tokens?.refresh_token)
            throw new Error('Conecte sua conta Google.');
        if (c.tokens.expires_at > Date.now() + 60000)
            return c.tokens.access_token;
        const t = await this.tokenRequest({ ...c.client, refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token' });
        await writePrivate(this.file, { ...c, tokens: { ...c.tokens, ...t, expires_at: Date.now() + t.expires_in * 1000 } });
        return t.access_token;
    }
    close() { if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.server.close();
        this.pending = null;
    } }
    async disconnect() { this.close(); const c = await readPrivate(this.file, {}); if (c.tokens?.refresh_token) {
        const r = await this.fetcher('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: c.tokens.refresh_token }), signal: AbortSignal.timeout(10000) });
        if (!r.ok && r.status !== 400)
            throw new Error('Não foi possível revogar o acesso Google. Tente novamente.');
    } await rm(this.file, { force: true }); this.lastError = null; return { disconnected: true }; }
}
