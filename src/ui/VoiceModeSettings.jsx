import { useEffect, useState } from 'react';
import { Check, Cpu, Mic } from 'lucide-react';
import { VOICE_MODES, voiceMode } from '../core/voice-modes.js';
import { localApi } from './local-api.js';

export function VoiceModeSettings({ settings, busy, onSave, onOpenSetup }) {
  const saved = voiceMode(settings.voice?.mode).id;
  const [mode, setMode] = useState(saved);
  useEffect(() => { setMode(saved); }, [saved]);
  const selected = voiceMode(mode);
  return <section className="workflow-card" aria-labelledby="voice-mode-title"><form onSubmit={event => { event.preventDefault(); onSave(mode); }}>
    <div className="section-title"><h2 id="voice-mode-title"><Cpu size={20}/> Voz de IA</h2></div>
    <p className="settings-lead">Escolha como o computador gera a sua voz clonada. Vale para a narração dos projetos e para “Ouvir como ficou”.</p>
    <fieldset className="choice-group" disabled={busy}>
      <legend>Modo de geração</legend>
      {VOICE_MODES.map(item => <label key={item.id} className={`choice-card${mode === item.id ? ' selected' : ''}`}>
        <input type="radio" name="voice-mode" value={item.id} checked={mode === item.id} onChange={() => setMode(item.id)}/>
        <span className="choice-head"><strong>{item.label}</strong>{saved === item.id && <span className="choice-badge"><Check size={12}/> Em uso</span>}</span>
        <span className="choice-chip">{item.memory}</span>
        <small>{item.summary}</small>
      </label>)}
    </fieldset>
    <p className="settings-note"><Mic size={16}/><span>Sua gravação em Minha voz serve para os dois modos: trocar de modo não pede gravar de novo. Áudios já gerados continuam salvos.</span></p>
    <div className="setup-actions"><button className="button primary" disabled={busy || mode === saved}>Salvar modo de voz</button>{onOpenSetup && <button type="button" className="button quiet" disabled={busy} onClick={() => onOpenSetup([selected.dependency])}>Ver instalação do {selected.label.toLowerCase()}</button>}</div>
  </form></section>;
}

export async function saveVoiceMode(settings, mode) {
  return localApi.updateSettings({ baseRevision: settings.revision, voice: { mode } });
}
