# Usar o Content Lab

O Content Lab é uma ferramenta audiovisual local. O agente opera o mesmo projeto que a pessoa acompanha na interface. Leia `skills/contentlab-control/SKILL.md` para produzir por MCP/CLI e `skills/contentlab-packages/SKILL.md` para importar ou exportar pacotes. Não edite `project.json` diretamente.

## Fluxo

1. Confira `contentlab_status`; use `contentlab_start` se necessário. Combine modo automático ou revisão antes de criar e abra o projeto com `contentlab_open`.
2. Siga ideia → título/thumbnail → roteiro → mídia → narração → edição → revisão. Use `project_get` para pendências; em revisão, espere `stage_wait_decision` ou aprovação explícita no chat.
3. Escreva o roteiro em capítulos e blocos (`docs/ROTEIRO.md`); para ajustes locais, use `script_get` e `script_edit` com revisão atual e IDs estáveis.
4. Só o texto dos blocos `narration` é falado. Títulos de capítulos/blocos, `scene`, `direction` e fontes ficam fora da voz. A tela de gravação mostra apenas a fala, agrupada por capítulo.
5. Na etapa Narração, escolha a pessoa gravando ou sua voz clonada com consentimento. Voz de IA exige perfil em Minha voz; sem perfil, use a gravação própria. Não existe voz sintética genérica.
6. Monte a narração e acompanhe `job_wait`. A montagem não transcreve: quando o áudio final estiver definido, rode `narration_transcribe` + `job_wait` (Whisper `large-v3` completo, em português, tempos de início/fim de cada palavra). O áudio montado já permite aprovar Narração; a transcrição é obrigatória antes de sincronizar ou concluir a edição. Se faltar dependência ou houver falha, preserve o áudio, corrija e retome com `narration_transcribe`.
7. Leia `narration_transcript` (paginado) antes de posicionar imagens, cortes, beats e legendas. Depois use `motion_kit`, `motion_plan_auto`, `motion_preview`, `motion_plan_set` e `render_start`, conferindo os arquivos reais.
8. Depois de `render_start` confirmar o envio à fila, avise e encerre a resposta, inclusive em modo automático. Não aguarde render, consulte porcentagens repetidamente, crie monitor ou prometa retorno automático. O usuário volta ao chat para retomar; só então consulte `job_status` uma vez e, se concluído, confira o arquivo. Se ainda estiver rodando, informe e encerre novamente.
9. Na retomada, depois de conferir o render, termine com `deliverable_build` e `project_export`. Publicação é manual.

## Fila de processamento

A aba **Fila de processamento** reúne render, transcrição, voz de IA, montagem WAV e importações de todos os projetos em uma fila FIFO: apenas um trabalho executa por vez. Envie pelos controles normais ou MCP. Na Edição/Revisão aparece somente o render atual ou o último, com um botão para abrir a fila. `queue_list` consulta a fila; `queue_cancel` cancela um trabalho, `queue_cancel_all` cancela os ativos e aguardando, e `queue_clear_history` remove só registros encerrados, preservando a fila ativa e os arquivos.

## Conteúdo e verificação

O Content Lab é neutro: marca, regras editoriais e personagens vêm do projeto ou plugin do criador. Importe mídias e trilha com direitos confirmados; personagem entra por `character_import`. Cena no roteiro é planejamento, não clipe/áudio pronto. Confira imagem, som, sincronismo e legibilidade no render antes de declarar a entrega concluída. Em conflito de revisão, releia e recalcule; não sobrescreva mudanças da pessoa.

## Fundos do kit

**Half-Tone** (`halftone`) é o fundo pontilhado anteriormente chamado de papel. Os IDs atuais `papel`, `papel-dobras`, `papel-hq` e `papel-sutil` são os fundos de papel amassado gerados por código. Preservar essa distinção ao editar a documentação e as prévias.
