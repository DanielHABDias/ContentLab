import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION_KIT } from '../motion/kit-catalog.js';

/**
 * Documentação do padrão do canal (aba Documentação da interface, mesmo núcleo para CLI/MCP).
 * Lê o catálogo do kit e o de poses do Nox, que vêm do plugin Diazverso; nada aqui escreve em assets/brand.
 */
export const BRAND_ROOT = import.meta.url.startsWith('file:') ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/brand') : path.join(process.cwd(), 'assets/brand');

/** Onde cada som entra (resumo de skills/diazverso-motion/references/som.md do plugin). */
const SFX_USE = {
  whoosh: 'Corte seco para cena nova (alterna com swish).',
  swish: 'Corte seco para cena nova (alterna com whoosh).',
  'whoosh-rapido': 'Cortes de ritmo acelerado.',
  'whoosh-lento': 'Transição longa, voo de câmera, entrada de capítulo (~1 s antes).',
  impact: 'Palavra gigante, título ou virada, no quadro em que bate.',
  sub: 'Camada grave junto do impact, só nas viradas fortes.',
  pop: 'Nox entra no aparte, balão estala, caixinha ou recorte aparece.',
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

export const CAPTION_RULES = [
  'Short (9:16): legenda palavra a palavra o tempo todo, acima da interface do Shorts.',
  'Vídeo longo (16:9): legenda só no gancho dos primeiros segundos e nos apartes do Nox.',
];

export const SOUND_RULES = [
  'Um som por evento na tela; no máximo dois em camada (impact + sub).',
  'O mesmo som não repete em trocas seguidas.',
  'Perto da fala, volume entre 0,3 e 0,5; mais alto só em pausas e viradas.',
  'O render final sai sem metadados.',
];

export class BrandDocs {
  constructor({ root = BRAND_ROOT, kit = MOTION_KIT } = {}) { this.root = root; this.kit = kit; }

  async poseCatalog() {
    if (!this.poses) this.poses = JSON.parse(await readFile(path.join(this.root, 'nox', 'poses', 'catalogo.json'), 'utf8'));
    return this.poses;
  }

  async docs() {
    const catalog = await this.poseCatalog();
    const sfx = await Promise.all((this.kit.sfx || []).map(async name => ({ name, use: SFX_USE[name] || '', origin: SFX_ORIGIN.has(name) ? 'CC0 (Freesound/Openverse)' : 'Original (procedural)', available: await exists(path.join(this.root, 'sfx', `${name}.wav`)) })));
    const poses = (this.kit.poses?.lista || Object.keys(catalog.poses || {})).map(id => { const pose = catalog.poses?.[id] || {}; return { id, files: (pose.arquivos || []).filter(file => NAME.test(file.replace(/\.png$/, ''))), gesture: pose.gesto || '', eyes: pose.olhos || '', tones: pose.tons || [] }; });
    return {
      schema: 'contentlab-brand-docs-v1',
      scenes: Object.entries(this.kit.cenas || {}).map(([id, scene]) => ({ id, use: scene.uso })),
      moods: this.kit.humores || [],
      backgrounds: this.kit.fundos || [],
      rules: this.kit.regras || [],
      captions: CAPTION_RULES,
      sound: SOUND_RULES,
      sfx,
      tones: catalog.tons || {},
      poses,
      poseUse: this.kit.poses?.uso || '',
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
    } else if (kind === 'pose') {
      const catalog = await this.poseCatalog();
      const known = Object.values(catalog.poses || {}).some(pose => (pose.arquivos || []).includes(`${value}.png`));
      if (!known) throw new Error('Pose fora do catálogo');
      file = path.join(this.root, 'nox', 'poses', `${value}.png`);
    } else throw new Error('Tipo de arquivo inválido');
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new Error('Arquivo do kit não encontrado; rode npm run scenes:diazverso');
    return { file, size: info.size, contentType: kind === 'sfx' ? 'audio/wav' : 'image/png' };
  }
}

async function exists(file) { return Boolean((await stat(file).catch(() => null))?.isFile()); }
