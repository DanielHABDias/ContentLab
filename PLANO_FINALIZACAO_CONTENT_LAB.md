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

- [ ] Criar assistente de primeira execução com diagnóstico de Node, FFmpeg, FFprobe, `zenity`/diálogo nativo, `yt-dlp`, whisper.cpp + `large-v3` e Chatterbox PT-BR.
- [ ] Separar dependências essenciais das opcionais. A interface básica deve abrir mesmo sem voz/transcrição.
- [ ] Oferecer “Instalar essenciais”, “Instalar recursos de IA” e “Agora não”, mostrando tamanho estimado, origem, licença, espaço livre e destino antes do download.
- [ ] Exigir consentimento antes de pesos grandes, código de terceiros ou perfil de voz. Nunca instalar tudo silenciosamente a cada inicialização.
- [ ] Fixar versão e checksum de cada binário/modelo; baixar para arquivo parcial; verificar integridade; promover por rename atômico.
- [ ] Suportar pausa, retomada, cancelamento e nova tentativa sem reiniciar downloads válidos.
- [ ] Guardar estado do setup versionado fora do repositório e revalidar somente quando versão/checksum/requisito mudar.
- [ ] Preferir dependências isoladas em `.tools/`; não alterar Python/Node global nem configurações do sistema sem ação explícita.
- [ ] Para pacotes do sistema (FFmpeg, diálogo nativo), mostrar comando por distribuição/SO ou abrir fluxo privilegiado somente após confirmação.
- [ ] Implementar Linux primeiro e contratos para Windows/macOS; não declarar suporte multiplataforma antes dos testes reais.
- [ ] Atualizar `npm run doctor` para compartilhar o mesmo catálogo do instalador e produzir diagnóstico legível e JSON.
- [ ] Criar testes com servidor local/falso para checksum incorreto, queda de rede, pouco disco, retomada e versão já instalada.

Aceite: uma instalação limpa conduz o usuário até um estado operacional; a segunda inicialização não baixa novamente; falhas deixam instrução acionável e nenhum artefato parcial é tratado como instalado.

## F15 — configurações, armazenamento e recuperação

Objetivo: tornar caminhos, cache e manutenção compreensíveis e seguros.

- [ ] Criar tela Configurações com raiz de projetos, cache de mídia, downloads/modelos, saída de render e limites de disco.
- [ ] Validar e testar escrita antes de aceitar uma nova pasta; não mover dados automaticamente.
- [ ] Implementar migração assistida entre raízes com plano, espaço necessário, progresso, verificação e rollback.
- [ ] Mostrar uso de disco por projetos, objetos, cortes, renders e modelos.
- [ ] Limpar apenas derivados/cache por padrão; objetos usados por projetos exigem análise de referências.
- [ ] Implementar backup/restauração do registro e recuperação de registro corrompido sem perder projetos.
- [ ] Detectar projeto movido e permitir relocalizar a pasta.
- [ ] Adicionar locks por projeto/processo e recuperação segura após encerramento inesperado.

Aceite: mudar configurações não perde dados; limpeza nunca apaga originais ou mídias ainda referenciadas.

## F16 — mídia completa, URLs e transcrição

Objetivo: concluir o fluxo da mídia bruta ao material pesquisável dentro da interface.

- [ ] Adicionar importação múltipla, drag-and-drop, progresso, cancelamento e prevenção de duplicatas por hash.
- [ ] Implementar remoção/desassociação de mídia com análise de uso em thumbnail, timeline, takes e render.
- [ ] Integrar URL HTTPS com `yt-dlp`, validação de direitos e limites existentes; bloquear playlists e excessos conforme documentação.
- [ ] Criar preview real de vídeo, áudio e imagem, metadados de ffprobe e localização do original/cache.
- [ ] Expor cortes não destrutivos e seus derivados cacheados.
- [ ] Conectar Whisper `large-v3`: fila, idioma PT-BR, progresso, cancelamento, JSON/SRT, timestamps e reexecução idempotente.
- [ ] Permitir revisão/correção da transcrição sem sobrescrever a saída bruta.
- [ ] Associar transcrição à mídia e permitir busca por texto/timecode.
- [ ] Testar com arquivos reais pequenos, mídia inválida, URL recusada e runtime ausente.

Aceite: importar, visualizar, cortar e transcrever funciona do início ao fim; nenhum botão apenas informa que o recurso será integrado depois.

## F17 — narração e voz

Objetivo: disponibilizar gravação, tratamento, montagem e voz consentida na interface.

- [ ] Criar sessão de narração por projeto e listar takes reais.
- [ ] Gravar pelo microfone somente após permissão explícita; permitir também importar áudio existente.
- [ ] Cortar, renomear, reordenar, excluir e montar takes sem modificar originais.
- [ ] Expor redução de ruído, high-pass, compressão e normalização, com preview antes de aplicar.
- [ ] Medir duração, pico e loudness; validar WAV/48 kHz/mono nos derivados esperados.
- [ ] Criar perfil Chatterbox apenas com titular, consentimento, data, texto lido e amostra válida.
- [ ] Integrar geração PT-BR, watermark/metadados aplicáveis, fila, cancelamento e diagnóstico de runtime/modelo.
- [ ] Permitir excluir perfil e todos os derivados de voz com confirmação e relatório do que será afetado.
- [ ] Realizar QA auditivo com corpus PT-BR autorizado antes de declarar qualidade de produção.

Aceite: uma narração pode ser gravada/importada, tratada, montada e usada no projeto; voz sintética permanece bloqueada sem consentimento completo.

## F18 — timeline, preview e edição visual

Objetivo: transformar a timeline persistente existente em uma superfície de edição real.

- [ ] Implementar tracks, clips, seleção, trim, split, mover, ripple opcional, mute/lock e snap.
- [ ] Conectar undo/redo ao histórico de comandos, inclusive após reabrir a sessão quando aplicável.
- [ ] Expor propriedades de fit, âncora, layout por proporção, efeitos e keyframes.
- [ ] Criar preview sincronizado usando o mesmo `RenderPlan` do render final.
- [ ] Integrar componentes TSX/Remotion com allowlist, build isolado e erro recuperável.
- [ ] Exibir safe areas e alternância 16:9, 9:16, 1:1 e 4:5 sem alterar silenciosamente composições aprovadas.
- [ ] Adicionar legendas a partir de SRT/transcrição com edição e estilos acessíveis.
- [ ] Testar áudio/vídeo sincronizados, mídia ausente, clip fora da duração e projetos longos.

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
- [ ] Verificar licenças e redistribuição de FFmpeg, whisper.cpp, pesos `large-v3`, Chatterbox e `yt-dlp` antes de empacotar.
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

---

## Ordem recomendada de execução

1. F13 (controle e exclusão segura de projetos).
2. F14–F15 (setup, dependências, configurações e armazenamento).
3. F16–F17 (mídia, transcrição, narração e voz).
4. F18–F19 (edição, preview, render e pacotes).
5. F20–F22 (autonomia, UX e segurança).
6. F23–F24 (distribuição e release candidate).

Não iniciar empacotamento desktop antes de estabilizar armazenamento, setup e operações destrutivas. Não baixar modelos grandes antes de implementar consentimento, checksum, retomada e espaço em disco.

## Checkpoint de retomada

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
