# Música do VD_0005 — auditoria de integração ao ContentLab

**Data:** 13/10/2026. Projeto de referência: VD_0005 (não alterar esse edit_plan ou a seleção musical aprovada).

## Inventário comparativo

| Música no VD_0005 | Estado no ContentLab | Ação |
| --- | --- | --- |
| `Something is Going On - Godmode.mp3` | Já existe em `builtin-assets/music/` | Nenhuma |
| `The New Order - Aaron Kenny.mp3` | Já existe em `builtin-assets/music/` | Nenhuma |
| `Future Rennaisance - Godmode.mp3` | Já existe em `builtin-assets/music/` | Para projetos **futuros**, já é possível referenciar como `builtin://music/Future Rennaisance - Godmode.mp3`, sem modificar VD_0005 |
| `A Great Darkness Approaches, Can You Feel It_ - ELPHNT.mp3` | Falta no repo | **Candidata a importação local**, confirmação individual de licença e atribuição |
| `Elegy - Asher Fulero.mp3` | Falta no repo | **Candidata a importação local**, confirmação individual de licença e atribuição |
| `Frightmare - Jimena Contreras.mp3` | Falta no repo | **Candidata a importação local**, confirmação individual de licença e atribuição |
| `GTA V Pause Menu Main Menu Music - OST Grand Theft Auto.mp3` | Já existe no repo | **Não tratar como royalty-free**; tema/OST de jogo tem risco próprio de Content ID, consultar titular/termos antes de uso futuro |

A pasta `Diazverso/Musicas/NoCopyright/Biblioteca do YouTube` no Drive foi inspecionada: os três MP3 ausentes **existem no acervo pessoal**. Origem interna não equivale a prova legal de redistribuição/uso em todas as plataformas. Metadados/fonte original e condições atuais da licença devem ser conferidos no YouTube Studio **por faixa**.

## Por que não comitar MP3s no repositório público?

Biblioteca de áudio do YouTube oferece música para inclusão em vídeos produzidos, mas há regras de licença e atribuição; isso **não** equivale a autorização genérica para redistribuir a faixa isolada junto a um editor publicado no GitHub. Mesmo uma licença padrão sem atribuição pode não permitir distribuição do arquivo como asset de software. A licença MIT do código ContentLab **não** transforma automaticamente as músicas em MIT.

Fonte normativa do YouTube: https://support.google.com/youtube/answer/3376882

**Integração realizada:** script de instalação **local**, sem downloads automáticos, sem colocar MP3 sob versionamento, com checagens de arquivo/colisão e confirmação explícita de direitos. Isso torna os três títulos disponíveis na biblioteca local do ContentLab **depois que o operador executa a importação**; nenhum MP3 foi enviado ao GitHub.

## Como importar no seu ContentLab local (quando desejar)

1. No YouTube Studio > Biblioteca de áudio, conferir para cada título a licença vigente e a indicação `Attribution required/not required`. Registrar créditos na descrição de cada vídeo quando exigidos.
2. Colocar cópias de seus três MP3 legítimos numa pasta local, mantendo os nomes de arquivo acima. Não usar fontes de reupload duvidosas.
3. No diretório do repositório:

```bash
node scripts/import-diazverso-music.mjs --source "/caminho/para/suas-musicas" --dry-run
node scripts/import-diazverso-music.mjs --source "/caminho/para/suas-musicas" --confirm-rights
```

4. O script instala em `builtin-assets/music/` na sua máquina. Os três nomes estão excluídos do Git em `.gitignore` para reduzir o risco de publicar acidentalmente os arquivos.
5. Em **novos** vídeos, após importar, referenciar `builtin://music/xxx.mp3`; ou continuar usando `project://assets/music/xxx.mp3` se o áudio for exclusivo do projeto. Não reescrever o `edit_plan.json` do VD_0005.

O script valida estrutura inicial MP3 e SHA para não substituir silenciosamente faixas diferentes; ele **não** confere juridicamente a licença, não garante ausência de reivindicações e não acessa a conta do YouTube Studio.

## Seleção editorial futura

- ELPHNT: clima de ameaça/suspense, cenas de tensão e antecipação.
- Elegy (Asher Fulero): clima introspectivo/memória/tragédia, com voz prioritária.
- Frightmare (Jimena Contreras): suspense mais forte, conflito/terror situacional.
- Future Rennaisance (Godmode): energia e fechamento expansivo.
- Algo existir no YouTube Audio Library não obriga usá-lo em todos os vídeos nem comprova licença cross-platform. Selecionar pela emoção da narração, não para preencher uma playlist.