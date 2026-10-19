import fs from 'node:fs';
import path from 'node:path';
import {APP_ROOT} from './plan.mjs';
import {sceneLibrary} from './scene-library.mjs';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const image=file=>'data:image/png;base64,'+fs.readFileSync(path.join(APP_ROOT,file)).toString('base64');
export const libraryCss=`#cenas-especiais button{padding:10px 15px;border:1px solid #c4d5ef;border-radius:10px;background:#edf4ff;color:#174887;font:inherit;cursor:pointer;margin:8px 5px 12px 0}#cenas-especiais button:disabled{opacity:.5}#presetProject{display:block;width:100%;padding:12px;border:1px solid #c4d5ef;border-radius:10px;font:inherit}#cenas-especiais details{border:1px solid #e2e8f1;border-radius:10px;margin:10px 0;padding:12px}#cenas-especiais summary{cursor:pointer;font-weight:600}#cenas-especiais article{border-top:1px solid #e2e8f1;padding-top:12px}#cenas-especiais figcaption{font-size:12px;color:#6c798b}#cenas-especiais pre{max-height:600px;overflow:auto}`;
// The imported guides contain Markdown, not trusted HTML.
function guideHtml(text){
 const lines=text.split('\n'),out=[];let i=0;
 const inline=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
 while(i<lines.length){const line=lines[i];
  if(line.startsWith('```')){const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');continue;}
  if(line.trim().startsWith('|')){const rows=[];while(i<lines.length&&lines[i].trim().startsWith('|')){const row=lines[i++].trim();if(!/^\|[\s:|\-]+$/.test(row))rows.push(row.slice(1,-1).split('|'));}out.push('<div class="table-scroll"><table>'+rows.map((r,n)=>'<tr>'+r.map(c=>'<'+(n?'td':'th')+'>'+inline(c.trim())+'</'+(n?'td':'th')+'>').join('')+'</tr>').join('')+'</table></div>');continue;}
  if(/^#{1,6} /.test(line))out.push('<h4>'+inline(line.replace(/^#+ /,''))+'</h4>');
  else if(line.trim())out.push('<p>'+inline(line)+'</p>');i++;
 }
 return out.join('');
}
export function libraryMarkdown(){
 return ['## Galeria de cenas especiais','','Oferecimento do DiasVerso.','',
 'Os 15 padrões são genéricos e aceitam 16:9/9:16. Na documentação do aplicativo, escolha uma pasta de projeto e prepare o preset. O TSX é copiado para custom-scenes/ sem sobrescrever uma versão diferente; o plano não é alterado nem renderizado automaticamente. Alternativamente copie o arquivo indicado abaixo. Leia os parâmetros e exemplos antes de usar. Fontes e mídias pertencem a customComponent.assets; props recebe apenas dados JSON. SFX continuam na timeline.','',
 ...sceneLibrary().flatMap(item=>['### '+item.title,'',item.summary,'','Módulo: `'+item.module+'`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.','',
 ...item.previews.map(p=>'![Exemplo de '+item.title+'](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/'+p+')'),'',
 'Guia: ['+item.id+'](../'+item.guide+'). Exemplos: '+item.examples.map(p=>'['+path.basename(p)+'](../'+p+')').join(' · '),'',
 '```ts',item.contract,'```',''])].join('\n');
}
export function libraryHtml(standalone){
 const tools=standalone?'':'<label>Pasta do projeto <input id="presetProject" placeholder="Selecione a pasta com edit_plan.json"></label><button id="presetChoose" type="button">Selecionar pasta</button><p id="presetResult" role="status"></p><pre id="presetExample" hidden></pre>';
 return '<section id="cenas-especiais"><h2>Galeria de cenas especiais</h2><p>Oferecimento do DiasVerso.</p><p>15 padrões para 16:9 e 9:16. A preparação copia o TSX e o auxiliar HQComicPage.tsx; não altera o plano nem inicia render. Mídia, narração e tempos são configurados no projeto. Uma versão existente diferente nunca é sobrescrita.</p>'+tools+
 sceneLibrary().map(item=>'<article id="preset-'+item.id+'" style="margin:2rem 0"><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary)+'</p><div style="display:flex;gap:12px;overflow:auto">'+
 item.previews.map((p,i)=>'<figure style="margin:0;flex-shrink:0"><img style="max-width:420px;max-height:280px;object-fit:contain;border-radius:8px" alt="'+esc(item.title)+'" src="'+image(p)+'"><figcaption>Exemplo '+(Math.floor(i/2)+1)+' · '+(p.endsWith('16x9.png')?'16:9':'9:16')+'</figcaption></figure>').join('')+'</div><p><code>'+esc(item.module)+'</code></p>'+(!standalone?'<button type="button" data-install-preset="'+item.id+'">Preparar no projeto</button>':'')+
 '<details><summary>Quando usar, parâmetros, tempos e sons</summary>'+guideHtml(fs.readFileSync(path.join(APP_ROOT,item.guide),'utf8'))+'</details><details><summary>Exemplos de JSON</summary>'+item.examples.map(p=>'<h4>'+esc(path.basename(p))+'</h4><pre>'+esc(fs.readFileSync(path.join(APP_ROOT,p),'utf8'))+'</pre>').join('')+'</details></article>').join('')+'</section>';
}
export const libraryScript=`
const choose=document.getElementById('presetChoose');
if(choose){
 choose.addEventListener('click',async()=>{const r=await fetch('/api/choose-folder',{method:'POST'});const d=await r.json();if(d.folder)document.getElementById('presetProject').value=d.folder;});
 document.querySelectorAll('[data-install-preset]').forEach(button=>button.addEventListener('click',async()=>{
 const result=document.getElementById('presetResult');button.disabled=true;
 try{const r=await fetch('/api/scene-library/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:button.dataset.installPreset,projectRoot:document.getElementById('presetProject').value})});const d=await r.json();if(!r.ok)throw Error(d.error);result.textContent='Preparado: '+d.file+'. Adapte o exemplo e os assets; nenhuma cena foi renderizada.';document.getElementById('presetExample').hidden=false;document.getElementById('presetExample').textContent=JSON.stringify(d.example,null,2);}
 catch(e){result.textContent=e.message;}finally{button.disabled=false;}}));
}`;
