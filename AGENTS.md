# Usar o Content Lab

O Content Lab é uma ferramenta audiovisual local. O agente opera o mesmo projeto que a pessoa acompanha na interface. Leia `skills/contentlab-control/SKILL.md` para produzir por MCP/CLI e `skills/contentlab-packages/SKILL.md` para importar ou exportar pacotes. Não edite `project.json` diretamente.

## Fluxo

1. Confira `contentlab_status`; use `contentlab_start` se necessário. Combine modo automático ou revisão antes de criar e abra o projeto com `contentlab_open`.
2. Siga ideia → título/thumbnail → roteiro → mídia → narração → edição → revisão. Use `project_get` para pendências; em revisão, espere `stage_wait_decision` ou aprovação explícita no chat.
3. Escreva o roteiro em capítulos e blocos (`docs/ROTEIRO.md`); para ajustes locais, use `script_get` e `script_edit` com revisão atual e IDs estáveis.
4. Só o texto dos blocos `narration` é falado. Títulos de capítulos/blocos, `scene`, `direction` e fontes ficam fora da voz. A tela de gravação mostra apenas a fala, agrupada por capítulo.
5. Na etapa Narração, escolha a pessoa gravando ou sua voz clonada com consentimento. Voz de IA exige perfil em Minha voz; sem perfil, use a gravação própria. Não existe voz sintética genérica.
6. Monte a narração e acompanhe `job_wait`: o app transcreve automaticamente com Whisper `large-v3` completo, em português, com tempos de início/fim de cada palavra. O áudio final montado já permite aprovar Narração e seguir; a transcrição continua em segundo plano e é obrigatória antes de sincronizar ou concluir a edição. Se faltar dependência ou houver falha, preserve o áudio, corrija e retome com `narration_transcribe`.
7. Leia `narration_transcript` (paginado) antes de posicionar imagens, cortes, beats e legendas. Depois use `motion_kit`, `motion_plan_auto`, `motion_preview`, `motion_plan_set` e `render_start`, conferindo os arquivos reais.
8. Termine com `deliverable_build` e `project_export`. Publicação é manual.

## Conteúdo e verificação

O Content Lab é neutro: marca, regras editoriais e personagens vêm do projeto ou plugin do criador. Importe mídias e trilha com direitos confirmados; personagem entra por `character_import`. Cena no roteiro é planejamento, não clipe/áudio pronto. Confira imagem, som, sincronismo e legibilidade no render antes de declarar a entrega concluída. Em conflito de revisão, releia e recalcule; não sobrescreva mudanças da pessoa.
