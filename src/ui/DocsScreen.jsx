import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { localApi } from './local-api.js';

const ScenePlayer = lazy(() => import('./KitPreview.jsx').then(module => ({ default: module.ScenePlayer })));
const BackgroundPlayer = lazy(() => import('./KitPreview.jsx').then(module => ({ default: module.BackgroundPlayer })));

const COLOR_LABELS = { amarelo: 'Amarelo', vermelho: 'Vermelho', azul: 'Azul', branco: 'Branco', tinta: 'Tinta' };
const TINTED = new Set(['explosao', 'meio-tom']);

/** Carrega a Anton do kit uma vez, para as prévias usarem a mesma fonte do render. */
function useKitFont() {
  useEffect(() => {
    if (typeof FontFace === 'undefined' || [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'Anton')) return;
    new FontFace('Anton', `url(${localApi.brandFileUrl('font', 'anton')})`).load().then(font => document.fonts.add(font)).catch(() => {});
  }, []);
}

/** Documentação do kit de motion: cenas tocando ao vivo, fundos com cor, sons e regras. */
export function DocsScreen({ onBack }) {
  const [docs, setDocs] = useState(null); const [error, setError] = useState(''); const [playing, setPlaying] = useState(null); const audio = useRef(null);
  const [scene, setScene] = useState(null); const [vertical, setVertical] = useState(false); const [tint, setTint] = useState('amarelo');
  useKitFont();
  useEffect(() => { localApi.brandDocs().then(value => { setDocs(value); setScene(value.scenes.find(item => item.example)?.id || null); }).catch(issue => setError(issue.message)); return () => audio.current?.pause(); }, []);
  const play = name => {
    setError('');
    if (audio.current) { audio.current.pause(); audio.current = null; }
    if (playing === name) { setPlaying(null); return; }
    const sound = new Audio(localApi.brandFileUrl('sfx', name)); audio.current = sound; setPlaying(name);
    sound.onended = () => setPlaying(current => (current === name ? null : current));
    sound.play().catch(() => { setPlaying(null); setError(`Não deu para tocar “${name}”. Confira o som do computador e tente de novo.`); });
  };
  const header = <header className="project-header"><div><span className="eyebrow">Kit de motion</span><h1>Documentação</h1>{docs && <p className="hint">O que todo projeto traz no modo composição: cenas, fundos, sons e regras.</p>}</div>{docs && <button className="button quiet" onClick={onBack}>Voltar</button>}</header>;
  if (!docs) return <main id="main" className="workspace docs">{header}{error ? <div className="notice error" role="alert"><X size={16}/>{error}</div> : <p className="empty-state" role="status">Carregando documentação…</p>}</main>;
  const previews = docs.scenes.filter(item => item.example); const current = previews.find(item => item.id === scene);
  const loading = <p className="empty-state" role="status">Carregando prévia…</p>;
  return <main id="main" className="workspace docs">
    {header}
    <nav className="docs-index" aria-label="Seções da documentação"><a href="#docs-scenes">Cenas</a><a href="#docs-backgrounds">Fundos</a><a href="#docs-sfx">Sons</a><a href="#docs-rules">Legenda e som</a></nav>
    <div aria-live="polite">{error && <div className="notice error" role="alert"><X size={16}/>{error}</div>}</div>

    <section className="workflow-card" aria-labelledby="docs-scenes"><div className="section-title"><h2 id="docs-scenes">Cenas do kit</h2><span>{docs.scenes.length} cenas</span></div>
      <p className="hint">Escolha uma cena para ver o exemplo tocando. No vídeo, as cenas usam as mídias e o personagem do projeto.</p>
      <div className="docs-player-controls">
        <div className="tone-list" role="group" aria-label="Cena de exemplo">{previews.map(item => <button key={item.id} type="button" className={`mini-button ${item.id === scene ? 'active' : ''}`} aria-pressed={item.id === scene} onClick={() => setScene(item.id)} translate="no">{item.id}</button>)}</div>
        <label className="check"><input type="checkbox" checked={vertical} onChange={event => setVertical(event.target.checked)}/> Short (9:16)</label>
      </div>
      {current && <div className="docs-player" aria-label={`Prévia da cena ${current.id}`}><Suspense fallback={loading}><ScenePlayer key={`${current.id}-${vertical}`} scene={current.id} props={current.example} vertical={vertical}/></Suspense></div>}
      <dl className="docs-list">{docs.scenes.map(item => <div key={item.id}><dt translate="no">{item.id}</dt><dd>{item.use}</dd></div>)}</dl>
      <h3>Humores</h3><p className="hint">Escolhem a pose do personagem do projeto pelo tom da fala.</p><p className="tone-list">{docs.moods.map(mood => <span key={mood} className="tone" translate="no">{mood}</span>)}</p>
      {docs.character && <><h3>Pacote de personagem</h3><p className="hint">{docs.character.pacote}</p></>}
    </section>

    <section className="workflow-card" aria-labelledby="docs-backgrounds"><div className="section-title"><h2 id="docs-backgrounds">Fundos</h2><span>{docs.backgrounds.length} fundos</span></div>
      <fieldset className="docs-colors"><legend>Cor (muda explosão e meio-tom)</legend>
        {docs.colors.map(color => <label key={color} className="check"><input type="radio" name="kit-color" value={color} checked={tint === color} onChange={() => setTint(color)}/> {COLOR_LABELS[color] || color}</label>)}
        <label className="check">Outra <input type="color" aria-label="Outra cor" value={/^#[0-9a-f]{6}$/i.test(tint) ? tint : '#2676e8'} onChange={event => setTint(event.target.value)}/></label>
      </fieldset>
      <ul className="background-grid">{docs.backgrounds.map(kind => <li key={kind}><Suspense fallback={loading}><BackgroundPlayer kind={kind} tint={TINTED.has(kind) ? tint : undefined}/></Suspense><strong translate="no">{kind}</strong></li>)}</ul>
    </section>

    <section className="workflow-card" aria-labelledby="docs-sfx"><div className="section-title"><h2 id="docs-sfx">Sons do kit</h2><span>{docs.sfx.length} sons</span></div>
      <p className="hint">Clique para ouvir. Cada som marca um evento na tela; o plano automático já põe o som certo.</p>
      <ul className="sfx-grid">{docs.sfx.map(item => <li key={item.name}><button className={`sfx-button ${playing === item.name ? 'playing' : ''}`} aria-pressed={playing === item.name} disabled={!item.available} onClick={() => play(item.name)}>{playing === item.name ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>}<span translate="no">{item.name}</span></button><small>{item.available ? item.use : 'Arquivo ausente em assets/kit/sfx.'}</small><small className="origin">{item.origin}</small></li>)}</ul>
    </section>

    <section className="workflow-card" aria-labelledby="docs-rules"><div className="section-title"><h2 id="docs-rules">Legenda e som</h2></div>
      <h3>Legenda</h3><ul className="docs-rules">{docs.captions.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <h3>Som</h3><ul className="docs-rules">{docs.sound.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <details><summary>Todas as regras do kit ({docs.rules.length})</summary><ul className="docs-rules">{docs.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></details>
    </section>
  </main>;
}
