import {spawn} from 'node:child_process';
import {APP_ROOT} from '../server/plan.mjs';
// npm start must use the same preparation as the desktop shortcut.
const windows=process.platform==='win32';
const child=spawn(windows?'cmd.exe':'bash',windows?['/d','/c','iniciar.bat']:['run.sh'],{cwd:APP_ROOT,stdio:'inherit',windowsHide:false});
child.on('error',error=>{console.error('Falha no inicializador: '+error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
