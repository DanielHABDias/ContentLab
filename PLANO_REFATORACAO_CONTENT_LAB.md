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

## 4. Etapas de execução

1. **Preparação:** isolar código legado em `old/`; criar estrutura inicial da nova versão.
2. **Levantamento:** identificar componentes reutilizáveis, dependências, ferramentas e fluxos que deverão ser substituídos.
3. **Arquitetura:** definir contratos do núcleo local, camada manual e controle por agentes; provar compatibilidade local.
4. **Implementação:** entregar os recursos em módulos e testar cada fluxo.
5. **Qualidade:** testes automatizados, uso manual, falhas de dependência, cache, desempenho, exportação e testes com agentes.
6. **Acabamento:** identidade visual, créditos, documentação e fluxos completos.
7. **Skills:** escrever e validar instruções para agentes somente ao final.
8. **Limpeza:** remover `old/` e este plano apenas depois de validar integralmente a nova versão.

## 5. Regras de trabalho

- Registrar decisões e pendências no plano enquanto a refatoração estiver em andamento.
- Diferenciar requisitos aprovados de sugestões técnicas sujeitas à avaliação.
- Não apagar nem substituir arquivos do legado sem preservá-los na migração inicial.
- Não adicionar hospedagem, APIs comerciais ou serviços pagos como requisitos obrigatórios.
- Não alterar o repositório do plugin Diazverso nesta etapa.
- Testar operações antes de declará-las concluídas.
