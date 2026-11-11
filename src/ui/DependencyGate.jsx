import { Check, Lock, Wrench } from 'lucide-react';
import { FEATURES, featureBlock, stageBlock } from '../core/capabilities.js';

/** Painel exibido no lugar de uma etapa cujas dependências obrigatórias faltam. */
export function StageGate({ stageId, setup, onOpenSetup, children }) {
  if (!setup) return <div className="empty-state" role="status">Verificando dependências locais…</div>;
  const missing = stageBlock(stageId, setup.items);
  if (!missing.length) return children;
  return <section className="gate" role="alert" aria-labelledby={`gate-${stageId}`}>
    <Lock size={22} aria-hidden="true"/>
    <div><h2 id={`gate-${stageId}`}>Etapa bloqueada</h2><p>Esta etapa precisa de {listLabels(missing)}. Instale pela tela de dependências para continuar.</p></div>
    <button className="button primary" onClick={() => onOpenSetup(missing.map(item => item.id))}><Wrench size={17}/> Instalar dependências</button>
  </section>;
}

/** Lista de recursos da etapa: disponíveis ou bloqueados com atalho para instalar. */
export function FeatureList({ features = [], setup, onOpenSetup }) {
  if (!setup || !features.length) return null;
  return <ul className="feature-list" aria-label="Recursos desta etapa">{features.map(featureId => {
    const missing = featureBlock(featureId, setup.items);
    return <li key={featureId} className={missing.length ? 'locked' : 'unlocked'}>
      {missing.length ? <Lock size={16} aria-hidden="true"/> : <Check size={16} aria-hidden="true"/>}
      <span><strong>{FEATURES[featureId].label}</strong><small>{missing.length ? `Bloqueado: requer ${listLabels(missing)}` : 'Disponível'}</small></span>
      {missing.length > 0 && <button className="mini-button" onClick={() => onOpenSetup(missing.map(item => item.id))} aria-label={`Desbloquear ${FEATURES[featureId].label}`}>Desbloquear</button>}
    </li>;
  })}</ul>;
}

/** Aviso para erros DEPENDENCY_MISSING vindos do servidor. */
export function DependencyNotice({ error, onOpenSetup }) {
  if (!error) return null;
  return <div className="notice error" role="alert"><span>{error.message}</span>{error.code === 'DEPENDENCY_MISSING' && error.details?.missing?.length > 0 && <button className="mini-button" onClick={() => onOpenSetup(error.details.missing)}>Instalar dependências</button>}</div>;
}

export function isStageBlocked(stageId, setup) { return Boolean(setup) && stageBlock(stageId, setup.items).length > 0; }

function listLabels(items) {
  const labels = items.map(item => item.label);
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}` : labels[0];
}
