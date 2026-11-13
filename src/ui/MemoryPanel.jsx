import { useEffect, useState } from 'react';
import { ConfirmDialog } from './Dialogs.jsx';
import { localApi } from './local-api.js';

const gbText = bytes => `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;

/**
 * Falta RAM para a voz clonada: mostra quanto falta e os programas abertos que mais usam
 * memória, com botão para fechar cada um (com confirmação). Navegadores ganham a opção de
 * fechar só algumas abas pelo gerenciador de tarefas deles.
 */
export function MemoryPanel({ plan, onChanged, onRetry, onUseEconomy, busy }) {
  const [apps, setApps] = useState(null); const [confirming, setConfirming] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = async () => { try { setApps((await localApi.systemApps()).apps); } catch (issue) { setError(issue.message); } };
  useEffect(() => { load(); }, [plan.availableBytes]);
  const missingBytes = Math.max(0, plan.requiredBytes - plan.availableBytes);
  const close = async (app, force = false) => {
    setError(''); setMessage('');
    try {
      const result = await localApi.closeApp({ name: app.name, force });
      if (result.closed) setMessage(`${app.name} fechado: cerca de ${gbText(result.freedBytes)} liberados.`);
      else setConfirming({ ...app, stuck: true });
    } catch (issue) { setError(issue.message); }
    await onChanged(); await load();
  };
  return <div id="memory-panel" className="memory-panel" role="region" aria-labelledby="memory-title">
    <div className="memory-head">
      <div><strong id="memory-title">{plan.runtimeFailure ? 'A geração atingiu o limite de memória' : `Libere ${gbText(missingBytes)} de memória para gerar`}</strong><small>A voz clonada precisa de {gbText(plan.requiredBytes)} livres; há {gbText(plan.availableBytes)} agora. Feche algum destes programas:</small></div>
      <button className="mini-button" disabled={busy} onClick={onRetry}>Tentar de novo</button>
    </div>
    <span className="memory-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (plan.availableBytes / plan.requiredBytes) * 100)}%` }}/></span>
    {plan.mode !== 'economy' && onUseEconomy && <p className="setup-actions"><span>Você também pode usar o VoxCPM2 econômico, que precisa de menos memória.</span><button className="button quiet" disabled={busy} onClick={onUseEconomy}>Trocar para modo econômico</button></p>}
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {apps === null ? <p className="plan-line">Procurando programas abertos…</p> : apps.length ? <ul className="memory-apps">{apps.map(app => <li key={app.name}>
      <span><strong>{app.name}</strong><small>{gbText(app.bytes)}{app.kind === 'browser' ? ' · navegador: dá para fechar só algumas abas com Shift+Esc (gerenciador de tarefas dele)' : ''}</small></span>
      <button className="mini-button" aria-label={`Fechar ${app.name}${app.kind === 'browser' ? ' inteiro' : ''}`} onClick={() => setConfirming(app)}>{app.kind === 'browser' ? 'Fechar tudo' : 'Fechar'}</button>
    </li>)}</ul> : <p className="plan-line">Nenhum programa grande aberto. Talvez este computador não tenha memória suficiente agora.</p>}
    {confirming && <ConfirmDialog
      title={confirming.stuck ? `${confirming.name} não fechou` : `Fechar ${confirming.name}?`}
      message={confirming.stuck ? `${confirming.name} não respondeu. Forçar o fechamento encerra na hora: o que não foi salvo nele se perde.` : `${confirming.name} vai ser fechado por completo (${confirming.processes} processo${confirming.processes === 1 ? '' : 's'}, ${gbText(confirming.bytes)}). Salve o que estiver aberto nele antes.${confirming.kind === 'browser' ? ' Se o Content Lab estiver aberto neste navegador, a página fecha junto; o servidor continua e é só abrir de novo.' : ''}`}
      confirm={confirming.stuck ? 'Forçar fechamento' : `Fechar ${confirming.name}`}
      onClose={() => setConfirming(null)}
      onConfirm={async () => { const app = confirming; setConfirming(null); await close(app, Boolean(app.stuck)); }}
    />}
  </div>;
}

