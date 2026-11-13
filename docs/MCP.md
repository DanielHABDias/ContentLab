# MCP: produzir vídeos com um agente de IA

O MCP do Content Lab permite que um chat (Claude, Codex ou outro cliente MCP) **opere o app de verdade**. Ele usa o mesmo núcleo, as mesmas pastas e os mesmos Recentes da interface. Tudo o que o agente faz aparece no app, e o que você aprova no app o agente enxerga.

O Content Lab nunca publica nada sozinho: ele entrega o vídeo e o pacote, e você decide.

## Conectar

Claude Code:

```bash
claude mcp add content-lab -- node /home/daniel/Documentos/Projects/ContentLab/src/adapters/mcp-server.js
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.content-lab]
command = "node"
args = ["/home/daniel/Documentos/Projects/ContentLab/src/adapters/mcp-server.js"]
```

No app instalado (F23), use o Node embutido e informe o modo instalado:

```text
~/.local/share/contentlab/app/current/runtime/node ~/.local/share/contentlab/app/current/app/src/adapters/mcp-server.js
env: CONTENTLAB_INSTALLED=1
```

O agente não precisa que o app esteja aberto: `contentlab_start` o abre em segundo plano.

Para você acompanhar, logo depois de criar ou retomar um projeto o agente chama `contentlab_open`, que abre o projeto no seu navegador padrão (`http://127.0.0.1:<porta>/?project=<pasta>`). A tela se atualiza sozinha a cada 2 s com o que o agente muda.

## Combinar o fluxo

Antes de criar o projeto, o agente pergunta como você quer trabalhar e grava a resposta no projeto:

São dois caminhos, só isso:

- **Tudo automático:** `mode: "autonomous"`. O agente vai da ideia ao render sozinho e entrega o projeto pronto. Você revisa no fim e pode reabrir qualquer etapa. Ele ainda para por direitos de mídia, consentimento de voz e custo de render, e nunca publica.
- **Etapa por etapa:** `mode: "review"`. Ao fim de cada etapa ele chama `stage_wait_decision` e espera. Você clica em **Aprovar e seguir** no app, ou responde no chat, e ele continua.

**Quem narra não se decide aqui.** `narrationBy` começa `null`. Na etapa Narração o agente chama `voice_options` e combina com você:

- **Voz de IA:** é a sua voz clonada. Só existe com um perfil gravado em **Minha voz** (barra lateral, cerca de 60 s de leitura). O agente confirma com `project_flow_set narrationBy: "ai"` antes de `narration_generate`; sem perfil, o app e o servidor recusam (`VOICE_PROFILE_REQUIRED`).
- **Você grava:** `narrationBy: "creator"`. O agente não gera voz (`narration_generate` recusa). Você grava e monta a narração no app (Narração → Gravar → Montar narração), e ele continua com `narration_transcribe`.

Para mudar no meio do caminho, o agente usa `project_flow_set`.

## Como o agente "espera do lado de fora"

Trabalhos longos devolvem um `jobId` **na hora**: narração, importação e render. O agente avisa você ("comecei a narração"), e então chama `job_wait`. Cada chamada espera até `timeoutSeconds` e responde com o progresso. Enquanto o job não termina, ela devolve `waiting: true`, e o agente chama de novo.

Para aprovações vale o mesmo: `stage_wait_decision` fica esperando você **aprovar ou pedir mudança no app**. Enquanto o agente espera, a barra da etapa mostra "A IA está esperando você revisar esta etapa". O botão **Aprovar e seguir** (ou **Pedir mudanças**) é o sinal: ela responde, e o agente continua dali. Se você pediu mudança, ele também recebe o motivo. O botão não trava o agente: se você aprovar pelo chat, ele usa `stage_approve` com `userApproved=true` e segue.

Um servidor MCP não consegue iniciar uma mensagem no chat por conta própria; quem volta a perguntar é sempre o agente. Na prática, o efeito é o mesmo: ele espera e retoma sozinho.

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `contentlab_status`, `contentlab_start`, `contentlab_open`, `contentlab_stop` | Mostram se o app está aberto e quais dependências estão prontas; abrem o app em segundo plano; abrem o projeto no navegador da pessoa; desligam o app (sem `force`, recusam se houver trabalho em andamento) |
| `project_list`, `project_create`, `project_get` | Projetos reais dos Recentes. O `mode` do projeto pode ser `review` (espera a sua aprovação) ou `autonomous` (o agente aprova). `project_get` mostra a etapa atual e o que falta nela |
| `creative_write` | Ideia (brief), roteiro (`script.chapters`: capítulos com blocos `narration`, `scene`, `direction`; só `narration.text` é falado) e embalagem (títulos A/B, descrição, tags, SEO) |
| `script_get`, `script_edit` | Leitura só do roteiro e edição pontual por IDs, com revisão obrigatória, lote atômico e `dryRun`. [Contrato e exemplo](ROTEIRO.md) |
| `stage_wait_decision`, `stage_approve`, `stage_request_changes` | Aprovação humana ou do agente. Ver as regras abaixo |
| `media_import_files`, `media_import_url`, `media_generate_slides` | Mídias próprias ou licenciadas, ou um slide por cena do roteiro quando não há filmagem |
| `voice_options`, `narration_generate`, `narration_assemble` | Perfis de voz clonada (gravados em Minha voz) e a geração e montagem tratada da narração. Lenta em CPU: ~30 s por segundo de fala |
| `motion_kit`, `motion_plan_auto`, `motion_plan_get`, `motion_plan_set`, `motion_preview` | **Modo composição** (principal): o vídeo inteiro como motion design do kit de motion, em beats; plano automático, ajuste pelo agente e prévia em PNG. Ver [MOTION.md](MOTION.md) |
| `character_import` | Importa o personagem do projeto: pasta com PNGs de poses e `catalogo.json` (pose, gesto, tons), com direitos confirmados. Vira mídia com papel `character`. Sem personagem, o plano não tem aparte nem a cena `personagem`. `dryRun` confere sem gravar |
| `narration_transcribe` | Transcreve a narração montada (Whisper local) para legenda palavra a palavra |
| `scene_list`, `scene_add` | Cenas HQ do Content Lab, com plano sugerido (um beat visual por frase, cada um com imagem do assunto); adicionar uma cena num intervalo |
| `audio_library` | Efeitos sonoros **originais** (whoosh, ding, boom, riser) e uma trilha sintetizada que é só rascunho |
| `timeline_auto_assemble` | Coloca a narração no áudio, distribui as mídias pela duração e cria legendas sincronizadas por cena. Opcionalmente: cenas HQ (`scenes: "auto"` ou lista), trilha com ducking (`music`), SFX nas trocas (`sfx`). Em 9:16 aplica as áreas seguras de Shorts |
| `chapters_get` | Capítulos a partir dos tempos reais da narração |
| `thumbnails_generate` | Gera as thumbnails A e B (título sobre um frame do vídeo, ou sobre um degradê) e grava na embalagem |
| `render_start`, `job_wait` | Render final (fila persistente) e espera de qualquer job |
| `deliverable_build`, `project_export` | Monta `output/entrega/` (roteiro.md, embalagem.md com capítulos, thumbnail-A/B, video.mp4, verificacao.md) e exporta ZIP ou `.contentlab` |
| `project_run` | Avançado: aplica qualquer ação validada do núcleo, como editar a timeline |

## Regras de aprovação e direitos

- **Modo `review`:** o agente produz a etapa e chama `stage_wait_decision`. Ele só pode aprovar sozinho se você disser no chat que aprovou (`userApproved=true`), e o histórico registra "usuário (aprovado no chat, MCP)".
- **Modo `autonomous`:** você escolheu não aprovar. O agente aprova cada etapa, e o histórico registra "agente (modo autônomo, MCP)".
- **Direitos de mídia:** valem nos dois modos. Mídia com direitos pendentes bloqueia a etapa, e importar por URL exige a sua confirmação.
- **Voz clonada:** exige um perfil gravado com o seu consentimento em **Minha voz**. Sem perfil não há voz de IA: resta você gravar os takes.

## Fluxo de exemplo

1. `contentlab_start`
2. `project_create` (`type: long`, `mode: review`) → `contentlab_open`
3. `creative_write` (brief) → `stage_wait_decision`
4. `creative_write` (packaging: títulos; thumbnail e descrição podem vir depois) → espera a decisão. Título e thumbnail vêm antes do roteiro: o roteiro cumpre o que eles prometem.
5. `creative_write` (script) → `stage_wait_decision`. Se você pedir mudança, o agente reescreve e espera de novo.
6. `media_generate_slides` ou `media_import_files` → espera a decisão
7. `narration_generate` → `job_wait`
8. `narration_assemble` → `job_wait`
9. `timeline_auto_assemble` → espera a decisão da narração e depois a da edição
10. `thumbnails_generate`
11. `render_start` → `job_wait` → espera a decisão
12. `deliverable_build` e `project_export` (ZIP)

**Jeito principal (modo composição, [MOTION.md](MOTION.md)):** depois do passo 8, rode `narration_transcribe` + `job_wait`, `motion_plan_auto`, `motion_preview` (abra os PNG), ajuste com `motion_plan_set` e siga para o passo 10; o passo 9 não é usado.

Modo antigo, de clips na timeline ([ESTILO_HQ.md](ESTILO_HQ.md)): no passo 6 importe imagens do assunto com direitos (`media_import_files`), uma faixa licenciada com papel música e chame `audio_library` para os SFX; depois do passo 8 rode `narration_transcribe` + `job_wait`; no passo 9 use `scene_list` e `timeline_auto_assemble` com `scenes: "auto"` (ou a sua lista), `music: true` e `sfx: true`; renderize Shorts em `full-hd` para sair em 1080×1920.

Para 5 Shorts: repetir o fluxo com `type: short`, `mode: autonomous` e `stage_approve` no lugar das esperas.


## Tempos nesta máquina (Ryzen 5 5500, CPU)

| Trecho | Tempo |
| --- | --- |
| Narração padrão | cerca de 5× mais rápida que o tempo real (1 min de fala ≈ 12 s) |
| Voz clonada | cerca de 30 s de processamento por segundo de fala (1 min de fala ≈ 30 min) |
| Render 1080p | segundos por minuto de vídeo com slides |

## Tempos da narração para a edição

`narration_assemble` monta o áudio e gera automaticamente a transcrição com Whisper `large-v3` completo em português. Espere `job_wait`: só conclui depois de salvar início/fim de cada palavra do WAV montado. A narração não é aprovada sem esses tempos; o plano automático não estima a fala quando há narração montada sem transcrição.

Use `narration_transcript({ path, offset: 0, limit: 500 })`. A resposta contém `mediaId`, `model`, `language`, `total`, `nextOffset` e `words: [{ text, start, end }]`, em segundos. Continue com `offset: nextOffset` até `null`. Leia antes de colocar imagens, cortes e legendas; use os tempos reais, não a duração estimada do roteiro.

Se o Whisper falhar ou faltar dependência, a montagem de áudio permanece salva. Resolva a dependência e use `narration_transcribe` + `job_wait` para retomar, sem gerar ou gravar tudo novamente. Títulos, cenas e direção não são narrados; a tela de gravação apresenta só as falas organizadas por capítulo.
