/* Schema-driven editor: the JSON textarea remains the single source of truth. */
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const labels = {
    project: 'Projeto', name: 'Nome', format: 'Formato', profile: 'Perfil', resolution: 'Resolução', width: 'Largura', height: 'Altura', fps: 'Quadros por segundo', seed: 'Semente',
    sources: 'Fontes', assets: 'Pasta de assets', transcript: 'Transcrição', assetCatalog: 'Catálogo de assets', audio: 'Áudio', narration: 'Narração', narrationTrim: 'Trecho mantido da narração', sourceCuts: 'Cortes da voz', voice: 'Tratamento da voz', ducking: 'Redução automática da música', music: 'Músicas',
    start: 'Início (s)', end: 'Fim (s)', at: 'Momento (s)', id: 'Identificador', elements: 'Camadas', type: 'Tipo', asset: 'Arquivo', text: 'Texto', style: 'Estilo', fontAsset: 'Fonte (arquivo)', fontScale: 'Tamanho da fonte', reveal: 'Escrita letra a letra', charactersPerSecond: 'Letras por segundo', delay: 'Atraso (s)',
    cells: 'Células do grid 3×3', fit: 'Enquadramento', box: 'Caixa', animation: 'Animação', enter: 'Entrada', idle: 'Enquanto visível', exit: 'Saída', enterDuration: 'Duração da entrada', exitDuration: 'Duração da saída', z: 'Camada (z)', loop: 'Repetir vídeo', sync: 'Sincronização', emphasis: 'Ênfase', range: 'Intervalo', config: 'Configurações do efeito', textStyle: 'Aparência das letras', fontFamily: 'Fonte', uppercase: 'Maiúsculas', outlineColor: 'Cor do contorno', outlineWidth: 'Espessura do contorno (px)', blur: 'Desfoque da sombra', offsetX: 'Sombra horizontal', offsetY: 'Sombra vertical',
    transform: 'Posição e escala', x: 'Posição horizontal', y: 'Posição vertical', scale: 'Escala', rotation: 'Rotação', opacity: 'Opacidade', keyframes: 'Pontos da animação', t: 'Tempo na cena (s)', easing: 'Suavização', background: 'Fundo', color: 'Cor hexadecimal', layout: 'Layout', timeline: 'Cenas', transitionOut: 'Transição para próxima cena', transitionDuration: 'Duração da transição', camera: 'Câmera', shake: 'Balanço', amplitude: 'Amplitude', frequency: 'Frequência',
    preset: 'Predefinição', trimDb: 'Volume (dB)', autoTrimSilence: 'Cortar silêncio automaticamente nas bordas', sourceStart: 'Início dentro do arquivo musical (s)', sourceEnd: 'Fim dentro do arquivo musical (s)', fadeIn: 'Fade-in (s)', fadeOut: 'Fade-out (s)', normalize: 'Normalizar', targetLufs: 'Alvo LUFS', truePeakDb: 'Pico real (dB)', highpassHz: 'Filtro grave (Hz)', enabled: 'Ativado', threshold: 'Limiar', ratio: 'Intensidade', attackMs: 'Ataque (ms)', releaseMs: 'Retorno (ms)', padding: 'Espaçamento', radius: 'Arredondamento', shadow: 'Sombra', border: 'Borda', grid: 'Grid', keyColor: 'Cor removida', similarity: 'Similaridade', blend: 'Suavidade', duration: 'Duração',
  };
  const configSchemas = {
    keyColor: {type: 'string'}, similarity: {type: 'number', minimum: 0, maximum: 1}, blend: {type: 'number', minimum: 0, maximum: 1},
    duration: {type: 'number', exclusiveMinimum: 0}, trimDb: {type: 'number'}, fadeIn: {type: 'number', minimum: 0}, fadeOut: {type: 'number', minimum: 0}, preset: {type: 'string'},
  };
  const suggestions = {
    layout: ['fullscreen', '3x3', 'custom_grid', 'center_column', 'three_columns'], transitionOut: ['cut', 'fade', 'blur_left', 'blur_right', 'blur_up', 'blur_down', 'flip', 'curtain'],
    enter: ['cut', 'none', 'fade', 'pop_in', 'slide_from_left', 'slide_from_right', 'slide_up', 'slide_down'],
    idle: ['none', 'float_soft', 'pulse_soft', 'slow_zoom_in', 'slow_zoom_out', 'pan'],
    exit: ['cut', 'none', 'fade', 'fade_out', 'slide_to_left', 'slide_to_right', 'slide_to_bottom'],
    style: ['impact', 'impact_yellow', 'word_pop', 'paper_word', 'versus_big', 'anton', 'bangers', 'anton_karaoke', 'green_screen', 'green_screen_default', 'green_screen_soft'],
    fit: ['cover', 'contain', 'stretch', 'smart_cover'],
  };
  let context = null;
  let plan = null;
  let selectedScene = 0;
  let writing = false;
  let projectRoot = '';
  let initialScenes = new Map();
  let sceneCache = new Map();
  let searchQuery = '';
  let undoStates=[],redoStates=[],lastSnapshot='';
  const historyButtons=()=>{
    $('visualUndo').disabled=!undoStates.length;
    $('visualRedo').disabled=!redoStates.length;
  };
  const recordChange=()=>{
    const latest=JSON.stringify(plan);
    if(lastSnapshot&&lastSnapshot!==latest){
      undoStates.push(lastSnapshot);
      if(undoStates.length>80)undoStates.shift();
      redoStates=[];
    }
    lastSnapshot=latest;
    historyButtons();
  };
  const restoreSnapshot=(source,target)=>{
    if(!source.length)return;
    target.push(JSON.stringify(plan));
    plan=JSON.parse(source.pop());
    lastSnapshot=JSON.stringify(plan);
    writing=true;
    $('editorPlanText').value=JSON.stringify(plan,null,2);
    $('editorPlanText').dispatchEvent(new Event('input'));
    writing=false;
    selectedScene=Math.min(selectedScene,Math.max(0,plan.timeline.length-1));
    render();
    historyButtons();
  };

  const fmtTime = seconds => Number(seconds || 0).toFixed(2).replace(/\.00$/, '') + 's';
  const uniqueSceneId = prefix => {
    const existing = new Set((plan?.timeline || []).map(item => item.id));
    const safe = String(prefix || 'cena').replace(/[^\w-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'cena';
    let next = safe, suffix = 2;
    while (existing.has(next)) next = safe + '-' + suffix++;
    return next;
  };
  const shiftScene = (scene, offset) => {
    scene.start = Number((scene.start + offset).toFixed(6));
    scene.end = Number((scene.end + offset).toFixed(6));
    for (const item of scene.elements || []) {
      if (typeof item.start === 'number') item.start = Number((item.start + offset).toFixed(6));
      if (typeof item.end === 'number') item.end = Number((item.end + offset).toFixed(6));
      if (typeof item.at === 'number') item.at = Number((item.at + offset).toFixed(6));
    }
  };
  const insertScene = (at, scene) => {
    const duration = scene.end - scene.start;
    const start = at > 0 ? plan.timeline[at - 1].end : 0;
    shiftScene(scene, start - scene.start);
    // Ripple is applied to narration AND global soundtrack, not only video scenes.
    // Existing voice remains synchronized; the new segment is silent until narration is added.
    plan.audio = plan.audio || {};
    const gaps = plan.audio.silenceInserts || [];
    for (const gap of gaps) if (gap.at >= start) gap.at = Number((gap.at+duration).toFixed(6));
    gaps.push({at:start,duration});
    gaps.sort((a,b)=>a.at-b.at);
    plan.audio.silenceInserts = gaps;
    for (const music of plan.audio.music || []) {
      if (music.start >= start) {
        music.start = Number((music.start+duration).toFixed(6));
        music.end = Number((music.end+duration).toFixed(6));
      } else if (music.end > start) {
        music.end = Number((music.end+duration).toFixed(6));
      }
    }
    for (let i = at; i < plan.timeline.length; i++) shiftScene(plan.timeline[i], duration);
    plan.timeline.splice(at, 0, scene);
    selectedScene = at;
    changed();
    message('Cena inserida; narração e trilha alinhadas. A nova cena recebeu silêncio de voz, sem alterar a fala existente.');
  };
  const cloneScene = scene => JSON.parse(JSON.stringify(scene));
  const cacheStatus = scene => {
    const cached = sceneCache.get(scene.id) || {status:'missing'};
    const originally = initialScenes.get(scene.id);
    if (originally && JSON.stringify(originally) !== JSON.stringify(scene))
      return {status:'changed',hasVideo:cached.status!=='missing'};
    return {status:cached.status,hasVideo:cached.status!=='missing'};
  };
  const cacheLabel = status => ({
    ready:'Em cache',changed:'Alterada',missing:'Sem render'
  }[status] || 'Sem render');
  const loadCacheState = async () => {
    sceneCache = new Map();
    if (!projectRoot) return;
    try {
      const response = await fetch('/api/editor/scenes?projectRoot=' + encodeURIComponent(projectRoot));
      if (!response.ok) return;
      const data = await response.json();
      sceneCache = new Map((data.scenes || []).map(item => [item.id,item]));
    } catch (_) { /* Trabalhar offline não depende dos MP4s existentes. */ }
  };
  let listId = 0;
  const message = (value) => { $('visualMessage').textContent = value; };
  const label = (key) => labels[key] || key;
  const pathValue = (path) => path.reduce((value, part) => value?.[part], plan);
  const update = (path, value) => {
    let parent = plan;
    for (const part of path.slice(0, -1)) parent = parent[part];
    parent[path.at(-1)] = value;
    recordChange();
    writing = true;
    $('editorPlanText').value = JSON.stringify(plan, null, 2);
    $('editorPlanText').dispatchEvent(new Event('input'));
    writing = false;
    render();
    message('Rascunho atualizado. Valide e salve o plano antes do render final.');
  };
  const changed = () => {
    recordChange();
    writing = true;
    $('editorPlanText').value = JSON.stringify(plan, null, 2);
    $('editorPlanText').dispatchEvent(new Event('input'));
    writing = false;
    render();
  };
  const schema = () => context?.schema;
  const resolve = (node) => node?.$ref ? resolve(node.$ref.split('/').slice(1).reduce((item, key) => item[key], schema())) : (node || {});
  const defaultValue = (node, key) => {
    const s = resolve(node);
    if (s.const !== undefined) return s.const;
    if (s.enum) return s.enum[0];
    if (s.oneOf) return defaultValue(s.oneOf[0], key);
    if (s.type === 'array') return [];
    if (s.type === 'object') {
      const value = {};
      for (const required of s.required || []) value[required] = defaultValue(s.properties?.[required], required);
      return value;
    }
    if (s.type === 'boolean') return false;
    if (s.type === 'number' || s.type === 'integer') return s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : s.minimum ?? 0;
    return key === 'color' ? '#000000' : '';
  };
  const button = (text, action, className = 'btn btn-secondary btn-sm') => {
    const control = el('button', text, className);
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  };
  const choices = (node, values, value, change) => {
    const select = el('select');
    for (const item of values) {
      const option = el('option', label(String(item)));
      option.value = String(item);
      select.append(option);
    }
    select.value = String(value ?? values[0]);
    select.addEventListener('change', () => change(select.value));
    node.append(select);
    return select;
  };
  const uriOptions = (path) => {
    const key = String(path.at(-1));
    const all = [...(context?.projectAssets || []), ...Object.values(context?.builtin || {}).flat().map(item => item.uri)];
    if (key === 'fontAsset') return all.filter(item => /\.(ttf|otf)$/i.test(item));
    if (path.includes('background')) return all.filter(item => /\.(png|jpe?g|webp|bmp|mp4|mov|mkv|webm)$/i.test(item));
    if (path.includes('music') || pathValue(path.slice(0, -1))?.type === 'sfx') return all.filter(item => /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(item));
    return all;
  };
  const primitive = (parent, node, value, path) => {
    const key = String(path.at(-1));
    const row = el('label', undefined, 'visual-field');
    row.append(el('span', path.includes('transform') && key === 'offsetX' ? 'Mover horizontalmente (px; + direita)' : path.includes('transform') && key === 'offsetY' ? 'Mover verticalmente (px; + baixo)' : label(key)));
    if (node.const !== undefined) row.append(el('strong', String(node.const)));
    else if (node.enum) choices(row, node.enum, value, next => {
      update(path, next);
      if (key === 'type' && path.includes('elements')) {
        const item = pathValue(path.slice(0, -1));
        if (['image', 'video', 'overlay', 'sfx'].includes(next) && !('asset' in item)) item.asset = '';
        if (['text', 'kinetic_text'].includes(next) && !('text' in item)) item.text = '';
        if (next === 'caption' && context.transcript?.length) {
          plan.sources = plan.sources || {}; plan.sources.transcript = 'transcript.json';
        }
        changed();
      } else if (key === 'type') render();
    });
    else if (node.type === 'boolean' || typeof value === 'boolean') {
      const input = el('input'); input.type = 'checkbox'; input.checked = !!value;
      input.addEventListener('change', () => update(path, input.checked)); row.append(input);
    } else {
      const input = key === 'text' ? el('textarea') : el('input');
      if (input.tagName === 'INPUT') input.type = node.type === 'number' || node.type === 'integer' ? 'number' : key === 'color' ? 'color' : 'text';
      if (input.type === 'number') {
        input.step = node.type === 'integer' ? '1' : 'any';
        if (node.minimum !== undefined) input.min = node.minimum;
        if (node.maximum !== undefined) input.max = node.maximum;
      }
      input.value = value ?? '';
      input.addEventListener('change', () => update(path, input.type === 'number' ? Number(input.value) : input.value));
      row.append(input);
      const hints = key === 'asset' || key === 'fontAsset' ? uriOptions(path) : suggestions[key];
      if (hints?.length) {
        const id = `visual-options-${++listId}`;
        input.setAttribute('list', id);
        const datalist = el('datalist'); datalist.id = id;
        for (const hint of hints) { const option = el('option'); option.value = hint; datalist.append(option); }
        row.append(datalist);
      }
    }
    parent.append(row);
  };
  const renderNode = (parent, rawSchema, value, path) => {
    const node = resolve(rawSchema);
    const key = String(path.at(-1));
    if (node.oneOf) {
      const wrapper = el('div', undefined, 'visual-nested');
      const current = typeof value === 'object' && value !== null ? 1 : 0;
      const labelRow = el('label', `${label(key)} — formato`, 'visual-field');
      choices(labelRow, ['Valor simples', 'Campos detalhados'], current ? 'Campos detalhados' : 'Valor simples', choice => {
        update(path, defaultValue(node.oneOf[choice === 'Campos detalhados' ? 1 : 0], key)); render();
      });
      wrapper.append(labelRow);
      renderNode(wrapper, node.oneOf[current], value, path);
      parent.append(wrapper); return;
    }
    if (key === 'cells' && Array.isArray(value)) {
      const box = el('div', undefined, 'visual-nested'); box.append(el('strong', label(key)));
      const grid = el('div', undefined, 'visual-grid');
      for (let cell = 1; cell <= 9; cell++) grid.append(button(String(cell), () => {
        const next = value.includes(cell) ? value.filter(item => item !== cell) : [...value, cell].sort();
        update(path, next); render();
      }, value.includes(cell) ? 'visual-cell selected' : 'visual-cell'));
      box.append(grid, el('small', 'As células devem formar um retângulo contínuo.'));
      parent.append(box); return;
    }
    if (node.type === 'object' || (value && typeof value === 'object' && !Array.isArray(value))) {
      const details = el('details', undefined, 'visual-nested'); details.open = path.length <= 3;
      details.append(el('summary', label(key)));
      const body = el('div', undefined, 'visual-fields');
      const object = value || {};
      const properties = {...(node.properties || {})};
      if (key === 'config') Object.assign(properties, configSchemas);
      for (const field of Object.keys(object)) {
        const fieldSchema = properties[field] || {type: typeof object[field]};
        const fieldWrap = el('div', undefined, 'visual-property');
        renderNode(fieldWrap, fieldSchema, object[field], [...path, field]);
        if (!(node.required || []).includes(field)) fieldWrap.append(button('Remover', () => { delete object[field]; changed(); }, 'visual-remove'));
        body.append(fieldWrap);
      }
      const available = Object.keys(properties).filter(field => !(field in object));
      if (available.length) {
        const add = el('div', undefined, 'visual-add');
        const picker = choices(add, available, available[0], () => {});
        add.append(button('+ Campo', () => { object[picker.value] = defaultValue(properties[picker.value], picker.value); changed(); }));
        body.append(add);
      }
      if (key === 'config') {
        const add = el('div', undefined, 'visual-add');
        const input = el('input'); input.placeholder = 'Outro parâmetro de config';
        const type = choices(add, ['texto', 'número', 'sim/não'], 'texto', () => {});
        add.prepend(input);
        add.append(button('+ Parâmetro', () => {
          const name = input.value.trim();
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name in object) return message('Use um nome de parâmetro novo, sem espaços.');
          object[name] = type.value === 'número' ? 0 : type.value === 'sim/não' ? false : ''; changed();
        }));
        body.append(add);
      }
      details.append(body); parent.append(details); return;
    }
    if (node.type === 'array' || Array.isArray(value)) {
      const details = el('details', undefined, 'visual-nested'); details.open = path.length <= 3;
      details.append(el('summary', `${label(key)} (${value?.length || 0})`));
      const list = value || [];
      list.forEach((item, index) => {
        const row = el('div', undefined, 'visual-array-item');
        row.append(el('strong', `${label(key)} ${index + 1}`));
        renderNode(row, node.items || {}, item, [...path, index]);
        row.append(button('Remover', () => { list.splice(index, 1); changed(); }, 'visual-remove'));
        details.append(row);
      });
      details.append(button(`+ ${key === 'elements' ? 'Camada' : key === 'music' ? 'Música' : 'Item'}`, () => {
        let item = defaultValue(node.items || {}, key);
        if (key === 'elements') {
          const scene = pathValue(path.slice(0, -1));
          item = {type: 'image', asset: '', start: scene.start, end: scene.end};
          item.id = `camada-${Date.now().toString(36)}`;
        }
        if (key === 'music') item = {asset: '', start: 0, end: Math.max(1, plan.timeline.at(-1)?.end || 5)};
        if (key === 'keyframes') item = {t: list.length ? Number(list.at(-1).t) + 1 : 0};
        list.push(item); changed();
      }));
      parent.append(details); return;
    }
    primitive(parent, node, value, path);
  };
  const renderTranscript = () => {
    const target = $('visualTranscriptRows');
    const previousScroll = target.parentElement.scrollTop;
    target.replaceChildren();
    const segments = context?.transcript;
    if (!segments?.length) { target.append(el('p', 'Nenhuma transcrição encontrada. Você pode carregar um transcript.json ou transcrever a narração na aba Transcrição.', 'helper-text')); return; }
    for (const segment of segments) {
      const row = el('div', undefined, 'visual-transcript-row');
      row.append(el('small', `${Number(segment.start).toFixed(2)}s – ${Number(segment.end).toFixed(2)}s`), el('p', segment.text));
      const actions = el('div', undefined, 'visual-transcript-actions');
      for (const [field, text] of [['start', 'Usar início'], ['end', 'Usar fim']]) actions.append(button(text, () => {
        if (!plan?.timeline?.[selectedScene]) return message('Adicione e selecione uma cena antes.');
        update(['timeline', selectedScene, field], Number(segment[field])); render();
      }, 'btn btn-ghost btn-sm'));
      row.append(actions); target.append(row);
    }
    target.parentElement.scrollTop = previousScroll;
  };
  const render = () => {
    if (!context || !plan) return;
    const global = $('visualGlobalFields'); global.replaceChildren();
    for (const field of ['project', 'sources', 'audio']) {
      if (plan[field] !== undefined) renderNode(global, schema().properties[field], plan[field], [field]);
    }
    if (plan.sources === undefined) global.append(button('+ Fontes e transcrição', () => { plan.sources = {}; changed(); }));
    const list = $('visualSceneList'); list.replaceChildren();
    $('visualSceneCount').textContent = '(' + plan.timeline.length + ')';
    let visible = 0;
    plan.timeline.forEach((scene,index) => {
      const brief = (scene.elements || []).map(item => item.text || item.asset || '').filter(Boolean).join(' ');
      if (searchQuery && ![scene.id,String(index + 1),brief,String(scene.start),String(scene.end)]
        .some(value => value.toLowerCase().includes(searchQuery))) return;
      visible++;
      const status = cacheStatus(scene);
      const card = button('', () => { selectedScene = index; render(); },
        index === selectedScene ? 'visual-scene selected' : 'visual-scene');
      card.setAttribute('role','listitem');
      card.setAttribute('aria-label','Cena ' + (index + 1) + ': ' + scene.id);
      card.setAttribute('aria-current',index === selectedScene ? 'true' : 'false');
      const heading = el('span',undefined,'scene-card-heading');
      heading.append(el('span',String(index + 1).padStart(2,'0'),'scene-number'),
        el('strong',scene.id || 'Sem ID'));
      const pill=el('span',cacheLabel(status.status),'scene-status status-' + status.status);
      card.append(heading,el('small',fmtTime(scene.start) + ' → ' + fmtTime(scene.end) + ' · ' +
        (scene.elements?.length || 0) + ' camada(s)'),pill);
      if (brief)card.append(el('span',brief.slice(0,90),'scene-card-brief'));
      list.append(card);
    });
    if (!visible) list.append(el('p','Nenhuma cena corresponde à busca.','helper-text'));
    const fields = $('visualSceneFields');
    const openDetails=[...fields.querySelectorAll('details')].map(node=>node.open);
    fields.replaceChildren();
    const scene = plan.timeline[selectedScene];
    const player = $('visualSceneVideo'),empty = $('visualSceneEmpty');
    if (scene) {
      const state = cacheStatus(scene);
      $('visualSelectedSceneTitle').textContent = scene.id;
      $('visualSelectedSceneCache').textContent = state.status === 'changed' && state.hasVideo ?
        'Versão anterior' : cacheLabel(state.status);
      $('visualSelectedSceneCache').className='cache-pill status-' + state.status;
      $('visualSceneTime').textContent = fmtTime(scene.start) + ' — ' + fmtTime(scene.end) +
        ' · ' + fmtTime(scene.end-scene.start);
      $('visualSceneLayerCount').textContent = (scene.elements?.length || 0) + ' camadas';
      const previewKey=projectRoot + '::' + scene.id;
      if(state.hasVideo){
        if(player.dataset.previewKey !== previewKey){
          player.pause();
          player.src='/api/editor/scenes/' + encodeURIComponent(scene.id) +
            '/media?projectRoot=' + encodeURIComponent(projectRoot);
          player.dataset.previewKey = previewKey;
          player.load();
        }
        player.classList.remove('hidden');empty.classList.add('hidden');
      }else{
        player.pause();player.removeAttribute('src');player.dataset.previewKey='';
        player.classList.add('hidden');empty.classList.remove('hidden');
        empty.querySelector('strong').textContent='Cena ainda não renderizada';
        empty.querySelector('small').textContent='Use Aproveitar cache para gerar o primeiro MP4 desta cena.';
      }
      const quick = el('section',undefined,'scene-quick');
      const heading = el('div',undefined,'scene-detail-heading');
      heading.append(el('div',undefined,'scene-detail-title'));
      heading.firstChild.append(el('span','PROPRIEDADES DA CENA','eyebrow'),el('h4','Ajustes rápidos'));
      const actions=el('div',undefined,'scene-action-row');
      actions.append(button('Inserir após',() => {
        const fresh={id:uniqueSceneId('cena'),start:0,end:5,layout:'3x3',
          background:{color:'#000000'},elements:[],transitionOut:'cut'};
        insertScene(selectedScene + 1,fresh);
      },'btn btn-secondary btn-sm'),button('Duplicar',()=>{
        const clone=cloneScene(scene);clone.id=uniqueSceneId(scene.id + '-copia');
        for(const item of clone.elements||[])if(item.id) item.id=item.id+'-copia';
        insertScene(selectedScene + 1,clone);
      },'btn btn-secondary btn-sm'),button('Excluir',()=>{
        if(!window.confirm('Excluir a cena ' + scene.id + '? Um intervalo vazio continuará na timeline.'))return;
        plan.timeline.splice(selectedScene,1);
        selectedScene=Math.max(0,Math.min(selectedScene,plan.timeline.length-1));changed();
      },'btn btn-danger btn-sm'));
      heading.append(actions);quick.append(heading);
      const quickGrid=el('div',undefined,'scene-quick-grid');
      for(const [key,title,step] of [['id','ID da cena',null],['start','Início (segundos)','0.01'],
        ['end','Fim (segundos)','0.01']]){
        const labelNode=el('label',undefined,'visual-field');labelNode.append(el('span',title));
        const input=el('input');input.type=step?'number':'text';
        if(step){input.min='0';input.step=step;}
        input.value=scene[key];input.addEventListener('change',()=>{
          const value=step?Number(input.value):input.value.trim();
          if(key==='id' && (!value || plan.timeline.some((other,i)=>i!==selectedScene&&other.id===value))){
            message('Escolha um ID novo e não vazio.');input.value=scene.id;return;
          }
          if(step && (value<0 || (key==='end'&&value<=scene.start) ||
            (key==='start'&&value>=scene.end))){message('Verifique o início e o fim da cena.');input.value=scene[key];return;}
          if(key==='start'){
            const previous=selectedScene?plan.timeline[selectedScene-1].end:0;
            const following=plan.timeline[selectedScene+1]?.start??Infinity;
            const delta=value-scene.start;
            if(value<previous||scene.end+delta>following){
              message('Mover a cena causaria sobreposição. Insira tempo ou escolha outro ponto.');
              input.value=scene.start;return;
            }
            shiftScene(scene,delta);changed();
            message('Cena e efeitos locais deslocados. A narração global permaneceu na posição original.');
          }else if(key==='end'){
            const next=plan.timeline[selectedScene+1]?.start??Infinity;
            if(value>next){message('O fim da cena ultrapassa a próxima.');input.value=scene.end;return;}
            const former=scene.end;
            for(const layer of scene.elements||[])if(layer.end===former)layer.end=value;
            scene.end=value;changed();
          }else update(['timeline',selectedScene,key],value);
        });
        labelNode.append(input);quickGrid.append(labelNode);
      }
      quick.append(quickGrid);
      const layerTools=el('div',undefined,'scene-layer-tools');
      layerTools.append(el('strong','Camadas da cena'));
      const picker=el('select');picker.setAttribute('aria-label','Tipo da nova camada');
      for(const [value,title] of [['image','Imagem / PNG'],['video','Vídeo'],['text','Texto'],
        ['caption','Legenda'],['overlay','Sobreposição'],['sfx','Efeito sonoro']]){
        const option=el('option',title);option.value=value;picker.append(option);
      }
      layerTools.append(picker,button('+ Adicionar camada',()=>{
        const type=picker.value;
        const element={id:'camada-'+Date.now().toString(36),type,
          start:scene.start,end:scene.end};
        if(['image','video','overlay','sfx'].includes(type))element.asset='';
        if(type==='image')element.cells=[2,5,8];
        if(type==='text')element.text='Novo texto';
        if(type==='sfx'){delete element.start;delete element.end;element.at=scene.start;}
        scene.elements=scene.elements||[];scene.elements.push(element);changed();
      },'btn btn-secondary btn-sm'));
      quick.append(layerTools);
      const advanced=el('details',undefined,'scene-advanced');
      advanced.append(el('summary','Editar propriedades avançadas (fundo, câmera, elementos, animações)'));
      const advancedBody=el('div',undefined,'scene-advanced-body');
      const sceneSchema=resolve(schema().$defs.scene);
      for(const field of Object.keys(scene)){
        if(['id','start','end'].includes(field))continue;
        renderNode(advancedBody,sceneSchema.properties[field]||{},scene[field],['timeline',selectedScene,field]);
      }
      const available=Object.keys(sceneSchema.properties).filter(field=>!(field in scene));
      if(available.length){
        const add=el('div',undefined,'visual-add');const picker=choices(add,available,available[0],()=>{});
        add.append(button('+ Propriedade',()=>{
          scene[picker.value]=defaultValue(sceneSchema.properties[picker.value],picker.value);changed();
        }));advancedBody.append(add);
      }
      advanced.append(advancedBody);quick.append(advanced);fields.append(quick);
    }else{
      $('visualSelectedSceneTitle').textContent='Nenhuma cena';
      $('visualSelectedSceneCache').textContent='Sem cache';
      $('visualSceneTime').textContent='—';$('visualSceneLayerCount').textContent='—';
      player.pause();player.removeAttribute('src');player.classList.add('hidden');
      empty.classList.remove('hidden');
      fields.append(el('p','Clique em + Nova cena para começar seu storyboard.','helper-text'));
    }
    [...fields.querySelectorAll('details')].forEach((node,i)=>{
      if(i < openDetails.length) node.open=openDetails[i];
    });
    renderTranscript();
  };
  const load = async (project) => {
    message('Carregando recursos do editor visual...');
    try {
      const response = await fetch('/api/editor/visual-context', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({projectRoot: project.projectRoot})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o editor visual.');
      const previouslySelected = projectRoot === project.projectRoot ?
        plan?.timeline?.[selectedScene]?.id : null;
      context = data; plan = JSON.parse($('editorPlanText').value);
      selectedScene = Math.max(0,plan.timeline.findIndex(scene=>scene.id===previouslySelected));
      projectRoot = project.projectRoot;
      initialScenes = new Map((plan.timeline||[]).map(item=>[item.id,cloneScene(item)]));
      lastSnapshot=JSON.stringify(plan);undoStates=[];redoStates=[];historyButtons();
      await loadCacheState();render();
      message('Editor visual pronto. Alterações aparecem também no JSON abaixo.');
    } catch (error) { message(error.message); }
  };
  const syncFromJson = () => {
    if (writing || !context) return;
    try { plan = JSON.parse($('editorPlanText').value); selectedScene = Math.min(selectedScene, Math.max(0, plan.timeline.length - 1));
      lastSnapshot=JSON.stringify(plan);undoStates=[];redoStates=[];historyButtons();render(); }
    catch (_) { message('Corrija o JSON para voltar a usar o editor visual.'); }
  };
  $('visualUndo').addEventListener('click',()=>restoreSnapshot(undoStates,redoStates));
  $('visualRedo').addEventListener('click',()=>restoreSnapshot(redoStates,undoStates));
  $('panel-editor').addEventListener('keydown',event=>{
    if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z')return;
    if(event.target.closest('input,textarea,select,[contenteditable]'))return;
    event.preventDefault();
    if(event.shiftKey)restoreSnapshot(redoStates,undoStates);
    else restoreSnapshot(undoStates,redoStates);
  });
  $('visualAddScene').addEventListener('click', () => {
    if (!plan || !context) return message('Abra ou crie um projeto primeiro.');
    const start=plan.timeline.length?Math.max(...plan.timeline.map(scene=>Number(scene.end))):0;
    plan.timeline.push({id:uniqueSceneId('cena'),start,end:start+5,layout:'3x3',
      background:{color:'#000000'},elements:[],transitionOut:'cut'});
    selectedScene=plan.timeline.length-1;changed();
  });
  $('visualSceneSearch').addEventListener('input',event=>{
    searchQuery=event.target.value.trim().toLowerCase();render();
  });
  $('visualRefresh').addEventListener('click', () => {
    const root = $('editorProjectRoot').value.trim();
    if (root) load({projectRoot: root});
  });
  $('visualImportTranscript').addEventListener('click', () => $('visualTranscriptFile').click());
  $('visualTranscriptFile').addEventListener('change', async () => {
    const file = $('visualTranscriptFile').files[0];
    if (!file || !context) return;
    try {
      const form = new FormData(); form.append('projectRoot', $('editorProjectRoot').value.trim()); form.append('file', file);
      const response = await fetch('/api/editor/project/transcript', {method: 'POST', body: form});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a transcrição.');
      plan.sources = plan.sources || {}; plan.sources.transcript = 'transcript.json'; changed();
      await load({projectRoot: $('editorProjectRoot').value.trim()});
      message(`${data.segments} trecho(s) carregado(s). Salve o plano.`);
    } catch (error) { message(error.message); }
    finally { $('visualTranscriptFile').value = ''; }
  });
  window.visualEditor = {load, syncFromJson};
})();
