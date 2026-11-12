/**
 * Planejador automático do modo composição (kit de motion Diazverso).
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
 * Regras: gancho em palavras gigantes; pergunta com o Nox; número vira contador; imagem citada pelo nome entra
 * quando é citada; frases longas viram dois beats; o mesmo tipo de cena não se repete 3 vezes seguidas.
 */
export function planMotion({ windows, words = [], media = [], title = '', question = '', end = null }) {
  const timed = timeSentences(windows, words);
  const pool = media.map(item => ({ ...item, key: fold(String(item.name || '').replace(/\.[a-z0-9]+$/i, '')) }));
  let next = 0; const recent = [];
  const pick = text => {
    if (!pool.length) return null;
    const said = new Set(fold(text).split(/[^a-z0-9]+/).filter(word => word.length >= 3));
    const named = pool.find(item => !recent.includes(item.id) && item.key.split(/[^a-z0-9]+/).some(word => word.length >= 3 && said.has(word)));
    let chosen = named; for (let tries = 0; !chosen && tries < pool.length; tries += 1) { const candidate = pool[next++ % pool.length]; if (!recent.includes(candidate.id) || pool.length <= 2) chosen = candidate; }
    chosen ||= pool[next++ % pool.length]; recent.push(chosen.id); if (recent.length > Math.min(3, pool.length - 1)) recent.shift();
    return { ...chosen, cited: chosen === named };
  };
  const named = text => pool.some(item => item.key && fold(text).split(/[^a-z0-9]+/).some(word => word.length >= 3 && item.key.split(/[^a-z0-9]+/).includes(word)));
  const beats = []; let id = 0;
  const push = (scene, at, duration, props, extra = {}) => { const last = beats.at(-1); const change = !last || last.scene !== scene; beats.push({ id: `b${String(++id).padStart(3, '0')}`, scene, at: round(at), duration: round(duration), props: JSON.parse(JSON.stringify(props)), sfx: extra.sfx ?? (change ? [{ name: id % 2 ? 'whoosh' : 'swish', at: 0, volume: 0.45 }] : []), flash: extra.flash ?? ['titulo', 'nox', 'cta', 'numero'].includes(scene) }); };
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
        push('cta', at, Math.max(len, 4), { titulo: 'DIAZVERSO', pergunta: short(question_ ? text : question || text, 90) }, { sfx: [{ name: 'riser', at: -1.8, volume: 0.4 }, { name: 'impact', at: 0, volume: 0.9 }, { name: 'pop', at: 1.4, volume: 0.5 }] });
        continue;
      }
      if (numeric && p === 0) {
        const value = Number(numeric[1].replace(',', '.')); const suffix = numeric[2] === '%' ? '%' : '';
        push('numero', at, len, { valor: value, de: 0, sufixo: suffix, rotulo: short(text, 44), fonte: 'roteiro', tendencia: NEGATIVE.test(text) ? 'desce' : 'sobe' }, { sfx: [{ name: 'tick', at: 0.2, volume: 0.4 }, { name: 'tick', at: 0.5, volume: 0.4 }, { name: 'ding', at: Math.min(len - 0.2, 1.2), volume: 0.4 }] });
        continue;
      }
      if (question_ && p === pieces - 1) { const scene = avoid('nox', 'frase'); push(scene, at, len, scene === 'nox' ? { humor: 'surpreso', texto: short(text, 26).toUpperCase(), fundo: 'explosao' } : { linhas: twoLines(short(text, 64)), humor: 'surpreso' }, { sfx: [{ name: 'pop', at: 0.1, volume: 0.6 }] }); if (scene === 'frase') beats.at(-1).legenda = false; continue; }
      if (item.role === 'payoff' && p === 0) { push('frase', at, len, { linhas: twoLines(short(text, 70)), destaque: ending(text) }, { sfx: [{ name: 'swish', at: 0, volume: 0.4 }, { name: 'impact', at: len * 0.55, volume: 0.7 }] }); beats.at(-1).legenda = false; continue; }
      const asset = pool.length && (named(text) || (p + index) % 3 !== 2) ? pick(text) : null;
      if (asset) {
        const scene = avoid('evidencia', 'nox');
        if (scene === 'evidencia') {
          const two = pool.length >= 2 && len >= 2.4 && (index + p) % 4 === 1;
          const tag = item_ => (item_.cited ? label(item_.name) : undefined);
          if (two) { const other = pick(`${text} outra`); push('pagina', at, len, { paineis: [{ midia: `media:${asset.id}`, rotulo: tag(asset) }, { midia: `media:${other.id}`, rotulo: tag(other) }] }, { sfx: [{ name: 'camera', at: 0, volume: 0.5 }, { name: 'camera', at: len * 0.4, volume: 0.5 }] }); }
          else push('evidencia', at, len, { midia: `media:${asset.id}`, rotulo: tag(asset), humor: (index + p) % 3 === 0 ? mood(text) : undefined, movimento: ['entrar', 'sair', 'panoramica'][(index + p) % 3] }, { flash: false });
          continue;
        }
      }
      const scene = avoid((index + p) % 2 ? 'nox' : 'frase', (index + p) % 2 ? 'frase' : 'nox');
      if (scene === 'nox') push('nox', at, len, { humor: mood(text), texto: short(text, 26).toUpperCase(), fundo: ['explosao', 'meio-tom', 'estrelas'][(index + p) % 3], lado: (index + p) % 2 ? 'direita' : 'esquerda' }, { sfx: [{ name: 'pop', at: 0.05, volume: 0.55 }] });
      else { push('frase', at, len, { linhas: twoLines(short(text, 64)) }); beats.at(-1).legenda = false; }
    }
  });
  if (end && beats.length) { const last = beats.at(-1); last.duration = round(Math.max(last.duration, end - last.at)); }
  return { schema: 'contentlab-motion-v1', beats, narration: true, captions: true, music: { volume: 0.5, duck: 0.25 }, source: 'auto' };
}
