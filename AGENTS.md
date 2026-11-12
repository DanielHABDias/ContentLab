# Content Lab — instruções para agentes

Leia o `README.md` e a documentação do módulo afetado. Trabalhe na `main` somente quando o usuário pedir explicitamente; preserve alterações locais e valide antes de commitar.

Para continuidade do produto, use `PLANO_FINALIZACAO_CONTENT_LAB.md` como backlog e checkpoint. Execute uma macroetapa por vez e atualize seus critérios somente após validação real.

## Operação do produto

- Use `skills/contentlab-control/SKILL.md` para controlar projetos por CLI/MCP.
- Use `skills/contentlab-packages/SKILL.md` para `.contentlab` e ZIP.
- Interface, CLI e MCP devem chamar o mesmo núcleo; não edite manifestos diretamente.
- Mantenha contratos versionados, operações idempotentes, dry-run e revisões otimistas.
- Não implemente publicação automática nem banco de mídia social.
- Plugin Diazverso (mesmo dono) é a fonte das cenas HQ e dos assets de marca: altere no repositório do plugin e recompile com `npm run scenes:diazverso`; não edite à mão `src/timeline/components/diazverso/` nem `assets/brand/`. Siga o padrão visual do plugin; a montagem principal é o modo composição (`docs/MOTION.md`).
- O Nox (`Nox.png`, `nox-sem-olhos.png`, poses e `catalogo.json`) é propriedade do Diazverso e não entra no Content Lab nem no git dele: o app lê do plugin no computador (`src/core/nox-pack.js`: `CONTENTLAB_NOX_DIR`, `DIAZVERSO_PLUGIN_DIR` ou a pasta `DiazVerso-Plugin` ao lado). Não copie o Nox para este repositório.

## Qualidade

Execute `npm run check`, testes proporcionais do módulo e `npm audit --omit=dev`. Para mídia/render, valide arquivos reais com FFmpeg/ffprobe. Não declare transcrição, voz ou render prontos se dependências/artefatos reais não foram verificados.

Mensagens da interface são curtas e acionáveis. Preserve acessibilidade, layouts 16:9/9:16, histórico, consentimento de voz, direitos de mídia e extração segura de pacotes.
