import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import {APP_ROOT} from './plan.mjs';
import {buildMarkdown,buildHtml,figureAssets} from './docs.mjs';

const instruction=[
  '---','name: contentlab-edicao',
  'description: Cria edit_plan.json validado para o editor Content Lab, com Remotion, timeline, narração e cache.',
  '---','',
  '# Content Lab — skill de autoria',
  '',
  '## Fontes obrigatórias',
  '- Leia docs/Documentacao-ContentLab.md antes de construir cenas.',
  '- Confira schemas/edit_plan.schema.json: é o contrato único; não adicione um campo version.',
  '- Consulte os exemplos em examples/ e os diagramas docs/figures/ quando útil.',
  '',
  '## Fluxo recomendado',
  '1. Conheça narração, arquivos reais e formato de saída.',
  '2. Escolha cenas coerentes com a fala e IDs únicos estáveis.',
  '3. Gere edit_plan.json com project, audio e timeline; sources é opcional.',
  '4. Valide limites de tempo, tipos, URIs e propriedades com o schema.',
  '5. Preserve IDs de cenas e elementos ao ajustar um vídeo existente para aproveitar o cache.',
  '6. Não afirme ter renderizado ou validado imagens sem testes correspondentes.',
  '',
  '## Regras essenciais',
  '- Use project://assets/arquivo.ext e builtin://categoria/arquivo.ext para mídia existente; não invente arquivos.',
  '- O motor visual é Remotion; o FFmpeg compõe áudio e transições.',
  '- O modo padrão contain preserva o vídeo inteiro; só use cover para recorte intencional.',
  '- Para personagem centralizado numa grade 3x3, cells [2,5,8] é uma opção; escala em transform.scale.',
  '- start/end de cenas e camadas são segundos ABSOLUTOS. t dos keyframes é RELATIVO ao início da cena.',
  '- O campo at do SFX define o início audível. O sistema remove somente silêncio das bordas, não pausas internas.',
  '- Ao inserir uma cena no meio, ajuste música e eventos posteriores e preserve o alinhamento da narração via silenceInserts.',
  '- Para cortar um único trecho da narração use audio.narrationTrim {start,end}; para unir vários trechos use sourceCuts. Não use os dois juntos.',
  '- O Content Lab remove automaticamente somente silêncio do INÍCIO e FIM da narração e da música, igual aos SFX; preserva pausas internas. Por padrão está ligado.',
  '- Para manter uma introdução/cauda silenciosa intencional, marque audio.voice.autoTrimSilence:false ou audio.music[].autoTrimSilence:false.',
  '- O auto-trim é aplicado à música antes de loop/fades. Na narração, ajuste os timestamps de palavras após a remoção inicial; não use trimDb como corte de tempo.',
  '- audio.voice.fadeIn/fadeOut aplicam fades à voz, inclusive no fim real da fala antes de uma cauda musical.',
  '- Música: start/end posicionam o clipe na timeline; sourceStart/sourceEnd escolhem o trecho da fonte; loop repete apenas esse trecho por padrão.',
  '- Crossfade musical: sobreponha as duas faixas; por exemplo, primeira termina em 20 com fadeOut 3, segunda começa em 17 com fadeIn 3.',
  '- Evite textos que se sobreponham sem intenção; confirme intervalos e cells.',
  '- Use animações e estilos que constam no catálogo instalado. config admite campos arbitrários no schema, mas apenas os usados pelo renderer têm efeito.',
  '- Nunca adicione código JS executável ao edit_plan.json; ele é estritamente declarativo.',
  '- O storyboard reproduz vídeos por cena em cache, mas não é um render novo. A saída final deve ser conferida separadamente.',
  '',
  '## Checklist final',
  '- Cada cena tem id único, start < end e elementos válidos.',
  '- Cada camada visual possui id único dentro da cena.',
  '- Caminhos existem no projeto; fundos 16:9 não são ampliados sem pedido.',
  '- Legendas e eventos sonoros seguem os tempos absolutos, sourceCuts e silenceInserts.',
  '- O plano satisfaz schemas/edit_plan.schema.json e as regras adicionais de validação.',
  '',
  'A referência completa de cada campo, exemplos e diagramas está na documentação dentro deste ZIP.',
  ''
].join('\n');
export function streamSkillZip(response){
  response.setHeader('Content-Type','application/zip');
  response.setHeader('Content-Disposition','attachment; filename="ContentLab-Skill.zip"');
  const zip=archiver('zip',{zlib:{level:8}});
  zip.on('error',err=>response.destroy(err));
  zip.pipe(response);
  zip.append(instruction,{name:'SKILL.md'});
  zip.append(buildMarkdown(),{name:'docs/Documentacao-ContentLab.md'});
  zip.append(buildHtml({standalone:true}),{name:'docs/Documentacao-ContentLab.html'});
  for(const figure of figureAssets())
    zip.append(figure.content,{name:figure.name});
  for(const file of [
    'schemas/edit_plan.schema.json','EDIT_PLAN_REFERENCE.md','SCENE_CACHE.md',
    'CORRECOES_CACHE_AUDIO_TRANSICOES.md',
    'examples/minimal-edit-plan.json','examples/motion-grid.json',
    'examples/motion-storyboard.json','examples/tipografia.json',
    'examples/word-stack.json','examples/audio-phase8-edit-plan.json'
  ]){
    const source=path.join(APP_ROOT,file);
    if(fs.existsSync(source))zip.file(source,{name:file});
  }
  return zip.finalize();
}
