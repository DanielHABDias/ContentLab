---
name: diazverso-criacao-video
description: "Orquestradora principal da produção completa do Diazverso: seleção e pesquisa de tema, títulos A/B e metadados, thumbnail, roteiro, narração, direção/edição, QA, publicação e Shorts derivados. Coordena skills especializadas, valida autonomamente antes de pedir aprovação humana e salva progresso para retomar sem refazer etapas."
metadata:
  brand: diazverso
  version: "1.0"
  role: orchestrator
---

# Diazverso — Criação de Vídeo | Orquestradora de ponta a ponta

## Ativação
Use quando o criador pedir "criação de vídeo", "criar um vídeo do zero", "seguir o workflow do Diazverso", "retomar produção" ou "produzir longo e shorts". Esta é a entrada da **produção editorial completa**. Para edição isolada, `diazverso-direcao-edicao` continua sendo a gateway; para operações genéricas do motor, `contentlab-direcao` permanece a entrada do ContentLab.

A orquestradora **não substitui** as skills especializadas, não copia suas instruções e não cria uma segunda fonte de regras. Lê e executa cada skill específica quando a etapa chegar, respeitando as versões e a hierarquia oficiais. Skills são instruções, não subprocessos executáveis: se o runtime não disponibilizar uma skill como ferramenta, ler seu `SKILL.md` na pasta IA/Skills do Drive ou no repositório acessível, e explicitar qualquer indisponibilidade. Não afirmar que invocou uma skill se apenas inferiu seu comportamento.

## Hierarquia e segurança
1. Pedido explícito atual > regras de segurança e permissões > `DIAZVERSO_MASTER_CONTEXT.md` vigente > skill especializada da etapa > esta orquestradora para **ordem, estados e aprovações** > exemplos.
2. Canal **Diazverso** com Z; preservar identidade de escrita, Nox e direção de arte atual definida na skill de edição.
3. Nenhuma mutação na planilha, criação de novos IDs, postagem no YouTube, compra, eliminação de assets ou substituição de arquivos aprovados sem base verificada e a autorização exigida para a etapa.
4. Preferir recuperar trabalho existente. Não pedir dados já obtidos e não refazer pesquisa, thumbs ou textos aprovados por padrão.
5. Recursos privados do Drive, IDs e nomes de arquivos locais **não devem ser copiados para repositórios públicos** ou consultas de pesquisa na web.

## Regra-mãe: revisão interna → apresentação → aprovação humana → persistência → próxima etapa
Cada etapa tem cinco atos inseparáveis:
1. Ler entradas aprovadas e executar a skill responsável.
2. **Revisão interna obrigatória**: checar fatos/fontes, contradições, identidade, aderência ao briefing e ao resultado da etapa anterior; acionar a skill de revisão pertinente quando existir; corrigir e repetir se necessário.
3. Entregar ao criador uma **síntese curta + resultado concreto + decisões que realmente precisam de aprovação**; não pedir um formulário para cada detalhe.
4. Aguardar decisão expressa: `aprovado`, `aprovado com ajustes` ou `revisar`. Para feedback parcial, revisar somente a parte rejeitada e as dependências afetadas.
5. Com aprovação, salvar o artefato canônico, registrar prova/link/data/gate no estado, atualizar a planilha **apenas nos campos apropriados** e avançar. Nunca interpretar silêncio como aprovação.

Se o criador quiser pular etapa, registrar a exceção, sua justificativa e dependências pendentes. O fato de um arquivo existir não indica aprovação.

## Começo de cada sessão: descobrir ou retomar
1. Consultar o registro de andamento de uma produção existente; identificar `VD_XXXX`, pasta canônica, links dos aprovados, `current_stage`, `pending_approval` e bloqueios. Mostrar em uma frase de onde vai retomar.
2. Localizar no Drive a planilha **Canal do YT** por nome/MIME e confirmar as abas reais `Temas futuros`, `Videos Longos` e `Shorts`. Não embutir ID privado na skill.
3. Consultar `Temas futuros` antes de propor novos temas: campos `ID, TEMA, TÍTULO PRINCIPAL, THUMB, CONTEXTO / TESE, POR QUE É BOM, OBSERVAÇÃO / TIMING, STATUS`. Considerar temas pendentes e evitar repetir franquia/tese muito recentemente.
4. Examinar linhas relevantes de `Videos Longos` e `Shorts` para evitar duplicação de IDs, temas e promessas. Um `FINALIZADO` existente é indicador da planilha, **não** substitui o andamento detalhado deste workflow.
5. Caso seja uma produção nova, apresentar inventário de pendências + alternativas de tema; iniciar estado de rascunho **sem criar uma nova linha oficial** antes do usuário escolher.

## Etapas do vídeo longo

### L0 — Pesquisa e priorização de tema
Responsável: `diazverso-pesquisa-temas`. Entradas: temas futuros, vídeos anteriores, sinais de demanda e fontes externas atualizadas. Saída: 3–5 teses priorizadas, evidência, risco de saturação, promessa viável e recomendação. QA: fontes, atualidade, precisão factual, distinção fato/rumor, comparação com ideias antigas.
**Gate L0:** criador escolhe/ajusta uma tese. Não decidir sozinho nem marcar tema como escolhido na planilha antes da confirmação.

### L1 — Packaging inicial: títulos A/B, descrição e tags
Responsáveis: `diazverso-titulos`, `diazverso-youtube-publicacao` quando aplicável. Primeiro determinar promessa, público/Busca vs Home e concorrência; depois propor duas formulações **A e B** que cumpram a mesma tese. Preparar tags e **rascunho** de descrição coerentes com a promessa, deixando capítulos/fontes/links pendentes para preencher após roteiro e edição.
QA: sem clickbait enganoso; A/B testam hipóteses diferentes, não sinônimos; tags relevantes, não spam; nome e entidades corretos; palavras-chave não substituem promessa clara.
**Gate L1:** aprovar A/B, tags e direção descritiva. Registrar em `Videos Longos` após aprovação em linha confirmada: `TITULO`, `TAGS` e `CONTEXTO`; `DESCRIÇÃO` só quando o conteúdo estiver pronto ou em registro explicitamente marcado como rascunho. A coluna de título já aceita variantes `A / B`; preservar a convenção. Não sobrescrever informação de outro vídeo.

### L2 — Thumbnail: direção e criação
Responsáveis: `diazverso-thumbnail`, `diazverso-nox` se necessário. Saída: 2–3 propostas que complementem os títulos, texto curto ou ausência de texto, sujeito principal, contraste, hierarquia, ângulo visual, assets necessários e opções A/B; quando o criador pedir a peça, produzir arquivo de imagem e avaliar mobile.
QA: teste de 1 segundo, redução mobile, coerência entre título/thumb, legibilidade, identidade, direitos e rastreabilidade do arquivo.
**Gate L2:** aprovar conceito (e arte final, quando já disponível). **Não colocar texto de conceito na coluna `THUMBNAIL`**: ela representa link de arquivo final. Se o roteiro mudar substancialmente a tese, reabrir gates L1/L2.

### L3 — Roteiro longo
Responsáveis: `diazverso-roteiro` + `diazverso-revisao-roteiro`. Entregas: outline, hook, blocos, tese, fatos verificáveis, contrapontos, pagamento da promessa, CTA e texto narrável. QA: precisão, lacunas de evidência, sequência lógica, oralidade, retenção, proporção de duração, sem alteração da promessa aprovada sem aviso.
**Gate L3:** usuário aceita ou comenta. Após aprovar, salvar roteiro canônico e somente então registrar link na coluna `ROTEIRO`; refinar a descrição com fatos, capítulos planejados e fontes, sem inventar timecodes.

### L4 — Narração preparada e minutagem
Responsáveis: `diazverso-narracao`, `contentlab-timeline-audio`. Confirmar versão gravada, duração real, `transcript.json` e timing de palavras/segmentos antes de definir beats. Narração é feita/fornecida pelo criador conforme seu processo, não presumir TTS. QA: correspondência áudio/texto e pausas; não regenerar falas aprovadas.
**Gate L4:** criador confirma áudio preparado e eventuais retrabalhos.

### L5 — Direção, assets e guia de edição
Entrada da fase: `diazverso-direcao-edicao`, que delega `diazverso-edicao-decupagem`, `contentlab-composicao`, `contentlab-motion`, música/SFX e Nox. Preparar mapa de cenas, prioridade de footage real, screenshots/PNG de personagens, fontes, trilhas, licenças e pontos de coleta. Sempre indicar **asset já disponível / reutilizável / precisa baixar / indisponível** e sua função exata no roteiro.
**Gate L5-A:** criador aprova direção e lista de coleta. Esperar confirmação de assets coletados ou propor alternativas verificadas; não inventar paths `project://`.
**Gate L5-B:** conferir arquivos reais e aprovar mapa de assets; só então gerar plano.

### L6 — Edit plan, componentes TSX e render
Responsáveis: `contentlab-contrato`, `contentlab-cenas-tsx` quando realmente agrega, `contentlab-motion`, `contentlab-timeline-audio`, `contentlab-revisao`, mais revisão da identidade Diazverso. Criar `edit_plan.json` compatível com schema real, `custom-scenes/*.tsx` necessários e guia com mapa de transições/som; validar caminhos, duração, tipo de cena, ordem de composição e fonte.
**Gate de QA interno L6:** validar JSON, compilar TSX, checar frames início/meio/fim, sincronismo e mix real **quando render disponível**. Validação sintática não é aprovação visual. Se render não foi possível, declarar pendência e impedir status `qa_aprovado`.
**Gate humano L6:** usuário renderiza no ContentLab, envia feedback, refaz-se **apenas o que falhou** e repete QA até `edição aprovada`. Toda nova mudança em título/roteiro reabre os gates dependentes; revisão estética não reabre texto aprovado sem necessidade.

### L7 — Finalização/publicação do longo
Responsáveis: `diazverso-youtube-publicacao` + revisão final. Conferir thumb final, A/B de título, descrição final/hashtags, `TAGS`, links, capítulos medidos, créditos, miniatura, vídeo relacionado e export. O ato de subir/publicar depende de autorização separada; nunca declarar publicação porque MP4 foi renderizado.
**Gate L7:** criador confirma `vídeo longo concluído` ou publicação. Só então atualizar `FINALIZADO` e `LINK FINAL` se corresponder à prática aprovada da planilha; salvar `GUIA DE EDIÇÃO` canônico e disparar derivação de Shorts. Os status da planilha não são substitutos dos gates.

## Pipeline dos Shorts derivados
### S0 — Seleção de microteses
Responsável: `diazverso-shorts` e pesquisa contextual. Usar roteiro **aprovado** e o catálogo do longo. Propor 1–6 Shorts ou quantidade pedida, cada um com microtese que se sustenta sozinha, hook, payoff e conexão com `VD_XXXX`, evitando miniaturas de capítulos repetidos.
**Gate S0:** aprovar quantidade e microteses; reservar `SH_XXXX` distintos apenas após confirmação.
### S1 — Packaging próprio por Short
Usar `diazverso-titulos`, `diazverso-thumbnail` e publicação, agora adaptados a Shorts: título e descrição/tags próprios, thumbnail quando útil, CTA/vídeo relacionado apontando para o longo certo. QA por Short; aprovação humana por lote quando as opções estiverem claras.
### S2 — Roteiro e narração dos Shorts
Usar `diazverso-shorts` (não aplicar cegamente duração/estrutura da skill de roteiro longo), `diazverso-narracao`, `contentlab-timeline-audio`, revisão do roteiro. Cada microtese deve sustentar entrada, contexto mínimo, virada, payoff, CTA, sem reduzir Short a anúncio do vídeo longo.
### S3 — Reutilização responsável dos assets do longo
Criar catálogo `asset_origem → Short(s) → caminho no projeto local` com fonte/licença/corte relevante; **reusar sem baixar de novo quando possível**. O render do ContentLab só deve receber `project://` válido sob a pasta do Short: não presumir resolução automática de caminhos no `assets/` do longo. Copiar, linkar ou preparar assets compartilhados conforme o mecanismo local verificado; validar todos os caminhos e não duplicar mídia sem necessidade.
### S4 — Direção, edit_plan, QA e aceite
Usar a mesma cadeia especializada L5/L6, respeitando o padrão **9:16** e as regras atuais de abertura/overlay Minecraft/riser, transição, trilha e CTA (não transplantar essas regras para longo). Revisar por Short, renderizar/inspecionar quando possível e repetir correções até aceite explícito.
**Gate S4:** usuário aprova cada Short como concluído, podendo aprovar lote, e somente então o workflow encerra e registra `SH_XXXX` na planilha correspondente. Não marcar `FINALIZADO` por JSON/TSX compilarem.

## Contrato da planilha e persistência
Abas observadas: `Temas futuros`, `Videos Longos`, `Shorts`.
- `Temas futuros`: ID, TEMA, TÍTULO PRINCIPAL, THUMB, CONTEXTO / TESE, POR QUE É BOM, OBSERVAÇÃO / TIMING, STATUS.
- `Videos Longos`: ID, CONTEXTO, TITULO, THUMBNAIL, ROTEIRO, DESCRIÇÃO, PRIMEIRO COMENTÁRIO, TAGS, LINK FINAL, FINALIZADO, GUIA DE EDIÇÃO.
- `Shorts`: ID, CONTEXTO, TITULO, THUMBNAIL, ROTEIRO, DESCRIÇÃO, TAGS, LINK FINAL, FINALIZADO, GUIA DE EDIÇÃO.
- Resolver IDs/linhas pelo valor da coluna `ID`, **não** por posição fixa. Antes de escrever ler linha atual, mesclar apenas colunas aprovadas, mostrar conflito e preservar fórmulas/links/validação. Nunca usar linhas `TRUE` como indicadores internos de roteiro ou thumbnail aprovados.
- Registro detalhado de aprovação e etapas fica no arquivo `workflow_estado.json` ou `workflow_estado.md` **privado**, dentro da pasta canônica de produção, sob `Guia de Edições/Vídeos Longos/VD_XXXX`; Shorts derivados também mantêm registros individuais ou ligação ao registro do longo. Não criar múltiplas cópias canônicas. `workflow_estado` **é um registro de processo**, não campo novo de `edit_plan.json`. Ver `references/ESTADO_E_GATES.md`.
- Não alterar o layout/colunas da planilha apenas para introduzir o workflow. Confirmar se o arquivo já existe antes de criar.

## Como responder em cada interação
Apresentar `Projeto — etapa atual — resumo da revisão interna — proposta/revisão — única decisão solicitada — o que acontece após aprovação`. Em etapas extensas, oferecer artefatos completos sem ocultar ressalvas. Se o usuário responder `aprovado`, avançar exatamente um gate; se `altere X`, revisar X, checar impactos e apresentar novamente. Não despejar o pipeline inteiro em um turno nem executar etapas irreversíveis sem permissão.

## Condições de conclusão
Produção completa só termina quando **longo aceito** + **Shorts aprovados ou dispensados explicitamente** + registros consistentes; publicação é estado adicional distinto. Em toda parada/resumo: mostrar etapa atual e próximo passo, com registro canônico atualizado. Se faltar conector, render ou dado, informar pendência sem inventar sucesso ou prometer trabalho assíncrono.
