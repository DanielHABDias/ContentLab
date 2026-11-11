---
name: contentlab-revisor-json-tecnico
description: Audita tecnicamente edit_plan.json do Content Lab, incluindo schema, relógios, assets, regiões, crops, camadas, transições, TSX, áudio e comportamento previsto do renderer. Use antes dos revisores perceptivos e antes de liberar o plano para render.
---

# Revisor técnico do JSON

Este passe verifica se o plano descreve uma edição executável e coerente com o renderer atual. Não substitui assistir aos pixels nem ouvir o áudio.

## Fontes de verdade

- `schemas/edit_plan.schema.json`, `EDIT_PLAN_REFERENCE.md` e documentação da instalação usada;
- `edit_plan.json`, `transcript.words`, arquivos reais e contratos dos TSX;
- implementação atual do compilador/renderer quando houver dúvida sobre defaults.

Não aceite uma prop porque parece plausível. Confirme que existe no schema e é consumida pelo motor.

## Auditoria obrigatória

1. Validar JSON e schema: tipos, enums, IDs únicos, ordem, intervalos, sobreposições, lacunas, duração e FPS.
2. Resolver todas as URIs `project://` e `builtin://`; conferir extensão, duração, resolução, canal de áudio, fonte e caminhos de TSX.
3. Cruzar narração, `sourceCuts`, `silenceInserts`, transcript e duração final para impedir relógios duplicados ou deslocados.
4. Revisar cada cena e camada: `start/end`, `at`, `z`, `cells`, `fit`, transform, keyframes, câmera, filtros, áudio embutido e transição.
5. Para imagem ou vídeo sem `cells`, exigir o padrão full-frame do Content Lab: caixa de tela inteira e `cover` por padrão. Se a mídia deve aparecer menor, exigir `cells` explícitos ou componente/painel que assuma essa intenção. `fit` não redimensiona uma região menor para a tela inteira.
6. Confirmar que crops preservam o sujeito e que overscan/keyframes não revelam bordas. Isso é previsão técnica; o revisor visual confirma o frame real.
7. Em TSX, conferir módulo, modo `replace|overlay`, props, mapa de assets, duração interna e dependências. Schema válido não compila TSX.
8. Em SFX/música, conferir limites reais de fonte, trims, fades, loops e eventos dentro da timeline. A escuta pertence ao revisor de áudio.
9. Conferir cache: mudanças visuais precisam alterar a fingerprint apropriada; não recomendar apagar assets ou exports para forçar atualização.

## Ordem do gate

Execute este passe primeiro. Se o contrato estiver quebrado, corrija o menor conjunto possível antes dos revisores de abertura, visual/movimento e áudio/sincronização. Um JSON tecnicamente válido ainda pode falhar perceptivamente.

## Saída

Relate por caminho JSON e `scene.id`: valor observado, contrato esperado, impacto, evidência e correção. Use `CONFORME|CORRIGIR|NÃO VERIFICADO`. Qualquer `CORRIGIR` bloqueia o render; `NÃO VERIFICADO` permite somente rascunho explicitamente pendente.
