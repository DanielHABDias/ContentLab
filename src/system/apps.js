import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Programas que nunca aparecem para fechar: sistema, sessão gráfica, terminais e o próprio
 * Content Lab (node, python do VoxCPM2, ferramentas em .tools) e o Claude Code, que pode estar
 * operando o Content Lab.
 */
export const PROTECTED_PROCESSES = /^(node|npm|claude|systemd.*|init|gnome-shell|gnome-session.*|gdm.*|Xorg|Xwayland|mutter|kwin.*|plasmashell|pipewire.*|wireplumber|pulseaudio|dbus.*|gvfs.*|gsd-.*|xdg-.*|at-spi.*|ibus.*|tracker.*|evolution-.*|bash|zsh|fish|sh|dash|sshd|ssh-agent|gnome-terminal.*|tilix|kgx|ptyxis|konsole|python.*|contentlab.*|deep-filter|whisper.*|ffmpeg|ffprobe|WindowServer|kernel_task|launchd)$/i;
const BROWSERS = /^(chrome|chromium.*|brave.*|firefox.*|vivaldi.*|opera.*|msedge|microsoft-edge.*|librewolf|zen.*)$/i;

/** Agrupa a saída de `ps -o pid=,rss=,comm=` por programa, sem os protegidos. */
export function groupProcesses(output, { exclude = [] } = {}) {
  const groups = new Map();
  for (const line of String(output || '').split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]); const name = match[3].split('/').pop().trim();
    if (exclude.includes(pid) || PROTECTED_PROCESSES.test(name)) continue;
    const group = groups.get(name) || { name, bytes: 0, pids: [], kind: BROWSERS.test(name) ? 'browser' : 'app' };
    group.bytes += Number(match[2]) * 1024; group.pids.push(pid);
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes);
}

/**
 * Abre e fecha programas do próprio usuário para liberar memória (Linux e macOS).
 * Só vê processos do usuário que roda o Content Lab, nunca os protegidos nem o próprio servidor.
 */
export class AppsService {
  constructor({ run = execFileAsync, kill = (pid, signal) => process.kill(pid, signal), platform = process.platform, uid = process.getuid?.(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    Object.assign(this, { run, kill, platform, uid, sleep });
  }

  get supported() { return this.platform === 'linux' || this.platform === 'darwin'; }

  async #processes() {
    const { stdout } = await this.run('ps', ['-u', String(this.uid), '-o', 'pid=,rss=,comm='], { timeout: 8_000, maxBuffer: 4 * 1024 * 1024 });
    return groupProcesses(stdout, { exclude: [process.pid, process.ppid] });
  }

  /** Programas abertos com mais de `minimumBytes` de RAM, do maior para o menor. */
  async list({ minimumBytes = 150 * 1024 ** 2, limit = 8 } = {}) {
    if (!this.supported) return { supported: false, apps: [] };
    const apps = (await this.#processes()).filter(app => app.bytes >= minimumBytes).slice(0, limit);
    return { supported: true, apps: apps.map(({ pids, ...app }) => ({ ...app, processes: pids.length })) };
  }

  /**
   * Fecha um programa pelo nome: pede para encerrar (SIGTERM) e espera até 5 s. Com `force`,
   * encerra na hora (SIGKILL) — o que não foi salvo nele se perde.
   */
  async close({ name, force = false } = {}) {
    if (!this.supported) throw Object.assign(new Error('Fechar programas pelo Content Lab só funciona no Linux e no macOS'), { code: 'UNSUPPORTED' });
    if (typeof name !== 'string' || !name.trim() || PROTECTED_PROCESSES.test(name)) throw Object.assign(new Error('Este programa não pode ser fechado pelo Content Lab'), { code: 'APP_PROTECTED' });
    const target = (await this.#processes()).find(app => app.name === name);
    if (!target) return { name, closed: true, freedBytes: 0, remaining: 0 };
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    for (const pid of target.pids) { try { this.kill(pid, signal); } catch { /* já encerrou ou não é do usuário */ } }
    let left = target;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await this.sleep(500);
      left = (await this.#processes()).find(app => app.name === name);
      if (!left) break;
    }
    return { name, closed: !left, freedBytes: Math.max(0, target.bytes - (left?.bytes || 0)), remaining: left?.pids.length || 0 };
  }
}
