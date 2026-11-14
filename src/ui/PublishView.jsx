import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, Film, FolderOpen, Image as ImageIcon, Loader2, PencilLine, Tag, Type, AlignLeft } from 'lucide-react';
import { localApi } from './local-api.js';
import { mediaUrl } from './MediaLibrary.jsx';
import { outputUrl } from './MotionStudio.jsx';

/** O projeto chegou ao fim da edição: a tela de apresentação substitui o fluxo ao abrir. */
export const isProjectFinished = project => project.stages.some(stage => stage.id === 'edit' && stage.state === 'approved');

/** Copia para a área de transferência; sem a API (contexto inseguro), cai no execCommand. */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text }); area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
  }
}

function CopyButton({ text, label }) {
  const [state, setState] = useState('idle'); const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => { const ok = await copyText(text); setState(ok ? 'done' : 'error'); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setState('idle'), 1800); };
  return <button type="button" className={`copy-button ${state}`} disabled={!text} onClick={copy} aria-label={`Copiar ${label}`}>
    {state === 'done' ? <Check size={15} aria-hidden="true"/> : <Copy size={15} aria-hidden="true"/>}
    <span aria-live="polite">{state === 'done' ? 'Copiado' : state === 'error' ? 'Não copiou' : 'Copiar'}</span>
  </button>;
}

function OpenFolder({ projectPath, folder, label }) {
  const [busy, setBusy] = useState(false);
  const open = async () => { setBusy(true); try { await localApi.revealOutput(projectPath, folder); } catch { /* a pasta ainda não existe */ } finally { setBusy(false); } };
  return <button type="button" className="button quiet" disabled={busy} onClick={open}>{busy ? <Loader2 size={17} className="spin" aria-hidden="true"/> : <FolderOpen size={17} aria-hidden="true"/>} {label}</button>;
}

function useLatestRender(projectPath, revision) {
  const [outputs, setOutputs] = useState(null);
  useEffect(() => { let active = true; localApi.productionOutputs(projectPath).then(value => active && setOutputs(value)).catch(() => active && setOutputs({ renders: [], thumbnails: [] })); return () => { active = false; }; }, [projectPath, revision]);
  return outputs;
}

/**
 * Apresentação do vídeo pronto: as thumbnails A e B com os títulos, a descrição, as tags e o vídeo final,
 * tudo com um botão de copiar. Só leitura; "Editar projeto" volta ao fluxo de etapas.
 */
export function PublishView({ details, onBack, onEdit }) {
  const { project, path } = details;
  const packaging = project.creative?.packaging || {};
  const media = project.media || [];
  const outputs = useLatestRender(path, project.revision);
  const latest = outputs?.renders?.[0];
  const vertical = project.aspectRatio === '9:16';
  const reviewed = project.stages.find(stage => stage.id === 'review')?.state === 'approved';
  const variants = [['A', packaging.titleA, packaging.thumbnailA], ['B', packaging.titleB, packaging.thumbnailB]].filter(([, title, thumb]) => title || thumb);
  const hasThumb = id => id && media.some(item => item.id === id);
  return <main id="main" className="workspace publish-view">
    <button className="text-button" aria-label="Voltar aos projetos" onClick={onBack}><ArrowLeft size={16}/> Projetos</button>
    <header className="publish-hero">
      <div>
        <span className="eyebrow">{vertical ? 'Short · 9:16' : `Vídeo longo · ${project.aspectRatio}`}</span>
        <h1>{project.title}</h1>
        <span className={`publish-status ${reviewed ? 'ready' : ''}`}><Check size={14} aria-hidden="true"/> {reviewed ? 'Pronto para publicar' : 'Edição concluída'}</span>
      </div>
      <div className="publish-actions">
        <OpenFolder projectPath={path} folder="output" label="Pasta do vídeo"/>
        <button type="button" className="button primary" onClick={onEdit}><PencilLine size={17} aria-hidden="true"/> Editar projeto</button>
      </div>
    </header>

    <section className="publish-section" aria-labelledby="publish-variants">
      <div className="publish-heading"><h2 id="publish-variants"><ImageIcon size={19} aria-hidden="true"/> Títulos e thumbnails</h2><OpenFolder projectPath={path} folder="thumbnails" label="Pasta das thumbnails"/></div>
      <div className={`publish-variants ${vertical ? 'vertical' : ''}`}>
        {variants.map(([label, title, thumb]) => <article className="publish-variant" key={label}>
          <div className="publish-thumb">{hasThumb(thumb) ? <img src={mediaUrl(path, thumb)} alt={`Thumbnail ${label}`}/> : <span>Sem thumbnail {label}</span>}<span className="variant-tag">{label}</span></div>
          <div className="publish-variant-body">
            <span className="field-label"><Type size={14} aria-hidden="true"/> Título {label}</span>
            <p className="publish-title">{title || '—'}</p>
            <div className="publish-variant-actions">
              <CopyButton text={title} label={`título ${label}`}/>
              {hasThumb(thumb) && <a className="copy-button" href={mediaUrl(path, thumb)} download={`thumbnail-${label}.png`}><Download size={15} aria-hidden="true"/><span>Baixar thumbnail</span></a>}
            </div>
          </div>
        </article>)}
      </div>
    </section>

    <section className="publish-section" aria-labelledby="publish-description">
      <div className="publish-heading"><h2 id="publish-description"><AlignLeft size={19} aria-hidden="true"/> Descrição</h2><CopyButton text={packaging.description} label="descrição"/></div>
      {packaging.description ? <pre className="publish-text">{packaging.description}</pre> : <p className="empty-state">Sem descrição ainda.</p>}
    </section>

    <section className="publish-section" aria-labelledby="publish-tags">
      <div className="publish-heading"><h2 id="publish-tags"><Tag size={19} aria-hidden="true"/> Tags</h2><CopyButton text={packaging.tags} label="tags"/></div>
      {packaging.tags ? <ul className="publish-tags">{packaging.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => <li key={tag}>{tag}</li>)}</ul> : <p className="empty-state">Sem tags ainda.</p>}
    </section>

    <section className="publish-section" aria-labelledby="publish-video">
      <div className="publish-heading"><h2 id="publish-video"><Film size={19} aria-hidden="true"/> Vídeo final</h2>{latest && <span className="muted">{latest.name}</span>}</div>
      {!outputs ? <p className="empty-state">Carregando o vídeo…</p> : latest ? <video className={`publish-video ${vertical ? 'vertical' : ''}`} controls preload="metadata" src={outputUrl(path, latest.name, latest.modifiedAt)} aria-label="Vídeo final"/> : <p className="empty-state">Nenhum vídeo renderizado ainda.</p>}
    </section>
  </main>;
}
