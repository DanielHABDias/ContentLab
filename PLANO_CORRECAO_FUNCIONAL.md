# Plano de correção funcional do Content Lab

Este plano substitui a aceitação visual usada no ciclo T01–T12 por aceitação funcional. Uma tela só conta como pronta quando usa o mesmo núcleo da CLI/MCP, persiste em disco e passa por teste de integração. Não haverá projetos, textos, versões, históricos ou estados fictícios na aplicação final.

## Regras de execução e economia de contexto

- Trabalhar uma tarefa macro por vez e registrar um commit por tarefa concluída.
- Antes de editar, ler apenas o módulo afetado e seus contratos/testes diretos; ampliar a busca somente quando uma dependência exigir.
- Manter critérios de aceite e decisões neste arquivo para não depender do histórico da conversa.
- Rodar primeiro os testes focados do módulo; rodar `npm run check` e `npm audit --omit=dev` nos marcos F04, F08 e F12.
- Usar saídas compactas (`rg`, recortes de arquivo e diffs direcionados), sem reler arquivos já compreendidos.
- Atualizar as caixas deste plano somente depois da validação real e antes do commit correspondente.
- O plugin Diazverso é somente leitura. Se não estiver instalado ou exposto à sessão, aplicar estas regras locais e registrar a limitação, sem alterar o plugin.

## Auditoria inicial

- [x] Projetos recentes eram três exemplos fixos e ainda eram copiados para `localStorage`.
- [x] “Novo projeto” criava apenas um cartão no navegador, sem `project.json`.
- [x] “Abrir projeto” e “Importar pacote” exibiam avisos de implementação futura.
- [x] “Mídias locais”, “Configurar”, “Continuar” e importação de thumbnail não executavam ações.
- [x] Workflow, histórico, roteiro, títulos e versões usavam estado e conteúdo fictícios em memória.
- [x] CLI/MCP já possuem núcleo persistente, mas a interface não estava ligada a ele.

## F01 — servidor local e registro de projetos reais

- [ ] Criar um servidor HTTP local que sirva a aplicação e exponha uma API versionada.
- [ ] Criar registro persistente de caminhos recentes; remover entradas inexistentes automaticamente.
- [ ] Listar recentes somente a partir de projetos reais e válidos em disco.
- [ ] Exibir estado vazio e erro acionável quando o servidor local não estiver disponível.
- [ ] Testar registro, API e ausência total de dados de demonstração.

## F02 — criar, abrir e importar projetos

- [ ] Criar projeto real pelo `ProjectStore`, em pasta escolhida ou na raiz local padrão.
- [ ] Abrir pasta por seletor nativo e validar `project.json` antes de registrar.
- [ ] Importar `.contentlab`/ZIP por seletor nativo, inspeção segura e restauração pelo `PackageService`.
- [ ] Tratar cancelamento, pasta inválida, conflito e indisponibilidade do seletor sem falso sucesso.
- [ ] Testar os fluxos completos da interface até o disco.

## F03 — configuração e navegação do projeto

- [ ] Fazer “Configurar” editar e persistir título, formato, proporção e modo com revisão otimista.
- [ ] Fazer “Continuar” abrir a etapa ativa real.
- [ ] Manter botões indisponíveis realmente desabilitados e explicar o motivo por texto/tooltip.
- [ ] Remover todos os rótulos de demonstração e mensagens de integração futura.

## F04 — workflow e histórico persistentes

- [ ] Ler estados das etapas e histórico diretamente do projeto.
- [ ] Persistir aprovação, pedido de mudanças e reabertura pelo mesmo núcleo da CLI/MCP.
- [ ] Preservar revisões, invalidação de dependências e idempotência.
- [ ] Validar conflitos de revisão e atualizar a interface sem perder dados.

## F05 — brief, roteiro e embalagem reais

- [ ] Adicionar ao contrato dados criativos versionados, inicialmente vazios.
- [ ] Persistir brief, roteiro, direção visual, fontes, títulos, descrição, tags e notas.
- [ ] Substituir autosave simulado por salvamento real com estados salvando/salvo/erro.
- [ ] Mostrar versões e histórico reais, sem números inventados.

## F06 — mídias locais e thumbnails

- [ ] Tornar “Mídias locais” uma área funcional, com estado vazio explícito.
- [ ] Importar arquivos reais via seletor, calcular hash, registrar direitos e associar ao projeto.
- [ ] Listar apenas arquivos reais e sinalizar arquivo ausente.
- [ ] Fazer importação de thumbnail usar o mesmo catálogo e persistir a seleção.

## F07 — narração, edição e render com disponibilidade honesta

- [ ] Conectar as telas às capacidades reais de narração, timeline, preview e fila de render.
- [ ] Desabilitar dependências opcionais ausentes com diagnóstico e solução, sem hover enganoso.
- [ ] Validar mídia/render reais com FFmpeg/ffprobe quando o ambiente suportar.

## F08 — varredura de controles e teste de aceitação

- [ ] Inventariar cada botão, link, campo, seletor e área com hover; conectar ou desabilitar com motivo.
- [ ] Criar teste de aceitação cobrindo primeira execução vazia, criar, abrir, configurar, continuar, salvar e reabrir.
- [ ] Confirmar por busca que não restam exemplos, avisos de implementação futura ou sucessos simulados.
- [ ] Rodar `npm run check`, `npm run doctor` e `npm audit --omit=dev`.

## F09 — documentação e operação local

- [ ] Atualizar README com comando único para iniciar interface + API.
- [ ] Documentar pasta padrão, registro de recentes, seletor nativo e recuperação de erros.
- [ ] Validar instalação limpa e reinício preservando projetos.

## F10 — revisão de acessibilidade e estados de interação

- [ ] Revisar foco, teclado, leitores de tela, loading, vazio, erro e disabled.
- [ ] Garantir que hover indique ação disponível; controles inertes não podem parecer clicáveis.
- [ ] Testar layouts 16:9 e 9:16.

## F11 — migração e compatibilidade

- [ ] Ignorar/remover com segurança os cartões antigos do `localStorage`, sem transformá-los em projetos.
- [ ] Migrar projetos `contentlab-project-v1` existentes sem inventar conteúdo.
- [ ] Verificar compatibilidade CLI/MCP/pacotes após extensão do contrato.

## F12 — validação final e entrega

- [ ] Executar a suíte completa e uma sessão manual no navegador.
- [ ] Conferir que o diretório Git está limpo e os commits F01–F12 estão na `main`.
- [ ] Fazer push normal e registrar apenas limitações reais restantes.
