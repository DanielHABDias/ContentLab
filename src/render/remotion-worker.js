import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';

const request = JSON.parse(await readFile(process.argv[2], 'utf8'));
const entry = path.join(request.workDirectory, 'entry.tsx');
const imported = request.exportName === 'default' ? 'default as UserComponent' : `${request.exportName} as UserComponent`;
await writeFile(entry, `import React from 'react';\nimport {AbsoluteFill, Composition, registerRoot} from 'remotion';\nimport {${imported}} from ${JSON.stringify(request.sourcePath)};\nconst Scene=(props)=><AbsoluteFill style={{backgroundColor:'transparent',justifyContent:'center',alignItems:'center',overflow:'hidden'}}><UserComponent {...props}/></AbsoluteFill>;\nconst Root=()=> <Composition id="ContentLabComponent" component={Scene} durationInFrames={${request.durationInFrames}} fps={${request.fps}} width={${request.width}} height={${request.height}} defaultProps={${JSON.stringify(request.props)}}/>;\nregisterRoot(Root);\n`);
const serveUrl = await bundle({ entryPoint: entry, outDir: path.join(request.workDirectory, 'bundle'), rootDir: request.workDirectory, publicDir: null, enableCaching: false, onProgress: () => {}, ignoreRegisterRootWarning: false });
const composition = await selectComposition({ serveUrl, id: 'ContentLabComponent', inputProps: request.props, logLevel: 'error' });
await renderFrames({ serveUrl, composition, imageFormat: 'png', muted: true, outputDir: request.output, inputProps: request.props, concurrency: 2, timeoutInMilliseconds: 30_000, imageSequencePattern: 'frame-[frame].[ext]', onStart: () => {}, onFrameUpdate: () => {}, logLevel: 'error' });
