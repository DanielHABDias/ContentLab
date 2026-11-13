import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { localApi } from './local-api.js';

export function NarrationReaderLink({ projectPath }) {
  const query = new URLSearchParams({ view: 'narration-script', project: projectPath });
  return <a className="button quiet" href={`?${query}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} aria-hidden="true"/> Abrir roteiro em outra aba</a>;
}

function narrationChapters(scenes) {
  const chapters = [];
  for (const scene of scenes) {
    const id = scene.chapterId || scene.section || scene.id;
    let chapter = chapters.find(item => item.id === id);
    if (!chapter) {
      chapter = { id, title: scene.chapterTitle || ({ hook: 'Abertura', development: 'Desenvolvimento', payoff: 'Encerramento' }[scene.section]) || scene.label.replace(/ \d+$/, ''), scenes: [] };
      chapters.push(chapter);
    }
    chapter.scenes.push(scene);
  }
  return chapters;
}

export function NarrationChapters({ scenes }) {
  const chapters = narrationChapters(scenes);
  return chapters.length ? chapters.map((chapter, index) => <section className="read-chapter" id={`chapter-${index}`} key={chapter.id} aria-labelledby={`read-chapter-${index}`}>
    <h3 id={`read-chapter-${index}`}>{chapter.title}</h3><small>Título de orientação · não narrar</small>
    <ol className="read-scenes">{chapter.scenes.map(scene => <li key={scene.id}>{(scene.lines || [{ text: scene.text }]).map((line, i) => <p key={i}>{line.text}</p>)}</li>)}</ol>
  </section>) : <p className="empty-state">O roteiro ainda não tem texto para narrar.</p>;
}

/** Aba de leitura independente: abrir ou fechar não altera a gravação na aba principal. */
export function NarrationReader({ projectPath }) {
  const [state, setState] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!projectPath) { setError('Abra o roteiro pela etapa Narração de um projeto.'); return; }
    let active = true;
    setBusy(true); setError('');
    Promise.all([localApi.narration(projectPath), localApi.openProject(projectPath)]).then(([narration, details]) => {
      if (active) { setState(narration); setTitle(details.project.title); }
    }).catch(issue => { if (active) setError(issue.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [projectPath, refresh]);
  const chapters = narrationChapters(state?.scenes || []);
  return <main id="main" className="narration-reader" style={{ '--reading-size': `${fontSize}px` }}>
    <header className="reader-toolbar">
      <div><span className="eyebrow">Content Lab · Leitura</span><h1>Roteiro de narração</h1>{title && <p>{title}</p>}</div>
      <div className="header-actions" role="group" aria-label="Opções de leitura">
        <button className="button quiet" disabled={fontSize <= 18} onClick={() => setFontSize(size => size - 2)} aria-label="Diminuir texto">A−</button>
        <output aria-label="Tamanho do texto">{fontSize} px</output>
        <button className="button quiet" disabled={fontSize >= 48} onClick={() => setFontSize(size => size + 2)} aria-label="Aumentar texto">A+</button>
        <button className="button quiet" disabled={busy || !projectPath} onClick={() => setRefresh(value => value + 1)}>Atualizar roteiro</button>
      </div>
    </header>
    <div className="reader-content">
      <p className="reader-hint">Coloque esta aba na segunda tela. Grave pela aba principal e leia somente as falas; os títulos dos capítulos são orientação. Se editar o roteiro, clique em Atualizar roteiro.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {busy && <p role="status">Carregando roteiro…</p>}
      {chapters.length > 1 && <nav className="reader-chapters" aria-label="Capítulos">{chapters.map((chapter, index) => <a key={chapter.id} href={`#chapter-${index}`}>{chapter.title}</a>)}</nav>}
      {state && <NarrationChapters scenes={state.scenes}/>}
    </div>
  </main>;
}
