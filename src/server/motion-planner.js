/**
 * Planejador automático do modo composição (kit de motion do Content Lab).
 * Entrada: trechos do roteiro com janela de tempo, palavras com tempo (Whisper) e imagens/vídeos do assunto.
 * Saída: beats no ritmo das referências (troca a cada ~1,5–3 s), cada um com cena, props, SFX e clarão.
 * É ponto de partida: o agente revisa e ajusta pelo MCP (motion_plan_set).
 */
const MAX_BEAT = 3.0;
const STOP = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e é ou se mas mais muito como ao aos à às seu sua seus suas ele ela eles elas isso esse essa este esta foi era são ser ter tem tinha já não nem só também quando onde porque então depois antes até sobre entre estava estavam está estão ficou fica vai vão eram foram sendo havia pode podem faz fez coisa quer querem parece cada quem todo toda todos todas sempre nunca aqui agora assim dele dela você voce nada tudo algo alguém ninguém mesmo outro outra apenas ainda precisa precisava veio começa justamente direito prática alguma algum alguns algumas lá aí cara mano tipo né tá pra pro pelo pela'.split(' '));
const fold = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sentences = text => String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
const tokens = text => String(text).split(/\s+/).map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, '')).filter(Boolean);
const round = value => Math.round(value * 100) / 100;

/** Palavras de impacto (nomes próprios, números e palavras fortes), na ordem da fala. */
export function impact(text, limit = 3) {
  const words = tokens(text);
  const scored = words.map((word, index) => ({ word, index, score: (/^\p{N}/u.test(word) ? 4 : 0) + (index > 0 && /^\p{Lu}/u.test(word) ? 3 : 0) + (word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0) - (STOP.has(fold(word)) ? 9 : 0) }));
  const picked = scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).sort((a, b) => a.index - b.index).map(item => item.word);
  return (picked.length ? picked : words.slice(0, limit)).map(word => word.toUpperCase());
}
/** Frase curta para tela (até `max` caracteres, em palavra inteira). */
export function short(text, max = 34) {
  const clean = String(text).replace(/\s+/g, ' ').trim().replace(/[.…]+$/, '');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1); return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[,;:\s]+$/, '')}…`;
}
/** Quebra em duas linhas equilibradas. */
/** Pedaços naturais de 2–3 palavras (para palavras gigantes), no máximo `limit`. */
export function chunks(text, limit = 4) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); const out = []; let current = [];
  for (const word of words) { current.push(word); const joined = current.join(' '); if (current.length >= 3 || (current.length >= 2 && joined.length >= 11) || /[,.!?…:;]$/.test(word)) { out.push(joined); current = []; } }
  if (current.length) { if (out.length && current.join(' ').length < 6) out[out.length - 1] += ` ${current.join(' ')}`; else out.push(current.join(' ')); }
  return out.slice(0, limit).map(item => item.replace(/[,;:]$/, '').toUpperCase());
}
/** Fim da frase (depois da última vírgula, ou as 3 últimas palavras) para o destaque gigante. */
const ending = text => { const clean = String(text).replace(/[.…!?]+$/, ''); const parts = clean.split(/,\s*/); const tail = parts.length > 1 && parts.at(-1).split(' ').length <= 5 ? parts.at(-1) : clean.split(' ').slice(-3).join(' '); return `${tail.toUpperCase()}.`; };
const label = name => String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').toUpperCase();
const twoLines = text => { const words = String(text).split(' '); if (words.length < 5) return [text]; const half = Math.ceil(words.length / 2); return [words.slice(0, half).join(' '), words.slice(half).join(' ')]; };
const NEGATIVE = /\b(nunca|ninguém|nada|falh|perd|chato|tédio|fracass|caiu|cai|morre|morte|errad|erro|problema|pior|vazio)/i;
const SURPRISE = /[!?]$|\b(imagina|incrível|absurdo|olha só|mas|sério)\b/i;
const mood = text => (/\?$/.test(text) ? 'surpreso' : NEGATIVE.test(text) ? 'tedio' : SURPRISE.test(text) ? 'surpreso' : /\b(então|porque|princípio|lição|entender)\b/i.test(text) ? 'determinado' : 'feliz');
/** Ícone do balão do personagem pelo assunto da frase (kit: icons.tsx). */
const ICON_RULES = [[/dinheiro|grana|pag[ao]|preço|caro|rico/, 'dinheiro'], [/tempo|anos?\b|hora|demor|rápido demais/, 'relogio'], [/\bam[oa]r?\b|gosta|coração|paix/, 'coracao'], [/morr|morte|matar|mata\b/, 'caveira'], [/ideia|percebe|entend|lição|aprend/, 'lampada'], [/poder|força|forte|energia/, 'raio'], [/proteg|defend|escudo/, 'escudo'], [/\brei\b|melhor|maior|domina/, 'coroa'], [/incrível|absurd|explod|insano/, 'fogo'], [/errad|erro|nunca|falh|fracass/, 'errado'], [/certo|acert|sempre|funciona/, 'certo'], [/olha|\bvê\b|\bver\b|repara/, 'olho'], [/pensa|mente|cabeça|lógica/, 'cerebro'], [/venc|ganh|vitória|campe/, 'trofeu']];
const iconFor = text => { const folded = fold(text); const hit = ICON_RULES.find(([rule]) => rule.test(folded)); return hit ? hit[1] : /\?$/.test(text) ? 'interrogacao' : 'exclamacao'; };
const OPINION = /\b(pra mim|eu acho|acho que|na real|sinceramente|opinião|convenhamos|vamos combinar)\b/i;
/** Tom da frase, na mesma língua dos tons do catálogo de poses do personagem (`tons` de cada pose). */
const TONE_RULES = [
  [/\?$/, 'pergunta'], [OPINION, 'opiniao'], [/\b(kkk|haha|piada|ironia|zoeira|engraçad|ridícul|hilári)/i, 'piada'],
  [/\b(morr|morte|perd|triste|decep|chor|luto)/i, 'tristeza'], [/\b(venc|ganh|vitória|sucesso|conseguiu|campe)/i, 'vitoria'],
  [/\b(segredo|bastidor|curiosidade|pouca gente sabe|sabia que)/i, 'bastidor'], [/\b(discord|não concordo|exager|forçad)/i, 'discordancia'],
  [NEGATIVE, 'erro'], [/\b(ideia|percebe|entend|aí que está|lição|aprend|descobr|resumindo)/i, 'descoberta'],
  [/\b(mas|porém|calma|espera|só que|cuidado)\b/i, 'ressalva'], [/\b(certo|acert|funciona|genial|perfeito|bom demais)/i, 'aprovacao'],
  [/!$|\b(incrível|absurdo|sério|imagina)\b/i, 'surpresa'], [/\b(olha|repara|vê|presta atenção)\b/i, 'enfase'],
];
const EMOTIVE = new Set(['piada', 'erro', 'tristeza', 'vitoria', 'discordancia', 'surpresa', 'opiniao']);
const toneOf = text => TONE_RULES.find(([rule]) => rule.test(String(text).trim()))?.[1] || 'explicacao';
/** Tons vizinhos: as poses que podem seguir a primeira na mesma fala sem mudar o sentido. */
const NEAR = {
  pergunta: ['pergunta', 'surpresa', 'ressalva', 'explicacao'], opiniao: ['opiniao', 'enfase', 'aprovacao', 'discordancia', 'explicacao'],
  piada: ['piada', 'aprovacao', 'vitoria', 'enfase'], tristeza: ['tristeza', 'erro', 'ressalva'], vitoria: ['vitoria', 'aprovacao', 'piada', 'abertura'],
  bastidor: ['bastidor', 'descoberta', 'explicacao', 'enfase'], discordancia: ['discordancia', 'opiniao', 'erro', 'ressalva', 'pergunta'],
  erro: ['erro', 'piada', 'discordancia', 'tristeza'], descoberta: ['descoberta', 'explicacao', 'enfase', 'bastidor'],
  ressalva: ['ressalva', 'explicacao', 'pergunta', 'base'], aprovacao: ['aprovacao', 'vitoria', 'opiniao', 'piada'],
  surpresa: ['surpresa', 'pergunta', 'enfase', 'piada'], enfase: ['enfase', 'opiniao', 'explicacao', 'descoberta'],
  explicacao: ['explicacao', 'base', 'enfase', 'descoberta', 'bastidor'], abertura: ['abertura', 'aprovacao', 'explicacao', 'base'], base: ['base', 'explicacao'],
};
/** Uma pose nova a cada ~0,85 s de fala, de 1 a 5 por beat. */
const posesIn = len => Math.max(1, Math.min(5, Math.round(len / 0.85)));
const NUMBER = /(\d+(?:[.,]\d+)?)\s*(%|mil|milhões|bilhões|anos)?/gi;
/** Primeiro número que não é um ano (anos viram contexto, não contador). */
const numberIn = text => [...String(text).matchAll(NUMBER)].find(match => !/^(1[0-9]{3}|20[0-9]{2})$/.test(match[1]) || match[2] === '%') || null;

/** Distribui cada frase do roteiro no tempo: palavras do Whisper dentro da janela do trecho, ou proporcional a caracteres. */
export function timeSentences(windows, words = []) {
  const out = [];
  for (const [w, window] of windows.entries()) {
    const parts = sentences(window.scene.text); if (!parts.length) continue;
    const end = window.start + window.length;
    const inside = words.filter(word => word.start >= window.start - 0.05 && word.start < end);
    const counts = parts.map(part => Math.max(1, tokens(part).length)); const total = counts.reduce((a, b) => a + b, 0);
    let cursor = window.start; let consumed = 0;
    parts.forEach((text, i) => {
      let start;
      if (inside.length) { const index = Math.min(inside.length - 1, Math.round((consumed / total) * inside.length)); start = i === 0 ? window.start : inside[index].start; }
      else start = cursor;
      consumed += counts[i]; cursor += window.length * (counts[i] / total);
      out.push({ text, start: round(Math.max(window.start, start)), sceneId: window.scene.id, role: window.scene.id.split('-')[0], first: i === 0, last: i === parts.length - 1, lastWindow: w === windows.length - 1 });
    });
  }
  out.forEach((item, i) => { item.end = round(i + 1 < out.length ? out[i + 1].start : Math.max(item.start + 1, windows.at(-1).start + windows.at(-1).length)); });
  return out.filter(item => item.end - item.start > 0.15);
}

/**
 * Beats a partir das frases cronometradas. `media`: [{id, name, kind}] na ordem de importação.
 * Regras: gancho em palavras gigantes; pergunta com o personagem; número vira contador; imagem citada pelo nome entra
 * quando é citada; frases longas viram dois beats; o mesmo tipo de cena não se repete 3 vezes seguidas.
 * `poses`: catálogo do personagem do projeto (pose → { tons }); sem ele não há aparte, cena `personagem` nem humor.
 */
export function planMotion({ windows, words = [], media = [], title = '', question = '', end = null, vertical = false, poses = null, report = {} }) {
  const timed = timeSentences(windows, words);
  // Poses do personagem: todas do catálogo aparecem ao longo do vídeo; dentro do tom, a que ainda não apareceu vem primeiro.
  const catalog = Object.fromEntries(Object.entries(poses || {}).map(([name, entry]) => [name, Array.isArray(entry) ? entry : entry?.tons || []]));
  const hasChar = Object.keys(catalog).length > 0; const moodOf = text => (hasChar ? mood(text) : undefined);
  const used = new Map(Object.keys(catalog).map(name => [name, 0])); let lastPose = ''; let charSeen = false; let poseTurn = 0;
  const choosePose = tones => {
    const fits = Object.keys(catalog).filter(name => name !== lastPose && catalog[name].some(tone => tones.includes(tone)));
    const options = fits.length ? fits : Object.keys(catalog).filter(name => name !== lastPose);
    const least = Math.min(...options.map(name => used.get(name)));
    const best = options.filter(name => used.get(name) === least);
    const name = best[poseTurn++ % best.length]; used.set(name, used.get(name) + 1); lastPose = name; return name;
  };
  /** Sequência de poses de uma fala: a primeira no tom exato, as seguintes nos tons vizinhos. */
  const poseRun = (text, count) => { const tone = !charSeen ? 'abertura' : toneOf(text); charSeen = true; return Array.from({ length: count }, (_, i) => choosePose(i === 0 ? [tone] : NEAR[tone] || NEAR.explicacao)); };
  const all = media.map(item => ({ ...item, key: fold(String(item.name || '').replace(/\.[a-z0-9]+$/i, '')) }));
  // Recortes PNG (nome com "recorte" ou "png-"): entram por cima da cena quando citados, não como cena.
  const isCut = item => /(^|[^a-z])(recorte|png)([^a-z]|$)/.test(item.key);
  const pool = all.filter(item => !isCut(item)); const cutouts = all.filter(isCut);
  const cutFor = text => { const said = new Set(fold(text).split(/[^a-z0-9]+/).filter(word => word.length >= 3)); return cutouts.find(item => item.key.split(/[^a-z0-9]+/).some(word => word.length >= 3 && !['recorte', 'png'].includes(word) && said.has(word))); };
  // Fundos sempre variando: nunca o mesmo de um beat para o outro.
  const BGS = [['papel'], ['meio-tom', 'azul'], ['escuro'], ['explosao', 'amarelo'], ['meio-tom', 'vermelho'], ['estrelas'], ['explosao', 'vermelho'], ['branco']];
  let bgTurn = 0; const nextBg = (allowed = BGS) => { const options = allowed.filter(([kind, tone]) => `${kind}${tone || ''}` !== lastBg); const [kind, tone] = options[bgTurn++ % options.length]; lastBg = `${kind}${tone || ''}`; return tone ? { fundo: kind, tom: tone } : { fundo: kind }; };
  let lastBg = '';
  let next = 0; const recent = []; let lastMedia = null;
  const pick = text => {
    if (!pool.length) return null;
    const said = new Set(fold(text).split(/[^a-z0-9]+/).filter(word => word.length >= 3));
    const named = pool.find(item => !recent.includes(item.id) && item.key.split(/[^a-z0-9]+/).some(word => word.length >= 3 && said.has(word)));
    let chosen = named; for (let tries = 0; !chosen && tries < pool.length; tries += 1) { const candidate = pool[next++ % pool.length]; if (!recent.includes(candidate.id) || pool.length <= 2) chosen = candidate; }
    chosen ||= pool[next++ % pool.length]; recent.push(chosen.id); if (recent.length > Math.min(3, pool.length - 1)) recent.shift();
    lastMedia = chosen.id; return { ...chosen, cited: chosen === named };
  };
  const named = text => pool.some(item => item.key && fold(text).split(/[^a-z0-9]+/).some(word => word.length >= 3 && item.key.split(/[^a-z0-9]+/).includes(word)));
  const beats = []; let id = 0;
  // Som de corte em rodízio, para não repetir o mesmo whoosh em seguida.
  let cuts = 0; const cut = () => ({ name: ['whoosh', 'swish', 'whoosh-rapido'][cuts++ % 3], at: 0, volume: 0.45 });
  const push = (scene, at, duration, props, extra = {}) => { const last = beats.at(-1); const change = !last || last.scene !== scene; beats.push({ id: `b${String(++id).padStart(3, '0')}`, scene, at: round(at), duration: round(duration), props: JSON.parse(JSON.stringify(props)), sfx: extra.sfx ?? (change ? [cut()] : []), flash: extra.flash ?? ['titulo', 'personagem', 'cta', 'numero'].includes(scene) }); };
  const recentScenes = () => beats.slice(-2).map(beat => beat.scene);
  const avoid = (scene, alternative) => (recentScenes().length === 2 && recentScenes().every(item => item === scene) ? alternative : scene);

  timed.forEach((item, index) => {
    const { text, start } = item; const total = item.end - start; const isLast = index === timed.length - 1;
    const pieces = total > MAX_BEAT * 1.3 ? Math.min(4, Math.ceil(total / MAX_BEAT)) : 1; const piece = total / pieces;
    const numeric = numberIn(text); const question_ = /\?$/.test(text);
    for (let p = 0; p < pieces; p += 1) {
      const at = start + p * piece; const len = p === pieces - 1 ? item.end - at : piece;
      if (index === 0 && p === 0) {
        push('titulo', at, len, { palavras: chunks(text, Math.max(2, Math.min(4, Math.round(len / 0.9)))) }, { sfx: [{ name: 'impact', at: 0, volume: 0.8 }, { name: 'sub', at: 0, volume: 0.5 }] });
        continue;
      }
      if (isLast && p === pieces - 1 && item.role === 'payoff') {
        push('cta', at, Math.max(len, 4), { pergunta: short(question_ ? text : question || text, 90) }, { sfx: [{ name: 'riser', at: -1.8, volume: 0.4 }, { name: 'impact', at: 0, volume: 0.9 }, { name: 'pop', at: 1.4, volume: 0.5 }] });
        continue;
      }
      if (numeric && p === 0) {
        const value = Number(numeric[1].replace(',', '.')); const suffix = numeric[2] === '%' ? '%' : '';
        push('numero', at, len, { valor: value, de: 0, sufixo: suffix, rotulo: short(text, 44), fonte: 'roteiro', tendencia: NEGATIVE.test(text) ? 'desce' : 'sobe' }, { sfx: [{ name: 'tick', at: 0.2, volume: 0.4 }, { name: 'tick', at: 0.5, volume: 0.4 }, { name: 'ding', at: Math.min(len - 0.2, 1.2), volume: 0.4 }] });
        continue;
      }
      // Pergunta ou piada sobre o que está na tela: aparte do personagem sobre a cena desfocada (da cintura para cima).
      if (hasChar && question_ && p === pieces - 1 && lastMedia && recentScenes().at(-1) !== 'aparte') {
        const run = poseRun(text, posesIn(len)); const say = Math.floor(run.length / 2);
        const falas = run.map((pose, i) => ({ pose, humor: i ? (mood(text) === 'surpreso' ? 'confuso' : mood(text)) : 'surpreso', ...(i === 0 ? { icone: iconFor(text) } : {}), ...(i === say && i > 0 && len >= 2.2 ? { texto: short(text, 22).toUpperCase() } : {}) }));
        push('aparte', at, len, { midia: `media:${lastMedia}`, falas }, { sfx: [cut(), { name: 'pop', at: 0.45, volume: 0.6 }], flash: false });
        continue;
      }
      if (question_ && p === pieces - 1) { const scene = hasChar ? avoid('personagem', 'frase') : 'frase'; push(scene, at, len, scene === 'personagem' ? { humor: 'surpreso', texto: short(text, 26).toUpperCase(), fundo: 'explosao' } : { linhas: twoLines(short(text, 64)), ...(hasChar ? { humor: 'surpreso' } : {}), ...nextBg() }, { sfx: [{ name: 'pop', at: 0.1, volume: 0.6 }] }); if (scene === 'frase') beats.at(-1).legenda = false; continue; }
      if (item.role === 'payoff' && p === 0) { push('frase', at, len, { linhas: twoLines(short(text, 70)), destaque: ending(text), ...nextBg() }, { sfx: [{ name: 'swish', at: 0, volume: 0.4 }, { name: 'impact', at: len * 0.55, volume: 0.7 }] }); beats.at(-1).legenda = false; continue; }
      // Frase de emoção (piada, erro, vitória, tristeza, discordância, surpresa, opinião): o personagem reage por cima da cena.
      if (hasChar && EMOTIVE.has(toneOf(text)) && lastMedia && !named(text) && !beats.slice(-2).some(beat => beat.scene === 'aparte')) { const run = poseRun(text, posesIn(len)); push('aparte', at, len, { midia: `media:${lastMedia}`, falas: run.map((pose, i) => ({ pose, humor: mood(text), ...(i === 0 ? { icone: iconFor(text) } : {}), ...(i === Math.floor(run.length / 2) && i > 0 && len >= 2.2 ? { texto: short(text, 22).toUpperCase() } : {}) })) }, { sfx: [cut(), { name: 'pop', at: 0.45, volume: 0.6 }], flash: false }); continue; }
      const asset = pool.length && (named(text) || (p + index) % 3 !== 2) ? pick(text) : null;
      if (asset) {
        const scene = avoid('evidencia', hasChar ? 'personagem' : 'frase');
        if (scene === 'evidencia') {
          const two = pool.length >= 2 && len >= 2.4 && (index + p) % 4 === 1;
          const tag = item_ => (item_.cited ? label(item_.name) : undefined);
          if (two) { const other = pick(`${text} outra`); push('pagina', at, len, { paineis: [{ midia: `media:${asset.id}`, rotulo: tag(asset) }, { midia: `media:${other.id}`, rotulo: tag(other) }] }, { sfx: [{ name: 'camera', at: 0, volume: 0.5 }, { name: 'camera', at: len * 0.4, volume: 0.5 }] }); }
          else {
            // Metade das evidências é só a cena, em tela cheia, sem moldura; a outra metade ganha painel e fundo variado.
            const plain = (index + p) % 2 === 0;
            push('evidencia', at, len, { midia: `media:${asset.id}`, rotulo: tag(asset), humor: !plain && (index + p) % 6 === 3 ? moodOf(text) : undefined, movimento: ['entrar', 'sair', 'panoramica'][(index + p) % 3], ...(plain ? { cheia: true } : nextBg([['papel'], ['meio-tom', 'azul'], ['escuro'], ['meio-tom', 'vermelho'], ['branco']])) }, { flash: false });
          }
          continue;
        }
      }
      // Sem mídia para esta frase: o personagem comenta por cima da última cena (aparte) ou a frase vira texto pensado;
      // o personagem de corpo inteiro fica para poucos momentos.
      const turn = (index + p) % 3;
      if (hasChar && (turn === 1 || OPINION.test(text)) && lastMedia && recentScenes().at(-1) !== 'aparte') { const run = poseRun(text, posesIn(len)); const say = Math.floor(run.length / 2); push('aparte', at, len, { midia: `media:${lastMedia}`, falas: run.map((pose, i) => ({ pose, humor: i ? (mood(text) === 'feliz' ? 'piscada' : 'determinado') : mood(text), ...(i === 0 ? { icone: iconFor(text) } : {}), ...(i === say && i > 0 && len >= 2.2 ? { texto: short(text, 22).toUpperCase() } : {}) })) }, { sfx: [cut(), { name: 'pop', at: 0.45, volume: 0.6 }], flash: false }); continue; }
      const scene = avoid(hasChar && turn === 2 && !beats.slice(-6).some(beat => beat.scene === 'personagem') ? 'personagem' : 'frase', 'frase');
      if (scene === 'personagem') push('personagem', at, len, { humor: mood(text), texto: short(text, 26).toUpperCase(), ...nextBg([['explosao', 'amarelo'], ['meio-tom', 'azul'], ['explosao', 'vermelho'], ['estrelas'], ['meio-tom', 'vermelho']]), lado: (index + p) % 2 ? 'direita' : 'esquerda', poses: poseRun(text, posesIn(len)).map(pose => ({ pose, humor: mood(text) })) }, { sfx: [{ name: 'pop', at: 0.05, volume: 0.55 }] });
      else { push('frase', at, len, { linhas: twoLines(short(text, 64)), ...nextBg() }); beats.at(-1).legenda = false; }
    }
  });
  if (end && beats.length) { const last = beats.at(-1); last.duration = round(Math.max(last.duration, end - last.at)); }
  // Recortes PNG citados na fala entram por cima do beat em que são ditos.
  for (const item of timed) { const cut = cutFor(item.text); if (!cut) continue; const beat = beats.find(b => item.start >= b.at - 0.05 && item.start < b.at + b.duration); if (beat && beat.scene !== 'cta' && beat.scene !== 'titulo') (beat.extras ||= []).push({ tipo: 'recorte', midia: `media:${cut.id}`, at: round(Math.max(0, item.start - beat.at)), duracao: round(Math.min(beat.duration, item.end - item.start + 0.4)) }); }
  // Caixinhas de lembrete (sem precisar ser faladas): inscrição perto de 20%, like perto de 55% e "opinião" nas frases opinativas.
  const total = beats.length ? beats.at(-1).at + beats.at(-1).duration : 0;
  const host = time => beats.find(b => time >= b.at && time < b.at + b.duration && !['titulo', 'cta', 'aparte'].includes(b.scene) && b.duration >= 1.6);
  if (total >= 25) for (const [share, preset] of [[0.2, 'inscricao'], [0.55, 'like']]) { const beat = host(total * share) || beats.find(b => b.at >= total * share && !['titulo', 'cta', 'aparte'].includes(b.scene)); if (beat) { const duracao = Math.min(3, Math.max(1.4, beat.duration - 0.3)); (beat.extras ||= []).push({ tipo: 'caixinha', preset, at: 0.2, duracao }); (beat.sfx ||= []).push({ name: 'pop', at: 0.2, volume: 0.5 }, { name: 'clique', at: round(0.2 + duracao * 0.5), volume: 0.7 }); } }
  for (const item of timed) if (OPINION.test(item.text)) { const beat = beats.find(b => item.start >= b.at - 0.05 && item.start < b.at + b.duration && !['titulo', 'cta'].includes(b.scene) && b.duration >= 1.2); if (beat && !beat.extras?.some(extra => extra.tipo === 'caixinha')) (beat.extras ||= []).push({ tipo: 'caixinha', preset: 'opiniao', canto: 'superior-esquerdo', at: 0.1, duracao: Math.min(2.5, beat.duration - 0.2) }); }
  // Poses que ainda não apareceram entram no lugar de repetidas, nas falas seguintes de um tom vizinho.
  for (const strict of [true, false]) for (const name of Object.keys(catalog).filter(item => !used.get(item))) {
    for (const beat of beats) {
      const list = beat.scene === 'aparte' ? beat.props.falas : beat.scene === 'personagem' ? beat.props.poses : null; if (!list) continue;
      const tone = toneOf(timed.find(item => beat.at >= item.start - 0.05 && beat.at < item.end)?.text || '');
      const slot = list.findIndex((item, i) => i > 0 && used.get(item.pose) > 1 && (!strict || catalog[name].some(t => (NEAR[tone] || NEAR.explicacao).includes(t))) && list[i - 1]?.pose !== name && list[i + 1]?.pose !== name);
      if (slot < 0) continue;
      used.set(list[slot].pose, used.get(list[slot].pose) - 1); list[slot].pose = name; used.set(name, 1); break;
    }
  }
  // Piada do personagem: tapa seco; o tapa de meme (com eco) no máximo uma vez a cada 90 s.
  let lastMeme = -Infinity;
  for (const beat of beats) {
    if (beat.scene !== 'aparte') continue;
    const text = timed.find(item => beat.at >= item.start - 0.05 && beat.at < item.end)?.text || '';
    if (toneOf(text) !== 'piada' && toneOf(text) !== 'erro') continue;
    const meme = beat.at - lastMeme >= 90; if (meme) lastMeme = beat.at;
    beat.sfx = [...(beat.sfx || []).filter(cue => cue.name !== 'pop'), { name: meme ? 'tapa-eco' : 'tapa', at: 0.45, volume: meme ? 0.6 : 0.55 }];
  }
  report.posesUsadas = [...used].filter(([, count]) => count > 0).map(([name]) => name);
  report.posesFaltando = [...used].filter(([, count]) => count === 0).map(([name]) => name);
  // Legenda: nos Shorts o tempo todo; no vídeo longo só no gancho (primeiros 6 s) e nos apartes do personagem.
  if (!vertical) for (const beat of beats) if (beat.at >= 6 && beat.scene !== 'aparte') beat.legenda = false;
  return { schema: 'contentlab-motion-v1', beats, narration: true, captions: true, music: { volume: 0.5, duck: 0.25 }, source: 'auto' };
}
