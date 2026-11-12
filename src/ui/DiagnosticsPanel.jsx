import { Fragment, useEffect, useState } from 'react';
import { Download, Info } from 'lucide-react';
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
      <p className="hint">O relatório não inclui títulos, roteiros, caminhos de projetos nem perfis de voz; a pasta pessoal aparece como “~”.</p>
    </>}
  </section>;
}
