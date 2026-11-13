import { useState } from 'react';
import { ArrowDown, ArrowUp, Film, Mic, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { BLOCK_LABELS, editScript, scriptChapters } from '../core/script.js';

const newId = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
const emptyBlock = type => ({ id: newId('block'), type, title: '', text: '' });

export function ScriptPanel({ project, value, onChange, readOnly = false }) {
  const chapters = scriptChapters(value);
  const [undo, setUndo] = useState([]);
  const edit = actions => {
    if (readOnly) return;
    const next = editScript(value, actions);
    setUndo(previous => [...previous.slice(-29), structuredClone(chapters)]);
    onChange('chapters', next.chapters);
  };
  const moveChapter = (index, step) => edit([{ op: 'chapter.move', chapterId: chapters[index].id, beforeId: step < 0 ? chapters[index - 1].id : chapters[index + 2]?.id }]);
  const moveBlock = (chapter, index, step) => edit([{ op: 'block.move', blockId: chapter.blocks[index].id, chapterId: chapter.id, beforeId: step < 0 ? chapter.blocks[index - 1].id : chapter.blocks[index + 2]?.id }]);
  return <section className="editor-layout script-layout">
    <div className="script-page">
      <div className="page-meta"><span>Revisão {project.revision}</span><span>{project.type === 'short' ? 'Short' : 'Vídeo longo'}</span></div>
      <h2>{project.title}</h2>
      <p className="script-explanation">Organize a história em capítulos e alterne fala, cenas e direção. Só os textos dos blocos de narração serão lidos pela voz.</p>
      {chapters.length === 0 && <p className="script-empty">Adicione o primeiro capítulo para começar seu roteiro.</p>}
      {chapters.map((chapter, chapterIndex) => <section className="script-chapter" key={chapter.id} aria-label={`Capítulo ${chapterIndex + 1}`}>
        <header className="chapter-header">
          <label><span>Capítulo {chapterIndex + 1} · título não narrado</span><input aria-label={`Título do capítulo ${chapterIndex + 1}`} readOnly={readOnly} maxLength={200} placeholder="Ex.: Origem — antes da transformação" value={chapter.title} onChange={event => edit([{ op: 'chapter.update', chapterId: chapter.id, title: event.target.value }])}/></label>
          {!readOnly && <div className="script-actions">
            <button type="button" disabled={chapterIndex === 0} aria-label={`Subir capítulo ${chapterIndex + 1}`} onClick={() => moveChapter(chapterIndex, -1)}><ArrowUp size={16}/></button>
            <button type="button" disabled={chapterIndex === chapters.length - 1} aria-label={`Descer capítulo ${chapterIndex + 1}`} onClick={() => moveChapter(chapterIndex, 1)}><ArrowDown size={16}/></button>
            <button type="button" aria-label={`Remover capítulo ${chapterIndex + 1}`} onClick={() => edit([{ op: 'chapter.remove', chapterId: chapter.id }])}><Trash2 size={16}/></button>
          </div>}
        </header>
        {chapter.blocks.map((block, blockIndex) => <article className={`script-card script-card-${block.type}`} key={block.id} aria-label={`Bloco ${blockIndex + 1} do capítulo ${chapterIndex + 1}`}>
          <div className="block-header"><span>{block.type === 'narration' ? <Mic size={16}/> : <Film size={16}/>} {BLOCK_LABELS[block.type]}</span><small>{block.type === 'narration' ? 'Texto falado' : 'Não narrar'}</small>
            {!readOnly && <div className="script-actions">
              <button type="button" disabled={blockIndex === 0} aria-label={`Subir bloco ${blockIndex + 1} do capítulo ${chapterIndex + 1}`} onClick={() => moveBlock(chapter, blockIndex, -1)}><ArrowUp size={15}/></button>
              <button type="button" disabled={blockIndex === chapter.blocks.length - 1} aria-label={`Descer bloco ${blockIndex + 1} do capítulo ${chapterIndex + 1}`} onClick={() => moveBlock(chapter, blockIndex, 1)}><ArrowDown size={15}/></button>
              <button type="button" aria-label={`Remover bloco ${blockIndex + 1} do capítulo ${chapterIndex + 1}`} onClick={() => edit([{ op: 'block.remove', blockId: block.id }])}><Trash2 size={15}/></button>
            </div>}
          </div>
          <label className="block-title-label">Título do bloco · opcional, não narrado<input maxLength={200} readOnly={readOnly} value={block.title} onChange={event => edit([{ op: 'block.update', blockId: block.id, changes: { title: event.target.value } }])}/></label>
          <label className="block-text-label">{block.type === 'narration' ? 'Texto da narração' : block.type === 'scene' ? 'Descrição da cena e do som original' : 'Instruções de direção visual'}<textarea rows={block.type === 'narration' ? 5 : 3} readOnly={readOnly} value={block.text} placeholder={block.type === 'narration' ? 'Escreva somente o que será falado…' : block.type === 'scene' ? 'O que aparece, qual trecho usar, duração estimada e áudio da obra. Sem narração.' : 'Imagem, movimento, Nox, texto na tela ou efeitos…'} onChange={event => edit([{ op: 'block.update', blockId: block.id, changes: { text: event.target.value } }])}/></label>
          {!readOnly && chapters.length > 1 && <label className="block-move-label">Mover para capítulo<select value={chapter.id} onChange={event => edit([{ op: 'block.move', blockId: block.id, chapterId: event.target.value }])}>{chapters.map((target, i) => <option key={target.id} value={target.id}>{i + 1}. {target.title || 'Sem título'}</option>)}</select></label>}
        </article>)}
        {!readOnly && <div className="add-script-block" aria-label={`Adicionar bloco ao capítulo ${chapterIndex + 1}`}>{Object.entries(BLOCK_LABELS).map(([type, label]) => <button type="button" key={type} onClick={() => edit([{ op: 'block.add', chapterId: chapter.id, block: emptyBlock(type) }])}><Plus size={15}/>{label}</button>)}</div>}
      </section>)}
      {!readOnly && <div className="script-footer-actions"><button type="button" className="button primary" onClick={() => edit([{ op: 'chapter.add', chapter: { id: newId('chapter'), title: '', blocks: [] } }])}><Plus size={16}/> Adicionar capítulo</button><button type="button" className="button quiet" disabled={!undo.length} onClick={() => { onChange('chapters', undo.at(-1)); setUndo(previous => previous.slice(0, -1)); }}><RotateCcw size={16}/> Desfazer</button></div>}
      <label className="script-block"><span>Fontes · não narrar</span><textarea readOnly={readOnly} rows={4} value={value.sources || ''} onChange={event => onChange('sources', event.target.value)}/></label>
    </div>
  </section>;
}
