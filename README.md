# Content Lab

**Content Lab — criado por Daniel Dias** · [Diazverso](https://www.youtube.com/@DiazVerso)

Ferramenta audiovisual local para organizar um vídeo da ideia ao pacote final. A interface e agentes trabalham sobre o mesmo projeto versionado: roteiro, títulos A/B, thumbnails, mídia, narração, timeline, revisão e render.

## Requisitos e instalação

- Node.js 22 ou superior
- FFmpeg/FFprobe 6 ou superior
- Opcional: `yt-dlp` para URLs, whisper.cpp + `large-v3` para transcrição, Chatterbox V3 PT-BR para voz por IA

```bash
npm install
npm run doctor
npm run dev
```

Abra o endereço local mostrado. O comando inicia a interface e a API local juntas. Para uso sem recarga de desenvolvimento, `npm start` compila e serve o aplicativo em `http://127.0.0.1:4173`.

Os dados padrão ficam em `.contentlab/`: projetos criados sem pasta escolhida ficam em `.contentlab/projects`, mídias deduplicadas em `.contentlab/media` e o registro de recentes em `.contentlab/recent-projects.json`. Defina `CONTENTLAB_DATA_DIR` para usar outra raiz. O registro de recentes guarda apenas caminhos; projetos removidos deixam de aparecer automaticamente.

No Linux, os seletores nativos usam `zenity`. Se ele não estiver disponível, instale-o pelo gerenciador do sistema. Cancelar um seletor não altera o projeto. `npm run doctor` retorna JSON com dependências prontas e soluções para as ausentes. Recursos opcionais com pesos grandes não são baixados silenciosamente.

## Uso

A tela inicial cria, abre, importa e retoma projetos locais reais. Não são inseridos exemplos. “Abrir projeto” espera uma pasta cujo nome corresponda ao `id` de um `project.json` válido; “Importar pacote” aceita `.contentlab` e ZIP seguro. Dentro do projeto, escolha revisão por etapa ou modo autônomo até a revisão final. Reabrir uma etapa preserva o histórico e invalida dependências posteriores.

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
- Transcrição/voz indisponível: o doctor mostra o runtime/peso ausente; edição e render continuam funcionando.
- Conflito de revisão: reinspecione o projeto e refaça o dry-run sobre a revisão atual.
- Pacote recusado: não force extração; confira manifesto, hash, caminho e se o destino já contém arquivos.
- Render interrompido: reinicie a fila; jobs que estavam executando voltam para `queued`.
- `Servidor local indisponível`: inicie com `npm run dev` (desenvolvimento) ou `npm start` (compilado), em vez de abrir o HTML diretamente.
- Seletor não abre: confirme que a sessão é gráfica e que `zenity` está instalado.
- Projeto não aparece em Recentes: abra novamente a pasta; caminhos removidos são descartados do registro.
