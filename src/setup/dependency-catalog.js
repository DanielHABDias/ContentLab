/**
 * Catálogo único de dependências, compartilhado por `npm run doctor`, pela API
 * local e pelo assistente de primeira execução. Versões e checksums foram
 * conferidos nas fontes oficiais; não alterar sem nova verificação.
 *
 * kind:
 * - system:   pacote do sistema; mostramos o comando, nunca executamos sudo.
 * - runtime:  o próprio Node em execução.
 * - download: arquivo único baixado para `.tools/`, verificado por SHA-256.
 * - build:    código-fonte em commit fixo compilado localmente para `.tools/bin`.
 * - python:   ambiente Python isolado em `.tools/venvs` com pacote de SHA-256 fixado,
 *             PyTorch escolhido pelo hardware e pesos numa revisão fixada do Hugging Face.
 */

export const CATALOG_VERSION = 1;

const ffmpegCommands = {
  apt: 'sudo apt install ffmpeg',
  dnf: 'sudo dnf install ffmpeg  # requer RPM Fusion no Fedora',
  pacman: 'sudo pacman -S ffmpeg',
  zypper: 'sudo zypper install ffmpeg',
  brew: 'brew install ffmpeg',
  winget: 'winget install --id Gyan.FFmpeg',
};

export function defaultCatalog() {
  return [
    {
      id: 'node', label: 'Node.js', group: 'essential', kind: 'runtime', required: true,
      description: 'Executa o Content Lab.', minimumMajor: 22,
      license: 'MIT', origin: 'https://nodejs.org',
    },
    {
      id: 'ffmpeg', label: 'FFmpeg', group: 'essential', kind: 'system', required: true,
      description: 'Render, cortes e tratamento de áudio.', detect: { command: 'ffmpeg', args: ['-version'] },
      license: 'LGPL-2.1+/GPL-2.0+ (conforme a build do sistema)', origin: 'https://ffmpeg.org', systemCommands: ffmpegCommands,
    },
    {
      id: 'ffprobe', label: 'FFprobe', group: 'essential', kind: 'system', required: true,
      description: 'Valida mídias e renders. Acompanha o FFmpeg.', detect: { command: 'ffprobe', args: ['-version'] },
      license: 'LGPL-2.1+/GPL-2.0+ (conforme a build do sistema)', origin: 'https://ffmpeg.org', systemCommands: ffmpegCommands,
    },
    {
      id: 'zenity', label: 'Diálogo nativo (zenity)', group: 'essential', kind: 'system', required: true, platforms: ['linux'],
      description: 'Seletores de pasta e arquivo no Linux.', detect: { command: 'zenity', args: ['--version'] },
      license: 'LGPL-2.1+', origin: 'https://gitlab.gnome.org/GNOME/zenity',
      systemCommands: { apt: 'sudo apt install zenity', dnf: 'sudo dnf install zenity', pacman: 'sudo pacman -S zenity', zypper: 'sudo zypper install zenity' },
    },
    {
      id: 'yt-dlp', label: 'yt-dlp', group: 'ai', kind: 'download', required: false, consent: true,
      description: 'Importa vídeos por URL (somente com direitos do usuário).', version: '2026.10.26',
      detect: { command: 'yt-dlp', args: ['--version'] }, tool: 'yt-dlp',
      license: 'Unlicense', origin: 'https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26',
      artifacts: {
        'linux-x64': { url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_linux', size: 41166968, sha256: '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795' },
        'linux-arm64': { url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_linux_aarch64', size: 40789792, sha256: 'e87e9533e89fe5889abaa21f5114dfe7756d6aa6219b83551add04d48b18e483' },
        'darwin-x64': { url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_macos', size: 37466304, sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa' },
        'darwin-arm64': { url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp_macos', size: 37466304, sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa' },
        'win32-x64': { url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe', size: 23575744, sha256: 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d' },
      },
      destination: 'bin/yt-dlp', executable: true,
    },
    {
      id: 'whisper-cli', label: 'Whisper large-v3 (transcrição)', group: 'ai', kind: 'build', required: false, consent: true, platforms: ['linux', 'darwin'],
      description: 'Transcrição local em português com o modelo mais preciso do Whisper. Instala junto o motor whisper.cpp (compilado do código-fonte fixado), o modelo large-v3 (cerca de 2,9 GB) e o Silero VAD, que acha pausas e respiros na narração.', version: '1.9.5',
      bundle: ['whisper-large-v3', 'silero-vad'],
      extraTargets: [{ target: 'whisper-vad-speech-segments', destination: 'bin/whisper-vad-speech-segments' }],
      detect: { command: 'whisper-cli', args: ['--help'] }, tool: 'whisper-cli',
      license: 'MIT', origin: 'https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.5',
      source: { repository: 'https://github.com/ggml-org/whisper.cpp.git', tag: 'v1.9.5', commit: 'd1be6fde11ac6e0407606b4e42fe72d34add8037' },
      buildRequirements: ['git', 'cmake', 'c++'], estimatedBytes: 400 * 1024 * 1024,
      systemCommands: { apt: 'sudo apt install git cmake build-essential', dnf: 'sudo dnf install git cmake gcc-c++ make', pacman: 'sudo pacman -S git cmake base-devel', zypper: 'sudo zypper install git cmake gcc-c++ make', brew: 'xcode-select --install && brew install cmake' },
      destination: 'bin/whisper-cli', executable: true,
    },
    {
      id: 'whisper-large-v3', label: 'Modelo Whisper large-v3', group: 'ai', kind: 'download', required: false, consent: true, partOf: 'whisper-cli',
      description: 'Modelo de transcrição em português (cerca de 2,9 GB).', version: 'ggml-large-v3',
      license: 'MIT (pesos OpenAI Whisper)', origin: 'https://huggingface.co/ggerganov/whisper.cpp',
      artifacts: { any: { url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin', size: 3095033483, sha256: '64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2' } },
      destination: 'models/ggml-large-v3.bin', executable: false,
    },
    {
      id: 'silero-vad', label: 'Silero VAD', group: 'ai', kind: 'download', required: false, consent: true, partOf: 'whisper-cli',
      description: 'Detecta onde há fala, pausa e respiro (formato do whisper.cpp).', version: 'v5.1.2',
      license: 'MIT', origin: 'https://huggingface.co/ggml-org/whisper-vad',
      artifacts: { any: { url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin', size: 885098, sha256: '29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf' } },
      destination: 'models/ggml-silero-v5.1.2.bin', executable: false,
    },
    {
      id: 'deepfilternet', label: 'Limpeza de voz com IA (DeepFilterNet3)', group: 'ai', kind: 'download', required: false, consent: true,
      description: 'Remove ruído de fundo da narração com um modelo local, rápido em CPU (cerca de 0,15 s por segundo de áudio).', version: '0.5.6',
      license: 'MIT ou Apache-2.0', origin: 'https://github.com/Rikorose/DeepFilterNet/releases/tag/v0.5.6',
      artifacts: {
        'linux-x64': { url: 'https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl', size: 36417296, sha256: '70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da' },
      },
      destination: 'bin/deep-filter', executable: true,
    },
    {
      id: 'voxcpm2-q8', label: 'VoxCPM2 econômico (Q8)', group: 'ai', kind: 'build', required: false, consent: true, platforms: ['linux', 'darwin'],
      description: 'O mesmo VoxCPM2 com a parte de linguagem compactada. Executa em CPU sem PyTorch. Instala o motor e os dois arquivos de pesos (3,55 GB).', version: 'e1047e121ee8',
      runtime: 'voice-q8', bundle: ['voxcpm2-q8-base', 'voxcpm2-q8-acoustic'],
      license: 'MIT (motor), Apache-2.0 (pesos)', origin: 'https://github.com/tc-mb/llama.cpp-omni',
      source: { repository: 'https://github.com/tc-mb/llama.cpp-omni.git', commit: 'e1047e121ee83cfa70865c0e4d7ebfb858c2cc69' },
      buildRequirements: ['git', 'cmake', 'c++'], estimatedBytes: 600 * 1024 ** 2,
      buildTarget: 'voxcpm2-cli', cmakeArgs: ['-DBUILD_SHARED_LIBS=OFF', '-DGGML_NATIVE=OFF', '-DGGML_CUDA=OFF', '-DGGML_METAL=OFF', '-DGGML_VULKAN=OFF', '-DLLAMA_BUILD_TESTS=OFF'],
      systemCommands: { apt: 'sudo apt install git cmake build-essential', dnf: 'sudo dnf install git cmake gcc-c++ make', pacman: 'sudo pacman -S git cmake base-devel', brew: 'xcode-select --install && brew install cmake' },
      destination: 'bin/voxcpm2-cli', executable: true,
    },
    {
      id: 'voxcpm2-q8-base', label: 'Pesos VoxCPM2 Q8', group: 'ai', kind: 'download', required: false, consent: true, partOf: 'voxcpm2-q8', version: '169f64d8b98b',
      description: 'Parte de linguagem compactada em 8 bits.', license: 'Apache-2.0', origin: 'https://huggingface.co/DennisHuang648/VoxCPM2-GGUF',
      artifacts: { any: { url: 'https://huggingface.co/DennisHuang648/VoxCPM2-GGUF/resolve/169f64d8b98bbaab1761e4ca3a83e6af653456cc/VoxCPM2-BaseLM-Q8_0.gguf', size: 1727309920, sha256: '0113177abd11303503bf0b705e1613ec5f0a8508cc74a7dfd0f99312b962a962' } },
      destination: 'models/voxcpm2-q8/VoxCPM2-BaseLM-Q8_0.gguf', executable: false,
    },
    {
      id: 'voxcpm2-q8-acoustic', label: 'Pesos acústicos VoxCPM2', group: 'ai', kind: 'download', required: false, consent: true, partOf: 'voxcpm2-q8', version: '169f64d8b98b',
      description: 'Parte acústica mantida em 16 bits.', license: 'Apache-2.0', origin: 'https://huggingface.co/DennisHuang648/VoxCPM2-GGUF',
      artifacts: { any: { url: 'https://huggingface.co/DennisHuang648/VoxCPM2-GGUF/resolve/169f64d8b98bbaab1761e4ca3a83e6af653456cc/VoxCPM2-Acoustic-F16.gguf', size: 1825096352, sha256: '5bde898488ad635ff55d24da53543768fa33d5e5cdc538ce190e5ef831038e85' } },
      destination: 'models/voxcpm2-q8/VoxCPM2-Acoustic-F16.gguf', executable: false,
    },
    {
      id: 'voxcpm2', label: 'VoxCPM2 (voz clonada)', group: 'ai', kind: 'python', required: false, consent: true, platforms: ['linux', 'darwin'],
      description: 'Clona a sua voz a partir de uma amostra com o texto lido. Venceu o teste às cegas com a voz do usuário. A variante (CPU, NVIDIA, AMD, Apple) é escolhida pelo hardware.', version: '2.0.3',
      detect: { command: 'contentlab-voice', args: ['--version'] }, tool: 'contentlab-voice', runtime: 'voice',
      license: 'Apache-2.0', origin: 'https://huggingface.co/openbmb/VoxCPM2',
      python: { minimum: [3, 10], maximumExclusive: [3, 13] },
      wheel: { url: 'https://files.pythonhosted.org/packages/f5/50/76e912427684f7e71d443d9542802ad33df8764ef3bba954b96feeab41ba/voxcpm-2.0.3-py3-none-any.whl', size: 88270, sha256: '24da58a30d094a9e9a7ead450ae9cffda0d31eaeba620b61ad99179dd87e486b', filename: 'voxcpm-2.0.3-py3-none-any.whl' },
      weights: { repository: 'openbmb/VoxCPM2', revision: '7936080b41163874f38610f46f438e2c0757f9fd', destination: 'models/voxcpm2' },
      adapter: 'tools/voxcpm/contentlab_voice.py', environment: 'venvs/voxcpm2',
      estimatedBytes: Math.round(7.5 * 1024 ** 3),
      systemCommands: { apt: 'sudo apt install python3 python3-venv', dnf: 'sudo dnf install python3', pacman: 'sudo pacman -S python', zypper: 'sudo zypper install python3', brew: 'brew install python@3.12' },
      destination: 'bin/contentlab-voice', executable: true,
    },
  ];
}

export function platformKey(platform = process.platform, arch = process.arch) { return `${platform}-${arch}`; }

/** Artefato aplicável à plataforma, ou null quando não há download oficial. */
export function artifactFor(item, platform = process.platform, arch = process.arch) {
  if (!item.artifacts) return null;
  return item.artifacts[platformKey(platform, arch)] || item.artifacts.any || null;
}

export function appliesTo(item, platform = process.platform) {
  return !item.platforms || item.platforms.includes(platform);
}
