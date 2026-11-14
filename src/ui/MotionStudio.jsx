import { useEffect, useState } from 'react';
import { Clapperboard, FolderOpen, Image as ImageIcon, Loader2, Music, Film } from 'lucide-react';
import { localApi } from './local-api.js';
import { mediaUrl } from './MediaLibrary.jsx';
import { packagingVariants } from '../core/workflow.js';

export const outputUrl = (project, name, version = '') => `/api/v1/production/output-file?path=${encodeURIComponent(project)}&name=${encodeURIComponent(name)}${version ? `&v=${encodeURIComponent(version)}` : ''}`;
const clock = seconds => { const s = Math.max(0, Math.round(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SCENES = { titulo: 'Palavras gigantes', frase: 'Frase', personagem: 'Personagem', evidencia: 'Cena da obra', pagina: 'Página HQ', numero: 'Número', ficha: 'Ficha', formula: 'Fórmula', lista: 'Lista', comparacao: 'Comparação', cta: 'Chamada final', aparte: 'Aparte do personagem', paineis3d: 'Painéis 3D', telafinal: 'Tela final' };

/** Texto curto que resume o beat para quem acompanha (o que aparece na tela). */
export function beatSummary(beat) {
  const p = beat.props || {};
  if (beat.scene === 'evidencia' && p.som) return `${p.rotulo || 'Trecho da obra'} · com o áudio original`;
  const text = p.palavras?.join(' ') || p.linhas?.join(' ') || p.texto || p.rotulo || p.titulo || p.pergunta || p.veredito
    || p.falas?.map(fala => fala.texto).filter(Boolean).join(' · ') || p.paineis?.map(painel => painel.rotulo).filter(Boolean).join(' · ') || '';
  return text || (p.midia ? 'Cena da obra' : '');
}

/** Lista o que já saiu da edição (prévias, renders, thumbnails) e atualiza enquanto a IA trabalha. */
function useOutputs(projectPath, revision) {
  const [outputs, setOutputs] = useState(null);
  useEffect(() => {
    if (!projectPath) return undefined;
    let active = true;
    const load = () => localApi.productionOutputs(projectPath).then(value => active && setOutputs(value)).catch(() => {});
    load(); const timer = window.setInterval(load, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectPath, revision]);
  return outputs;
}

function FolderButton({ projectPath, folder, label }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const open = async () => { setBusy(true); setError(''); try { await localApi.revealOutput(projectPath, folder); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  return <><button type="button" className="mini-button" disabled={busy} onClick={open}>{busy ? <Loader2 size={15} className="spin" aria-hidden="true"/> : <FolderOpen size={15} aria-hidden="true"/>} {label}</button>{error && <small className="notice error" role="alert">{error}</small>}</>;
}

/** Vídeo final, thumbnails e as pastas: o resultado que a pessoa confere antes de publicar. */
export function FinalResult({ details, outputs: given }) {
  const projectPath = details.path; const own = useOutputs(given ? null : projectPath, details.project.revision);
  const outputs = given || own;
  const packaging = details.project.creative?.packaging || {};
  const media = details.project.media || [];
  const labels = packagingVariants(details.project); const single = labels.length === 1;
  const thumbs = labels.map(label => [label, packaging[`thumbnail${label}`]]).filter(([, id]) => id && media.some(item => item.id === id));
  if (!outputs) return <section className="workflow-card"><p className="empty-state">Carregando o resultado…</p></section>;
  const latest = outputs.renders[0];
  return <section className="workflow-card final-result" aria-labelledby="final-result-title">
    <div className="section-title"><div><h2 id="final-result-title"><Film size={19} aria-hidden="true"/> Resultado final</h2><span>{latest ? `${latest.name} · ${new Date(latest.modifiedAt).toLocaleString()}` : 'O vídeo aparece aqui assim que o render terminar.'}</span></div>
      <div className="take-actions">{latest && <FolderButton projectPath={projectPath} folder="output" label="Abrir pasta do vídeo"/>}{outputs.thumbnails.length > 0 && <FolderButton projectPath={projectPath} folder="thumbnails" label="Abrir pasta das thumbnails"/>}{outputs.delivery && <FolderButton projectPath={projectPath} folder="entrega" label="Abrir pasta de entrega"/>}</div></div>
    {latest ? <video className="final-video" controls preload="metadata" src={outputUrl(projectPath, latest.name, latest.modifiedAt)} aria-label="Vídeo final"/> : <div className="empty-state"><strong>Nenhum vídeo renderizado ainda.</strong></div>}
    {outputs.renders.length > 1 && <details className="older-renders"><summary>Versões anteriores ({outputs.renders.length - 1})</summary><ul>{outputs.renders.slice(1).map(item => <li key={item.name}><a href={outputUrl(projectPath, item.name, item.modifiedAt)} target="_blank" rel="noreferrer">{item.name}</a> <small>{new Date(item.modifiedAt).toLocaleString()}</small></li>)}</ul></details>}
    <h3><ImageIcon size={17} aria-hidden="true"/> {single ? 'Thumbnail' : 'Thumbnails'}</h3>
    {thumbs.length ? <div className="thumb-variants">{thumbs.map(([label, id]) => <figure key={label}><img src={mediaUrl(projectPath, id)} alt={`Thumbnail ${label}`}/><figcaption>{single ? 'Thumbnail' : `Thumbnail ${label}`}</figcaption></figure>)}</div> : <p className="hint">Ainda sem thumbnails. Elas aparecem aqui e na aba Título e thumbnail quando a IA gerar.</p>}
  </section>;
}

/**
 * Etapa Edição no modo composição: a IA monta o vídeo pelo MCP (plano em beats, prévias e render).
 * Aqui a pessoa acompanha cada passo: o resumo do plano, as prévias assim que saem e o vídeo renderizado.
 */
export function MotionPanel({ details }) {
  const projectPath = details.path; const plan = details.project.motion;
  const outputs = useOutputs(projectPath, details.project.revision);
  const beats = plan?.beats || [];
  const duration = beats.length ? Math.max(...beats.map(beat => beat.at + beat.duration)) : 0;
  const scenes = Object.entries(beats.reduce((count, beat) => ({ ...count, [beat.scene]: (count[beat.scene] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const music = plan?.music ? (details.project.media || []).find(item => item.id === plan.music.mediaId) || (details.project.media || []).filter(item => item.role === 'music').at(-1) : null;
  const originals = beats.filter(beat => beat.props?.som).length;
  const previews = outputs?.previews || [];
  return <>
    <section className="workflow-card motion-panel" aria-labelledby="motion-title">
      <div className="section-title"><div><h2 id="motion-title"><Clapperboard size={19} aria-hidden="true"/> Vídeo montado pela IA</h2><span>A IA monta a composição pelo MCP. Esta tela se atualiza sozinha a cada passo.</span></div></div>
      <dl className="motion-stats">
        <div><dt>Duração</dt><dd>{clock(duration)}</dd></div>
        <div><dt>Trocas de cena</dt><dd>{beats.length}</dd></div>
        <div><dt>Média por troca</dt><dd>{beats.length ? `${(duration / beats.length).toFixed(1).replace('.', ',')} s` : '—'}</dd></div>
        <div><dt>Trechos com áudio da obra</dt><dd>{originals}</dd></div>
        <div><dt>Tela final</dt><dd>{beats.some(beat => beat.scene === 'telafinal') ? 'Sim' : 'Não'}</dd></div>
        <div><dt><Music size={14} aria-hidden="true"/> Trilha</dt><dd className="small">{music ? music.name : 'Sem trilha'}</dd></div>
      </dl>
      <p className="scene-mix">{scenes.map(([scene, count]) => <span key={scene} className="chip">{SCENES[scene] || scene} · {count}</span>)}</p>
    </section>
    <section className="workflow-card motion-previews" aria-labelledby="previews-title">
      <div className="section-title"><div><h2 id="previews-title">Prévias</h2><span>{previews.length ? `${previews.length} quadros conferidos pela IA antes do render` : 'Os quadros de prévia aparecem aqui quando a IA gerar.'}</span></div>{previews.length > 0 && <FolderButton projectPath={projectPath} folder="previas" label="Abrir pasta das prévias"/>}</div>
      {previews.length > 0 && <ul className="preview-grid">{previews.map(item => <li key={item.name}><a href={outputUrl(projectPath, item.name, item.modifiedAt)} target="_blank" rel="noreferrer"><img loading="lazy" src={outputUrl(projectPath, item.name, item.modifiedAt)} alt={`Prévia em ${clock(item.second)}`}/></a><small>{clock(item.second)}</small></li>)}</ul>}
    </section>
    <FinalResult details={details} outputs={outputs}/>
    <section className="workflow-card" aria-labelledby="beats-title">
      <details className="beat-list"><summary><h2 id="beats-title">Roteiro em beats ({beats.length})</h2></summary>
        <ol>{beats.map(beat => <li key={beat.id}><time>{clock(beat.at)}</time><strong>{SCENES[beat.scene] || beat.scene}</strong><span>{beatSummary(beat)}</span></li>)}</ol>
      </details>
    </section>
  </>;
}
