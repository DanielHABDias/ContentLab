import { Fragment, useEffect, useState } from 'react';
import { Download, Info, RefreshCw, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from './Dialogs.jsx';
import { localApi } from './local-api.js';

const PATHS = { data: 'Dados do app', projects: 'Projetos', media: 'Cache de mídia', renderCache: 'Cache de render', tools: 'Ferramentas e modelos', renderOutput: 'Saída de render' };
const PLATFORM = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' };

export function DiagnosticsPanel() {
  const [about, setAbout] = useState(null); const [error, setError] = useState('');
  useEffect(() => { localApi.about().then(setAbout, issue => setError(issue.message)); }, []);
  const exportReport = () => {
    const blob = new Blob([JSON.stringify(about, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `contentlab-diagnostico-${about.generatedAt.slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
  };
  return <section className="workflow-card" aria-labelledby="about-title">
    <div className="section-title"><h2 id="about-title"><Info size={20}/> Sobre e diagnóstico</h2><button className="button quiet" disabled={!about} onClick={exportReport}><Download size={16}/> Exportar relatório</button></div>
    {error && <div className="notice error" role="alert">Diagnóstico indisponível: {error}</div>}
    {!about && !error && <p className="setup-meta" role="status">Carregando…</p>}
    {about && <>
      <dl className="target about-list">
        <dt>Versão</dt><dd>{about.app.name} {about.app.version}</dd>
        <dt>Sistema</dt><dd>{PLATFORM[about.system.platform] || about.system.platform} {about.system.arch} · Node {about.system.node} · {about.system.cpus} CPUs · {about.system.memoryGb} GB</dd>
        <dt>Seletor de arquivos</dt><dd>{about.nativeDialog.available ? `Nativo (${about.nativeDialog.tool})` : `Indisponível: ${about.nativeDialog.solution || 'instale o seletor do sistema'}`}</dd>
        {Object.entries(about.paths).filter(([, value]) => value).map(([key, value]) => <Fragment key={key}><dt>{PATHS[key] || key}</dt><dd><code>{value}</code></dd></Fragment>)}
        <dt>Dependências</dt><dd>{about.dependencies.filter(item => item.ready).length} de {about.dependencies.length} prontas{about.dependencies.some(item => item.required && !item.ready) ? ' · faltam essenciais, veja Dependências' : ''}</dd>
      </dl>
      <UpdateSection/>
      <p className="hint">O relatório não inclui títulos, roteiros, caminhos de projetos nem perfis de voz; a pasta pessoal aparece como “~”.</p>
    </>}
  </section>;
}

function UpdateSection() {
  const [status, setStatus] = useState(null); const [found, setFound] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(null);
  const load = () => localApi.updateStatus().then(setStatus, issue => setError(issue.message));
  useEffect(() => { load(); }, []);
  const act = async (task, done) => { setBusy(true); setError(''); setMessage(''); try { const result = await task(); if (done) setMessage(done(result)); await load(); return result; } catch (issue) { setError(issue.message); return null; } finally { setBusy(false); } };
  if (!status) return null;
  if (!status.installed) return <p className="setup-meta">Atualizações: {status.reason}</p>;
  return <div className="update-box" aria-labelledby="update-title">
    <h3 id="update-title">Atualizações</h3>
    <div className="setup-actions">
      <label>Canal<select value={status.channel} disabled={busy} onChange={event => act(() => localApi.updateConfigure({ channel: event.target.value }))}><option value="stable">Estável</option><option value="beta">Beta</option></select></label>
      <label className="check"><input type="checkbox" checked={status.manual} disabled={busy} onChange={event => act(() => localApi.updateConfigure({ manual: event.target.checked }))}/> Só atualizar manualmente</label>
    </div>
    <div className="setup-actions">
      <button className="button quiet" disabled={busy || !status.signing} title={status.signing ? undefined : 'Este build não tem chave de assinatura'} onClick={() => act(localApi.updateCheck, result => { setFound(result.available ? result : null); return result.available ? `Versão ${result.version} disponível.` : `Você está na versão mais recente (${result.current}).`; })}><RefreshCw size={16}/> Verificar agora</button>
      {found && <button className="button primary" disabled={busy} onClick={() => setConfirm('apply')}>Instalar {found.version}</button>}
      {status.previous && <button className="button quiet" disabled={busy} onClick={() => setConfirm('rollback')}><RotateCcw size={16}/> Voltar para {status.previous}</button>}
    </div>
    {!status.signing && <p className="hint">Este build só aceita atualização manual: baixe o pacote, confira o SHA-256 e rode <code>contentlab --install-archive</code>.</p>}
    {found?.notes && <p className="hint">Novidades: {found.notes}</p>}
    <p className="setup-meta">Versão {status.version}{status.lastCheck ? ` · última verificação ${new Date(status.lastCheck).toLocaleString('pt-BR')}` : ''}. Projetos, dados e modelos não são tocados ao atualizar.</p>
    <div aria-live="polite">{message && <p className="notice" role="status">{message}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
    {confirm && <ConfirmDialog tone="primary" title={confirm === 'apply' ? `Instalar ${found.version}` : `Voltar para ${status.previous}`} message={confirm === 'apply' ? `O pacote é conferido por assinatura e SHA-256 e instalado ao lado da versão atual, que fica guardada para voltar. Depois feche e abra o Content Lab.` : 'A versão atual fica guardada. Depois feche e abra o Content Lab.'} confirm={confirm === 'apply' ? 'Instalar' : 'Voltar versão'} onClose={() => setConfirm(null)} onConfirm={async () => { const kind = confirm; setConfirm(null); await act(kind === 'apply' ? localApi.updateApply : localApi.updateRollback, result => `${kind === 'apply' ? 'Instalada' : 'Ativa'} a versão ${result.version}. Feche e abra o Content Lab para usar.`); setFound(null); }}/>}
  </div>;
}
