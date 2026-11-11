import {prepareFeatures} from '../server/feature-setup.mjs';
try{await prepareFeatures({mediaOnly:process.argv.includes('--media-only'),update:message=>console.log('[Content Lab] '+message)});}
catch(error){console.error('[Content Lab] Falha ao preparar dependências: '+error.message);process.exitCode=1;}
