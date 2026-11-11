# Content Lab

**Content Lab — criado por Daniel Dias** · [Diazverso](https://www.youtube.com/@DiazVerso)

Ferramenta audiovisual local para organizar um vídeo da ideia ao pacote final. A interface e agentes trabalham sobre o mesmo projeto versionado: roteiro, títulos A/B, thumbnails, mídia, narração, timeline, revisão e render.

## Requisitos e instalação

- Node.js 22 ou superior
- FFmpeg/FFprobe 6 ou superior e, no Linux, `zenity` (seletores nativos)
- Opcional: `yt-dlp` para URLs, whisper.cpp + `large-v3` para transcrição, Chatterbox PT-BR para voz por IA

```bash
npm install
npm run doctor -- --text
npm run dev
```

Na primeira execução abre o assistente **Prepare seu computador** (também disponível em “Dependências” no menu lateral):

- **Essenciais** (Node, FFmpeg, FFprobe, zenity) são pacotes do sistema: o assistente mostra o comando para a sua distribuição (apt, dnf, pacman, zypper; brew/winget como contrato) e nunca executa `sudo`.
- **Recursos de IA** são opcionais. yt-dlp (2026.10.26) e os pesos Whisper `large-v3` são baixados com tamanho e SHA-256 fixados; whisper.cpp v1.9.5 é compilado a partir do commit fixado `d1be6fde`. Antes de baixar, o assistente mostra origem, licença, tamanho, destino e espaço livre, e exige consentimento. Chatterbox não tem artefato verificável (upstream arquivado) e permanece manual.
- Tudo vai para `.tools/` (ou `CONTENTLAB_TOOLS_DIR`), sem alterar Python/Node globais. Downloads usam arquivo `.partial`, podem ser pausados, retomados (HTTP Range), cancelados ou repetidos, e só são promovidos após conferir o SHA-256. O estado fica em `.tools/setup-state.json`; a segunda inicialização não baixa de novo, e uma mudança de versão/checksum no catálogo pede atualização.
- “Agora não” é lembrado; a interface básica funciona sem voz e transcrição.

Pelo terminal: `npm run doctor` (JSON), `npm run doctor -- --text` (legível) e `npm run doctor -- --install whisper-large-v3 --accept` (sem `--accept`, apenas mostra origem, licença e tamanho).

Abra o endereço local mostrado. O comando inicia a interface e a API local juntas. Para uso sem recarga de desenvolvimento, `npm start` compila e serve o aplicativo em `http://127.0.0.1:4173`.

Os dados padrão ficam em `.contentlab/`: projetos criados sem pasta escolhida ficam em `.contentlab/projects`, mídias deduplicadas em `.contentlab/media` e o registro de recentes em `.contentlab/recent-projects.json`. Defina `CONTENTLAB_DATA_DIR` para usar outra raiz. O registro de recentes guarda caminho, ID e título; um caminho ausente ou inválido continua listado com aviso até ser removido dos Recentes.

No Linux, os seletores nativos usam `zenity`. Se ele não estiver disponível, instale-o pelo gerenciador do sistema. Cancelar um seletor não altera o projeto.

## Uso

A tela inicial cria, abre, importa e retoma projetos locais reais. Não são inseridos exemplos. “Abrir projeto” espera uma pasta cujo nome corresponda ao `id` de um `project.json` válido; “Importar pacote” aceita `.contentlab` e ZIP seguro. Dentro do projeto, escolha revisão por etapa ou modo autônomo até a revisão final. Reabrir uma etapa preserva o histórico e invalida dependências posteriores.

### Gerenciar projetos

O menu “⋯” de cada cartão oferece abrir, revelar pasta, renomear, duplicar, exportar (`.contentlab` ou ZIP, sem renders), remover de Recentes e excluir. Cada cartão mostra tamanho, última modificação e última abertura.

- **Remover de Recentes** altera só o registro; a pasta fica intacta.
- **Renomear** muda o título sem alterar ID e pasta. Mudar pasta/ID é opção avançada separada: valida o novo ID, recusa conflitos e desfaz o rename se a gravação falhar.
- **Duplicar** cria novo ID, revisão 1 e histórico com a origem; mídias continuam referenciadas pelo hash, sem copiar objetos.
- **Excluir** mostra nome, ID e caminho exatos, exige digitar o ID e move a pasta para a lixeira do sistema (`gio trash`), com “Desfazer”. Sem lixeira, oferece backup e exige digitar `EXCLUIR <id>` antes da exclusão permanente. Exclusão e mudança de ID ficam bloqueadas durante escrita, exportação ou render; o render pode ser cancelado no próprio diálogo.

O editor de roteiro separa fala, direção visual e fontes; packaging mantém títulos A/B, descrição, tags e thumbnails. A timeline usa camadas genéricas, keyframes, undo/redo e layouts próprios para 16:9 e 9:16. Preview e render compartilham o mesmo plano.

## CLI e MCP

```bash
CONTENTLAB_DATA_DIR=/caminho/projetos npm run contentlab -- project.inspect project_id
CONTENTLAB_DATA_DIR=/caminho/projetos npm run contentlab -- project.run operacao.json
npm run mcp
```

Operações aceitam `dryRun`, `operationId` idempotente e revisão-base. O MCP usa `stdio`; configure o cliente para executar `node /caminho/ContentLab/src/adapters/mcp-server.js` e, se necessário, `CONTENTLAB_DATA_DIR`.

## Pacotes

`.contentlab` é um ZIP versionado com manifesto, deduplicação SHA-256 e verificação de integridade. ZIP padrão é a alternativa interoperável. Veja [formato e extração segura](docs/FORMATO_CONTENTLAB.md).

```bash
npm run contentlab -- package.export pedido-exportacao.json
npm run contentlab -- package.inspect projeto.contentlab
npm run contentlab -- package.restore pedido-restauracao.json
```

## Segurança e privacidade

Tudo funciona localmente. A aplicação não publica em redes sociais nem exige hospedagem ou API paga. URLs e mídias dependem dos direitos do usuário. Clonagem de voz exige consentimento registrado. Componentes TSX passam por validação e devem renderizar em processo isolado.

## Desenvolvimento e documentação

```bash
npm test
npm run build
npm run check
npm audit --omit=dev
```

- [Arquitetura](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Mídia e transcrição](docs/MIDIA_E_TRANSCRICAO.md)
- [Narração e voz](docs/NARRACAO_E_VOZ.md)
- [Timeline e componentes](docs/TIMELINE_E_COMPONENTES.md)
- [Preview e render](docs/RENDER_E_PREVIEW.md)
- [Benchmark técnico](docs/BENCHMARK_TECNICO.md)

## Solução de problemas

- `FFmpeg não disponível`: instale FFmpeg/FFprobe e execute `npm run doctor`.
- Transcrição/voz indisponível: abra “Dependências” ou rode `npm run doctor -- --text`; edição e render continuam funcionando.
- Download falhou: “Tentar novamente” retoma do ponto salvo; checksum incorreto descarta o arquivo e recomeça. Pouco espaço é avisado antes de baixar.
- Compilação do whisper.cpp falhou: instale `git`, `cmake` e um compilador C++ (o assistente mostra o comando) e tente de novo.
- Conflito de revisão: reinspecione o projeto e refaça o dry-run sobre a revisão atual.
- Pacote recusado: não force extração; confira manifesto, hash, caminho e se o destino já contém arquivos.
- Render interrompido: reinicie a fila; jobs que estavam executando voltam para `queued`.
- `Servidor local indisponível`: inicie com `npm run dev` (desenvolvimento) ou `npm start` (compilado), em vez de abrir o HTML diretamente.
- Seletor não abre: confirme que a sessão é gráfica e que `zenity` está instalado.
- Projeto não aparece em Recentes: abra novamente a pasta. Cartão com “Pasta não encontrada”: a pasta foi movida ou apagada; abra-a no novo local e remova a entrada antiga.
- “Restaurar” falhou: o item já saiu da lixeira ou existe outra pasta no local original; mova-a e tente de novo.
