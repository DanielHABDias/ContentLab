import { useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { localApi } from './local-api.js';

const TONE_LABELS = { abertura: 'abertura', base: 'base', explicacao: 'explicação', enfase: 'ênfase', opiniao: 'opinião', piada: 'piada', pergunta: 'pergunta', surpresa: 'surpresa', discordancia: 'discordância', ressalva: 'ressalva', bastidor: 'bastidor', erro: 'erro', tristeza: 'tristeza', descoberta: 'descoberta', aprovacao: 'aprovação', vitoria: 'vitória' };

/** Documentação curta do padrão do canal: ouvir os SFX, ver as poses do Nox e as regras do kit. */
export function DocsScreen({ onBack }) {
  const [docs, setDocs] = useState(null); const [error, setError] = useState(''); const [playing, setPlaying] = useState(null); const audio = useRef(null);
  useEffect(() => { localApi.brandDocs().then(setDocs).catch(issue => setError(issue.message)); return () => audio.current?.pause(); }, []);
  const play = name => {
    setError('');
    if (audio.current) { audio.current.pause(); audio.current = null; }
    if (playing === name) { setPlaying(null); return; }
    const sound = new Audio(localApi.brandFileUrl('sfx', name)); audio.current = sound; setPlaying(name);
    sound.onended = () => setPlaying(current => (current === name ? null : current));
    sound.play().catch(() => { setPlaying(null); setError(`Não deu para tocar “${name}”. Confira o som do computador e tente de novo.`); });
  };
  if (!docs) return <main id="main" className="workspace docs"><header className="project-header"><div><span className="eyebrow">Padrão do canal</span><h1>Documentação</h1></div></header>{error ? <div className="notice error" role="alert"><X size={16}/>{error}</div> : <p className="empty-state" role="status">Carregando documentação…</p>}</main>;
  return <main id="main" className="workspace docs">
    <header className="project-header"><div><span className="eyebrow">Padrão do canal</span><h1>Documentação</h1><p className="hint">O que todo projeto já traz do kit Diazverso. Vem do plugin; para mudar, altere lá e rode <code>npm run scenes:diazverso</code>.</p></div><button className="button quiet" onClick={onBack}>Voltar</button></header>
    <nav className="docs-index" aria-label="Seções da documentação"><a href="#docs-sfx">Sons</a><a href="#docs-poses">Poses do Nox</a><a href="#docs-scenes">Cenas</a><a href="#docs-rules">Legenda e som</a></nav>
    <div aria-live="polite">{error && <div className="notice error" role="alert"><X size={16}/>{error}</div>}</div>

    <section className="workflow-card" aria-labelledby="docs-sfx"><div className="section-title"><h2 id="docs-sfx">Sons do kit</h2><span>{docs.sfx.length} sons</span></div>
      <p className="hint">Clique para ouvir. Cada som marca um evento na tela; o plano automático já põe o som certo.</p>
      <ul className="sfx-grid">{docs.sfx.map(item => <li key={item.name}><button className={`sfx-button ${playing === item.name ? 'playing' : ''}`} aria-pressed={playing === item.name} disabled={!item.available} onClick={() => play(item.name)}>{playing === item.name ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>}<span translate="no">{item.name}</span></button><small>{item.available ? item.use : 'Arquivo ausente: rode npm run scenes:diazverso.'}</small><small className="origin">{item.origin}</small></li>)}</ul>
    </section>

    <section className="workflow-card" aria-labelledby="docs-poses"><div className="section-title"><h2 id="docs-poses">Poses do Nox</h2><span>{docs.poses.length} poses</span></div>
      <p className="hint">Enquanto fala, o Nox troca de pose a cada 0,7–1 s, sem animação entre elas. Variantes (-b) são sorteadas.</p>
      <ul className="pose-grid">{docs.poses.map(pose => <li key={pose.id}><div className="pose-images">{pose.files.length ? pose.files.map(file => <img key={file} src={localApi.brandFileUrl('pose', file.replace(/\.png$/, ''))} alt={`Nox, pose ${pose.id}${file.includes('-b') ? ' (variante)' : ''}: ${pose.gesture}`} width="96" height="142" loading="lazy" decoding="async"/>) : <span className="hint">Sem PNG: usa o Nox com o humor.</span>}</div><strong translate="no">{pose.id}</strong><small>{pose.gesture}</small>{pose.eyes && <small>Olhos: {pose.eyes}</small>}<span className="tone-list">{pose.tones.map(tone => <span key={tone} className="tone" title={docs.tones[tone]}>{TONE_LABELS[tone] || tone}</span>)}</span></li>)}</ul>
    </section>

    <section className="workflow-card" aria-labelledby="docs-scenes"><div className="section-title"><h2 id="docs-scenes">Cenas do kit</h2><span>{docs.scenes.length} cenas</span></div>
      <dl className="docs-list">{docs.scenes.map(scene => <div key={scene.id}><dt translate="no">{scene.id}</dt><dd>{scene.use}</dd></div>)}</dl>
      <h3>Humores do Nox</h3><p className="tone-list">{docs.moods.map(mood => <span key={mood} className="tone" translate="no">{mood}</span>)}</p>
      <h3>Fundos</h3><p className="tone-list">{docs.backgrounds.map(item => <span key={item} className="tone" translate="no">{item}</span>)}</p>
    </section>

    <section className="workflow-card" aria-labelledby="docs-rules"><div className="section-title"><h2 id="docs-rules">Legenda e som</h2></div>
      <h3>Legenda</h3><ul className="docs-rules">{docs.captions.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <h3>Som</h3><ul className="docs-rules">{docs.sound.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <details><summary>Todas as regras do kit ({docs.rules.length})</summary><ul className="docs-rules">{docs.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></details>
    </section>
  </main>;
}
