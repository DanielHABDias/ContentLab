import { useState } from 'react';
import { localApi } from './local-api.js';
import { packagingVariants } from '../core/workflow.js';

/** A receita fica na embalagem; UI, MCP e render usam os mesmos campos. */
export function ThumbnailControls({ path, project, value, media, onChange, onGenerated, readOnly, saving }) {
  const labels = packagingVariants(project); const [label, setLabel] = useState('A'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const recipes = value.thumbnailVariants || [];
  const recipe = recipes.find(v => v.label === label) || { label, text: '', layout: 'palavra' };
  const patch = changes => onChange('thumbnailVariants', [...recipes.filter(v => v.label !== label), { ...recipe, ...changes }]);
  const set = (key, next) => patch({[key]:next});
  const nested = (key, field, next) => set(key, { ...recipe[key], [field]: next });
  const number = (name, current, change, min, max, step = 1) => <label key={name}>{name}<input type="number" min={min} max={max} step={step} value={current} onChange={e => { if(e.target.value !== '' && e.target.validity.valid) change(Number(e.target.value)); }}/></label>;
  const generate = async () => { setBusy(true); setMessage('Gerando thumbnail…'); try { await localApi.productionThumbnails({ path, variants: [recipe] }); await onGenerated(await localApi.openProject(path)); setMessage(`Thumbnail ${label} atualizada.`); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
  return <details className="thumbnail-controls"><summary>Ajustar composição da thumbnail</summary><label>Versão<select disabled={busy} value={label} onChange={e => setLabel(e.target.value)}>{labels.map(v => <option key={v}>{v}</option>)}</select></label><fieldset disabled={readOnly || busy}>
    <label>Palavra principal<input value={recipe.text || ''} onChange={e => set('text', e.target.value)}/></label>
    <label>Imagem em destaque<select value={recipe.mediaId || ''} onChange={e => set('mediaId', e.target.value || undefined)}><option value="">Escolher imagem</option>{media.filter(v => v.kind === 'image' && !['thumbnail', 'character'].includes(v.role)).map(v => <option key={v.id} value={v.id}>{v.name || v.uri.split('/').at(-1)}</option>)}</select></label>
    <label>Composição<select value={recipe.layout || 'palavra'} onChange={e => set('layout', e.target.value)}><option value="palavra">Palavra atravessando o personagem</option><option value="centro">Rosto no centro</option><option value="lado">Texto ao lado</option></select></label>
    <label>Cor da palavra<select value={recipe.tone || 'amarelo'} onChange={e => set('tone', e.target.value)}>{['amarelo','vermelho','azul','branco','verde'].map(c => <option key={c}>{c}</option>)}</select></label>
    {recipe.layout === 'palavra' && <>
      <label>Fundo<select value={recipe.background || 'preto'} onChange={e => patch({background:e.target.value,backgroundMediaId:undefined,backgroundEffects:recipe.backgroundEffects || {blur:3,brightness:.7,saturation:.65,vignette:.75}})}><option value="quadrinhos">Quadrinhos</option><option value="preto">Escuro</option><option value="branco">Claro</option></select></label>
      <label>Textura<select value={recipe.texture || 'tv'} onChange={e => patch({texture:e.target.value,...(e.target.value==='halftone'&&!recipe.halftone?{halftone:{spacing:9,radius:.3,opacity:.595,color:'#000000',full:true}}:{})})}><option value="halftone">Meio-tom</option><option value="tv">TV</option><option value="nenhuma">Sem textura</option></select></label>
      <div className="thumbnail-control-grid">
        {number('Desfoque do fundo',recipe.backgroundEffects?.blur ?? 3,v => nested('backgroundEffects','blur',v),0,40)}
        {number('Brilho do fundo',recipe.backgroundEffects?.brightness ?? .7,v => nested('backgroundEffects','brightness',v),0,2,.05)}
        {number('Saturação do fundo',recipe.backgroundEffects?.saturation ?? .65,v => nested('backgroundEffects','saturation',v),0,2,.05)}
        {number('Vinheta',recipe.backgroundEffects?.vignette ?? .75,v => nested('backgroundEffects','vignette',v),0,1,.05)}
      </div>
      {recipe.texture === 'halftone' && <details><summary>Ajustar o pontilhado</summary><div className="thumbnail-control-grid">
        {number('Espaçamento dos pontos',recipe.halftone?.spacing ?? 9,v => nested('halftone','spacing',v),3,50)}
        {number('Tamanho dos pontos',recipe.halftone?.radius ?? .3,v => nested('halftone','radius',v),.05,.45,.01)}
        {number('Intensidade dos pontos',recipe.halftone?.opacity ?? .595,v => nested('halftone','opacity',v),0,1,.01)}
      </div><label><input type="checkbox" checked={recipe.halftone?.full ?? recipe.background==='quadrinhos'} onChange={e => nested('halftone','full',e.target.checked)}/>Pontilhado no fundo inteiro</label></details>}
      <label><input type="checkbox" checked={Boolean(recipe.border?.width)} onChange={e => set('border', e.target.checked ? {width:7,radius:24,colors:['#2676E8','#2676E8','#F5C518','#E63946'],stops:[0,20,52,88],angle:115} : undefined)}/>Borda colorida</label>
      {recipe.border && <div className="thumbnail-control-grid">
        {number('Espessura',recipe.border.width,v => nested('border','width',v),0,30)}
        {number('Curva das quinas internas',recipe.border.radius ?? 24,v => nested('border','radius',v),0,120)}
        {recipe.border.colors.map((color,i) => <label key={i}>Cor {i+1}<input type="color" value={color} onChange={e => nested('border','colors',recipe.border.colors.map((v,j) => i===j?e.target.value:v))}/></label>)}
      </div>}
      <label>Texto complementar na frente<input value={recipe.foregroundText?.text || ''} onChange={e => set('foregroundText', e.target.value ? {x:330,y:500,width:560,size:165,tone:recipe.tone || 'amarelo',...recipe.foregroundText,text:e.target.value} : undefined)}/></label>
      {recipe.foregroundText && <details><summary>Ajustar o texto complementar</summary><div className="thumbnail-control-grid">{['x','y','size'].map((key,i) => number(['Posição horizontal do texto','Posição vertical do texto','Tamanho do texto'][i],recipe.foregroundText[key],v => nested('foregroundText',key,v),key==='size'?20:0,key==='x'?1280:key==='y'?720:300))}</div></details>}
      {number('Altura da palavra principal',recipe.textY ?? .5,v => set('textY',v),.15,.85,.01)}
      {number('Zoom da imagem',recipe.zoom ?? 1,v => set('zoom',v),.5,3,.01)}
      <details><summary>Posição e tamanho da imagem</summary><p className="hint">Medidas proporcionais a uma tela de 1280×720; a exportação mantém as proporções.</p><div className="thumbnail-control-grid">{['x','y','width','height'].map((key,i) => number(['Posição horizontal','Posição vertical','Largura','Altura'][i],recipe.subject?.[key] ?? [192,0,896,720][i],v => set('subject',{x:192,y:0,width:896,height:720,...recipe.subject,[key]:v}),key==='x'?-1280:key==='y'?-720:1,key==='width'?2560:key==='height'?2160:key==='x'?1280:720))}</div></details>
    </>}
    <button type="button" className="button primary" disabled={saving || !recipe.text?.trim() || !recipe.mediaId} onClick={generate}>{busy?'Gerando…':`Gerar somente ${label}`}</button>
  </fieldset><p role="status">{message || (saving?'Salvando ajustes…':'Os ajustes ficam salvos com esta thumbnail.')}</p></details>;
}
