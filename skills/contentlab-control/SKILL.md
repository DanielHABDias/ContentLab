---
name: contentlab-control
description: Controlar projetos locais do Content Lab por CLI ou MCP para inspecionar, revisar e aplicar mudanças verificáveis em workflow e timeline. Use quando o pedido envolve operar um projeto Content Lab; não use para publicar em redes sociais.
---

# Controle do Content Lab

Use o núcleo local; não edite `project.json` ou a timeline diretamente.

Pelo MCP (`docs/MCP.md`), o agente opera o app real. Antes de `project_create`, combine o fluxo com a pessoa numa pergunta só: tudo automático (`autonomous`), parar em etapas para revisar no app (`autonomous` + `pauseAt`) ou aprovar cada etapa (`review`); e voz de IA ou voz gravada por ela (`narrationBy: creator`). Mude com `project_flow_set`. Sequência: `contentlab_start` → `project_create` → `creative_write` → `stage_wait_decision`/`stage_approve` → `media_generate_slides`/`media_import_files` → `narration_generate` + `job_wait` → `narration_assemble` + `job_wait` → `timeline_auto_assemble` → `thumbnails_generate` → `render_start` + `job_wait` → `deliverable_build` → `project_export`. Use `project_get` para ver o que falta em cada etapa. Jeito principal de montar vídeos: **modo composição** (`docs/MOTION.md`). Importe cenas das obras com direitos e uma trilha licenciada (`role: music`), narre, rode `narration_transcribe`, `motion_plan_auto`, `motion_preview` (abra os PNG), ajuste com `motion_plan_set` (contrato em `motion_kit`) e `render_start`. Sem narração: beats direto em `motion_plan_set` com `narration: false`. Modo antigo de clips (`docs/ESTILO_HQ.md`): importe imagens do assunto com direitos (sem elas a montagem com cenas recusa), depois da narração rode `narration_transcribe` + `job_wait` (legenda palavra a palavra), `scene_list` e `timeline_auto_assemble` com `scenes`, `sfx` e uma trilha licenciada importada com papel música (a de `audio_library` é rascunho). Não invente falas canônicas de personagens nas cenas de diálogo. Pela CLI:

1. Descubra a raiz autorizada e inspecione o projeto em formato compacto com `project.inspect`.
2. Preserve `id` e `revision`. Prepare uma operação `contentlab-operation-v1` com `operationId` único e `baseRevision` igual à leitura atual.
3. Execute primeiro com `dryRun: true`. Revise o diff de clips, etapas e revisão.
4. Só aplique a mesma intenção com `dryRun: false` quando estiver no escopo autorizado. IDs repetidos são idempotentes.
5. Aprovação exige ordem explícita do usuário e `expectedRevision` da etapa. Não converta silêncio ou uma entrega do agente em aprovação humana. Exceção: projeto criado em modo `autonomous` a pedido da pessoa — aí o agente aprova (registrado como agente no histórico). Em modo `review`, espere com `stage_wait_decision`.
6. Reinspecione após escrita. Em conflito de revisão, pare, leia o estado atual e recalcule; não force nem sobrescreva.

## Edição no modo composição

- **Nox:** as 21 poses estão no catálogo `assets/brand/nox/poses/catalogo.json` (gesto, olhos, tons). Num aparte ou na cena `nox`, a pose troca a cada ~0,85 s enquanto ele fala (`falas`/`poses` com 2–5 itens), a primeira no tom da frase e sem repetir em seguida. Todas as poses aparecem ao longo do vídeo longo: `motion_plan_auto` devolve `poses.posesFaltando`, e as que faltarem entram em apartes de tom compatível pelo `motion_plan_set`.
- **Legenda:** nos Shorts (9:16), o tempo todo. No vídeo longo (16:9), só no gancho (primeiros 6 s) e nos apartes do Nox; nos outros beats, `legenda: false`.
- **SFX:** os nomes válidos são os da lista `sfx` de `motion_kit`. Cada som cai no quadro do evento da tela (`at` em segundos dentro do beat; negativo começa antes do corte):
  - cortes: `whoosh`, `swish` e `whoosh-rapido` em rodízio; `whoosh-lento` (~1 s antes) em transição longa ou abertura de capítulo;
  - estalos: `pop` (Nox entra, balão, caixinha, recorte); `clique` no clique da caixinha de inscrição ou like; `sino` em notificação ou acerto;
  - batidas: `impact` (+ `sub` nas viradas fortes); `explosao` em revelação enorme; `riser` termina no corte da revelação;
  - piada: `tapa` seco; `tapa-eco` (o tapa de meme) no máximo uma vez a cada 1–2 minutos;
  - informação: `tick` e `ding` no número; `type` no texto digitado; `camera` no painel; `error` e `glitch` no erro.
  - Um som principal por evento (no máximo dois em camada), sem repetir o mesmo em seguida, entre 0,3 e 0,5 de volume perto da fala. Som novo entra pelo plugin Diazverso (`skills/diazverso-motion/references/som.md`: sintetizado ou do Openverse em CC0) e vale depois de `npm run scenes:diazverso`.
- **Metadados:** todo render final sai sem metadados (etiquetas do contêiner, capítulos embutidos e a assinatura do encoder no H.264), com a imagem e o som copiados sem recodificar e o `faststart` para o envio. Os capítulos vão na descrição do kit de publicação.

Respostas devem ser compactas: IDs, revisão, mudança, estado e erro acionável. Jobs longos são acompanhados por ID, sem polling agressivo. Upload e publicação externa não fazem parte do Content Lab.

Para pacotes, use a skill `contentlab-packages`.
