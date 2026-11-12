# Plano de finalização do Content Lab

Este documento é o ponto de retomada para concluir o Content Lab como produto local utilizável, instalável e recuperável. O ciclo de correção funcional anterior foi concluído; este plano começa no estado atual da `main` e cobre o que ainda falta para uma versão de produção.

O próximo agente deve ler primeiro `AGENTS.md`, este arquivo e somente a documentação do módulo que for alterar. Não deve recriar o que já funciona, inserir dados de demonstração nem marcar uma tarefa como pronta por existir apenas uma tela.

## Estado confirmado na `main`

- A interface, CLI e MCP usam o núcleo persistente e versionado.
- Criar, abrir e importar projetos reais funciona; recentes vêm de caminhos reais em disco.
- Configuração, workflow, histórico, brief, roteiro, embalagem e autosave persistem no `project.json`.
- O catálogo importa mídia real, calcula SHA-256, registra direitos e alimenta thumbnails.
- FFmpeg/FFprobe geram e validam render; dependências ausentes são diagnosticadas sem falso sucesso.
- O início local funciona por `npm run dev` e a versão compilada por `npm start`.
- A suíte de referência possui 43 testes e a auditoria npm estava sem vulnerabilidades no encerramento do ciclo anterior.
- Não existem projetos, textos, versões ou históricos fictícios na interface.

## Referência externa Diazverso — somente leitura

O plugin indicado pelo usuário está em:

`/home/daniel/Documentos/Projects/DiazVerso-Plugin`

Ele não pertence ao Content Lab e não deve ser editado, formatado, commitado nem receber arquivos gerados por este projeto. Para economia de contexto, consultar somente quando necessário:

- `skills/diazverso-contexto-eficiente/SKILL.md`
- `skills/context-optimization/SKILL.md`

Se “plugin do Javas” se referir a outro projeto, localizar e confirmar o caminho antes de usá-lo; não substituir silenciosamente a referência acima.

### Continuidade pelo Codex Cloud

O caminho acima é local e provavelmente não estará montado num executor Cloud. Isso não deve bloquear tarefas independentes do plugin:

- usar este plano como checkpoint canônico;
- não inventar conteúdo das skills nem tentar modificar o repositório do plugin;
- se o plugin não estiver disponível, aplicar diretamente o protocolo de contexto abaixo e registrar a limitação no checkpoint;
- evitar testes que dependam de diálogo gráfico, microfone, GPU ou gerenciador de pacotes do computador local;
- implementar contratos e testes automatizados no Cloud, deixando QA nativo explicitamente marcado para execução local;
- antes de continuar uma branch criada no Cloud, sincronizar a `main` e conferir se a revisão deste plano não mudou.

## Protocolo obrigatório de contexto e tokens

1. Definir um resultado observável para a tarefa atual e trabalhar apenas nele.
2. Ler `AGENTS.md`, este plano e os arquivos diretamente responsáveis. Não abrir todas as skills, documentos ou fontes por rotina.
3. Usar `rg` e recortes direcionados. Ampliar a leitura somente quando uma dependência concreta aparecer.
4. Reutilizar decisões e observações enquanto o arquivo/revisão não mudar. Não reler fontes já compreendidas.
5. Rodar primeiro testes focados. Executar a suíte completa apenas nos marcos definidos neste plano.
6. Resumir saídas volumosas em: resultado, evidência, erro ainda ativo e próxima ação. Preservar o caminho/comando para recuperar a saída completa.
7. Ao trocar de macroetapa, registrar neste arquivo um checkpoint curto: concluído, testes, decisões, bloqueios e próxima tarefa.
8. Manter operações idempotentes, revisões otimistas e a mesma regra de negócio para UI, CLI e MCP.
9. Não delegar/reler em paralelo uma tarefa pequena. Paralelizar somente módulos independentes quando isso reduzir o trabalho total.
10. Sem telemetria real, não afirmar percentuais de economia de tokens ou cache.

## Regra de conclusão

Uma tarefa só pode ser marcada como concluída quando:

- o fluxo funciona do clique até o disco ou artefato final;
- há estado de loading, vazio, erro, cancelamento e sucesso real;
- controles indisponíveis estão desabilitados e explicam o motivo;
- existe teste proporcional, incluindo falha relevante;
- a documentação afetada foi atualizada;
- `git diff --check` passa e não há exemplos/atalhos simulados.

Cada macroetapa deve gerar um commit próprio na `main`, seguido de push normal. Não usar force push.

---

## F13 — gerenciamento completo de projetos

Objetivo: o usuário deve controlar o ciclo de vida do projeto sem editar pastas manualmente.

- [x] Adicionar menu de ações por projeto: abrir, revelar pasta, renomear, duplicar, exportar, remover de Recentes e excluir.
- [x] “Remover de Recentes” deve alterar apenas o registro, nunca apagar a pasta.
- [x] “Excluir projeto” deve mostrar nome e caminho exatos, exigir confirmação explícita e usar lixeira recuperável do sistema quando disponível.
- [x] Se a lixeira não estiver disponível, oferecer export/backup antes de qualquer exclusão permanente e pedir nova confirmação.
- [x] Impedir exclusão quando houver operação de escrita/render ativa; permitir cancelar ou aguardar.
- [x] Renomear título sem mudar o ID por padrão. Uma mudança de pasta/ID deve ser operação separada, atômica e validada.
- [x] Duplicar deve gerar novo ID, revisão inicial coerente e histórico informando a origem, sem duplicar objetos de mídia endereçados por hash.
- [x] Exibir tamanho, última abertura, última modificação e aviso de caminho ausente nos Recentes.
- [x] Criar testes para cancelamento, lixeira, projeto ausente, conflito, duplicação e remoção sem exclusão.

Aceite: excluir não deixa o cartão nem o diretório ativo; remover de Recentes preserva integralmente o projeto; restaurar da lixeira recupera um projeto válido.

## F14 — onboarding e instalador progressivo de dependências

Objetivo: na primeira execução, detectar o computador e conduzir a instalação do que for necessário sem downloads silenciosos ou repetidos.

- [x] Criar assistente de primeira execução com diagnóstico de Node, FFmpeg, FFprobe, `zenity`/diálogo nativo, `yt-dlp`, whisper.cpp + `large-v3` e Chatterbox PT-BR.
- [x] Separar dependências essenciais das opcionais. A interface básica deve abrir mesmo sem voz/transcrição.
- [x] Oferecer “Instalar essenciais”, “Instalar recursos de IA” e “Agora não”, mostrando tamanho estimado, origem, licença, espaço livre e destino antes do download.
- [x] Exigir consentimento antes de pesos grandes, código de terceiros ou perfil de voz. Nunca instalar tudo silenciosamente a cada inicialização.
- [x] Fixar versão e checksum de cada binário/modelo; baixar para arquivo parcial; verificar integridade; promover por rename atômico.
- [x] Suportar pausa, retomada, cancelamento e nova tentativa sem reiniciar downloads válidos.
- [x] Guardar estado do setup versionado fora do repositório e revalidar somente quando versão/checksum/requisito mudar.
- [x] Preferir dependências isoladas em `.tools/`; não alterar Python/Node global nem configurações do sistema sem ação explícita.
- [x] Para pacotes do sistema (FFmpeg, diálogo nativo), mostrar comando por distribuição/SO ou abrir fluxo privilegiado somente após confirmação.
- [x] Implementar Linux primeiro e contratos para Windows/macOS; não declarar suporte multiplataforma antes dos testes reais.
- [x] Atualizar `npm run doctor` para compartilhar o mesmo catálogo do instalador e produzir diagnóstico legível e JSON.
- [x] Criar testes com servidor local/falso para checksum incorreto, queda de rede, pouco disco, retomada e versão já instalada.

Aceite: uma instalação limpa conduz o usuário até um estado operacional; a segunda inicialização não baixa novamente; falhas deixam instrução acionável e nenhum artefato parcial é tratado como instalado.

## F15 — configurações, armazenamento e recuperação

Objetivo: tornar caminhos, cache e manutenção compreensíveis e seguros.

- [x] Criar tela Configurações com raiz de projetos, cache de mídia, downloads/modelos, saída de render e limites de disco.
- [x] Validar e testar escrita antes de aceitar uma nova pasta; não mover dados automaticamente.
- [x] Implementar migração assistida entre raízes com plano, espaço necessário, progresso, verificação e rollback.
- [x] Mostrar uso de disco por projetos, objetos, cortes, renders e modelos.
- [x] Limpar apenas derivados/cache por padrão; objetos usados por projetos exigem análise de referências.
- [x] Implementar backup/restauração do registro e recuperação de registro corrompido sem perder projetos.
- [x] Detectar projeto movido e permitir relocalizar a pasta.
- [x] Adicionar locks por projeto/processo e recuperação segura após encerramento inesperado.

Aceite: mudar configurações não perde dados; limpeza nunca apaga originais ou mídias ainda referenciadas.

## F16 — mídia completa, URLs e transcrição

Objetivo: concluir o fluxo da mídia bruta ao material pesquisável dentro da interface.

- [x] Adicionar importação múltipla, drag-and-drop, progresso, cancelamento e prevenção de duplicatas por hash.
- [x] Implementar remoção/desassociação de mídia com análise de uso em thumbnail, timeline, takes e render.
- [x] Integrar URL HTTPS com `yt-dlp`, validação de direitos e limites existentes; bloquear playlists e excessos conforme documentação.
- [x] Criar preview real de vídeo, áudio e imagem, metadados de ffprobe e localização do original/cache.
- [x] Expor cortes não destrutivos e seus derivados cacheados.
- [x] Conectar Whisper `large-v3`: fila, idioma PT-BR, progresso, cancelamento, JSON/SRT, timestamps e reexecução idempotente.
- [x] Permitir revisão/correção da transcrição sem sobrescrever a saída bruta.
- [x] Associar transcrição à mídia e permitir busca por texto/timecode.
- [x] Testar com arquivos reais pequenos, mídia inválida, URL recusada e runtime ausente.

Aceite: importar, visualizar, cortar e transcrever funciona do início ao fim; nenhum botão apenas informa que o recurso será integrado depois.

## F17 — narração e voz

Objetivo: disponibilizar gravação, tratamento, montagem e voz consentida na interface.

- [x] Criar sessão de narração por projeto e listar takes reais.
- [x] Gravar pelo microfone somente após permissão explícita; permitir também importar áudio existente.
- [x] Cortar, renomear, reordenar, excluir e montar takes sem modificar originais.
- [x] Expor redução de ruído, high-pass, compressão e normalização, com preview antes de aplicar.
- [x] Medir duração, pico e loudness; validar WAV/48 kHz/mono nos derivados esperados.
- [x] Criar perfil VoxCPM2 apenas com titular, consentimento, data, texto lido e amostra válida.
- [x] Integrar geração PT-BR, metadados aplicáveis (VoxCPM2 não tem marca d'água), fila, cancelamento e diagnóstico de runtime/modelo.
- [x] Permitir excluir perfil e todos os derivados de voz com confirmação e relatório do que será afetado.
- [ ] Realizar QA auditivo com corpus PT-BR autorizado antes de declarar qualidade de produção.

Aceite: uma narração pode ser gravada/importada, tratada, montada e usada no projeto; voz sintética permanece bloqueada sem consentimento completo.

## F18 — timeline, preview e edição visual

Objetivo: transformar a timeline persistente existente em uma superfície de edição real.

- [x] Implementar tracks, clips, seleção, trim, split, mover, ripple opcional, mute/lock e snap.
- [x] Conectar undo/redo ao histórico de comandos, inclusive após reabrir a sessão quando aplicável.
- [x] Expor propriedades de fit, âncora, layout por proporção, efeitos e keyframes.
- [x] Criar preview sincronizado usando o mesmo `RenderPlan` do render final.
- [x] Integrar componentes TSX/Remotion com allowlist, build isolado e erro recuperável.
- [x] Exibir safe areas e alternância 16:9, 9:16, 1:1 e 4:5 sem alterar silenciosamente composições aprovadas.
- [x] Adicionar legendas a partir de SRT/transcrição com edição e estilos acessíveis.
- [x] Testar áudio/vídeo sincronizados, mídia ausente, clip fora da duração e projetos longos.

Aceite: o usuário consegue montar e revisar um vídeo pela interface, e preview/render compartilham duração, enquadramento e fontes.

## F19 — fila de render, exportação e pacotes

Objetivo: tornar entregas longas observáveis, retomáveis e confiáveis.

- [ ] Expor fila persistente com queued/running/completed/failed/cancelled, progresso e fase.
- [ ] Permitir cancelar, repetir, revelar arquivo e abrir log resumido/diagnóstico.
- [ ] Restaurar jobs interrompidos para queued sem corromper o estado.
- [ ] Oferecer presets coerentes para proporção/resolução e impedir combinações inválidas.
- [ ] Validar toda saída com FFprobe: vídeo, áudio, dimensões, duração e tamanho mínimo.
- [ ] Integrar exportação `.contentlab` e ZIP pela interface, com escolha de incluir/excluir renders e cache.
- [ ] Implementar importação com preview do manifesto, tamanho e conflitos antes da restauração.
- [ ] Criar backup antes de sobrescrever qualquer destino restaurado.

Aceite: um render longo sobrevive a reinício e informa resultado real; um pacote exportado pode ser inspecionado e restaurado em ambiente limpo.

## F20 — workflow autônomo, agentes e aprovações

Objetivo: terminar a promessa “da ideia ao pacote final” sem esconder decisões humanas.

- [ ] Definir exatamente o que o modo autônomo executa e onde deve parar por direitos, consentimento, custo ou aprovação.
- [ ] Criar jobs por etapa com logs compactos, entradas, saídas, revisão-base e operação idempotente.
- [ ] Expor conflito de revisão e botão para recarregar/comparar, nunca sobrescrever silenciosamente.
- [ ] Associar pedidos de mudança a motivo, autor, etapa, revisão e resolução.
- [ ] Mostrar dependências invalidadas e impedir aprovação quando artefatos obrigatórios estiverem ausentes.
- [ ] Garantir paridade de operações entre UI, CLI e MCP.
- [ ] Não implementar publicação automática em redes sociais.

Aceite: o mesmo projeto produz resultados equivalentes pela UI, CLI e MCP; aprovações continuam explícitas e auditáveis.

## F21 — UX, acessibilidade e suporte multiplataforma

Objetivo: eliminar controles ambíguos e garantir operação clara em máquinas suportadas.

- [ ] Inventariar todos os controles e estados interativos; conectar ou desabilitar com explicação.
- [ ] Substituir `window.prompt` por diálogos acessíveis para motivo de mudanças/reabertura.
- [ ] Implementar navegação completa por teclado, foco restaurado, labels, live regions e contraste AA.
- [ ] Testar loading, vazio, erro, offline local, cancelamento e arquivos ausentes.
- [ ] Garantir que `:hover` nunca sugira ação em controle disabled.
- [ ] Implementar adaptador de diálogo nativo para Windows/macOS ou documentar oficialmente Linux-only.
- [ ] Testar breakpoints e proporções em viewport desktop e móvel.
- [ ] Adicionar página “Sobre e diagnóstico” com versões, caminhos e exportação de relatório sem dados sensíveis.

Aceite: todos os fluxos principais funcionam por teclado e cada indisponibilidade explica causa e solução.

## F22 — segurança, privacidade e integridade

Objetivo: revisar operações destrutivas, pacotes, processos externos e dados de voz antes da distribuição.

- [ ] Modelar ameaças para caminhos, ZIP, URLs, TSX, processos FFmpeg/yt-dlp, modelos e perfis de voz.
- [ ] Manter proteção contra path traversal, symlink, ZIP bomb, duplicatas e arquivos gigantes.
- [ ] Aplicar timeouts, limites de buffer, cancelamento e limpeza de temporários aos processos externos.
- [ ] Não incluir projetos, mídia, logs privados ou perfis de voz em telemetria/relatórios por padrão.
- [ ] Criar política clara de exclusão e retenção local.
- [ ] Verificar licenças e redistribuição de FFmpeg, whisper.cpp, pesos `large-v3`, VoxCPM2/PyTorch e `yt-dlp` antes de empacotar.
- [ ] Adicionar testes de pacote malicioso, caminhos externos e consentimento ausente.

Aceite: a revisão não encontra escrita fora das raízes autorizadas nem execução arbitrária no processo principal.

## F23 — instalação distribuível e atualização

Objetivo: permitir que uma pessoa não desenvolvedora instale, execute, atualize e desinstale o Content Lab.

- [ ] Escolher shell desktop/empacotamento depois de um spike curto (por exemplo Tauri ou Electron), preservando o núcleo Node e contratos.
- [ ] Produzir instalador assinado para o primeiro sistema oficialmente suportado.
- [ ] Separar aplicativo, dados do usuário, cache e modelos para atualizações sem perda.
- [ ] Implementar atualização com canal, versão, notas, checksum, rollback e opção manual.
- [ ] Desinstalação deve perguntar separadamente sobre aplicativo, cache/modelos e projetos.
- [ ] Criar instalação limpa em VM/máquina sem toolchain de desenvolvimento.
- [ ] Documentar requisitos mínimos de CPU, RAM, disco e GPU quando medidos.

Aceite: instalar e abrir não exige `npm`; atualizar preserva projetos; desinstalar nunca apaga projetos sem escolha explícita.

## F24 — QA final e release candidate

Objetivo: provar o produto completo antes de chamá-lo de finalizado.

- [ ] Criar matriz E2E: primeira execução, instalar dependências, criar, abrir, configurar, excluir/restaurar, mídia, transcrição, narração, timeline, render, pacote e reabertura.
- [ ] Testar ao menos projeto longo 16:9 e Short 9:16 com mídia licenciada pequena.
- [ ] Executar `npm run check`, testes E2E do instalador, `npm run doctor` e `npm audit --omit=dev`.
- [ ] Fazer varredura por demonstrações, placeholders, botões sem ação e mensagens de integração futura.
- [ ] Fazer teste de recuperação após encerrar o processo durante download, autosave, importação e render.
- [ ] Fazer revisão visual e auditiva dos artefatos reais.
- [ ] Atualizar README, arquitetura, solução de problemas, licenças e notas da versão.
- [ ] Confirmar árvore Git limpa, commits por macroetapa e push normal da `main`.

Aceite: um usuário novo conclui o fluxo sem terminal, nenhum teste crítico falha e todas as limitações restantes estão documentadas como tais.

## F25 — voz clonada VoxCPM2 com recursos dinâmicos

Objetivo: substituir o Chatterbox pelo motor que venceu o teste com a voz do usuário e executá-lo dentro dos limites reais de cada computador.

Evidência (2026-11-11, `.tools/voice-bakeoff`, referência de 32 s do usuário, 3 frases, escuta às cegas): VoxCPM2 4,7/4,3 (parece/natural), Qwen3-TTS 4,3/3,7, Chatterbox 3,0/2,3; os três com WER 0. Nesta máquina (Ryzen 12 threads, AVX2 sem bf16 nativo, 15 GiB RAM, AMD RX 580 sem ROCm) o VoxCPM2 em CPU gastou ~29 s por segundo de áudio e pico de 11,1 GB; sem limite de memória, travou o sistema.

- [x] Remover Chatterbox do catálogo, instalador, adaptador, capacidades, documentação e testes; perfis de voz passam a exigir o texto lido na amostra (clonagem com transcrição).
- [x] Adicionar VoxCPM2 (`voxcpm` 2.0.3 com SHA-256 fixado, pesos `openbmb/VoxCPM2` em revisão fixada, Apache-2.0) instalado em Python isolado.
- [x] Criar perfil de hardware: RAM total e disponível, swap, núcleos, AVX2/AVX-512/bf16, GPU NVIDIA (VRAM, versão CUDA do driver), AMD (arquitetura gfx e suporte ROCm), Apple Silicon (MPS) e disco livre.
- [x] Escolher automaticamente dispositivo e build do PyTorch (CPU, CUDA, ROCm, MPS) e recusar com explicação quando o computador não comporta o modelo.
- [x] Limitar cada geração dinamicamente: teto de memória sem swap (`systemd-run` no Linux), núcleos reservados para o sistema, prioridade baixa e encerramento seguro em vez de travamento.
- [x] Estimar tempo antes de gerar, medir a velocidade real e recalibrar a estimativa por máquina.
- [x] Mostrar hardware, plano de execução e alertas na tela de Dependências; bloquear voz clonada com motivo e solução.
- [x] Testar planos para perfis CPU, NVIDIA, AMD sem ROCm, Apple e pouca RAM; teste de encerramento por limite; QA real de geração nesta máquina.

Aceite: em qualquer computador, a instalação baixa a variante certa, a geração nunca congela o sistema e o usuário vê antes quanto tempo e memória a narração vai exigir.

---

## Ordem recomendada de execução

0. F25 (voz clonada VoxCPM2 com recursos dinâmicos) — prioridade definida pelo usuário em 2026-11-11, antes de F16.
1. F13 (controle e exclusão segura de projetos).
2. F14–F15 (setup, dependências, configurações e armazenamento).
3. F16–F17 (mídia, transcrição, narração e voz).
4. F18–F19 (edição, preview, render e pacotes).
5. F20–F22 (autonomia, UX e segurança).
6. F23–F24 (distribuição e release candidate).

Não iniciar empacotamento desktop antes de estabilizar armazenamento, setup e operações destrutivas. Não baixar modelos grandes antes de implementar consentimento, checksum, retomada e espaço em disco.

## Checkpoint de retomada

### F18 concluída (2026-11-11)

- Concluído: edição de tracks/clips, undo/redo persistente, propriedades e layouts por proporção, `RenderPlan` único para preview/render, safe areas, legendas editáveis e troca de proporção com reabertura de aprovação. A biblioteca TSX agora confere allowlist, transpilação e hash; o build/render Remotion roda em processo filho com memória, tempo e concorrência limitados, cache compartilhado e erro recuperável `COMPONENT_RENDER_FAILED`. A sequência PNG intermediária preserva alfa no FFmpeg. O editor lista **Ênfase cinética**, edita suas propriedades e importa SRT local pela própria interface.
- Evidência real: render anterior de 14 s 1920×1080 H.264/AAC; novo teste Remotion real gera componente animado, confere alfa zero fora do desenho e compõe o frame final. QA no navegador com dados isolados criou projeto, adicionou o componente, exibiu `F18 FUNCIONA` no frame 10 dentro da safe area e importou SRT que apareceu como clip. A inspeção visual encontrou e eliminou o intermediário WebM sem alfa decodificável.
- Testes: 24 arquivos/158 testes; `npm run check`, build e `npm audit --omit=dev` (0 vulnerabilidades).
- Pendências conscientes: a primeira utilização baixa o Chromium do Remotion para o cache de render; componentes longos podem atingir o limite de 120 s e retornam erro recuperável. Muitos clips ainda abrem muitas entradas no FFmpeg; render segmentado pertence à F19.
- Próxima tarefa: F19 — fila persistente de render, retomada, validação de presets e pacotes pela interface.

### F17 concluída (2026-11-11)

- Concluído: `src/server/narration-operations.js` + `src/audio/narration-service.js` (takes em `<projeto>/narration/` com original preservado e WAV 48 kHz mono de trabalho; corte/nome/ordem não destrutivos com revisão otimista; tratamento com silêncio, ruído, high-pass, presets do Voice Studio via rubberband/bass, compressão e loudnorm; preview A/B medido; montagem em job validada como WAV 48 kHz mono e vinculada ao catálogo; perfis globais em `<dados>/voices/` com titular, consentimento, texto lido e amostra de 3–60 s; geração VoxCPM2 por cena em fila com cache por chave SHA-256, cenas desatualizadas, cancelamento e trava entre processos; exclusão de perfil com relatório e remoção dos derivados). `SetupService.voiceRuntime()` corrige o caminho do shim/pesos. Tela `src/ui/NarrationStudio.jsx` na etapa Narração; `ConfirmDialog` acessível já usado aqui.
- Evidência real nesta máquina: amostra do usuário (32,5 s) virou perfil; 1 cena gerada pelo VoxCPM2 real em 132 s (CPU, 9 núcleos, teto 12,4 GB); segunda execução veio do cache; montagem WAV 48 kHz mono, -17,7 LUFS, pico -1,5 dBTP. Arquivos para escuta em `.tools/qa-f17/`.
- Testes: `narration-operations.test.js` (8, FFmpeg real e voz simulada), `narration-service.test.js` (6), setup (+1) e `NarrationStudio.test.jsx` (5). Total 140.
- Pendências: QA auditivo com corpus PT-BR maior (a fala gerada de 36 caracteres saiu com 1,9 s; confirmar ritmo pela escuta); clipes muito curtos não atingem o alvo de loudness (gating EBU R128); a etapa Narração só abre quando está ativa no workflow; fila de jobs é em memória (persistência fica para F19); exclusão de perfil só varre projetos dos Recentes; takes não entram na análise de uso de mídia; pastas `narration/previews` e `staging` ainda entram na exportação do projeto.
- Próxima tarefa: F18 — timeline, preview e edição visual.

### F16 concluída (2026-11-11)

- Concluído: contrato de mídia com nome, origem, metadados, cortes e transcrição; ações `media.remove` (análise de uso), `media.cut.add/remove`, `media.transcript.set`; `src/server/media-operations.js` + `job-queue.js` (importação múltipla/upload/URL/transcrição com progresso e cancelamento); `src/media/transcript-store.js` (bruto x revisado, SRT, busca por texto/timecode); preview com Range; `src/ui/MediaLibrary.jsx`. Hash de mídia passou a ser em streaming.
- Testes: `media-operations.test.js` (8, arquivos reais via FFmpeg, yt-dlp e whisper-cli simulados) e 3 de UI.
- Pendências: whisper real e yt-dlp real não executados aqui; takes de narração não entram na análise de uso (F17); API local sem proteção contra outras origens do navegador (F22).
- Próxima tarefa: F17 — narração e voz (gravação, takes, tratamento, perfil com consentimento, geração VoxCPM2 em fila por cena com cache).

### F25 concluída (2026-11-11)

- Concluído: Chatterbox removido; VoxCPM2 2.0.3 (wheel SHA-256 fixado, pesos `openbmb/VoxCPM2@7936080b`, Apache-2.0) instalável pelo assistente em Python 3.10–3.12 isolado; `src/setup/hardware.js` detecta RAM total/livre, swap, núcleos, AVX2/AVX-512/bf16, NVIDIA (VRAM, CUDA do driver), AMD (gfx/ROCm), Apple e `systemd-run`; `planVoiceRuntime` escolhe dispositivo e build do PyTorch (CPU fixada e validada; cu130/cu128/cu126, rocm7.1 e MPS não validadas), núcleos, teto de memória e estimativa recalibrada pela medição; `VoxCPMVoice` gera com `systemd-run -p MemoryMax -p MemorySwapMax=0 nice` e devolve `MEMORY_LIMIT`, `NEEDS_FREE_MEMORY`, `HARDWARE_UNSUPPORTED`, `CONSENT_REQUIRED` ou `REFERENCE_TEXT_REQUIRED`; tela de Dependências mostra hardware e plano.
- Evidência: teste às cegas com a voz do usuário (VoxCPM2 4,7/4,3; Qwen3-TTS 4,3/3,7; Chatterbox 3,0/2,3). QA real pelo serviço novo nesta máquina (Ryzen 5 5500, 15,5 GiB, RX 580 sem ROCm): CPU, 9 núcleos, teto 12,2 GB, 3,36 s de áudio 48 kHz em 102 s (30,3 s/s), estimativa recalibrada para "medido". A primeira tentativa sem teto de memória congelou o sistema; com teto, o processo é encerrado sem afetar o resto.
- Instalação local do usuário: o ambiente validado no teste foi promovido para `.tools/venvs/voxcpm2`, `.tools/models/voxcpm2` e `.tools/bin/contentlab-voice`, registrado em `setup-state.json` (reconhecido como instalado); Chatterbox, Qwen3-TTS e ferramentas de avaliação apagados (~14 GB liberados).
- Testes: `src/setup/hardware.test.js` (6 perfis), instalador VoxCPM2 (5), serviço de voz (4) e UI (2 novos).
- Pendências conscientes: builds CUDA/ROCm/MPS sem teste real; na CPU desta máquina uma narração de 10 min leva cerca de 5 h — a geração em fila por cena com cache e progresso fica para F17; fine-tuning (LoRA) com mais minutos da voz do usuário não foi implementado.
- Próxima tarefa: F16 — mídia completa, URLs e transcrição.

### F15 concluída (2026-11-11)

- Concluído: tela Configurações (`src/ui/SettingsScreen.jsx`) com raízes de projetos, cache de mídia, cache de render, ferramentas/modelos e saída de render; validação com teste de escrita; migração assistida (plano com arquivos/tamanho/espaço/conflitos, cópia verificada por SHA-256, troca de raiz, remoção opcional da origem, rollback); uso de disco por categoria e avisos de limite; limpeza de derivados e de mídias órfãs com reconferência; backup/restauração do registro e recuperação de registro corrompido (backup → varredura); “Localizar pasta…” para projeto movido; trava por projeto entre processos com recuperação após encerramento inesperado.
- Decisões: mudar a raiz de projetos não move projetos (são pastas independentes); mídia resolvida pelo SHA-256 quando o caminho gravado some, então migrar o cache não reescreve projetos; venv do Chatterbox não é relocável (é descartado do estado e reinstalado); render e exportação não seguram a trava de arquivo para não bloquear edição longa (protegidos pelo rastreador do processo).
- Testes: `src/core/project-lock.test.js` (4, incluindo processo filho real segurando a trava e processo morto), `src/server/storage.test.js` (10) e 3 de UI. QA visual da tela com dados isolados.
- Pendências conscientes: confirmações da tela usam `window.confirm` (substituir por diálogo acessível em F21, junto com `window.prompt`); a análise de órfãos só conhece projetos dos Recentes e da pasta padrão; travas de outro host em pasta de rede não são recuperadas automaticamente.
- Próxima tarefa: F16 — mídia completa: importação múltipla com progresso, URL via `yt-dlp` resolvido por `SetupService.toolPath()` + `requireFeature('media.url')`, preview e transcrição conectada.

### Ajuste pós-F14 (pedido do usuário, 2026-11-11)

- Todas as dependências opcionais instaláveis pela aplicação: Chatterbox passou de `manual` para `python` (wheel verificado, venv isolado, pesos em revisão fixada, comando verificado antes de ativar).
- Bloqueio por dependência: `src/core/capabilities.js` mapeia etapa/recurso → dependências; `StageGate`/`FeatureList`/`DependencyNotice` bloqueiam com botão para Dependências já com os itens marcados; servidor recusa com `DEPENDENCY_MISSING` (`importMedia`, `renderProject`).
- Pendente: instalação real do Chatterbox não foi executada nesta máquina (PyTorch de vários GB); validar no QA local. Ao implementar URL (F16), transcrição (F16) e voz (F17), chamar `requireFeature` com `media.url`, `transcription` e `voice.synthetic`.

### F14 concluída (2026-11-11)

- Concluído: catálogo único `src/setup/dependency-catalog.js` (versão, tamanho, SHA-256, licença, origem, comandos por gerenciador) usado por `npm run doctor`, API e assistente; `downloader.js` (HTTPS, `.partial`, Range, SHA-256 contínuo, espaço livre, rename atômico); `setup-service.js` (estado `contentlab-setup-v1` em `.tools/`, jobs com pausar/retomar/cancelar/repetir, consentimento, compilação do whisper.cpp verificando o commit); `SetupWizard.jsx` na primeira execução e em “Dependências”; rotas `/api/v1/setup/*`.
- Fontes conferidas em 2026-11-11: yt-dlp 2026.10.26 (digests da release GitHub), `ggml-large-v3.bin` (LFS oid no Hugging Face), whisper.cpp v1.9.5 → commit `d1be6fde11ac6e0407606b4e42fe72d34add8037` (MIT).
- Testes: `src/setup/setup.test.js` (13, servidor HTTP local: checksum incorreto, queda de rede + retomada por Range, servidor sem Range, pouco disco, HTTP externo recusado, segunda inicialização sem download, checksum novo pede atualização, pausa/retomada/cancelamento, ferramentas de build ausentes, commit divergente) e 4 novos de UI. QA no navegador com `.tools` isolado: assistente, consentimento e “Agora não” persistido.
- Decisões: pacotes do sistema só exibem o comando (sem `sudo`/pkexec); Chatterbox fica `manual` porque não há artefato fixado e verificável; tamanhos exibidos em unidades binárias.
- Pendências conscientes: nenhum download real de yt-dlp/pesos nem compilação real do whisper.cpp foi executado nesta máquina (exige consentimento do usuário; validar no QA local). Windows/macOS só como contrato (F21/F23). Os serviços de transcrição/URL ainda não consomem `SetupService.toolPath()`; conectar em F16.
- Próxima tarefa: F15 — tela de Configurações e locks por projeto/processo, começando pelo contrato de raízes (projetos, cache, modelos, render) e validação de escrita.

### F13 concluída (2026-11-11)

- Concluído: menu por projeto (abrir, revelar, renomear, duplicar, exportar `.contentlab`/ZIP, remover de Recentes, excluir); Recentes com tamanho, datas e aviso de caminho ausente/inválido; exclusão com confirmação pelo ID, lixeira `gio trash`, “Desfazer” por leitura direta dos `.trashinfo` (freedesktop) e exclusão permanente com backup opcional + segunda confirmação; bloqueio por `ActivityTracker` com cancelamento de render; `ProjectStore.changeId` atômico com rollback.
- Arquivos: `src/server/project-lifecycle.js` (lixeira, abridor, atividades, tamanho), `project-registry.js`, `local-application-service.js`, `http-server.js` (`/api/v1/projects/{forget,reveal,rename,change-id,duplicate,export,delete,restore,activities,cancel}`), `src/core/project-store.js`, `src/ui/ProjectManagement.jsx`, `App.jsx`, `styles.css`.
- Testes: `src/server/project-lifecycle.test.js` (11, incluindo `gio trash` real isolado por `XDG_DATA_HOME`) e 7 novos em `src/ui/App.test.jsx`. QA manual no navegador com dados isolados: excluir → cartão some → Desfazer → projeto válido.
- Decisões: `gio trash --list` usa o daemon GVfs (ignora `XDG_DATA_HOME` e escapa acentos), por isso a restauração lê `info/*.trashinfo`. O rastreador de atividades é por processo; locks entre processos ficam para F15.
- Pendências conscientes: as operações de ciclo de vida ainda não estão na CLI/MCP (paridade em F20); “relocalizar” caminho ausente fica em F15; lixeira em Windows/macOS sem teste real (F21).
- Próxima tarefa: F14, começando pelo catálogo único de dependências (versão, checksum, tamanho, licença, origem) compartilhado entre `npm run doctor` e o assistente.

### Checkpoint anterior

- Fonte: `main` sincronizada após o ciclo funcional.
- Próxima tarefa: F13 — projetar contratos de remoção de Recentes, lixeira e exclusão segura antes de alterar a interface.
- Primeiro teste a escrever: remover um projeto de Recentes preserva `project.json`; excluir via lixeira remove o caminho ativo e mantém possibilidade de restauração.
- Arquivos iniciais prováveis: `src/server/project-registry.js`, `src/server/local-application-service.js`, `src/server/http-server.js`, `src/ui/App.jsx` e seus testes diretos.
- Restrições: preservar projetos reais, não editar DiazVerso-Plugin, não usar force push e não considerar toast/placeholder como implementação.
