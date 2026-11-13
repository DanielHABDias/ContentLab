# Content Lab

**Content Lab — criado por Daniel Dias**

Ferramenta audiovisual local para organizar um vídeo da ideia ao pacote final. A interface e agentes trabalham sobre o mesmo projeto versionado: roteiro, títulos A/B, thumbnails, mídia, narração, timeline, revisão e render.

## Requisitos e instalação

**Para usar (Linux x64, sem npm):** baixe `contentlab-<versão>-linux-x64.tar.gz`, extraia e rode `./install.sh`. Atualizar, voltar versão e desinstalar sem perder projetos: [docs/DISTRIBUICAO.md](docs/DISTRIBUICAO.md). Para executar a pasta do projeto, use as instruções abaixo.

- Node.js 22 ou superior
- FFmpeg/FFprobe 6 ou superior e, no Linux, `zenity` (seletores nativos)
- Opcional: `yt-dlp` para URLs, whisper.cpp + `large-v3` completo para transcrição obrigatória da narração, VoxCPM2 para voz clonada (recomendado: 16 GB de RAM ou GPU NVIDIA com 8 GB)

```bash
npm install
npm run doctor -- --text
npm run dev
```

Na primeira execução abre o assistente **Prepare seu computador** (também disponível em “Dependências” no menu lateral):

- **Essenciais** (Node, FFmpeg, FFprobe, zenity) são pacotes do sistema: o assistente mostra o comando para a sua distribuição (apt, dnf, pacman, zypper; brew/winget como contrato) e nunca executa `sudo`.
- **Recursos de IA** são opcionais. yt-dlp (2026.10.26) e os pesos Whisper `large-v3` são baixados com tamanho e SHA-256 fixados; whisper.cpp v1.9.5 é compilado a partir do commit fixado `d1be6fde`; VoxCPM2 2.0.3 é instalado num Python isolado (`.tools/venvs/voxcpm2`) a partir do wheel com SHA-256 fixado, com pesos `openbmb/VoxCPM2` na revisão fixada `7936080b` e o comando `contentlab-voice` verificado antes de ser ativado (requer Python 3.10–3.12 com venv). O Content Lab analisa o computador (RAM total e livre, núcleos, AVX2/bf16, GPU NVIDIA/AMD/Apple) e instala a build certa do PyTorch: CPU (validada), CUDA conforme o driver, ROCm só para GPUs AMD suportadas, MPS no Mac. Cada geração roda com teto de memória sem swap, núcleos reservados ao sistema e prioridade baixa; estourar o teto encerra só a geração. Antes de baixar, o assistente mostra origem, licença, tamanho, destino e espaço livre, e exige consentimento.
- Etapas e recursos que dependem de algo ausente ficam bloqueados: Mídia, Narração, Edição e Revisão exigem FFmpeg/FFprobe; URL exige yt-dlp; transcrição exige whisper.cpp e os pesos; voz clonada exige VoxCPM2 e hardware compatível. O aviso de bloqueio tem um botão que abre Dependências com os itens necessários já marcados, e o servidor recusa a operação com `DEPENDENCY_MISSING`.
- Tudo vai para `.tools/` (ou `CONTENTLAB_TOOLS_DIR`), sem alterar Python/Node globais. Downloads usam arquivo `.partial`, podem ser pausados, retomados (HTTP Range), cancelados ou repetidos, e só são promovidos após conferir o SHA-256. O estado fica em `.tools/setup-state.json`; a segunda inicialização não baixa de novo, e uma mudança de versão/checksum no catálogo pede atualização.
- “Agora não” é lembrado; a interface básica funciona sem voz e transcrição.
- Narração: grave (com permissão explícita do microfone) ou importe takes, corte e reordene sem alterar originais, ouça o preview A/B do tratamento e monte um WAV 48 kHz mono medido. A voz clonada exige perfil com consentimento do titular e gera somente os blocos de narração, reaproveitando o que não mudou. A tela de gravação mostra só a fala por capítulo. Montar os takes também transcreve automaticamente com Whisper `large-v3` completo; a edição só segue com os tempos de cada palavra prontos.

Pelo terminal: `npm run doctor` (JSON), `npm run doctor -- --text` (legível) e `npm run doctor -- --install whisper-large-v3 --accept` (sem `--accept`, apenas mostra origem, licença e tamanho).

**Abrir com um comando (recomendado):**

```bash
npm run app
```

Compila a interface se algo mudou, sobe a interface e a API (um único processo) em segundo plano, abre o navegador e libera o terminal; pode fechá-lo. Para desligar tudo (servidor, renders, importações, voz, downloads), use o botão **Desligar** na barra lateral do app ou `npm run app:stop` (`-- --force` interrompe trabalho em andamento; renders interrompidos continuam ao abrir de novo). `npm run app:status` diz se está aberto. Log em `.contentlab/logs/server.log`.

O MCP não fica rodando: o cliente (Claude, Codex) inicia `npm run mcp` sob demanda via stdio e o encerra sozinho.

Abra o endereço local mostrado. O comando inicia a interface e a API local juntas. Para uso sem recarga de desenvolvimento, `npm start` compila e serve o aplicativo em `http://127.0.0.1:4173`.

Os dados padrão ficam em `.contentlab/`: projetos criados sem pasta escolhida ficam em `.contentlab/projects`, mídias deduplicadas em `.contentlab/media` e o registro de recentes em `.contentlab/recent-projects.json`. Defina `CONTENTLAB_DATA_DIR` para usar outra raiz. O registro de recentes guarda caminho, ID e título; um caminho ausente ou inválido continua listado com aviso até ser removido dos Recentes.

No Linux, os seletores nativos usam `zenity`. Se ele não estiver disponível, instale-o pelo gerenciador do sistema. Cancelar um seletor não altera o projeto.

## Configurações, armazenamento e recuperação

Em **Configurações**: pastas de projetos, cache de mídia, cache de render, ferramentas/modelos e saída padrão de render; limites de disco; uso por categoria; limpeza; backup do registro.

- Toda pasta nova passa por teste de escrita antes de ser aceita. Nada é movido automaticamente.
- Mudar a pasta de **projetos** só afeta projetos novos; os existentes continuam onde estão.
- Para cache de mídia, cache de render e ferramentas com conteúdo, escolha **Migrar dados** (cópia verificada por SHA-256, troca da pasta e, opcionalmente, remoção da origem; falha reverte o destino) ou **Começar vazia** (os dados antigos ficam onde estão). O ambiente Python da voz clonada não é relocável e é reinstalado após migrar ferramentas (os pesos são copiados).
- Mídias são localizadas pelo hash: após migrar o cache, os projetos continuam funcionando sem reescrita.
- **Limpar derivados** remove cortes, downloads temporários, cache de render e código-fonte de compilação. Mídias sem uso só são removidas por seleção explícita e são reconferidas antes (projetos ausentes impedem garantir que algo é órfão).
- Projeto movido aparece como “Pasta não encontrada”; use **Localizar pasta…** no menu do cartão.
- O registro de Recentes guarda uma cópia a cada alteração; se corromper, é recuperado do backup ou reconstruído varrendo a pasta de projetos, preservando o arquivo corrompido.
- Escritas usam a trava `.contentlab.lock` por projeto, válida entre interface, CLI e MCP. Se um processo morrer no meio, a trava obsoleta é recuperada e temporários órfãos são removidos.

## Uso

A tela inicial cria, abre, importa e retoma projetos locais reais. Não são inseridos exemplos. “Abrir projeto” espera uma pasta cujo nome corresponda ao `id` de um `project.json` válido; “Importar pacote” aceita `.contentlab` e ZIP seguro. Ao criar o projeto, você escolhe só como produzir: **tudo automático** (a IA vai da ideia ao render e entrega) ou **etapa por etapa** (ela espera o seu OK a cada etapa). Nos dois casos dá para reabrir qualquer etapa depois, e dá para mudar o modo em **Configurar**. Quem narra é escolhido na etapa **Narração**, com o roteiro na mão. Reabrir uma etapa preserva o histórico e invalida dependências posteriores.

### Documentação

A aba **Documentação**, na barra lateral, mostra o que todo projeto traz do kit de motion do Content Lab. Nela as cenas de exemplo tocam ao vivo no navegador (16:9 ou 9:16), os fundos (estrelas, meio-tom, explosão, papel…) aparecem com seletor de cor, cada SFX toca com um clique e há as regras de legenda e de som. Os dados vêm de `GET /api/v1/brand/docs` e os arquivos de `GET /api/v1/brand/file?kind=sfx|font&name=…`, que só servem nomes do kit. Pelo MCP, use `kit_docs`.

### Minha voz

A narração por voz de IA do Content Lab é a **sua** voz, clonada de uma amostra gravada por você. A tela **Minha voz**, na barra lateral, mostra um texto de leitura de cerca de 60 s (com perguntas, exclamações e números, para o modelo pegar a entonação), grava pelo microfone só depois do clique, registra o consentimento do titular e cria o perfil. Cada perfil tem o botão **Ouvir como ficou**, que gera uma frase curta com a voz clonada para você conferir o resultado. Dá para ter vários perfis e escolher qual usar em cada projeto.

Em **Configurações → Voz de IA**, escolha **Padrão** (11,5 GB livres em CPU) ou **Econômico** (VoxCPM2 Q8 em CPU, reserva de 10,5 GB e instalação própria). Se faltar RAM ao tentar gerar uma amostra ou narração, o painel oferece fechar aplicativos e, no modo Padrão, trocar para o Econômico. O painel some ao tentar novamente e só volta se a memória continuar insuficiente.

Enquanto não houver nenhum perfil gravado, a opção de narração por voz de IA fica bloqueada nos projetos: resta gravar a narração você mesmo na etapa Narração. Detalhes em [docs/NARRACAO_E_VOZ.md](docs/NARRACAO_E_VOZ.md).

### Personagem do projeto

Um projeto pode ter um personagem (mascote, apresentador desenhado): em **Mídias → Importar personagem**, escolha a pasta com os PNGs das poses e o `catalogo.json` e confirme os direitos. Pelo MCP é `character_import`; pela CLI, `character.inspect` e `character.import`. Com personagem, o modo composição ganha apartes e a cena `personagem`; sem ele, o vídeo sai sem os dois. Formato do pacote em [docs/MOTION.md](docs/MOTION.md#personagem-do-projeto).

### Gerenciar projetos

O menu “⋯” de cada cartão oferece abrir, revelar pasta, renomear, duplicar, exportar (`.contentlab` ou ZIP, escolhendo incluir renders e caches), remover de Recentes e excluir. A importação sempre mostra uma prévia de conteúdo, tamanho e destino; conflitos são bloqueados e nada é sobrescrito. Cada cartão mostra tamanho, última modificação e última abertura.

- **Remover de Recentes** altera só o registro; a pasta fica intacta.
- **Renomear** muda o título sem alterar ID e pasta. Mudar pasta/ID é opção avançada separada: valida o novo ID, recusa conflitos e desfaz o rename se a gravação falhar.
- **Duplicar** cria novo ID, revisão 1 e histórico com a origem; mídias continuam referenciadas pelo hash, sem copiar objetos.
- **Excluir** mostra nome, ID e caminho exatos, exige digitar o ID e move a pasta para a lixeira do sistema (`gio trash`), com “Desfazer”. Sem lixeira, oferece backup e exige digitar `EXCLUIR <id>` antes da exclusão permanente. Exclusão e mudança de ID ficam bloqueadas durante escrita, exportação ou render; o render pode ser cancelado no próprio diálogo.

O [editor de roteiro](docs/ROTEIRO.md) organiza capítulos livres com blocos adicionáveis e reordenáveis de narração, cena/som original e direção visual. Só a fala dos blocos de narração é lida pela voz; títulos e fontes ficam fora. É possível mover blocos entre capítulos e desfazer alterações. Packaging mantém títulos A/B, descrição, tags e thumbnails. A timeline usa camadas genéricas, keyframes, undo/redo e layouts próprios para 16:9 e 9:16. SRT pode ser importado no editor; componentes TSX/Remotion permitidos aparecem como camadas configuráveis e são renderizados em processo isolado. Preview e render compartilham o mesmo plano. A etapa Revisão mantém uma fila persistente com progresso, cancelamento, repetição, log e presets coerentes com a proporção.

## CLI e MCP

**Produzir com um agente de IA:** o MCP deixa o Claude/Codex operar o app real — escrever, narrar (gravação própria ou voz clonada), montar, gerar thumbnails A/B, renderizar e entregar, esperando sua aprovação a cada etapa ou em modo autônomo. Configuração e ferramentas: [docs/MCP.md](docs/MCP.md).

```bash
CONTENTLAB_DATA_DIR=/caminho/projetos npm run contentlab -- project.inspect project_id
CONTENTLAB_DATA_DIR=/caminho/projetos npm run contentlab -- project.run operacao.json
npm run mcp
```

Operações aceitam `dryRun`, `operationId` idempotente e revisão-base. O MCP usa `stdio`; configure o cliente para executar `node /caminho/ContentLab/src/adapters/mcp-server.js` e, se necessário, `CONTENTLAB_DATA_DIR`.

O modo autônomo usa a mesma operação `workflow.run` pela interface, CLI e MCP. Cada execução persiste um job compacto com etapa, entradas, saídas, revisão-base e log. Ele nunca aprova nem publica sozinho: para quando faltam artefatos e sempre exige decisão humana para direitos de mídia, consentimento de voz, custo de render e aprovação. Conflitos retornam `REVISION_CONFLICT` com as revisões para recarregar e comparar sem sobrescrever trabalho externo.

## Pacotes

`.contentlab` é um ZIP versionado com manifesto, deduplicação SHA-256 e verificação de integridade. ZIP padrão é a alternativa interoperável. Veja [formato e extração segura](docs/FORMATO_CONTENTLAB.md).

```bash
npm run contentlab -- package.export pedido-exportacao.json
npm run contentlab -- package.inspect projeto.contentlab
npm run contentlab -- package.restore pedido-restauracao.json
```

## Segurança e privacidade

Modelo de ameaças, retenção e licenças: [docs/SEGURANCA_E_PRIVACIDADE.md](docs/SEGURANCA_E_PRIVACIDADE.md).

Tudo funciona localmente. A aplicação não publica em redes sociais nem exige hospedagem ou API paga. URLs e mídias dependem dos direitos do usuário. Clonagem de voz exige consentimento registrado. Componentes TSX passam por validação e devem renderizar em processo isolado.

## Documentação de uso

- [Produção com IA pelo MCP](docs/MCP.md)
- [Roteiro em capítulos e blocos](docs/ROTEIRO.md)
- [Mídia e transcrição](docs/MIDIA_E_TRANSCRICAO.md)
- [Narração e voz](docs/NARRACAO_E_VOZ.md)
- [Motion e composição](docs/MOTION.md)
- [Timeline e componentes](docs/TIMELINE_E_COMPONENTES.md)
- [Preview e render](docs/RENDER_E_PREVIEW.md)

## Solução de problemas

- `FFmpeg não disponível`: instale FFmpeg/FFprobe e execute `npm run doctor`.
- Transcrição/voz indisponível: abra “Dependências” ou rode `npm run doctor -- --text`; edição e render continuam funcionando.
- Download falhou: “Tentar novamente” retoma do ponto salvo; checksum incorreto descarta o arquivo e recomeça. Pouco espaço é avisado antes de baixar.
- Compilação do whisper.cpp falhou: instale `git`, `cmake` e um compilador C++ (o assistente mostra o comando) e tente de novo.
- Conflito de revisão: reinspecione o projeto e refaça o dry-run sobre a revisão atual.
- “Projeto em uso por outro processo”: outra janela, a CLI ou o MCP está gravando; aguarde. Se o processo já terminou, a trava é recuperada automaticamente.
- Pacote recusado: não force extração; confira manifesto, hash, caminho e se o destino já contém arquivos.
- Render interrompido: reinicie a fila; jobs que estavam executando voltam para `queued`.
- `Servidor local indisponível`: inicie com `npm run dev` (desenvolvimento) ou `npm start` (compilado), em vez de abrir o HTML diretamente.
- Seletor não abre: confirme que a sessão é gráfica e que `zenity` está instalado.
- Projeto não aparece em Recentes: abra novamente a pasta. Cartão com “Pasta não encontrada”: a pasta foi movida ou apagada; abra-a no novo local e remova a entrada antiga.
- “Restaurar” falhou: o item já saiu da lixeira ou existe outra pasta no local original; mova-a e tente de novo.
