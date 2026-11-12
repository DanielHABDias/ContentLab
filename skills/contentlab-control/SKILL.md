---
name: contentlab-control
description: Controlar projetos locais do Content Lab por CLI ou MCP para inspecionar, revisar e aplicar mudanças verificáveis em workflow e timeline. Use quando o pedido envolve operar um projeto Content Lab; não use para publicar em redes sociais.
---

# Controle do Content Lab

Use o núcleo local; não edite `project.json` ou a timeline diretamente.

Pelo MCP (`docs/MCP.md`), o agente opera o app real: `contentlab_start` → `project_create` → `creative_write` → `stage_wait_decision`/`stage_approve` → `media_generate_slides`/`media_import_files` → `narration_generate` + `job_wait` → `narration_assemble` + `job_wait` → `timeline_auto_assemble` → `thumbnails_generate` → `render_start` + `job_wait` → `deliverable_build` → `project_export`. Use `project_get` para ver o que falta em cada etapa. Para vídeo no estilo HQ (cenas animadas, trilha com ducking, SFX, Shorts 1080×1920 com áreas seguras), acrescente `audio_library` e use `scene_list` → `timeline_auto_assemble` com `scenes`, `music` e `sfx` (`docs/ESTILO_HQ.md`). Não invente falas de personagens reais nas cenas de diálogo. Pela CLI:

1. Descubra a raiz autorizada e inspecione o projeto em formato compacto com `project.inspect`.
2. Preserve `id` e `revision`. Prepare uma operação `contentlab-operation-v1` com `operationId` único e `baseRevision` igual à leitura atual.
3. Execute primeiro com `dryRun: true`. Revise o diff de clips, etapas e revisão.
4. Só aplique a mesma intenção com `dryRun: false` quando estiver no escopo autorizado. IDs repetidos são idempotentes.
5. Aprovação exige ordem explícita do usuário e `expectedRevision` da etapa. Não converta silêncio ou uma entrega do agente em aprovação humana. Exceção: projeto criado em modo `autonomous` a pedido da pessoa — aí o agente aprova (registrado como agente no histórico). Em modo `review`, espere com `stage_wait_decision`.
6. Reinspecione após escrita. Em conflito de revisão, pare, leia o estado atual e recalcule; não force nem sobrescreva.

Respostas devem ser compactas: IDs, revisão, mudança, estado e erro acionável. Jobs longos são acompanhados por ID, sem polling agressivo. Upload e publicação externa não fazem parte do Content Lab.

Para pacotes, use a skill `contentlab-packages`.
