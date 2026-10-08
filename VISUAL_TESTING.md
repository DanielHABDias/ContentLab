# Visual testing com Iris

O Content Lab usa testes tradicionais para contrato, parser, áudio, timeline e
integração, mas recursos de edição também precisam de inspeção visual. Um teste
pode passar e ainda produzir texto cortado, camada na ordem errada, chroma ruim,
movimento exagerado ou composição ilegível.

Por isso o fluxo de desenvolvimento inclui uma camada opcional de **visual
testing assistido por agente** usando [Iris](https://github.com/brijr/iris).
Iris é somente a câmera: abre a aplicação em um navegador Chrome-family e
devolve os pixels ao agente via MCP. Ele não substitui unit tests, FFprobe,
render reports ou revisão audiovisual.

## 1. Instalar o Iris

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/brijr/iris/main/install.sh | sh
iris --version
```

Iris precisa de Chrome, Chromium, Edge ou Brave. Se a autodetecção não encontrar
o navegador, informe o binário explicitamente:

```bash
iris --chrome /usr/bin/brave-browser http://127.0.0.1:5000
```

## 2. Conectar a um coding agent

### Codex CLI

```bash
codex mcp add iris -- iris mcp
codex mcp get iris
```

Se o navegador não for autodetectado:

```bash
codex mcp add iris -- iris mcp --chrome /usr/bin/brave-browser
```

### Outros clientes MCP, incluindo Claude Code

Configure um servidor stdio com:

```json
{
  "mcpServers": {
    "iris": {
      "command": "iris",
      "args": ["mcp"]
    }
  }
}
```

Quando necessário, acrescente `--chrome` e o caminho do navegador aos
argumentos. Reinicie a task/sessão do agente depois de alterar a configuração
MCP.

## 3. Rodar os testes automáticos

Antes da inspeção visual:

```bash
python -m unittest discover -s tests -q
python -m tests.mvp_acceptance
```

O primeiro cobre comportamento unitário e rotas. O segundo executa o aceite
integrado sintético existente.

## 4. Gerar as fixtures visuais

```bash
python -m tests.visual_acceptance
```

Esse comando:

1. cria um projeto sintético em `.visual-tests/project`;
2. usa o **renderer real do Content Lab** e o contrato `0.2`;
3. gera `.visual-tests/visual-tests.mp4`;
4. extrai checkpoints PNG para diagnóstico;
5. grava `.visual-tests/manifest.json`.

A pasta inteira é gerada localmente e ignorada pelo Git.

Os casos iniciais cobrem:

- typewriter + câmera virtual 3×3;
- palavra inteira sem quebra/hifenização indevida;
- `center_reveal`;
- `center_close`;
- `word_stack_vertical`;
- `crt_tv`;
- `crt_tv + dim + PNG` com ordem de `z`;
- composição progressiva de três capas;
- `bangers_highlight_block`;
- `blur_left`;
- `blur_right`;
- `blur_up`.

Novas features visuais relevantes devem ganhar um checkpoint aqui.

## 5. Abrir o harness

Inicie o Content Lab:

```bash
python -m backend.app
```

Abra:

```text
http://127.0.0.1:5000/visual-tests
```

Um checkpoint pode ser endereçado diretamente:

```text
http://127.0.0.1:5000/visual-tests?case=word-stack
http://127.0.0.1:5000/visual-tests?case=crt-dim-png
http://127.0.0.1:5000/visual-tests?case=blur-left
```

Também é possível sobrescrever o segundo usado no seek:

```text
http://127.0.0.1:5000/visual-tests?case=center-reveal&time=6.55
```

A página pausa o MP4 no checkpoint e só marca
`body[data-visual-ready="true"]` e `#visual-frame[data-ready="true"]`
depois do seek terminar. Isso evita capturar um frame ainda carregando.

## 6. Fluxo recomendado para Codex/Claude Code

Quando uma alteração afetar renderer, UI, layout, texto, filtro, motion,
transição, chroma ou composição:

1. alterar o código;
2. rodar os testes unitários relevantes;
3. rodar `python -m tests.visual_acceptance`;
4. iniciar/confirmar o Content Lab em `127.0.0.1:5000`;
5. usar Iris para capturar o checkpoint relevante;
6. comparar os pixels com a expectativa escrita no próprio harness;
7. corrigir se necessário;
8. repetir até a captura ficar correta;
9. para movimento, conferir mais de um checkpoint e/ou assistir ao preview;
10. para áudio, continuar usando Preview/render e escuta humana: Iris não ouve.

Exemplo de instrução para um agente:

```text
Você alterou word_stack_vertical. Rode os testes relevantes e
python -m tests.visual_acceptance. Depois use Iris para abrir
http://127.0.0.1:5000/visual-tests?case=word-stack.
Espere data-visual-ready=true, capture #visual-frame e inspecione:
a palavra ativa precisa estar central e em opacidade total; anterior e próxima
devem estar atenuadas. Não declare o teste visual aprovado sem olhar a captura.
```

## 7. O que Iris não substitui

Iris trabalha com pixels de um instante. Portanto:

- movimento precisa de checkpoints em tempos diferentes ou reprodução do MP4;
- áudio exige Preview/render e escuta;
- sincronização fina exige timestamps e reprodução;
- duração/codec continuam sendo verificados por FFprobe;
- regras de schema/parser continuam sendo verificadas por testes automatizados;
- uma captura bonita não prova que o vídeo inteiro está correto.

A regra é: **testes automáticos provam contrato; render prova execução; Iris
permite ao agente verificar o resultado visual real.**
