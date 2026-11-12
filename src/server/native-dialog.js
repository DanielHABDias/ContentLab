import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MEDIA_EXT = ['mp4', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'm4a', 'png', 'jpg', 'jpeg', 'webp'];
const PACKAGE_EXT = ['contentlab', 'zip'];
const TOOLS = { linux: 'zenity', win32: 'powershell', darwin: 'osascript' };
const psQuote = value => `'${String(value).replace(/'/g, "''")}'`;
const asQuote = value => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

/**
 * Seletores nativos de pasta/arquivo: zenity (Linux), PowerShell + WinForms (Windows)
 * e AppleScript (macOS). Cancelar retorna null; argumentos vão sem shell.
 */
export class NativeDialog {
  constructor({ execute = run, platform = process.platform } = {}) {
    this.execute = execute;
    this.platform = platform;
  }

  support() {
    const tool = TOOLS[this.platform];
    return tool ? { available: true, tool } : { available: false, tool: null, solution: 'Digite o caminho ou arraste o arquivo para a janela.' };
  }

  async chooseDirectory({ title = 'Escolher pasta' } = {}) {
    return this.#choose({ kind: 'directory', title });
  }

  async choosePackage({ title = 'Importar pacote' } = {}) {
    return this.#choose({ kind: 'file', title, label: 'Pacotes Content Lab', extensions: PACKAGE_EXT });
  }

  async chooseMedia({ title = 'Importar mídia', multiple = false } = {}) {
    return this.#choose({ kind: 'file', title, label: 'Mídias', extensions: MEDIA_EXT, multiple });
  }

  async #choose(options) {
    if (this.platform === 'linux') return this.#zenity(options);
    if (this.platform === 'win32') return this.#windows(options);
    if (this.platform === 'darwin') return this.#mac(options);
    throw new Error('Seletor nativo indisponível neste sistema: digite o caminho ou arraste o arquivo');
  }

  #zenity({ kind, title, label, extensions, multiple }) {
    const args = ['--file-selection', `--title=${title}`];
    if (kind === 'directory') args.push('--directory');
    if (multiple) args.push('--multiple', '--separator=\n');
    if (extensions) args.push(`--file-filter=${label} | ${extensions.map(ext => `*.${ext}`).join(' ')}`);
    return this.#exec('zenity', args, { cancelCode: 1, missing: 'Seletor de pastas indisponível: instale zenity' });
  }

  #windows({ kind, title, label, extensions, multiple }) {
    const script = kind === 'directory'
      ? `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = ${psQuote(title)}; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`
      : `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = ${psQuote(title)}; $d.Multiselect = $${multiple ? 'true' : 'false'}; $d.Filter = ${psQuote(`${label}|${extensions.map(ext => `*.${ext}`).join(';')}`)}; if ($d.ShowDialog() -eq 'OK') { $d.FileNames -join [char]10 }`;
    return this.#exec('powershell', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { missing: 'Seletor indisponível: PowerShell não encontrado' });
  }

  #mac({ kind, title, extensions, multiple }) {
    const script = kind === 'directory'
      ? `POSIX path of (choose folder with prompt ${asQuote(title)})`
      : [`set picked to choose file with prompt ${asQuote(title)} of type {${extensions.map(asQuote).join(', ')}}${multiple ? ' with multiple selections allowed' : ''}`,
        'if class of picked is list then', 'set out to ""', 'repeat with f in picked', 'set out to out & POSIX path of f & linefeed', 'end repeat', 'return out',
        'else', 'return POSIX path of picked', 'end if'].join('\n');
    return this.#exec('osascript', ['-e', script], { cancelPattern: /-128|User canceled/i, missing: 'Seletor indisponível: osascript não encontrado' });
  }

  async #exec(command, args, { cancelCode, cancelPattern, missing }) {
    try {
      const { stdout } = await this.execute(command, args, { timeout: 10 * 60_000, maxBuffer: 256 * 1024, windowsHide: true });
      const value = stdout.replace(/\r/g, '').trim();
      return value || null;
    } catch (error) {
      if (cancelCode != null && error.code === cancelCode) return null;
      if (cancelPattern && cancelPattern.test(`${error.stderr || ''} ${error.message}`)) return null;
      if (error.code === 'ENOENT') throw new Error(missing);
      throw new Error(`Não foi possível abrir o seletor: ${error.message}`);
    }
  }
}
