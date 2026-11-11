import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class NativeDialog {
  constructor({ execute = run, platform = process.platform } = {}) {
    this.execute = execute;
    this.platform = platform;
  }

  async chooseDirectory({ title = 'Escolher pasta' } = {}) {
    if (this.platform !== 'linux') throw new Error('Seletor nativo ainda não está disponível neste sistema');
    return await this.#zenity(['--file-selection', '--directory', `--title=${title}`]);
  }

  async choosePackage({ title = 'Importar pacote' } = {}) {
    if (this.platform !== 'linux') throw new Error('Seletor nativo ainda não está disponível neste sistema');
    return await this.#zenity(['--file-selection', `--title=${title}`, '--file-filter=Pacotes Content Lab | *.contentlab *.zip']);
  }

  async #zenity(arguments_) {
    try {
      const { stdout } = await this.execute('zenity', arguments_, { timeout: 10 * 60_000, maxBuffer: 64 * 1024 });
      const value = stdout.trim();
      return value || null;
    } catch (error) {
      if (error.code === 1) return null;
      if (error.code === 'ENOENT') throw new Error('Seletor de pastas indisponível: instale zenity');
      throw new Error(`Não foi possível abrir o seletor: ${error.message}`);
    }
  }
}
