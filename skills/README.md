# Skills de autoria do Content Lab

## Entrada única
**Content Lab — Direção** (`skills/contentlab-direcao/SKILL.md`) é a porta de entrada. Recebe o objetivo e lê apenas os módulos necessários. A skill antiga monolítica `contentlab-edicao`, antes embutida em `server/skill.mjs`, foi substituída por arquivo canônico e módulos para evitar divergências.

## Módulos
- `contentlab-composicao`: narrativa espacial, foco, tipografia, formatos e câmera.
- `contentlab-motion`: coreografia, keyframes, easing, stagger, continuidade.
- `contentlab-timeline-audio`: voz, beats, transcript, SFX e música.
- `contentlab-contrato`: autoria e validação do JSON único.
- `contentlab-revisao`: inspeção visual, áudio, QA e feedback.
- `diazverso-video`: perfil editorial de marca Diazverso.
- `gsb-contentlab`: integração com o GSB, dependente das instruções específicas existentes.

## Distribuição
O download **Skill .zip** do aplicativo oferece o `SKILL.md` da Direção na raiz e os módulos em `skills/<slug>/SKILL.md`, além do mesmo schema, documentação e exemplos do Content Lab. O pacote completo permite ao agente ler módulos específicos conforme a tarefa.

Estes módulos também podem ser utilizados individualmente por agentes que trabalham diretamente no repositório, mas não devem ser confundidos com plugins ChatGPT instalados automaticamente apenas por estarem versionados no GitHub.

## Escopo da primeira etapa
Esta etapa altera instruções e empacotamento, **não** o `edit_plan.json`, schema ou renderer. Novas expectativas de qualidade e movimentos avançados são alvos do próximo ciclo de engenharia; até lá a skill de contrato identifica lacunas ao invés de gerar campos não executáveis.

## Manutenção
- Mudar conteúdo das skills aqui; não voltar a embutir orientações extensas em `server/skill.mjs`.
- Manter `AGENTS.md`, schema, documentação gerada e testes como referências para compatibilidade.
- A skill de Diazverso usa o Master Context privado/projeto quando disponível, não o copia automaticamente para este repositório público.
- Se houver uma skill anterior do Diazverso ou do GSB fora do repositório, fazer comparação e migração antes de apagá-la.
