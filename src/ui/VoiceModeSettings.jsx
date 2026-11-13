import { useEffect, useState } from 'react';
import { VOICE_MODES } from '../core/voice-modes.js';
import { localApi } from './local-api.js';

export function VoiceModeSettings({ settings, busy, onSave, onOpenSetup }) {
  const [mode, setMode] = useState(settings.voice?.mode || 'standard');
  useEffect(() => { setMode(settings.voice?.mode || 'standard'); }, [settings.voice?.mode]);
  return <section className="workflow-card" aria-labelledby="voice-mode-title"><form onSubmit={event => { event.preventDefault(); onSave(mode); }}>
    <div className="section-title"><h2 id="voice-mode-title">Voz de IA</h2></div>
    <label>Modo de geração<select value={mode} onChange={event => setMode(event.target.value)} disabled={busy}>{VOICE_MODES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <p className="hint">{VOICE_MODES.find(item => item.id === mode).description}</p>
    <p className="hint">Vale para a narração dos projetos e para “Ouvir como ficou” em Minha voz. Os áudios existentes são preservados.</p>
    <div className="setup-actions"><button className="button primary" disabled={busy || mode === (settings.voice?.mode || 'standard')}>Salvar modo de voz</button>{onOpenSetup && <button type="button" className="button quiet" disabled={busy} onClick={() => onOpenSetup([VOICE_MODES.find(item => item.id === mode).dependency])}>Ver instalação deste modo</button>}</div>
  </form></section>;
}

export async function saveVoiceMode(settings, mode) {
  return localApi.updateSettings({ baseRevision: settings.revision, voice: { mode } });
}
