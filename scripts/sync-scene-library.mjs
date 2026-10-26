import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=process.env.CONTENTLAB_SCENE_LIBRARY??path.join(repo,'scene-library');
const require=createRequire(path.join(repo,'backend/remotion/package.json')),ts=require('typescript');
const check=process.argv.includes('--check'),entries=JSON.parse(fs.readFileSync(root+'/manifest.json'));
const background=fs.readFileSync(root+'/background-hq/BackgroundHQ.tsx','utf8');
const marker='// Fundos HQ v2',canonical=background.slice(background.indexOf(marker)).trimEnd();
const utility=fs.readFileSync(root+'/shared/HQMotion.tsx','utf8');let changes=0;
function save(file,content){if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===content)return;changes++;if(!check)fs.writeFileSync(file,content);else console.error('Desatualizado: '+path.relative(root,file));}
for(const entry of entries){
 const file=path.join(root,entry.id,entry.file);let source=fs.readFileSync(file,'utf8');
 const start=source.indexOf(marker);if(start>=0&&entry.id!=='background-hq'){let end=source.indexOf('\ntype HQFont',start);if(end<0)end=source.length;source=source.slice(0,start)+canonical+'\n'+source.slice(end);save(file,source);}
 if(source.includes("from './HQMotion'")){save(path.join(root,entry.id,'HQMotion.tsx'),utility);entry.companions=[...new Set([...(entry.companions??[]),`scene-library/${entry.id}/HQMotion.tsx`])];}
 const ast=ts.createSourceFile(entry.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 entry.contract=ast.statements.filter(ts.isTypeAliasDeclaration).map(n=>n.getText(ast)).join('\n');
 if(source.includes('type HQComicPageOptions')&&!entry.contract.includes('type HQComicPageOptions ='))entry.contract+="\ntype HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};";
 entry.hash=crypto.createHash('sha256').update(source).digest('hex');
}
save(root+'/manifest.json',JSON.stringify(entries,null,2)+'\n');
if(check&&changes)process.exitCode=1;else console.log(check?'Biblioteca sincronizada.':'Biblioteca e contratos sincronizados.');
