import { open, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { POSE_FILE, characterSchema } from './contracts.js';

/**
 * Pacote de personagem: uma pasta com os PNGs das poses e um `catalogo.json`
 * (`{ nome?, tons?: { tom: descrição }, poses: { pose: { arquivos: [png], gesto?, olhos?, tons: [tom] } } }`).
 * O catálogo pode estar na pasta ou em `poses/` dentro dela, junto dos PNGs. Só lê: a importação para
 * o projeto (mídia com papel `character` + catálogo) fica em MediaOperations.importCharacter.
 */
const catalogFileSchema = z.object({
  versao: z.number().optional(),
  nome: z.string().max(80).optional(),
  tons: characterSchema.shape.tons,
  poses: characterSchema.shape.poses,
});

const fail = (message, details) => Object.assign(new Error(message), { code: 'CHARACTER_INVALID', ...(details ? { details } : {}) });

/** Largura e altura de um PNG (cabeçalho IHDR); null se não for PNG. */
export async function pngSize(file) {
  const handle = await open(file, 'r');
  try { const head = Buffer.alloc(24); await handle.read(head, 0, 24, 0); return head.toString('ascii', 1, 4) === 'PNG' && head.toString('ascii', 12, 16) === 'IHDR' ? { w: head.readUInt32BE(16), h: head.readUInt32BE(20) } : null; }
  finally { await handle.close(); }
}

/** Lê e valida um pacote. Devolve nome, tons, poses e a lista de arquivos com caminho e tamanho. */
export async function readCharacterPack(folder) {
  const root = path.resolve(String(folder || ''));
  if (!(await stat(root).catch(() => null))?.isDirectory()) throw fail('Escolha a pasta do personagem (com os PNGs das poses e o catalogo.json)');
  const dir = (await stat(path.join(root, 'catalogo.json')).catch(() => null)) ? root : path.join(root, 'poses');
  const text = await readFile(path.join(dir, 'catalogo.json'), 'utf8').catch(() => null);
  if (text === null) throw fail('Falta o catalogo.json na pasta do personagem (ou em poses/)');
  let raw; try { raw = JSON.parse(text); } catch { throw fail('catalogo.json não é um JSON válido'); }
  const parsed = catalogFileSchema.safeParse(raw);
  if (!parsed.success) throw fail(`catalogo.json inválido: ${parsed.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const catalog = parsed.data; const files = []; const missing = [];
  for (const [pose, entry] of Object.entries(catalog.poses)) {
    for (const file of entry.arquivos) {
      const size = await pngSize(path.join(dir, file)).catch(() => null);
      if (!size) { missing.push(file); continue; }
      files.push({ file, pose, path: path.join(dir, file), ...size });
    }
  }
  if (missing.length) throw fail(`PNG ausente ou inválido no pacote: ${missing.slice(0, 6).join(', ')}`, { missing });
  const listed = new Set(files.map(item => item.file));
  const ignored = (await readdir(dir)).filter(name => POSE_FILE.test(name) && !listed.has(name));
  return { dir, name: catalog.nome || path.basename(root), tons: catalog.tons, poses: catalog.poses, files, ignored };
}
