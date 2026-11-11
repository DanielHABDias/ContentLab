# Content Lab — instruções obrigatórias para Codex/agentes de desenvolvimento

> Este arquivo é a entrada operacional da nova versão. O legado está em `old/` e serve **somente como referência**.

## Começar e continuar
1. Ler **`PLANO_REFATORACAO_CONTENT_LAB.md`**, inclusive seu protocolo de execução (seção 7).
2. Identificar a primeira tarefa **T01–T12** não concluída. Executá-la, testar, atualizar o plano e fazer **um commit por tarefa macro**.
3. Continuar automaticamente para a próxima tarefa, **sem pedir "próximo"**. Interromper apenas por bloqueio genuíno, risco de perda de dados, falta de acesso ou decisão indispensável.
4. **Trabalhar somente na branch `main` do clone local**, sem branches/PRs. Conferir branch e estado antes de agir; sincronizar com Git sem sobrescrever alterações. Commits da refatoração ficam na `main`; fazer push normal quando possível, nunca force push.

## Economia de tokens e skills obrigatórias
Seguir **obrigatoriamente** as técnicas reais do plugin Diazverso 1.0: https://github.com/DanielHABDias/DiazVerso-Plugin (somente leitura; não modificar este repositório).

- Ler `skills/diazverso-contexto-eficiente/SKILL.md` **uma vez por sessão/versão**. Usar seleção da skill principal por resultado e leitura incremental, sem carregar tudo.
- Usar o **grafo/mapa de dependências** em `skills/diazverso-contexto-eficiente/references/skill-map.json` e, se disponível, `scripts/context_map.py` para seleção/índice com hashes; `references/roteamento.md` e `scripts/route_request.py` apenas se necessários.
- Para tarefas que justifiquem, consultar `skills/context-optimization/SKILL.md` sobre consultas limitadas, resumos de observações e checkpoints. **Compactação de contexto nativa só se o host suportar**; checkpoints não controlam a memória interna do agente.
- Reutilizar resultados válidos, ler apenas arquivos/trechos necessários, verificar versões antes de escrever, resumir saídas volumosas sem esconder erros, evitar chamadas repetidas e manter checkpoint curto para retomada.
- Não inventar métricas ou percentuais de economia de tokens; testes e qualidade são obrigatórios.

## Disciplina de implementação
- **Primeiro frontend/UX (T01–T03)**, depois arquitetura e serviços segundo a sequência do plano.
- Não criar dashboard nem módulos de publicação/banco de mídia antigos. Manter interfaces objetivas, sem explicações artificialmente geradas ou comentários redundantes.
- Usar código modular, contratos versionados, testes e documentação final. Validar resultados reais antes do commit de cada tarefa.
- A referência ao plugin Diazverso é somente leitura; skills próprias do Content Lab são entregues **no final**, como definido na T12.
- Preservar `old/` até a validação final, sem apagar ou reaproveitar código automaticamente.
- Não instalar serviços pagos ou depender de hospedagem para a execução local.

As decisões de produto, definição das 12 tarefas, critérios de aceite e política de commits estão no **plano temporário**. Em caso de divergência, observar as instruções mais recentes e explícitas do usuário.
