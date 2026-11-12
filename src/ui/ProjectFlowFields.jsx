export const FLOW_STAGE_LABELS = { brief: 'Brief', script: 'Roteiro', packaging: 'Embalagem', media: 'Mídia', narration: 'Narração', edit: 'Edição', review: 'Revisão' };
export const DEFAULT_PAUSES = ['script', 'narration', 'review'];

/** Converte modo + pausas no preset mostrado na interface (o mesmo fluxo do project_create do MCP). */
export function flowPreset({ mode, pauseAt = [] }) { return mode === 'review' ? 'review' : pauseAt.length ? 'pauses' : 'auto'; }
export function flowFromPreset(preset, pauses) {
  if (preset === 'review') return { mode: 'review', pauseAt: [] };
  if (preset === 'auto') return { mode: 'autonomous', pauseAt: [] };
  return { mode: 'autonomous', pauseAt: pauses.length ? pauses : DEFAULT_PAUSES };
}
export function flowSummary({ mode, pauseAt = [], narrationBy = 'ai' }) {
  const preset = flowPreset({ mode, pauseAt });
  const how = preset === 'review' ? 'Você aprova cada etapa' : preset === 'auto' ? 'Tudo automático' : `Para em: ${pauseAt.map(id => FLOW_STAGE_LABELS[id] || id).join(', ')}`;
  return `${how} · ${narrationBy === 'creator' ? 'você grava a narração' : 'voz de IA'}`;
}

/** Campos “Como produzir” e “Narração”, usados ao criar e ao configurar o projeto. */
export function ProjectFlowFields({ preset, pauses, narrationBy, onPreset, onPauses, onNarration, name = 'flow' }) {
  const toggle = id => onPauses(pauses.includes(id) ? pauses.filter(item => item !== id) : [...pauses, id]);
  return <>
    <fieldset><legend>Como produzir</legend>
      <label><input type="radio" name={`${name}-preset`} checked={preset === 'review'} onChange={() => onPreset('review')}/> Aprovar cada etapa<span className="option-hint">Nada avança sem o seu OK.</span></label>
      <label><input type="radio" name={`${name}-preset`} checked={preset === 'pauses'} onChange={() => onPreset('pauses')}/> Automático com pausas<span className="option-hint">Segue sozinho e para nas etapas marcadas.</span>
        {preset === 'pauses' && <span className="pause-stages" role="group" aria-label="Etapas em que o fluxo para">{Object.entries(FLOW_STAGE_LABELS).map(([id, label]) => <label key={id}><input type="checkbox" checked={pauses.includes(id)} onChange={() => toggle(id)}/> {label}</label>)}</span>}
      </label>
      <label><input type="radio" name={`${name}-preset`} checked={preset === 'auto'} onChange={() => onPreset('auto')}/> Tudo automático<span className="option-hint">Para só por direitos, consentimento ou custo. Nunca publica.</span></label>
    </fieldset>
    <fieldset><legend>Narração</legend>
      <label><input type="radio" name={`${name}-narration`} checked={narrationBy === 'ai'} onChange={() => onNarration('ai')}/> Voz de IA<span className="option-hint">Gerada a partir do roteiro.</span></label>
      <label><input type="radio" name={`${name}-narration`} checked={narrationBy === 'creator'} onChange={() => onNarration('creator')}/> Eu gravo<span className="option-hint">Você grava ou importa os takes na etapa Narração.</span></label>
    </fieldset>
  </>;
}
