# Skills de autoria do Content Lab

## Entrada de produção completa (Diazverso)
**Diazverso — Criação de Vídeo** (`skills/diazverso-criacao-video/SKILL.md`) é a skill principal para orquestrar **todo o ciclo**: tema → títulos A/B, tags e descrição → thumbnail → roteiro/revisão → narração → assets/direção → `edit_plan.json`/render e revisão → finalização do longo → Shorts derivados. Em cada etapa há **QA interno antes da aprovação do criador**, registro privado de estado e retomada onde parou. Consultar também `skills/diazverso-criacao-video/references/ESTADO_E_GATES.md`.

Ela **não substitui** os módulos de execução nem a entrada de edição. Para uma tarefa restrita à edição, continua valendo `diazverso-direcao-edicao` no Drive; para trabalho genérico do ContentLab, usar `contentlab-direcao`. As skills de pesquisa/títulos/thumb/roteiro/Shorts do Diazverso podem estar em **IA/Skills do Google Drive** e são lidas conforme a fase, não copiadas para dentro da orquestradora.

## Entrada única
**Content Lab — Direção** (`skills/contentlab-direcao/SKILL.md`) é a porta de entrada. Recebe o objetivo e lê apenas os módulos necessários. A skill antiga monolítica `contentlab-edicao`, antes embutida em `server/skill.mjs`, foi substituída por arquivo canônico e módulos para evitar divergências.

## Módulos
- `contentlab-composicao`: narrativa espacial, foco, tipografia, formatos e câmera.
- `contentlab-motion`: coreografia, keyframes, easing, stagger, continuidade.
- `contentlab-cenas-tsx`: gera um único componente Remotion para cena complexa e um pequeno trecho JSON, minimizando tokens.
- `contentlab-timeline-audio`: voz, beats, transcript, SFX e música.
- `contentlab-contrato`: autoria e validação do JSON único.
- `contentlab-revisao`: inspeção visual, áudio, QA e feedback.
- `diazverso-video`: perfil editorial de marca Diazverso.
- `gsb-contentlab`: integração com o GSB, dependente das instruções específicas existentes.

## Distribuição
O download **Skill .zip** do aplicativo oferece o `SKILL.md` da Direção na raiz e os módulos em `skills/<slug>/SKILL.md`, além do mesmo schema, documentação e exemplos do Content Lab. O pacote completo permite ao agente ler módulos específicos conforme a tarefa.

Estes módulos também podem ser utilizados individualmente por agentes que trabalham diretamente no repositório, mas não devem ser confundidos com plugins ChatGPT instalados automaticamente apenas por estarem versionados no GitHub.

## Cenas TSX programáveis — fluxo de baixo custo
Para movimento contínuo complexo, solicitar ao ChatGPT **um arquivo TSX completo** em vez de dezenas de objetos JSON. Baixar/salvar em `custom-scenes/MinhaCena.tsx` dentro do projeto e apontar `timeline[].customComponent.module` para `project://custom-scenes/MinhaCena.tsx`. Pedir apenas o fragmento `customComponent` (ou uma cena) se já houver plano; não regenerar arquivos extensos.

`props` contém dados JSON; `assets` contém URIs locais nomeadas. `mode: "replace"` usa a composição TSX inteira; `mode: "overlay"` mantém as camadas normais atrás. O código **não** é instalado automaticamente pelo site, mas renderiza sem configuração extra quando está em `custom-scenes/`. TSX é executável e não possui sandbox: use somente componentes confiáveis. Validar JSON, renderizar, inspecionar frames e áudio. Exemplo: `examples/custom-scenes/FollowDot.tsx`.

## Direção de arte contemporânea
O repertório **Modern Editorial UI** deriva do CSS existente do Studio: interfaces limpas, fundos branco-gelo/grafite, cinzas, cards com raio e sombra sutis, acentos discretos e tipografia de sistema. `contentlab-composicao` define visual/organização; `contentlab-motion` define suavidade, timing e coreografia; `contentlab-cenas-tsx` materializa composições complexas. `diazverso-video` adapta isso à marca. Fonte Apple no CSS significa fallback do sistema, **não fonte SF Pro distribuída**.

## Manutenção
- Mudar conteúdo das skills aqui; não voltar a embutir orientações extensas em `server/skill.mjs`.
- Manter `AGENTS.md`, schema, documentação gerada e testes como referências para compatibilidade.
- A skill de Diazverso usa o Master Context privado/projeto quando disponível, não o copia automaticamente para este repositório público.
- Se houver uma skill anterior do Diazverso ou do GSB fora do repositório, fazer comparação e migração antes de apagá-la.

## Aprendizado de motion TSX no Diazverso

Para o perfil Diazverso, a antiga preferência por muitos TSX complexos foi REVOGADA em 15/10/2026. O padrão vigente é montagem de cenas reais, artes completas em movimento suave, PNGs com animação discreta e poucos componentes HQ reutilizáveis; trajetórias 2.5D/mapas/splits continuam opcionais apenas quando realmente necessários. **A entrada do elemento deve estar concluída até o fim da palavra citada** (idealmente antes do início), com hold legível durante a fala. Para material real pertinente, um corte simples ainda pode ser a melhor decisão.

Exemplos de referência na pasta VD_0005: `PerguntaAbertura`, `ConflitoCentral`, `OutraRazao`, `LegadoEmRede`, `ArgumentosEmConflito`, `ConstelacaoFamilia`. Consultar `contentlab-cenas-tsx/references/REPERTORIO_MOTION_TSX.md` antes de projetar movimentos novos. Não confundir TSX custom da pasta do vídeo com presets globais do motor.

## Revisão obrigatória de som e edição automática (2026-10)

Cada movimento/animação editorial recebe cobertura sonora; no perfil Diazverso o ataque audível deve acompanhar o **meio** do gesto, não antes nem no primeiro frame como automatismo. SFX pode durar menos/mais que a ação visual, com tail natural; se estiver excessivamente longo, encurtar com `config.duration` e `fadeOut`, não cortar seco. Variar família de sons, não repetir sempre o mesmo whoosh, nem duplicar efeitos existentes em CTA/Nox. Ver `contentlab-timeline-audio`, `contentlab-motion`, `contentlab-revisao` e `contentlab-revisao/references/AUDITORIA_COMPLETA_PRE_E_POS_RENDER.md`.

A skill já existente `contentlab-revisao` passa a ser gate obrigatório pré-render (para liberar edição automática) e pós-render (para aprovar o vídeo final). No Diazverso, `diazverso-revisao-edicao`, mantida nas skills específicas do Drive, acrescenta QA de identidade autoral.


## Catálogo atualizado de reutilização, música e futura linguagem HQ

- [Auditoria de reutilização dos TSX do VD_0005](../VD0005_REUSABLE_REVIEW.md): diferencia núcleo reaproveitável de cenas/diálogos particulares e preserva o vídeo fechado.
- [Exemplos TSX](../examples/custom-scenes/): `NarrativePath`, `EvidenceConstellation`, `PixelNotification`, `ComicMotionKit`. Os arquivos precisam ser copiados para `custom-scenes/` do projeto novo; não são automaticamente componentes da UI.
- [Música e importação local](../MUSIC_LIBRARY_DIAZVERSO.md): três faixas já presentes, três candidatas a importação privada e alerta de direitos autorais.
- Para próximos vídeos Diazverso: adotar HQ simples com caixas de narrador branca/amarela com sombra, halftone, Anton, Bangers e fonte Avengers verificada para os TSX, sem balões como padrão. A montagem com cenas e ilustrações é a base; preservar VD_0005 concluído.

## Regras Diazverso revisadas em 15/10/2026

A entrada canônica para projetos de marca neste repositório é [`diazverso-video`](diazverso-video/SKILL.md), coordenada por [`diazverso-criacao-video`](diazverso-criacao-video/SKILL.md) para produção completa. Mudanças principais: poucos TSX, edição simples; Shorts com explosão Minecraft, legenda Bangers, riser só para tensão, whoosh/blur e CTA `ComicPageCTA`; longos com cenas relevantes, imagens sempre em zoom/pan sem borda preta, CRT em filmes/animações (não jogos), Nox/Anton e CTA HQ. Whoosh varia em deslizes, click/pop/bling em aparições, pico de SFX no meio do movimento; Metallic Riser NUNCA em slide. Música de Shorts é preferência autoral, não licença.

As skills específicas do Diazverso mantidas no **Drive/IA/Skills** podem ter espelhos desatualizados até sincronização explícita. O documento de consolidação no Drive ID `documento de consolidação em IA/Skills no Drive privado` registra decisões e exceções. Não apagar/renomear skills específicas por causa das cópias do ContentLab. Para arquivos específicos de Drive ainda não sincronizados, o criador deve aplicar a atualização textual quando a integração de edição Markdown estiver disponível. Não declarar que um espelho foi modificado só porque o GitHub mudou.
