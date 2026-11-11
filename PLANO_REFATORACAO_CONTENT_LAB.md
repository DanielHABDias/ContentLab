# PLANO TEMPORÁRIO — REFATORAÇÃO DO CONTENT LAB

> **Documento temporário de execução.** Será removido juntamente com a pasta `old/` após a conclusão e validação da refatoração. A documentação final deve permanecer no projeto.
>
> **Escopo exclusivo:** repositório `ContentLab`. Não modificar o repositório do plugin **Diazverso 1.0** nesta etapa.

## 1. Estratégia de migração

- [ ] Mover **todo o conteúdo versionado do projeto atual** para `old/`, preservando a hierarquia, sem perder arquivos ou sobrescrever material.
- [ ] Manter `.git/` e os metadados necessários do repositório na raiz (não mover `.git/`). Preservar o histórico Git.
- [ ] Criar a nova aplicação fora de `old/`, aproveitando o código antigo como referência, sem reativar a aplicação antiga por acidente.
- [ ] Revisar a estrutura de build e execução para que a aplicação nova rode a partir da raiz.
- [ ] Somente após a nova versão estar implementada, testada, documentada e aprovada, remover `old/` e este plano.

**Atenção:** a pasta `old/` não é o novo diretório de produção, nem deve ser removida antes da validação final.

## 2. Objetivo da nova versão

Reorganizar o Content Lab como ferramenta audiovisual **100% local**, com dois modos de operação:
- **Manual:** interface visual moderna, bonita, intuitiva e funcional.
- **Agentes:** controle direto por comandos/CLI e/ou servidor MCP local, compartilhando o mesmo núcleo de operações com a interface.

Prioridades: operação sem hospedagem obrigatória, ausência de serviços pagos obrigatórios, operações em lote, baixo consumo de tokens, mensagens concisas de estado e diagnóstico, logs locais e autonomia do usuário. A viabilidade de CLI, MCP e dos limites de acesso local deve ser comprovada por protótipos antes de fixar a arquitetura.

## 3. Requisitos funcionais definidos

### Importação, download, cortes e cache
- [ ] Importar vídeos por URL da internet, respeitando acesso e direitos de uso, e por arquivos já existentes no computador.
- [ ] Permitir extrair múltiplos cortes e reutilizar a mesma mídia sem baixar/reprocessar desnecessariamente.
- [ ] Guardar a mídia em cache persistente e permitir limpeza explícita pelo usuário.
- [ ] Expor estados, progresso, erros e caminhos dos arquivos gerados.

### Transcrição
- [ ] Utilizar **somente uma opção de modelo**, escolhida por precisão e adequação real ao português. Não instalar variantes fracas.
- [ ] Validar qualidade, tempo de processamento e requisitos de hardware antes da escolha final.
- [ ] Integrar transcrição ao fluxo de cortes e edição.

### Dependências e inicialização
- [ ] Na inicialização, verificar dependências necessárias, incluindo FFmpeg e componentes locais.
- [ ] Instalar ou preparar dependências ausentes automaticamente quando for seguro e tecnicamente viável.
- [ ] Implementar novas tentativas limitadas para falhas recuperáveis, com mensagens de diagnóstico e solução.
- [ ] Se algo obrigatório continuar indisponível, falhar de modo claro, sem fingir que o recurso está funcionando.

### Narração, voz e áudio
- [ ] Gravar narração no Content Lab com takes independentes.
- [ ] Cortar, regravar, excluir, organizar e revisar takes.
- [ ] Permitir geração de narração por IA e clonagem de voz com consentimento do titular.
- [ ] Selecionar apenas a opção de modelo de melhor qualidade validada, sem instalar modelos fracos por padrão.
- [ ] Criar configuração de perfil de voz: texto de referência, gravação de amostra e orientação sobre duração/qualidade da amostra.
- [ ] Tratar áudio e voz (ruído, volume, consistência e acabamento), priorizando inteligibilidade e naturalidade em português.
- [ ] Avaliar o que pode ser aproveitado dos aprendizados com OpenBox.

### Editor e renderização
- [ ] Refatorar o editor para edição de múltiplas faixas, mídias e elementos, conforme escopo técnico avaliado.
- [ ] Manter edição individual e facilitar ações em lote.
- [ ] Unificar o fluxo de edição manual e os comandos de agentes.
- [ ] Revisar pré-visualização, renderização e exportação.

### Thumbnail
- [ ] Não reproduzir o fluxo rígido atual.
- [ ] Avaliar uma abordagem flexível de composição/edição, com liberdade criativa e eventual integração com o plugin no futuro.

### Funcionalidades que serão removidas
- [ ] Remover completamente publicação automática em plataformas.
- [ ] Remover completamente o banco de mídia antigo.

### Visual, documentação e créditos
- [ ] Redesenhar a interface conforme as funcionalidades, não necessariamente as abas atuais, mantendo qualidade visual.
- [ ] Documentar instalação, configuração, funcionamento manual, operações automatizadas, solução de problemas e arquitetura.
- [ ] Incluir atribuição: **Content Lab — criado por Daniel Dias**, associado ao canal **Diazverso** (https://www.youtube.com/@DiazVerso).

### Skills de agentes — ÚLTIMA ETAPA
- [ ] Somente depois que a interface, operações locais, CLI/MCP e testes estiverem estáveis, escrever skills orientando agentes a controlar o Content Lab de modo econômico em tokens.
- [ ] Integração posterior ao plugin Diazverso, sem mudanças nesse repositório agora.

## 4. Pesquisa de skills, referências e códigos existentes (ANTES da implementação)

Esta etapa é **obrigatória antes de projetar e implementar a nova arquitetura**. Procurar documentação oficial, skills especializadas e repositórios open source, estudar a implementação real e registrar o que funciona, o que pode ser adaptado e o que deve ser descartado. Não escolher ferramentas apenas por popularidade.

### Skills e guias técnicos a localizar e avaliar
- [ ] **MCP:** skills/guias sobre como projetar, desenvolver, expor, documentar, proteger e testar servidores MCP locais, incluindo transporte `stdio`, contratos de ferramentas, operações em lote, estados e erros estruturados, baixo consumo de tokens e integração com Codex e Claude Code.
- [ ] **Arquitetura e qualidade de código:** skills/guias sobre organização de projetos, módulos, interfaces, separação de responsabilidades, manutenibilidade, tratamento de erros, testes unitários, testes de integração, testes end-to-end e automação de validações.
- [ ] **Remotion:** skills, documentação oficial e exemplos para composições, timeline, pré-visualização, renderização, efeitos e integração de edição programática.
- [ ] **Hyperframes:** skills, documentação e projetos de referência; entender as funcionalidades e arquitetura reais antes de decidir se será reutilizado, substituído ou combinado com Remotion/FFmpeg.
- [ ] **Edição e produção audiovisual moderna:** boas práticas e exemplos para montar vídeos com precisão (cortes, trilhas/faixas, legendas, sincronização, narração, efeitos, composição, prévia e exportação).
- [ ] **Plugin Diazverso 1.0:** consultar como **referência somente de leitura**, aproveitando padrões de fluxos, qualidade, identidade, uso de agentes e economia de tokens quando pertinentes. **Não alterar o repositório do plugin nesta refatoração.**

### Repositórios open source de edição automatizada com IA
- [ ] Pesquisar aplicações e projetos em que um agente ou LLM (ChatGPT, Claude ou outros) produz roteiro, organiza mídias, cria um plano de edição/timeline e renderiza o vídeo automaticamente, mesmo que o exemplo original use API de IA.
- [ ] Investigar **como o código faz a edição de verdade**, e não apenas a interface de chat: representação de cenas, modelo de timeline, seleção de trechos, sincronização de narração, aplicação de efeitos, geração de legendas, renderização, cache, filas e recuperação de falhas.
- [ ] Avaliar arquiteturas de renderização declarativa ou baseada em JSON/EDL, integração com Remotion/FFmpeg e mecanismos que geram operações determinísticas a partir de planos estruturados.
- [ ] Identificar ideias aproveitáveis para o **Content Lab local**, substituindo dependências obrigatórias de APIs pagas/nuvem por controle direto do agente via CLI/MCP, quando viável.
- [ ] Conferir licença, atividade/manutenção, maturidade, compatibilidade com hardware local, facilidade de teste, segurança, desempenho e custos ocultos antes de reaproveitar código.
- [ ] Registrar links, comparação das opções, lições de implementação e justificativas das decisões no plano enquanto a pesquisa estiver em andamento. Não copiar projetos inteiros indiscriminadamente.

**Distinção importante:** skills existentes serão **pesquisadas e consultadas desde o começo** para orientar a construção. As **skills próprias do Content Lab/Diazverso, destinadas a ensinar agentes a usar o produto final**, continuarão sendo criadas **somente na última etapa**, após o sistema estar funcional e validado.

## 5. Etapas de execução

1. **Preparação:** isolar código legado em `old/`; criar estrutura inicial da nova versão.
2. **Levantamento e pesquisa:** identificar componentes reutilizáveis, dependências e fluxos do legado; avaliar skills, documentação, repositórios e técnicas modernas de edição automatizada antes das decisões de arquitetura.
3. **Arquitetura:** definir contratos do núcleo local, camada manual e controle por agentes; provar compatibilidade local.
4. **Implementação:** entregar os recursos em módulos e testar cada fluxo.
5. **Qualidade:** testes automatizados, uso manual, falhas de dependência, cache, desempenho, exportação e testes com agentes.
6. **Acabamento:** identidade visual, créditos, documentação e fluxos completos.
7. **Skills:** escrever e validar instruções para agentes somente ao final.
8. **Limpeza:** remover `old/` e este plano apenas depois de validar integralmente a nova versão.

## 6. Regras de trabalho

- Registrar decisões e pendências no plano enquanto a refatoração estiver em andamento.
- Diferenciar requisitos aprovados de sugestões técnicas sujeitas à avaliação.
- Não apagar nem substituir arquivos do legado sem preservá-los na migração inicial.
- Não adicionar hospedagem, APIs comerciais ou serviços pagos como requisitos obrigatórios.
- Não alterar o repositório do plugin Diazverso nesta etapa.
- Testar operações antes de declará-las concluídas.
