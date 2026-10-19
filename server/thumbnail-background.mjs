import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireRenderer = createRequire(path.join(root, 'backend/remotion/package.json'));
const preset = path.join(root, 'scene-library/background-hq/BackgroundHQ.tsx');
let compiled;

// Render ONLY the installed, fixed BackgroundHQ source. Never accept a module
// path or executable code from a request. No video render/browser is involved.
export function thumbnailBackground({style, tone = 'light', width = 1280, height = 720}) {
  if (!['paper', 'film', 'grid', 'stars', 'comic_page'].includes(style)) throw Error('Fundo HQ inválido.');
  if (!['light', 'dark'].includes(tone)) throw Error('Tom do papel inválido.');
  if (![width, height].every(v => Number.isInteger(v) && v >= 100 && v <= 4096)) throw Error('Dimensões inválidas.');
  const source = fs.readFileSync(preset, 'utf8');
  const ts = requireRenderer('typescript');
  const React = requireRenderer('react');
  const {renderToStaticMarkup} = requireRenderer('react-dom/server');
  if (compiled?.source !== source) compiled = {source, code: ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true}
  }).outputText};
  const exports = {};
  const remotion = {
    AbsoluteFill: ({children, ...props}) => React.createElement('div', props, children),
    useCurrentFrame: () => 30,
    useVideoConfig: () => ({width, height, fps: 30, durationInFrames: 60})
  };
  remotion.Img = ({src}) => React.createElement('svg', {width:'100%',height:'100%',viewBox:`0 0 ${width} ${height}`},
    React.createElement('image',{href:src,width,height,preserveAspectRatio:'xMidYMid slice'}));
  const loadFixedHelper = () => {
    const helperExports={};
    const helperPath=path.join(path.dirname(preset),'HQComicPage.tsx');
    const code=ts.transpileModule(fs.readFileSync(helperPath,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}
    }).outputText;
    vm.runInNewContext(code,{exports:helperExports,require:name=>{
      if(name==='react')return React;if(name==='remotion')return remotion;
      throw Error('Import não permitido: '+name);
    }},{filename:helperPath,timeout:1000});
    return helperExports;
  };
  vm.runInNewContext(compiled.code, {exports, require: name => {
    if (name === 'react') return React;
    if (name === 'remotion') return remotion;
    if (name === './HQComicPage') return loadFixedHelper();
    throw Error('Import não permitido no BackgroundHQ: ' + name);
  }}, {filename: preset, timeout: 1000});
  const markup = renderToStaticMarkup(React.createElement(exports.default, {
    backgroundStyle: style, paperTone: tone, backgroundOpacity: 100,
    gridLineColor: '#FFFFFF'
  }));
  const svg = markup.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  if (!svg) throw Error('BackgroundHQ não retornou SVG.');
  // Base color is composed by the thumbnail editor, not baked into the effect.
  return svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/(<\/defs>)<rect\b[^>]*><\/rect>/, '$1')
    .replace(/(<\/defs>)<rect\b[^>]*\/>/, '$1');
}
