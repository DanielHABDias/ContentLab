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
    sources: 'Fontes', assets: 'Pasta de assets', transcript: 'Transcrição', assetCatalog: 'Catálogo de assets', audio: 'Áudio', narration: 'Narração', sourceCuts: 'Cortes da voz', voice: 'Tratamento da voz', ducking: 'Redução automática da música', music: 'Músicas',
    start: 'Início (s)', end: 'Fim (s)', at: 'Momento (s)', id: 'Identificador', elements: 'Camadas', type: 'Tipo', asset: 'Arquivo', text: 'Texto', style: 'Estilo', fontAsset: 'Fonte (arquivo)', fontScale: 'Tamanho da fonte', reveal: 'Escrita letra a letra', charactersPerSecond: 'Letras por segundo', delay: 'Atraso (s)',
    cells: 'Células do grid 3×3', fit: 'Enquadramento', box: 'Caixa', animation: 'Animação', enter: 'Entrada', idle: 'Enquanto visível', exit: 'Saída', enterDuration: 'Duração da entrada', exitDuration: 'Duração da saída', z: 'Camada (z)', loop: 'Repetir vídeo', sync: 'Sincronização', emphasis: 'Ênfase', range: 'Intervalo', config: 'Configurações do efeito', textStyle: 'Aparência das letras', fontFamily: 'Fonte', uppercase: 'Maiúsculas', outlineColor: 'Cor do contorno', outlineWidth: 'Espessura do contorno (px)', blur: 'Desfoque da sombra', offsetX: 'Sombra horizontal', offsetY: 'Sombra vertical',
    transform: 'Posição e escala', x: 'Posição horizontal', y: 'Posição vertical', scale: 'Escala', rotation: 'Rotação', opacity: 'Opacidade', keyframes: 'Pontos da animação', t: 'Tempo na cena (s)', easing: 'Suavização', background: 'Fundo', color: 'Cor hexadecimal', layout: 'Layout', timeline: 'Cenas', transitionOut: 'Transição para próxima cena', transitionDuration: 'Duração da transição', camera: 'Câmera', shake: 'Balanço', amplitude: 'Amplitude', frequency: 'Frequência',
    preset: 'Predefinição', trimDb: 'Volume (dB)', fadeIn: 'Entrada gradual', fadeOut: 'Saída gradual', normalize: 'Normalizar', targetLufs: 'Alvo LUFS', truePeakDb: 'Pico real (dB)', highpassHz: 'Filtro grave (Hz)', enabled: 'Ativado', threshold: 'Limiar', ratio: 'Intensidade', attackMs: 'Ataque (ms)', releaseMs: 'Retorno (ms)', padding: 'Espaçamento', radius: 'Arredondamento', shadow: 'Sombra', border: 'Borda', grid: 'Grid', keyColor: 'Cor removida', similarity: 'Similaridade', blend: 'Suavidade', duration: 'Duração',
  };
  const configSchemas = {
    keyColor: {type: 'string'}, similarity: {type: 'number', minimum: 0, maximum: 1}, blend: {type: 'number', minimum: 0, maximum: 1},
    duration: {type: 'number', exclusiveMinimum: 0}, trimDb: {type: 'number'}, fadeIn: {type: 'number', minimum: 0}, fadeOut: {type: 'number', minimum: 0}, preset: {type: 'string'},
  };
  const suggestions = {
    layout: ['fullscreen', '3x3', 'custom_grid'], transitionOut: ['cut', 'fade', 'blur_left'],
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
  let listId = 0;
  const message = (value) => { $('visualMessage').textContent = value; };
  const label = (key) => labels[key] || key;
  const pathValue = (path) => path.reduce((value, part) => value?.[part], plan);
  const update = (path, value) => {
    let parent = plan;
    for (const part of path.slice(0, -1)) parent = parent[part];
    parent[path.at(-1)] = value;
    writing = true;
    $('editorPlanText').value = JSON.stringify(plan, null, 2);
    $('editorPlanText').dispatchEvent(new Event('input'));
    writing = false;
    message('Rascunho atualizado. Valide e salve o plano antes do render final.');
  };
  const changed = () => {
    writing = true;
    $('editorPlanText').value = JSON.stringify(plan, null, 2);
    $('editorPlanText').dispatchEvent(new Event('input'));
    writing = false;
    render();
  };
  const schema = () => context?.schemas?.[plan?.version] || context?.schemas?.['0.2'];
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
    row.append(el('span', label(key)));
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
          if (plan.version === '0.2') item.id = `camada-${Date.now().toString(36)}`;
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
    plan.timeline.forEach((scene, index) => {
      const card = button(`${index + 1}. ${scene.id || 'Sem nome'} · ${scene.start}s–${scene.end}s · ${scene.elements?.length || 0} camada(s)`, () => { selectedScene = index; render(); }, index === selectedScene ? 'visual-scene selected' : 'visual-scene');
      list.append(card);
    });
    const fields = $('visualSceneFields'); fields.replaceChildren();
    const scene = plan.timeline[selectedScene];
    if (scene) {
      const heading = el('div', undefined, 'visual-scenes-head');
      heading.append(el('h4', `Cena ${selectedScene + 1}`), button('Remover cena', () => {
        if (!window.confirm('Remover esta cena do rascunho?')) return;
        plan.timeline.splice(selectedScene, 1); selectedScene = Math.max(0, selectedScene - 1); changed();
      }, 'btn btn-danger btn-sm'));
      fields.append(heading);
      const sceneSchema = resolve(schema().$defs.scene);
      for (const field of Object.keys(scene)) renderNode(fields, sceneSchema.properties[field] || {}, scene[field], ['timeline', selectedScene, field]);
      const available = Object.keys(sceneSchema.properties).filter(field => !(field in scene));
      if (available.length) {
        const add = el('div', undefined, 'visual-add');
        const picker = choices(add, available, available[0], () => {});
        add.append(button('+ Opção da cena', () => { scene[picker.value] = defaultValue(sceneSchema.properties[picker.value], picker.value); changed(); }));
        fields.append(add);
      }
    } else fields.append(el('p', 'Clique em “+ Nova cena” para começar. Você também pode deixar intervalos sem cena: eles serão exibidos em preto.', 'helper-text'));
    renderTranscript();
  };
  const load = async (project) => {
    message('Carregando recursos do editor visual...');
    try {
      const response = await fetch('/api/editor/visual-context', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({projectRoot: project.projectRoot})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o editor visual.');
      context = data; plan = JSON.parse($('editorPlanText').value); selectedScene = 0; render();
      message('Editor visual pronto. Alterações aparecem também no JSON abaixo.');
    } catch (error) { message(error.message); }
  };
  const syncFromJson = () => {
    if (writing || !context) return;
    try { plan = JSON.parse($('editorPlanText').value); selectedScene = Math.min(selectedScene, Math.max(0, plan.timeline.length - 1)); render(); }
    catch (_) { message('Corrija o JSON para voltar a usar o editor visual.'); }
  };
  $('visualAddScene').addEventListener('click', () => {
    if (!plan || !context) return message('Abra ou crie um projeto primeiro.');
    const legacy = plan.version === '0.1' && plan.timeline.length > 0;
    if (plan.version === '0.1' && !legacy) plan.version = '0.2';
    const start = plan.timeline.length ? Math.max(...plan.timeline.map(scene => Number(scene.end))) : 0;
    const id = `cena-${Date.now().toString(36)}`;
    plan.timeline.push({id, start, end: start + 5, layout: legacy ? {grid: '3x3'} : '3x3', background: {color: '#000000'}, elements: [], transitionOut: 'cut'});
    selectedScene = plan.timeline.length - 1; changed();
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
