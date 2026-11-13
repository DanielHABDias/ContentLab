# Content Lab — instruções para agentes

Leia o `README.md` e a documentação do módulo afetado. Trabalhe sempre na `main`, conforme orientação do criador; preserve alterações locais, sincronize com o remoto e valide antes de commitar e enviar.

## Operação do produto

- Use `skills/contentlab-control/SKILL.md` para controlar projetos por CLI/MCP.
- Use `skills/contentlab-packages/SKILL.md` para `.contentlab` e ZIP.
- Interface, CLI e MCP devem chamar o mesmo núcleo; não edite manifestos diretamente.
- Mantenha contratos versionados, operações idempotentes, dry-run e revisões otimistas.
- Não implemente publicação automática nem banco de mídia social.
- O Content Lab é uma ferramenta neutra: não traz marca, canal nem personagem de ninguém. O kit de motion (`src/motion/kit/`, `assets/kit/`) e as cenas HQ do modo clips (`src/timeline/components/hq/`) são código próprio; a montagem principal é o modo composição (`docs/MOTION.md`).
- A narração por voz de IA é sempre a voz clonada do próprio criador, gravada em “Minha voz” (`src/ui/VoiceScreen.jsx`, perfis em `<dados>/voices/`). Não existe voz sintética genérica. Sem nenhum perfil, `narrationBy: 'ai'` é recusado com `VOICE_PROFILE_REQUIRED` na interface, na CLI e no MCP.
- Quem narra é escolhido na etapa Narração, não ao criar o projeto. “Como produzir” tem só dois modos: `autonomous` (vai até o render e entrega) e `review` (espera o OK a cada etapa).
- Personagem é mídia do projeto: entra por `character_import` (pasta com PNGs de poses + `catalogo.json`, direitos confirmados). Não coloque personagem, poses ou marca de terceiros no repositório; nos testes e no QA use o personagem de teste de `src/test/character-fixture.js`.

## Qualidade

Execute `npm run check`, testes proporcionais do módulo e `npm audit --omit=dev`. Para mídia/render, valide arquivos reais com FFmpeg/ffprobe. Não declare transcrição, voz ou render prontos se dependências/artefatos reais não foram verificados.

Mensagens da interface são curtas e acionáveis. Preserve acessibilidade, layouts 16:9/9:16, histórico, consentimento de voz, direitos de mídia e extração segura de pacotes.
