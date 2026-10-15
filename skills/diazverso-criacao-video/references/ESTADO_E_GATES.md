# Estado e gates — criação completa de vídeos Diazverso

Este arquivo define o **contrato de retomada e aprovação**, não campos do `edit_plan.json`, não substitui a planilha do canal e não contém IDs/URLs privados.

## Estados possíveis de cada etapa

- `not_started`: ainda não executada.
- `in_progress`: em elaboração / revisão interna.
- `awaiting_user`: QA interno passou, criador deve aprovar ou pedir mudança.
- `approved`: entregue e aprovado explicitamente; arquivo canônico salvo.
- `blocked`: falta asset, fonte, autorização, ferramenta ou dado.
- `needs_revision`: feedback recebido, requer correção e nova QA.
- `skipped`: criador dispensou conscientemente, justificativa registrada.

Uma etapa passa para `approved` **somente** com confirmação verificável do usuário. Erro de render nunca vira aprovação tácita. `blocked` não equivale a `skipped`.

## Registro privado `workflow_estado.json`

Criar dentro da pasta do vídeo longo somente depois de identificar ou reservar o vídeo com autorização. Exemplo estrutural sem dados reais:

```json
{
  "schemaVersion": 1,
  "brand": "Diazverso",
  "kind": "long_form_with_shorts",
  "longVideoId": "VD_XXXX",
  "sheetName": "Videos Longos",
  "sheetRowId": "VD_XXXX",
  "createdAt": null,
  "updatedAt": null,
  "currentStage": "L0",
  "stageStatus": {
    "L0": "not_started",
    "L1": "not_started",
    "L2": "not_started",
    "L3": "not_started",
    "L4": "not_started",
    "L5A": "not_started",
    "L5B": "not_started",
    "L6": "not_started",
    "L7": "not_started",
    "S0": "not_started",
    "S1": "not_started",
    "S2": "not_started",
    "S3": "not_started",
    "S4": "not_started"
  },
  "approved": {
    "topic": null,
    "thesis": null,
    "titles": {"A": null, "B": null},
    "tags": [],
    "thumbnailConcept": null,
    "thumbnailFinalUrl": null,
    "scriptUrl": null,
    "narrationUrl": null,
    "assetMapUrl": null,
    "editGuideUrl": null,
    "editPlanUrl": null,
    "finalVideoUrl": null
  },
  "pendingApproval": null,
  "reviews": [],
  "blockers": [],
  "shorts": [],
  "lastUserDecision": null
}
```

Outros campos podem ser anexados, desde que não alterem os nomes definidos. As URLs de links aprovados são **privadas** e só devem ficar no Drive particular do criador. Ao ler, validar JSON e preservar campos desconhecidos de futuras versões.

## Estrutura de `reviews`

Cada gate gera 1 registro quando for apresentado à aprovação:
```json
{
  "stage": "L3",
  "version": 2,
  "internalReview": {
    "result": "pass",
    "checks": ["fatos", "promessa", "retenção", "identidade", "coerência"],
    "openIssues": []
  },
  "proposedArtifact": "roteiro-v2",
  "presentedAt": null,
  "userDecision": "approved",
  "decisionAt": null,
  "userFeedback": "",
  "approvedArtifactUrl": null
}
```

O campo `userDecision` pode ser `approved`, `needs_revision` ou `skipped`, ou `null` enquanto aguarda. Sempre confirmar decisões substantivas; não inferir confirmação de um comentário genérico.

## Propagação de mudanças

- Mudou **tese/tema**: reavaliar L1, L2, L3 e derivados.
- Mudou **título/embalagem**: reavaliar L2 e checar se L3 cumpre a nova promessa.
- Mudou **roteiro**: reavaliar L4, L5, L6 e roteiro dos Shorts impactados.
- Mudou **narrativa/áudio**: recalcular L5/L6 apenas nos intervalos afetados.
- Mudou **asset**: atualizar mapa de L5 e somente as cenas necessárias de L6; não reescrever roteiro.
- Mudou **estética da edição**: revisão de L6 e os Shorts impactados, mantendo título e roteiro aprovados quando continuam coerentes.
- Mudou **duração / proposta de Short**: revisar S0–S4 do Short correspondente, não de todos.
- Sempre preservar decisões aceitas não afetadas.

## Checkpoint de retomada

Responder sempre com:
`VD_XXXX · etapa L? · último gate aprovado · entregável atual · bloqueio (se existir) · decisão pendente`.

A ação seguinte deve ser **um passo concreto**, não toda a cadeia. Em caso de conflito entre a planilha (registro público/canal) e `workflow_estado.json` (produção), não sobrescrever automaticamente: mostrar a diferença ao criador e confirmar qual é a versão vigente.

## Conclusão e Shorts

Marcar longo concluído antes de iniciar a fase obrigatória de proposta de Shorts; a quantidade pode ser zero se o criador dispensar explicitamente. Shorts ligados ao longo incluem, no mínimo: `shortId`, `longVideoId`, `microthesis`, `stage`, `status`, `approvedAssets`, `finalLink`. A reutilização deve ser rastreável ao acervo local do vídeo longo.

Status final:
- `ready_to_publish`: render e QA aprovados, ainda não postado.
- `published`: link real verificado e permissão do criador para registrar.
- `finished`: longo e Shorts aprovados/dispensados, planilha coerente.
