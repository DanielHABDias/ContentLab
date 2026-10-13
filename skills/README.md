# Skills de autoria do Content Lab

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

Em cenas explicativas autorais, TSX virou opção prioritária quando melhora a compreensão: câmera sobre um palco maior que a tela, palavras em posições diagonais, mídia em perspectiva 2.5D, parallax em planos separados, mapas de relações, split e recomposição de camadas. **A entrada do elemento deve estar concluída até o fim da palavra citada** (idealmente antes do início), com hold legível durante a fala. Para material real pertinente, um corte simples ainda pode ser a melhor decisão.

Exemplos de referência na pasta VD_0005: `PerguntaAbertura`, `ConflitoCentral`, `OutraRazao`, `LegadoEmRede`, `ArgumentosEmConflito`, `ConstelacaoFamilia`. Consultar `contentlab-cenas-tsx/references/REPERTORIO_MOTION_TSX.md` antes de projetar movimentos novos. Não confundir TSX custom da pasta do vídeo com presets globais do motor.
