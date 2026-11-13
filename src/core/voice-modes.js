/** Modos de execução do mesmo VoxCPM2; tamanhos de RAM são margens, não notas de qualidade. */
export const VOICE_MODES = [
  { id: 'standard', label: 'Padrão', description: 'VoxCPM2 original. Cerca de 11,5 GB livres em CPU.', dependency: 'voxcpm2', model: 'voxcpm2' },
  { id: 'economy', label: 'Econômico', description: 'VoxCPM2 compacto. Reserva de 10,5 GB livres em CPU para amostras de até 60 s. Requer instalação própria; a voz pode variar.', dependency: 'voxcpm2-q8', model: 'voxcpm2-q8-v1' },
];
export const voiceMode = id => VOICE_MODES.find(mode => mode.id === id) || VOICE_MODES[0];
