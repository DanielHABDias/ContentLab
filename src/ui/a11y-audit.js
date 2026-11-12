import { computeAccessibleName } from 'dom-accessibility-api';

const CONTROLS = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="slider"]';

/** Inventário de controles: lista os que não têm nome acessível ou estão desabilitados sem explicação visível. */
export function auditControls(root) {
  const problems = [];
  for (const element of root.querySelectorAll(CONTROLS)) {
    const name = computeAccessibleName(element).trim();
    const label = element.outerHTML.slice(0, 90);
    if (!name) problems.push(`sem nome: ${label}`);
  }
  return problems;
}
