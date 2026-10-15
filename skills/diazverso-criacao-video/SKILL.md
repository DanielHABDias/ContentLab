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
Responsáveis: `diazverso-thumbnail`, `diazverso-nox` se necessário. Saída: 2–3 propostas que complementem os títulos, com padrão aprovado de personagem principal central e destacado e uma palavra grande/curta e legível; considerar contraste, hierarquia, ângulo visual, assets e opções A/B. Variações sem texto só quando solicitadas/justificadas; produzir imagem e revisar no mobile quando o criador pedir.
QA: teste de 1 segundo, redução mobile, coerência entre título/thumb, legibilidade, identidade, direitos e rastreabilidade do arquivo.
**Gate L2:** aprovar conceito (e arte final, quando já disponível). **Não colocar texto de conceito na coluna `THUMBNAIL`**: ela representa link de arquivo final. Se o roteiro mudar substancialmente a tese, reabrir gates L1/L2.

### L3 — Roteiro longo
Responsáveis: `diazverso-roteiro` + `diazverso-revisao-roteiro`. Entregas: outline, hook e progressão problema central → exemplos da obra → perguntas e novos problemas derivados ao longo dos blocos, com fatos verificáveis, contrapontos, pagamento da promessa, CTA e texto narrável. QA: precisão, lacunas de evidência, sequência lógica, oralidade, retenção, proporção de duração, sem alteração da promessa aprovada sem aviso.
**Gate L3:** usuário aceita ou comenta. Após aprovar, salvar roteiro canônico e somente então registrar link na coluna `ROTEIRO`; refinar a descrição com fatos, capítulos planejados e fontes, sem inventar timecodes.

### L4 — Narração preparada e minutagem
Responsáveis: `diazverso-narracao`, `contentlab-timeline-audio`. Confirmar versão gravada, duração real, `transcript.json` e timing de palavras/segmentos antes de definir beats. Narração é feita/fornecida pelo criador conforme seu processo, não presumir TTS. QA: correspondência áudio/texto e pausas; não regenerar falas aprovadas.
**Gate L4:** criador confirma áudio preparado e eventuais retrabalhos.

### Especialistas transversais (roteamento explícito)
- `diazverso-musica-pesquisa`: **L5-A**, quando trilha não foi definida, pesquisa opções, biblioteca do Drive, origem, licenças e necessidade de créditos. Não confundir com composição sonora.
- `diazverso-musica-sfx`: **L5/L6/S4**, define função da música, transições, SFX por gesto, timing, ducking, fades e mix. Encaminha direitos à skill de pesquisa musical.
- `diazverso-revisao-edicao`: **gate obrigatório L6/S4** antes e depois do render, cumulativo à `contentlab-revisao`; nenhuma aprovação final sem inspeção visual e escuta.
- `diazverso-nox`: L2/L5/S4 quando Nox aparece, aplicando Character Lock e asset aprovado.
- `diazverso-analise-performance`: **P1 opcional pós-publicação**, usa Analytics efetivos para retroalimentar a próxima pesquisa de temas; nunca inferir números.
- `diazverso-instagram`: **P0 opcional de divulgação**, somente se o criador desejar post, Stories, carrossel ou anúncio; não obrigatório para marcar vídeo concluído.
- `gsb-contentlab` é perfil de **outra configuração/marca**, não um filho do workflow Diazverso. É mantido para a entrada geral `contentlab-direcao` e não deve ser apagado apenas por não aparecer nas etapas L/S.
- `diazverso-video` é perfil de marca no repositório ContentLab, carregado por `contentlab-direcao`; difere da gateway de edição do Drive e não deve ser excluído por aparente duplicidade.

### Direção editorial vigente — 15/10/2026

A atualização aprovada pelo criador substitui instruções anteriores que incentivavam excesso de TSX. Em longos e Shorts, o vídeo deve ser montado principalmente de cenas reais pertinentes e ilustrações completas com pan/zoom suave, alternando PNGs e quadros gráficos comedidos, sem repetição excessiva de tomadas ou spoilers. **Poucos TSX padronizados** com molduras HQ, halftone, personagem que entra em quadro, Bangers; Anton grande continua para frases de impacto sobre fundos sólidos ou clipes escurecidos. Retângulos de narrador branco/creme com etiqueta amarela e sombra preta serão recorrentes. Não criar TSX só para aplicar uma textura repetida; pode usar overlay gráfico transparente de imagem reutilizável.

Longos: TSX em 16:9; cena conserva aspecto original; filtro de TV sobre filmes/animações, **não** jogos. Nox grande em cenas de opinião, oscilação suave e legenda especial abaixo. CTA HQ nova de like/inscrição/sino no canto superior direito, com hold mínimo de cinco segundos e click/sino/wooshes sincronizados; não substituir as CTAs Nox aprovadas. Cartela de capítulo apenas em vídeos que recontam jogos em capítulos, SOBRE cena com áudio original, seguida de corte para narração.

Shorts: gancho com explosão Minecraft sobreposta, metallic riser para tensão e whoosh+blur de virada, trilha entrando em seguida. Legendagem Bangers obrigatória logo abaixo do centro, contorno fino e sombra. Motion HQ leve sobre cenas, com CTA final reutilizável baseada apenas no `ComicPageCTA.tsx` aprovado do SH_0005; do `DiazversoHQEditorial.tsx`, usar apenas hook/caixas/lettering aprovados, retirando barra amarela inferior do hook. Demais experimentos TSX do SH_0005 não são padrões aprovados.

SFX: whoosh variado para movimento/deslize, pop/click/bling para aparição ou interação, sino para bell; **metallic riser somente para tensão**, nunca deslize. O som útil coincide com o **meio da animação**, não antes nem no primeiro frame por padrão. QA exige escuta do render. A seleção musical de Shorts (Bully 2 temas, L's Theme A, Kuroi Light, GTA IV, GTA San Andreas e GTA V Welcome to Los Santos) é preferencial, sujeita a direito autoral; não confundir arquivo em 'NoCopyright' com licença.

Consultar o documento de consolidação do Drive (ID `1R-fldN8Pni77DYIJd5yvPZCdwM1JAue-Yi_JBMW0GBQ`) e o perfil `diazverso-video`. Estes comandos orientam as especializadas ainda que seus espelhos no Drive estejam aguardando sincronização. Preservar a produção já concluída VD_0005. Não criar novos TSX/assets agora; os templates serão elaborados com Codex posteriormente.

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

## Etapas opcionais após publicação
- **P0 — divulgação complementar (opt-in)**: quando o criador optar por Instagram, acionar `diazverso-instagram` para post, Stories ou carrossel com título/thumb e link do vídeo já aprovados. Aplicar QA interno, pedir aceite humano e **não presumir publicação automática**. Esta etapa pode acontecer depois do longo, durante Shorts ou ao final.
- **P1 — análise de performance (opt-in ou revisão posterior)**: quando houver estatísticas reais após publicação, acionar `diazverso-analise-performance` para CTR por contexto, retenção, distribuição, hipóteses e aprendizados. Relacionar a `Temas futuros` e packaging futuro somente depois de revisão e aprovação; não alterar decisões históricas com base em poucos dados.
As etapas P0/P1 não bloqueiam a finalização do longo ou dos Shorts; podem ter estados próprios de `not_started`, `awaiting_user`, `approved`, `skipped`.

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
