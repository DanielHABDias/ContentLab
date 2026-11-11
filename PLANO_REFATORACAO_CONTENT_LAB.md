# PLANO TEMPORÁRIO — REFATORAÇÃO DO CONTENT LAB

> **Documento temporário de execução.** Será removido juntamente com a pasta `old/` após a conclusão e validação da refatoração. A documentação final deve permanecer no projeto.
>
> **Escopo exclusivo:** repositório `ContentLab`. Não modificar o [plugin Diazverso](https://github.com/DanielHABDias/DiazVerso-Plugin) nesta etapa. Consultar sempre sua versão atual disponível, sem fixar número de versão neste plano.

## 1. Estratégia de migração

- [x] Mover **todo o conteúdo versionado do projeto atual** para `old/`, preservando a hierarquia, sem perder arquivos ou sobrescrever material.
- [x] Manter `.git/` e os metadados necessários do repositório na raiz (não mover `.git/`). Preservar o histórico Git.
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

### Workflow de produção orientado a projetos (novo requisito)
- [ ] Tratar **cada vídeo como um projeto persistente independente**. Permitir vários projetos simultâneos, com tipo (longo, curto/Shorts e formatos adicionais), formato de tela, progresso, arquivos e histórico.
- [ ] **Sem dashboard:** abrir, criar, importar e retomar vários projetos de vídeo por uma área simples de projetos locais; dentro de cada projeto, mostrar somente as etapas, progresso e aprovações úteis, sem métricas de redes sociais.
- [ ] Fluxo-base: **brief/ideia → roteiro → título A/B + thumbnails + descrição + tags → seleção/importação de mídia → narração → edição/motion design → revisão e render → pacote final**. Permitir etapas opcionais, retomada e reordenação quando houver justificativa.
- [ ] Editor de roteiro dentro do Content Lab com **salvamento automático**, histórico e uma estrutura alinhada às regras de roteiro do plugin Diazverso. Consultar o plugin como fonte de referência **somente de leitura**, sem duplicar cegamente instruções nem alterar aquele repositório.
- [ ] Dois títulos A/B, descrição, tags, notas de SEO e thumbnails criadas no aplicativo **ou importadas** devem pertencer ao mesmo projeto; campos relevantes serão exportados no pacote final.
- [ ] Interface de revisão por etapa: o agente submete uma entrega; a pessoa visualiza, edita ou pede mudanças e **aprova explicitamente** antes de continuar.
- [ ] Modo com revisões intermediárias **ou** modo autônomo, com aprovação humana somente no final. Escolha por projeto e possibilidade de alterá-la.
- [ ] Permitir voltar uma ou mais etapas, recuperar versões e recalcular/invalidate aprovações ou resultados posteriores que dependam do material alterado, sem destruir o histórico.
- [ ] A ferramenta de importação/download/cache continua disponível **independentemente do workflow**, mas pode ser invocada por suas etapas, pela pessoa ou pelo agente.
- [ ] Sem publicação automática no YouTube/Instagram. A etapa final gera arquivos locais; eventual upload ao Google Drive/planilhas pode ser realizado **posteriormente por agente com acesso e autorização**, sem se tornar dependência obrigatória do Content Lab.

### Redesenho completo do editor (novo requisito)
- [ ] Refazer o modelo de timeline, não apenas ajustar o JSON antigo. **Fundo/background não será um tipo especial obrigatório**: tratá-lo como uma camada visual ordenável, com propriedades gerais, assim como outros elementos.
- [ ] Modelo de timeline **versionado, validado e extensível**: tracks, clips, efeitos, transições, animações, áudio, legendas, keyframes, componentes, referências de mídia e estados claros.
- [ ] Corrigir adaptação entre **16:9 e 9:16**, com coordenadas consistentes, ancoragem, safe areas, estratégias explícitas de crop/fit e possibilidade de layout específico por proporção, sem deslocamento inesperado de elementos.
- [ ] Permitir edição manual e comandos estruturados de agente no **mesmo documento de projeto**, com pré-visualização, desfazer/refazer, controle de alterações, validação e recuperação.
- [ ] Tornar simples criar, registrar e reutilizar **componentes TSX de motion design** por agente, aproveitando Remotion/Hyperframes conforme avaliação técnica; manter a edição declarativa comum simples.
- [ ] Investigar referências modernas de timeline, edição não linear, efeitos, transições, prévia, performance e render incremental. **Estudar vídeos de motion design bem executados** (tipografia cinética, ritmo, movimento, composição, keyframes e transições), adaptar princípios ao Diazverso e criar componentes originais. O conteúdo de `old/` é apenas referência: nenhuma arquitetura legada será preservada por obrigação.

### Funcionalidades que serão removidas
- [ ] Remover completamente publicação automática em plataformas.
- [ ] Remover completamente o banco de mídia antigo.

### Visual, documentação e créditos
- [ ] Redesenhar a interface conforme as funcionalidades, não necessariamente as abas atuais, mantendo qualidade visual.
- [ ] Documentar instalação, configuração, funcionamento manual, operações automatizadas, solução de problemas e arquitetura, **incluindo o formato `.contentlab`**, seu conteúdo, compactação, extração, restauração e exportação ZIP.
- [ ] Incluir atribuição: **Content Lab — criado por Daniel Dias**, associado ao canal **Diazverso** (https://www.youtube.com/@DiazVerso).

### Skills de agentes — ÚLTIMA ETAPA
- [ ] Somente depois que a interface, operações locais, CLI/MCP e testes estiverem estáveis, escrever skills orientando agentes a controlar o Content Lab de modo econômico em tokens.
- [ ] Integração posterior ao plugin Diazverso, sem mudanças nesse repositório agora.

## 4. Pesquisa de skills, referências e códigos existentes (ANTES da implementação)

Esta etapa é **obrigatória antes de projetar e implementar a nova arquitetura**. Procurar documentação oficial, skills especializadas e repositórios open source, estudar a implementação real e registrar o que funciona, o que pode ser adaptado e o que deve ser descartado. Não escolher ferramentas apenas por popularidade.

### UX/UI, acessibilidade e identidade visual (novos requisitos)
- [ ] Encontrar e avaliar skills de **UX/UI, frontend design e acessibilidade (a11y)**, além de referências de interfaces profissionais de criação audiovisual.
- [ ] Pesquisar padrões de **seleção simples de projetos locais (sem dashboard), workflow visual, estados de aprovação e timeline de editor**, priorizando clareza em vez de enfeites ou muitas abas.
- [ ] Criar uma **logo original para o Content Lab**, vinculável visualmente ao universo Diazverso por paleta, quadrinhos/halftone e glitch azul/vermelho controlado; **não usar Nox** como mascote/logo do Content Lab.
- [ ] Desenvolver um design system próprio, com responsividade, contraste, hierarquia, feedback de progresso/erros, acessibilidade e visual moderno sem poluição.
- [ ] Adotar o frontend como **primeiro foco de execução**, prototipando fluxos e comportamento antes de conectar todos os serviços reais.

### Skills e guias técnicos a localizar e avaliar
- [ ] **MCP:** skills/guias sobre como projetar, desenvolver, expor, documentar, proteger e testar servidores MCP locais, incluindo transporte `stdio`, contratos de ferramentas, operações em lote, estados e erros estruturados, baixo consumo de tokens e integração com Codex e Claude Code.
- [ ] **Arquitetura e qualidade de código:** skills/guias sobre organização de projetos, módulos, interfaces, separação de responsabilidades, manutenibilidade, tratamento de erros, testes unitários, testes de integração, testes end-to-end e automação de validações.
- [ ] **Remotion:** skills, documentação oficial e exemplos para composições, timeline, pré-visualização, renderização, efeitos e integração de edição programática.
- [ ] **Hyperframes:** skills, documentação e projetos de referência; entender as funcionalidades e arquitetura reais antes de decidir se será reutilizado, substituído ou combinado com Remotion/FFmpeg.
- [ ] **Edição e produção audiovisual moderna:** boas práticas e exemplos para montar vídeos com precisão (cortes, trilhas/faixas, legendas, sincronização, narração, efeitos, composição, prévia e exportação).
- [ ] **Plugin Diazverso:** consultar como **referência somente de leitura**, aproveitando padrões de fluxos, qualidade, identidade, uso de agentes e economia de tokens quando pertinentes. **Não alterar o repositório do plugin nesta refatoração.**

### Análise de vídeos e práticas modernas de motion design
- [ ] Analisar vídeos, breakdowns, reels, showreels, tutoriais e projetos de motion design de alta qualidade, identificando **movimento, easing, keyframes, tipografia cinética, transições, composição, sincronização com áudio e ritmo narrativo**.
- [ ] Registrar somente técnicas úteis e exemplos reproduzíveis no Content Lab, preferencialmente como componentes TSX/Remotion e presets parametrizáveis, sem copiar sequências, mídias ou código sem licença.
- [ ] Adaptar a qualidade das referências à identidade visual do Diazverso (quadrinhos, halftone, painéis, paleta e glitch controlado). **Edição a serviço da narrativa; não adicionar efeitos sem função.**

### Repositórios open source de edição automatizada com IA
- [ ] Pesquisar aplicações e projetos em que um agente ou LLM (ChatGPT, Claude ou outros) produz roteiro, organiza mídias, cria um plano de edição/timeline e renderiza o vídeo automaticamente, mesmo que o exemplo original use API de IA.
- [ ] Investigar **como o código faz a edição de verdade**, e não apenas a interface de chat: representação de cenas, modelo de timeline, seleção de trechos, sincronização de narração, aplicação de efeitos, geração de legendas, renderização, cache, filas e recuperação de falhas.
- [ ] Avaliar arquiteturas de renderização declarativa ou baseada em JSON/EDL, integração com Remotion/FFmpeg e mecanismos que geram operações determinísticas a partir de planos estruturados.
- [ ] Identificar ideias aproveitáveis para o **Content Lab local**, substituindo dependências obrigatórias de APIs pagas/nuvem por controle direto do agente via CLI/MCP, quando viável.
- [ ] Conferir licença, atividade/manutenção, maturidade, compatibilidade com hardware local, facilidade de teste, segurança, desempenho e custos ocultos antes de reaproveitar código.
- [ ] Registrar links, comparação das opções, lições de implementação e justificativas das decisões no plano enquanto a pesquisa estiver em andamento. Não copiar projetos inteiros indiscriminadamente.

### Repositórios e documentação candidatos para benchmark (ainda não aprovados)
- HyperFrames (site e repositório): https://hyperframes.studio/ e https://github.com/heygen-com/hyperframes
- Remotion (render React/TSX e skills oficiais): https://www.remotion.dev/docs e https://github.com/remotion-dev/remotion
- FableCut (timeline JSON, edição visual e MCP): https://github.com/ronak-create/fablecut
- OpenChatCut (timeline multifaixa, MCP e Remotion): https://github.com/0xsline/OpenChatCut
- TS AI Video Editor (timeline compartilhada por humanos/agentes): https://github.com/ChopperD00/ts-ai-video-editor
- MCP TypeScript SDK v2 (`stdio` local): https://ts.sdk.modelcontextprotocol.io/v2/
- React Flow (candidato para representação visual de workflows, **não obrigatório**): https://reactflow.dev/

**Nenhum desses candidatos está aprovado para copiar código.** Inspecionar implementações, estabilidade, licenças (ex.: AGPL e licença específica do Remotion) e custo real antes da decisão; o próprio editor e motor devem permanecer 100% operáveis localmente. Uma interface visual de workflow não precisa obrigatoriamente de um grafo de nós.

**Distinção importante:** skills existentes serão **pesquisadas e consultadas desde o começo** para orientar a construção. As **skills próprias do Content Lab/Diazverso, destinadas a ensinar agentes a usar o produto final**, continuarão sendo criadas **somente na última etapa**, após o sistema estar funcional e validado.

## 5. Plano de ação — 12 tarefas macro (executar nesta ordem)

**Status:** [ ] pendente · [x] concluído. Não quebrar artificialmente em dezenas de tarefas; cada tarefa pode ter subtarefas técnicas internas no momento da execução. A pesquisa especializada ocorre antes da implementação de cada módulo, sem criar uma etapa burocrática separada para cada tecnologia.

### T01 — UX/UI, logo e conceito visual do novo Content Lab
- [x] Pesquisar skills de UX/UI, acessibilidade e design de frontend; analisar referências atuais de ferramentas criativas.
- [x] Criar identidade visual e proposta de logo **original** Content Lab (HQ/halftone/glitch sutil da marca Diazverso, sem Nox), componentes de interface e protótipos navegáveis.
- **Entrega/aceite:** design system e fluxo visual aprováveis; acesso a projetos/workflow/editor identificáveis e fáceis de compreender. **Primeiro foco.**

**Checkpoint T01 (2026-11-11):** protótipo React/Vite responsivo com entrada de projetos, workflow navegável, marca SVG original e design system documentado. Referências: WCAG 2.2, feedback de progresso e padrões de ferramentas criativas. Verificações: 2 testes de interface e build de produção. Próxima: T02, tornar projetos/workflow interativos com dados de demonstração explícitos.

### T02 — Frontend: projetos locais e workflow visual (sem dashboard)
- [x] Construir entrada simples para **criar, abrir, importar e retomar projetos locais** de múltiplos vídeos (longos ou curtos), sem dashboard; visualizar estados, progresso, histórico e ações dentro de cada projeto, quando relevantes.
- [x] Expor etapas, pendências, modos **revisão por fase** e **autônomo até a revisão final**, aprovação, solicitação de mudanças e retorno de etapa.
- **Entrega/aceite:** usuário abre um projeto e navega seu workflow de ponta a ponta com dados de demonstração, visualiza o estado e consegue simular aprovar, rejeitar e voltar de etapa.

**Checkpoint T02 (2026-11-11):** criação de projeto longo/Short, retomada de recentes, modos de revisão/autônomo, aprovação, pedido de mudanças, reabertura com invalidação comunicada e histórico, todos marcados como demonstração. Verificações: 4 testes de interface e build. Próxima: T03, editor de roteiro, packaging e thumbnails.

### T03 — Frontend: roteiro e metadados criativos do vídeo
- [x] Criar editor de roteiro com formato guiado alinhado ao plugin Diazverso (**consulta read-only**), autosave previsto, títulos A/B, descrição, tags e painel de thumbnails.
- [x] Permitir thumbnail gerada/criada na aplicação ou importada de fora, sem editor rígido.
- **Entrega/aceite:** fluxo visual completo para preparar e revisar um vídeo, sem campos desnecessários, com versão/estado de cada entrega.

**Checkpoint T03 (2026-11-11):** editor guiado separa narração e direção visual, mostra autosave/histórico e oferece packaging com títulos A/B substantivos, descrição, tags, SEO e conceitos/arquivos de thumbnail com estado e direitos. Estrutura consultada no plugin Diazverso v1.1.0 somente para leitura. Verificações: 5 testes de interface e build. Próxima: T04, benchmark técnico, arquitetura e contratos versionados.

### T04 — Benchmark técnico, arquitetura nova e contratos
- [x] Pesquisar e testar skills de arquitetura, testes, MCP, Remotion, Hyperframes e UX; revisar repositórios de editores com agentes **e estudar vídeos/showreels/tutoriais de motion design de alta qualidade**, registrando técnica, timing e adaptação original para a identidade Diazverso. Comparar o legado em `old/` sem tomar suas decisões como obrigatórias.
- [x] Escolher stack e módulos por evidência, compatibilidade local e licença; definir modelo versionado para projetos, workflow, roteiro, mídias e timeline, com plano de migração/validação.
- [x] Planejar operações atômicas, efeitos, trilhas, posicionamento responsivo, versionamento, logs, permissões e testes desde o começo.
- **Entrega/aceite:** documento curto de arquitetura + contratos validados em protótipo; referências e decisões registradas, sem depender de API paga.

**Checkpoint T04 (2026-11-11):** arquitetura local, módulos, limites de confiança, persistência e estratégia de testes documentados; benchmark compara Remotion, Hyperframes, FableCut, OpenChatCut, Timeline Studio e legado, incluindo licenças e motion design. Contratos Zod versionados para projeto, workflow, mídia, timeline e lotes atômicos. Verificações: 9 testes e build. Próxima: T05, persistência real e núcleo de workflow.

### T05 — Núcleo local, persistência e orquestração do workflow
- [x] Implementar projeto local multi-vídeo, armazenamento de arquivos e metadados, autosave, checkpoints/versões, histórico e retomada após reinício.
- [x] Implementar estados e dependências das etapas, aprovação humana, modo autônomo, reabertura de etapas e invalidação rastreável de resultados posteriores.
- [x] Conectar o frontend ao núcleo com operações testáveis e independentes da interface.
- **Entrega/aceite:** projeto real persistente sobrevive ao reinício; fluxo manual e revisões funcionam sem dados de demonstração.

**Checkpoint T05 (2026-11-11):** `ProjectStore` grava manifesto por rename atômico, snapshots imutáveis e journal; leitura por nova instância comprova retomada. Núcleo puro controla aprovação, pedido de mudanças, reabertura e invalidação transitiva com revisão otimista. Adaptador da UI persiste a lista local e mantém o núcleo independente. Verificações: 12 testes, incluindo reinício/conflito/histórico, e build. Próxima: T06, CLI e MCP sobre o mesmo núcleo.

### T06 — Controle local por agentes: CLI e MCP
- [ ] Implementar operações semânticas de alto nível para criar/inspecionar projeto, escrever/revisar roteiro, preencher metadados, manipular mídias/timeline, aprovar status quando autorizado e solicitar renders.
- [ ] Expor o núcleo por **CLI e MCP local**; avaliar primeiro MCP TypeScript SDK v2 com `stdio` para Codex/Claude Code, sem cloud obrigatória.
- [ ] Aplicar schemas, idempotência, dry-run/diff, operações em lote, respostas compactas, IDs de jobs, progresso e controles para impedir que agentes pulem aprovações.
- **Entrega/aceite:** agente local e usuário executam operações equivalentes, consistentes e verificáveis, com baixo gasto de tokens.

### T07 — Mídia: importação, cache, cortes e transcrição
- [ ] Importar URL e arquivo local; manter cache persistente, limpar sob comando, extrair/reaproveitar múltiplos cortes, associar fontes ao projeto.
- [ ] Integrar modelo único de transcrição de maior precisão **validado para português**, com alinhamento/legendas quando aplicável, sem instalação automática de modelos inferiores.
- **Entrega/aceite:** a mesma mídia produz diversos cortes sem download repetido; cache, transcrições, falhas e limpeza funcionam.

### T08 — Narração, clonagem de voz e tratamento de áudio
- [ ] Implementar gravação em takes, cortes, regravação, organização, edição e revisão da narração.
- [ ] Perfil de voz com amostra guiada e texto de leitura; geração/clonagem de voz local autorizada, avaliando modelos de ponta por qualidade real no português e hardware disponível.
- [ ] Tratamento de ruído/volume/inteligibilidade, trilha e efeitos sonoros integráveis.
- **Entrega/aceite:** um roteiro gera narração humana ou IA revisável e exportável, com qualidade testada.

### T09 — Editor novo: timeline unificada e motion design TSX
- [ ] Reconstruir timeline e JSON versionado com **camadas genéricas** (fundo é uma delas), pistas de vídeo/áudio, elementos, keyframes e transições.
- [ ] Corrigir layout 16:9/9:16 com ancoragem, crop/fit, safe areas e layouts alternativos, sem saltos inesperados.
- [ ] Oferecer edição visual e operações de agentes na mesma timeline; criação/importação de componentes **TSX Remotion** com pré-validação e biblioteca de efeitos reutilizáveis.
- **Entrega/aceite:** editar, desfazer, revisar e reproduzir projeto complexo nos dois formatos sem divergência entre JSON, UI e agente.

### T10 — Preview, render e confiabilidade audiovisual
- [ ] Implementar pré-visualização fiel, motion design, transições, sincronização de narração, legendas e mixagem, integrando FFmpeg/Remotion/Hyperframes conforme decisão do T04.
- [ ] Render por projeto/versão, cache incremental quando útil, acompanhamento de jobs, cancelamento, recuperação e validação do arquivo final.
- **Entrega/aceite:** vídeos longos e verticais renderizam com áudio, posicionamento, efeitos e cortes corretos, comparados com a prévia.

### T11 — Pacotes .contentlab, ZIP e entrega opcional por agentes
- [ ] Definir o formato de projeto portátil versionado **`.contentlab`** (extensão proposta), com manifesto/estrutura documentados e capacidade de **importar, abrir e descomprimir dentro do Content Lab**; incluir roteiro, títulos A/B, descrição, tags, thumbnails, legendas, timeline, ajustes e recursos necessários. Vídeo final e intermediários opcionais conforme tipo de exportação.
- [ ] Aplicar **compressão sem perdas tão eficiente quanto viável**, com algoritmos adequados por tipo de arquivo, nível de compressão configurável, deduplicação quando possível, verificação de integridade e proteção contra extração insegura. Testar redução de tamanho x tempo/uso de CPU; mídia já comprimida pode oferecer pouco ganho e não deve sofrer recompressão com perdas disfarçada.
- [ ] Oferecer **ZIP padrão como alternativa**, além do formato `.contentlab`, e permitir exportação enxuta para entrega/publicação manual (vídeo e metadados sem caches desnecessários).
- [ ] Definir gerenciamento simples de pacotes locais: escolher caminho, localizar, reabrir e excluir. **Guardar cópias extras automaticamente é uma opção a avaliar**, não um requisito que cause duplicação de arquivos grandes.
- [ ] Disponibilizar importação/exportação pela interface e CLI/MCP. Um **agente externo autorizado** poderá enviar o pacote ao Google Drive/atualizar planilhas depois, sem publicação automática nem hospedagem obrigatória.
- **Entrega/aceite:** pacote `.contentlab` e ZIP exportados, testados, restaurados e abertos localmente com arquivos íntegros; formato descrito em documentação permanente e futura skill.

### T12 — Instalador, testes finais, documentação, skills e limpeza
- [ ] Validar/verificar dependências na inicialização, instalar ausentes quando seguro, tentar novamente falhas transitórias, diagnosticar erros persistentes.
- [ ] Cobrir testes unitários, integração, E2E, fluxos manuais e com agentes, regressões 16:9/9:16, retomada, erros e desempenho; melhorar UX e documentar instalação, uso e arquitetura.
- [ ] **Só após estabilidade:** criar e testar as **skills próprias do Content Lab**, ensinando agentes a controlar o produto e **a reconhecer, importar, compactar, extrair e exportar `.contentlab` e ZIP**; planejar integração posterior ao plugin Diazverso **sem modificá-lo agora**.
- [ ] **Somente após todos os critérios aprovados:** remover `old/` e este plano temporário, preservando documentação permanente no novo projeto.
- **Entrega/aceite:** instalação e uso local reproduzíveis; todos os fluxos validados e nova aplicação autônoma, sem depender de código legado.

### Regras de aprovação e critérios transversais
- Cada tarefa macro termina com demonstração verificável e atualização de status, não apenas código escrito.
- **Humano e agente usam o mesmo núcleo e os mesmos dados**; evitar implementações duplas que causem divergência.
- Modo de aprovação por etapa pausa trabalho dependente até o usuário aprovar; modo autônomo permite progresso sem validações intermediárias, mas preserva revisão final. Ações externas sensíveis (como upload) continuam dependendo das autorizações aplicáveis.
- Voltar etapas não elimina histórico e marca conteúdos dependentes como necessitando atualização/validação.
- A UI é implementada primeiro (T01–T03), com dados de demonstração explícitos, antes da conexão definitiva ao núcleo (T05). **Sem dashboard: entrada simples para projetos e foco no workflow de cada vídeo.**
- A seleção do **melhor modelo** requer benchmark local, suporte a português, licença e capacidade de hardware; somente a opção escolhida será instalada, sem catálogo de modelos inferiores.
- Uso local e gratuito sem hospedagem obrigatória é requisito. Verificar licenças (especialmente componentes de renderização) antes de adotar qualquer base externa. **Pacotes `.contentlab` serão portáteis, íntegros, documentados e extraídos com segurança.**

## 6. Regras de trabalho

### Diretriz de interface, mensagens e código (obrigatória)
- **Sem explicações artificiais de IA no produto ou nas atualizações.** Instruções pontuais do usuário devem virar **comportamento/correção do sistema**, não slogans, textos, avisos ou comentários literais no frontend/código. Exemplo: uma regra sobre quantidade de takes da narração não precisa aparecer escrita na tela.
- Interface com linguagem objetiva, controles claros e mensagens apenas quando necessárias para estados, instruções práticas e erros acionáveis. Evitar texto de preenchimento, justificativas redundantes e comentários autorreferenciais.
- Código claro, modular, testável, com comentários **apenas onde agregam explicação técnica real**; não colocar narrativa de conversa em comentários, changelogs ou telas.
- Consultar skills de UX writing, frontend, revisão de código e arquitetura para orientar essa disciplina. Decisões técnicas temporárias ficam neste plano ou em registros apropriados, não poluem a experiência do usuário.

- Registrar decisões e pendências no plano enquanto a refatoração estiver em andamento.
- Diferenciar requisitos aprovados de sugestões técnicas sujeitas à avaliação.
- Não apagar nem substituir arquivos do legado sem preservá-los na migração inicial.
- Não adicionar hospedagem, APIs comerciais ou serviços pagos como requisitos obrigatórios.
- Não alterar o repositório do plugin Diazverso nesta etapa.
- Testar operações antes de declará-las concluídas.

## 7. Protocolo obrigatório de execução pelo Codex local

**Aplicação:** desenvolvimento do Content Lab no clone Git local da máquina do usuário. Este protocolo rege as tarefas T01–T12. O plugin `DanielHABDias/DiazVerso-Plugin` permanece **somente leitura** durante toda esta refatoração.

### Branch, sequência e commits
- [ ] Executar o desenvolvimento **somente na branch `main`**; não criar branches de feature, branches auxiliares ou PRs. A branch de preparação `refactor/content-lab-v2`, criada anteriormente, **não será utilizada** no desenvolvimento. A preparação já foi incorporada à `main`.
- [ ] Antes de iniciar, conferir `git branch --show-current`, `git status` e a origem; sincronizar a `main` com `git pull --ff-only` quando seguro. Não descartar alterações locais não versionadas, não forçar push e não sobrescrever trabalho concorrente.
- [ ] Avançar **autonomamente, em sequência, de T01 até T12**, sem exigir que o usuário diga "próximo" ou autorize cada nova tarefa. Fazer uma pausa apenas por bloqueio real, dependência indisponível, risco de perda de dados, limite de ferramenta ou decisão essencial que não possa ser resolvida responsavelmente.
- [ ] Para **cada tarefa macro T01–T12**, implementar seu escopo, executar verificações/testes pertinentes, atualizar o checklist e registrar **um único commit ao final da tarefa**, com mensagem objetiva, por exemplo `feat(T01): estabelecer identidade e UX do Content Lab`. Subetapas internas não geram commits separados.
- [ ] Depois do commit válido, **iniciar automaticamente a tarefa seguinte**. Se testes falharem, corrigir antes de considerar a tarefa concluída; não declarar sucesso nem realizar commit de entrega quebrada. Se não puder concluir, deixar um checkpoint claro e registrar o bloqueio sem inventar aprovação.

### Protocolo obrigatório de contexto e economia de tokens
Usar **as técnicas concretas do plugin Diazverso**, não apenas dizer que está otimizando. Consultar o repositório público [DiazVerso-Plugin](https://github.com/DanielHABDias/DiazVerso-Plugin) ou sua instalação local **apenas para leitura**, principalmente:

- `skills/diazverso-contexto-eficiente/SKILL.md` — **protocolo principal obrigatório**, lido uma vez por sessão e versão; reutilizar contexto válido.
- `skills/diazverso-contexto-eficiente/references/skill-map.json` e `scripts/context_map.py` — **grafo/mapa de skills, dependências, caminhos, hashes e indexação incremental** para escolher a skill responsável; usar quando houver ambiguidade/mais de uma candidata. Sem executor, consultar o mapa diretamente.
- `skills/diazverso-contexto-eficiente/references/roteamento.md` e `scripts/route_request.py` — roteamento por resultado esperado quando necessário, sem abrir o catálogo inteiro.
- `skills/context-optimization/SKILL.md` — técnicas avançadas de **consulta limitada, resumo de observações, checkpoints, prefixos estáveis e particionamento** somente quando adequadas à tarefa e suportadas pela ferramenta.

**Regras práticas obrigatórias:**
1. Definir o resultado verificável da tarefa e a próxima ação. Escolher **uma skill principal** e carregar apenas suas dependências concretamente necessárias; não carregar todas as skills, repositórios ou logs de uma vez.
2. Navegar pelo **grafo de skills e dependências**, preferindo metadados antes dos arquivos completos. Reutilizar leitura se a revisão/hash for válida; revalidar a fonte real antes de alterações importantes.
3. Ler trechos específicos de arquivos e diffs necessários; reduzir saída de ferramentas a **decisão, evidência, erro relevante e caminho recuperável**. Não suprimir informação útil ao depurar.
4. Ao fechar cada tarefa, manter **checkpoint curto** (tarefa, commit, verificações, decisões técnicas, pendências e próxima tarefa), no plano temporário enquanto existir. O checkpoint ajuda a retomada, mas **não equivale à compactação interna do contexto**.
5. Agrupar implementação + testes proporcionais + atualização do plano num resultado funcional; evitar releituras, scaffolding sem necessidade, refatoração fora de escopo e relatórios verbosos.
6. Medir tokens e custo real **apenas se houver telemetria**; não inventar percentuais de economia, taxas de cache ou capacidade de controlar compactação/KV-cache interna do Codex. Aproveitar comandos de compactação nativa **somente se o ambiente realmente os oferecer**.

O objetivo é minimizar **o custo total para entregar uma tarefa correta**, incluindo repetição e retrabalho. A economia de tokens nunca justifica pular testes, ocultar falhas, perder decisões ou degradar o código.

### Segurança e encerramento
- Manter o legado preservado em `old/` até a T12; não tocar no repositório do plugin Diazverso.
- Preservar históricos, licenças, consentimentos, direitos de mídia e dados privados; não enviar arquivos locais a serviços externos sem autorização.
- A cada tarefa, fazer commit na `main` e, havendo remoto e permissão, enviar com push normal (sem force). Um push recusado por divergência exige inspeção e reconciliação antes de tentar novamente.
- Ao concluir T12, só apagar `old/` e este plano depois dos testes e documentação permanente confirmados.
