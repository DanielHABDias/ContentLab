import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION_KIT } from '../motion/kit-catalog.js';

/**
 * Documentação do kit de motion (aba Documentação da interface, mesmo núcleo para CLI/MCP):
 * cenas com exemplos tocáveis, fundos, regras de legenda e som e os SFX. Só lê arquivos do próprio kit.
 */
export const KIT_ROOT = import.meta.url.startsWith('file:') ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/kit') : path.join(process.cwd(), 'assets/kit');

/** Onde cada som entra. */
const SFX_USE = {
  whoosh: 'Corte seco para cena nova (alterna com swish).',
  swish: 'Corte seco para cena nova (alterna com whoosh).',
  'whoosh-rapido': 'Cortes de ritmo acelerado.',
  'whoosh-lento': 'Transição longa, voo de câmera, entrada de capítulo (~1 s antes).',
  impact: 'Palavra gigante, título ou virada, no quadro em que bate.',
  sub: 'Camada grave junto do impact, só nas viradas fortes.',
  pop: 'Personagem entra no aparte, balão estala, caixinha ou recorte aparece.',
  tick: 'Cada degrau de um número subindo.',
  ding: 'Valor final de um número.',
  type: 'Texto sendo digitado.',
  camera: 'Painel da HQ ou frame da obra entrando.',
  riser: 'Tensão antes da revelação; termina no corte.',
  glitch: 'Erro, “não é bem assim”.',
  error: 'Erro, “não é bem assim”.',
  clique: 'Caixinha de inscrição ou like sendo clicada.',
  sino: 'Sininho, notificação, “acertou”. Meme: no máximo 1 a cada 1–2 min.',
  explosao: 'Revelação enorme ou fundo explosão. Meme: no máximo 1 a cada 1–2 min.',
  tapa: 'Piada física, correção seca.',
  'tapa-eco': 'Tapa de meme, com eco. No máximo 1 a cada 1–2 min.',
};

const SFX_ORIGIN = new Set(['clique', 'sino', 'explosao', 'tapa', 'tapa-eco', 'whoosh-rapido', 'whoosh-lento']);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Cenas que dependem de mídia do projeto, do personagem ou de WebGL ficam fora das prévias da documentação. */
const NO_PREVIEW = new Set(['evidencia', 'aparte', 'personagem', 'paineis3d']);
const FILES = { font: { anton: 'fonts/Anton-Regular.ttf' } };

export const CAPTION_RULES = [
  'Short (9:16): legenda palavra a palavra o tempo todo, acima da interface do Shorts.',
  'Vídeo longo (16:9): legenda só no gancho dos primeiros segundos e nos apartes do personagem.',
];

export const SOUND_RULES = [
  'Um som por evento na tela; no máximo dois em camada (impact + sub).',
  'O mesmo som não repete em trocas seguidas.',
  'Perto da fala, volume entre 0,3 e 0,5; mais alto só em pausas e viradas.',
  'O render final sai sem metadados.',
];

/** Tira as referências `media:<id>` do exemplo (a prévia não tem mídia de projeto). */
const withoutMedia = value => (Array.isArray(value) ? value.map(withoutMedia) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([, item]) => !(typeof item === 'string' && item.startsWith('media:'))).map(([key, item]) => [key, withoutMedia(item)]))
  : value);

export class BrandDocs {
  constructor({ root = KIT_ROOT, kit = MOTION_KIT } = {}) { this.root = root; this.kit = kit; }

  async docs() {
    const sfx = await Promise.all((this.kit.sfx || []).map(async name => ({ name, use: SFX_USE[name] || '', origin: SFX_ORIGIN.has(name) ? 'CC0 (Freesound/Openverse)' : 'Original (procedural)', available: await exists(path.join(this.root, 'sfx', `${name}.wav`)) })));
    return {
      schema: 'contentlab-brand-docs-v2',
      scenes: Object.entries(this.kit.cenas || {}).map(([id, scene]) => ({ id, use: scene.uso, ...(NO_PREVIEW.has(id) || !scene.exemplo ? {} : { example: withoutMedia(scene.exemplo) }) })),
      moods: this.kit.humores || [],
      backgrounds: this.kit.fundos || [],
      colors: ['amarelo', 'vermelho', 'azul', 'branco', 'tinta'],
      rules: this.kit.regras || [],
      captions: CAPTION_RULES,
      sound: SOUND_RULES,
      sfx,
      character: this.kit.poses || null,
    };
  }

  /** Só nomes do catálogo, validados por regex; o caminho nunca vem do cliente. */
  async file({ kind, name }) {
    const value = String(name || '');
    if (!NAME.test(value)) throw new Error('Nome de arquivo inválido');
    let file;
    if (kind === 'sfx') {
      if (!(this.kit.sfx || []).includes(value)) throw new Error('Som fora do catálogo do kit');
      file = path.join(this.root, 'sfx', `${value}.wav`);
    } else if (kind === 'font' && FILES.font[value]) file = path.join(this.root, FILES.font[value]);
    else throw new Error('Tipo de arquivo inválido');
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new Error('Arquivo do kit não encontrado em assets/kit');
    return { file, size: info.size, contentType: kind === 'sfx' ? 'audio/wav' : 'font/ttf' };
  }
}

async function exists(file) { return Boolean((await stat(file).catch(() => null))?.isFile()); }
