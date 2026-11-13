import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Personagem de teste neutro (formas simples: cabeça, corpo e braço em posições diferentes), gerado com FFmpeg.
 * Serve aos testes e aos scripts de QA; nada de personagem real entra no Content Lab.
 */
export const TEST_POSES = {
  parado: { arm: 'drawbox=x=310:y=300:w=50:h=220:color=0xF5C518@1:t=fill:replace=1', gesto: 'De pé, braços para baixo', tons: ['abertura', 'base', 'explicacao', 'bastidor', 'descoberta'] },
  pensando: { arm: 'drawbox=x=250:y=180:w=50:h=140:color=0xF5C518@1:t=fill:replace=1', gesto: 'Mão no queixo', tons: ['pergunta', 'ressalva', 'surpresa', 'tristeza', 'erro'] },
  apontando: { arm: 'drawbox=x=300:y=300:w=100:h=40:color=0xF5C518@1:t=fill:replace=1', gesto: 'Braço esticado apontando', tons: ['opiniao', 'enfase', 'piada', 'aprovacao', 'vitoria', 'discordancia'] },
};

/** Cria a pasta do pacote (PNGs + catalogo.json) e devolve o caminho. `variant` adiciona apontando-b.png. */
export async function makeCharacterPack(dir, { name = 'Boneco de teste', variant = true } = {}) {
  await mkdir(dir, { recursive: true });
  const poses = {};
  for (const [pose, { arm, gesto, tons }] of Object.entries(TEST_POSES)) {
    const files = [`${pose}.png`, ...(variant && pose === 'apontando' ? [`${pose}-b.png`] : [])];
    for (const [index, file] of files.entries()) {
      const shapes = ['format=rgba', 'drawbox=x=150:y=40:w=160:h=160:color=0xE63946@1:t=fill:replace=1', 'drawbox=x=130:y=220:w=200:h=320:color=0x2676E8@1:t=fill:replace=1', arm, `drawbox=x=170:y=560:w=50:h=${index ? 60 : 80}:color=0x0B0B10@1:t=fill:replace=1`, 'drawbox=x=240:y=560:w=50:h=80:color=0x0B0B10@1:t=fill:replace=1'].join(',');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black@0:s=460x640,format=rgba', '-vf', shapes, '-frames:v', '1', path.join(dir, file)]);
    }
    poses[pose] = { arquivos: files, gesto, tons };
  }
  await writeFile(path.join(dir, 'catalogo.json'), JSON.stringify({ versao: 1, nome: name, tons: { base: 'neutro' }, poses }, null, 2));
  return dir;
}
