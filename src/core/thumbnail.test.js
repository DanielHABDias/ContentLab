import { expect, test } from 'vitest';
import { thumbnailVariantSchema, thumbnailProps } from './thumbnail.js';
import { projectSchema } from './contracts.js';

test('receita rejeita gradiente desalinhado e valores fora do quadro permitido', () => {
  const border = {width:7,radius:24,colors:['#2676E8','#F5C518','#E63946'],stops:[0,52,88]};
  expect(thumbnailVariantSchema.parse({label:'A',text:'O PAI DO',border}).border).toEqual(border);
  expect(() => thumbnailVariantSchema.parse({label:'A',border:{...border,stops:[0,88]}})).toThrow();
  expect(() => thumbnailVariantSchema.parse({label:'A',border:{...border,stops:[0,88,52]}})).toThrow();
  expect(() => thumbnailVariantSchema.parse({label:'A',backgroundEffects:{vignette:2}})).toThrow();
});

test('receita salva parâmetros suficientes para renderizar sem composição local', () => {
  const recipe=thumbnailVariantSchema.parse({label:'B',text:'VINGANÇA?',layout:'palavra',background:'quadrinhos',texture:'halftone',mediaId:'peter',subject:{x:-80,y:35,width:1080,height:865},border:{width:7,radius:24,colors:['#2676E8','#E63946']},backgroundEffects:{blur:3,brightness:.7,saturation:.65,vignette:.75},halftone:{spacing:9,radius:.3,opacity:.595,full:true},foregroundText:{text:'AMIGO',x:330,y:500,width:560,size:165}});
  const props=thumbnailProps(recipe);
  expect(props).toMatchObject({midia:'media:peter',fundo:'quadrinhos',textura:'halftone',subject:recipe.subject,border:recipe.border,foregroundText:recipe.foregroundText});
  // O contrato de projeto inclui a mesma receita; zod não descarta os controles na gravação.
  const packaging=projectSchema.shape.creative.unwrap().shape.packaging;
  expect(packaging.parse({titleA:'A',titleB:'B',description:'d',tags:'t',seo:'',thumbnailMediaId:null,thumbnailVariants:[recipe]}).thumbnailVariants).toEqual([recipe]);
});

test('fontes usadas por uma receita são protegidas contra exclusão sem desassociar', async()=>{
 const {mediaUsages}=await import('./agent-service.js');
 const project={creative:{packaging:{thumbnailVariants:[{label:'A',mediaId:'goblin',backgroundMediaId:'pages'}]}},timeline:{tracks:[]}};
 expect(mediaUsages(project,'goblin')).toMatchObject({thumbnail:true,total:1});
 expect(mediaUsages(project,'pages')).toMatchObject({thumbnail:true,total:1});
 expect(mediaUsages(project,'other').total).toBe(0);
});
