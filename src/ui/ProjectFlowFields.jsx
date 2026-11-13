export const FLOW_STAGE_LABELS = { brief: 'Brief', script: 'Roteiro', packaging: 'Embalagem', media: 'Mídia', narration: 'Narração', edit: 'Edição', review: 'Revisão' };

/** Converte modo + pausas no preset mostrado na interface (o mesmo fluxo do project_create do MCP). */
export function flowPreset({ mode }) { return mode === 'review' ? 'review' : 'auto'; }
export function flowFromPreset(preset) { return preset === 'review' ? { mode: 'review', pauseAt: [] } : { mode: 'autonomous', pauseAt: [] }; }

export function flowSummary({ mode, narrationBy = null }) {
  const how = mode === 'review' ? 'Etapa por etapa, com o seu OK' : 'Tudo automático até o render';
  const voice = narrationBy === 'creator' ? 'você grava a narração' : narrationBy === 'ai' ? 'voz de IA clonada' : 'narração a definir';
  return `${how} · ${voice}`;
}

/**
 * Campo “Como produzir”, usado ao criar e ao configurar o projeto. Só dois caminhos: a IA
 * faz tudo e você revisa no fim (podendo voltar em qualquer etapa), ou ela para a cada etapa
 * e espera o seu OK. Quem narra é escolhido depois, na etapa Narração.
 */
export function ProjectFlowFields({ preset, onPreset, name = 'flow' }) {
  return <fieldset><legend>Como produzir</legend>
    <label><input type="radio" name={`${name}-preset`} checked={preset === 'auto'} onChange={() => onPreset('auto')}/> Tudo automático<span className="option-hint">A IA vai da ideia ao render e entrega o projeto pronto. Você revisa no fim e pode voltar em qualquer etapa. Para só por direitos, consentimento ou custo. Nunca publica.</span></label>
    <label><input type="radio" name={`${name}-preset`} checked={preset === 'review'} onChange={() => onPreset('review')}/> Etapa por etapa<span className="option-hint">Ao fim de cada etapa a IA espera. Você aprova no app ou responde no chat, e ela segue.</span></label>
  </fieldset>;
}
