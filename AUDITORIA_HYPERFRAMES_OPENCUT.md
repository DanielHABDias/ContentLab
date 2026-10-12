# Auditoria técnica — Content Lab × HyperFrames × OpenCut

**Data:** 12/10/2026  
**Content Lab examinado:** `main`, commit `1608d8f31c15d5bae34bec9ff33a48f3d7925c37`  
**Escopo:** leitura de código e documentação, comparação de arquitetura/UX e verificação de resultados existentes de CI. **Sem renderizar o VD_0005** e sem alterar a implementação ou o formato do JSON.

## Fontes

1. [Content Lab](https://github.com/DanielHABDias/ContentLab) — código atual e [CI do merge do Studio](https://github.com/DanielHABDias/ContentLab/actions/runs/38273880022).
2. [HyperFrames](https://github.com/heygen-com/hyperframes), [skills](https://github.com/heygen-com/hyperframes/tree/main/skills), [registry](https://github.com/heygen-com/hyperframes/tree/main/registry) e [comparação oficial HyperFrames versus Remotion](https://github.com/heygen-com/hyperframes/blob/main/docs/guides/hyperframes-vs-remotion.mdx). Inspeção do repositório público.
3. [OpenCut](https://github.com/OpenCut-app/OpenCut) e [OpenCut Classic](https://github.com/opencut-app/opencut-classic) — a primeira base está em reescrita; a versão Classic contém uma interface de edição mais madura e foi usada nesta comparação. **Não foi possível comprovar que este é exatamente o fork anteriormente compartilhado pelo usuário.**

## Resultado geral

**A base técnica funciona nos smoke tests; ainda não é equivalente em funcionalidades ao HyperFrames nem em UX a um editor tipo CapCut.** Nenhuma biblioteca HyperFrames ou OpenCut aparece como dependência direta do Content Lab. O motor visual do Content Lab é Remotion/React, com pipeline Node e FFmpeg. HyperFrames e OpenCut têm servido como referências arquiteturais, não como implementações copiadas.

A recomendação desta auditoria é manter Remotion como renderizador visual no curto prazo, aproveitar receitas, catálogo e padrões de composição do HyperFrames e adaptar a UX do OpenCut apenas onde melhora a edição assistida por IA. Trocar todo o motor, ou criar uma timeline multitrack completa agora, aumentaria a complexidade sem resolver o principal problema: repetição de parâmetros no JSON.

## Verificações confirmadas

| Área | Evidência | Situação |
|---|---|---|
| Backend Node | `server/http.mjs`, `server/launcher.mjs`; sem arquivos `.py` na árvore | OK — não depende de Flask |
| Render visual Remotion | `backend/remotion/src/scene.tsx`, `server/remotion.mjs` | OK — renderer efetivamente chamado |
| Cache por cena/ID | `server/cache.mjs`, `server/render.mjs` e `server/scene-browser.mjs` | OK no fluxo básico de assinatura/reuso |
| Reprodução de clipes | API `/api/editor/scenes/:id/media`, `visual_editor.js` | OK — lê MP4s existentes, não gera novo vídeo ao selecionar |
| Interface Studio | `frontend/static/studio.css`, `frontend/static/visual_editor.js` | OK — lista, busca, cria, duplica, remove e inspeciona cenas |
| CI | [Actions concluído](https://github.com/DanielHABDias/ContentLab/actions/runs/38273880022) | **Node, Windows e smoke Linux aprovados** |
| Teste de UI | `server/smoke-ui.mjs` | Exercita Chrome real, cache MP4, seleção, busca e duplicação |
| Render do projeto VD_0005 | Não executado, conforme pedido | **Não validado** |
| Inspeção real de todas as animações/cenas | Não coberta pelos smoke tests | **Não validada** |

## Achados priorizados

### P1 — Assinatura do renderer invalida cache sem mudança visual

**Evidência:** [`server/cache.mjs`](server/cache.mjs), funções `statIdentity`, `rendererIdentity` e `sceneFingerprint`. A identidade do renderer inclui **caminho, tamanho e mtime** de arquivos de `server/`, `backend/remotion/src/` e lockfile. Em outro checkout, `git pull` ou reinstalação, timestamps podem mudar sem mudança de conteúdo, invalidando todas as cenas. Uma mudança apenas no servidor HTTP também invalida todo o motor visual.

**Efeito:** renders desnecessários e perda do ganho esperado de cache.

**Direção:** usar hash do conteúdo de dependências visuais efetivas; separar assinatura do renderizador visual da assinatura do compositor e do servidor. Evitar usar caminho absoluto e mtime como identidade semântica de código.

### P1 — Inserção/duplicação de cenas pode dessintonizar a trilha sonora

**Evidência:** [`frontend/static/visual_editor.js`](frontend/static/visual_editor.js), `insertScene` e `shiftScene`. A inserção desloca `start/end/at` das cenas seguintes e suas camadas, mas não desloca `audio.music`, nem altera a narração, os cortes de origem ou os marcadores de transcrição.

**Efeito:** as cenas seguintes passam a ocorrer mais tarde, enquanto a voz e músicas globais continuam no tempo original. Pode desalinhar fala e visual quando a inserção não foi precedida de uma mudança deliberada da narração.

**Direção:** diferenciar **inserir cena em uma lacuna**, **substituir intervalo** e **inserir tempo (ripple)**, explicitando a política de áudio antes de deslocar conteúdo.

### P1 — Transições não usam movimento real da cena de entrada

**Evidência:** [`server/compose.mjs`](server/compose.mjs), `composeVisual`, trecho que extrai `-frames:v 1` da próxima cena e combina com a cauda da cena anterior. Para fades e slides, o vídeo de entrada na transição é construído a partir da **primeira imagem estática**.

**Efeito:** transições curtas passam nos testes e geram vídeo correto estruturalmente, mas podem mostrar o início da próxima cena congelado; não equivalem a um crossfade de dois vídeos em movimento.

**Direção:** transição com pequenos handles de vídeo real das duas cenas, preservando duração exata e invalidação apenas das cenas vizinhas.

### P2 — Mídia sem `fit` ainda assume `cover`

**Evidência:** [`backend/remotion/src/scene.tsx`](backend/remotion/src/scene.tsx), função `fit` e uso em `Media`. O fundo já **não** herda o zoom de câmera; uma fonte 1920×1080 no projeto 1920×1080 é exibida em proporção correta. Entretanto, o fallback de `fit` é `cover`, que recorta conteúdo se as proporções diferirem.

**Direção:** valor explícito `contain`/enquadramento sem recorte para gameplay e imagens informativas, com `cover` apenas quando o crop for escolhido. Especificar o contrato de mídia na futura biblioteca de templates.

### P2 — Cenas sonoras também invalidam render visual

**Evidência:** [`server/cache.mjs`](server/cache.mjs), `sceneFingerprint` usa todo o JSON bruto da cena, incluindo elementos `sfx`; `server/remotion.mjs` não renderiza o tipo `sfx` visualmente.

**Efeito:** modificar somente o som de um SFX pode forçar recodificação do vídeo visual da cena.

**Direção:** separar dependências de imagem/áudio na assinatura incremental.

### P2 — Sem detector de conflito visual de textos

**Evidência:** [`server/plan.mjs`](server/plan.mjs), `validatePlan` identifica intervalos inválidos e sobreposição entre cenas, mas não analisa duas camadas `text`, `caption` ou `kinetic_text` simultâneas na mesma região.

**Efeito:** não sinaliza o caso de frases sobrepostas encontrado anteriormente no projeto. Há também sobreposições intencionais, portanto a checagem deve ser **aviso contextual**, não erro automático.

**Direção:** diagnóstico semântico com interseção temporal + espacial, filtrado por z-index/estilo, antes de renderizar.

### P2 — Editor ainda não possui o ciclo reversível do OpenCut

**Evidência:** `frontend/static/visual_editor.js` edita diretamente o objeto do plano; não há pilha estruturada de comandos `undo/redo`, controlador de drag/resize com snapping ou régua/playhead por camada. No OpenCut Classic, essas responsabilidades têm módulos separados em `apps/web/src/commands/timeline`, `timeline/controllers`, `timeline/components` e `components/editor/panels/properties`.

**Efeito:** o storyboard atual é mais simples, mas operações arriscadas (inserir/duplicar/mover) são difíceis de desfazer e editar em escala.

**Direção:** começar por histórico de alterações, modos de inserção explícitos e seleção consistente; não copiar uma timeline multitrack completa antes de comprovar necessidade.

### P2 — Biblioteca de motion design pequena e pouco modular

**Evidência:** a maior parte das animações está concentrada no arquivo [`backend/remotion/src/scene.tsx`](backend/remotion/src/scene.tsx) (~484 linhas); `server/project.mjs` expõe listas de estilos, layouts e entradas/saídas. Há exemplos JSON, porém não uma API de templates de cena com parâmetros e instâncias de usuário.

O HyperFrames dispõe de skills especializadas, rules/blueprints, catálogo de blocos e componentes instaláveis, diagnósticos e previews por frame.

**Efeito:** a IA tende a escrever repetidamente posições, timings, escalas, cores e movimentos, e o renderer oferece menos variedade pronta do que o universo de técnicas do HyperFrames.

**Direção para a próxima etapa (ainda não implementar):** criar um catálogo declarativo de cenas com contratos/variáveis e permitir instâncias por JSON. Preservar Remotion como motor e usar os exemplos do HyperFrames como referência criativa, não importar HTML/GSAP indiscriminadamente.

## Comparação das abordagens

| Tema | Content Lab | HyperFrames | OpenCut Classic |
|---|---|---|---|
| Autor da composição | IA gera `edit_plan.json` | Agente gera HTML/CSS/JS seekable | Pessoa edita timeline e propriedades |
| Render visual | Remotion React, dirigido por frames | Browser DOM, animações seekables (GSAP e outras) | Sistema próprio do editor |
| Reutilização | Estilos hardcoded, exemplos JSON e cache por cena | Registry de blocos/componentes, skills/blueprints | Componentes de UI, comandos e propriedades por tipo |
| Editor | Storyboard por ID + clipe em cache | Studio sobre mesma composição HTML | Timeline multitrack e painel contextual |
| Histórico de ações | Não há undo/redo estruturado | Fluxo de edição sobre DOM/source | Pilha de comandos e interações específicas |
| Testes | Smoke Node, Chrome, Remotion e Windows | Lint/check/snapshot/render + testes próprios | Testes de comandos de timeline e UI |
| Adequação ao DiazVerso | Boa base para IA + edição simples | Referência ótima para ampliar motion design | Referência ótima para UX/edição reversível |

## Limites desta auditoria

- **Não executado:** `VD_0005` completo; inspeção frame a frame de 101 cenas; benchmarks de render de longa duração; verificação manual com modelos reais do whisper.cpp ou downloads externos.
- **Verificado:** estrutura e implementações do repositório, CI do merge, testes existentes e arquivos relevantes das duas referências.
- **Não concluído:** que o JSON atual seja o formato ótimo; que se deva migrar para HyperFrames; que replicar o OpenCut seja necessário.
- A compatibilidade e licenças devem ser revisadas antes de copiar ou integrar **código**, em vez de apenas conceitos de interface ou motion.

## Decisão sugerida após esta revisão

1. Preservar Node.js + Remotion + cache por cena.
2. Corrigir primeiro os problemas de assinatura do cache, políticas de inserção e handles de transição.
3. Em seguida, estudar **um JSON de autoria mais curto** com `template`/preset, `params`, `overrides` e referências a templates pessoais, compilando para o mesmo contrato atual. **É somente proposta para discussão; nenhuma migração de schema foi feita.**
4. Criar testes de snapshots/contato visual de receitas, independentemente de testes de render sintético.


## Adendo — correções de validação

Após a auditoria, a leitura de `transcript.json` revelou duplicação de legendas se o arquivo trouxesse simultaneamente `words` e `segments`. O leitor agora considera `words` como fonte primária e usa `segments` apenas quando aquela lista está ausente ou vazia. Foi acrescentado teste cobrindo ambos os formatos.

A execução adicional da CI em `main` após publicar este relatório expôs uma falha intermitente: o navegador Chrome concluía os testes com sucesso, mas a limpeza imediata da pasta temporária podia retornar `ENOTEMPTY`. A limpeza agora tolera especificamente erros transitórios de perfil em uso, sem mascarar falhas dos testes de interação.

Essas duas correções foram integradas em [PR #2](https://github.com/DanielHABDias/ContentLab/pull/2), depois que a CI do PR passou. O renderizador, os templates e o schema do JSON **não** foram modificados por essas correções.

**Nota de transcrição:** o adaptador `whisper.cpp` pode distribuir as palavras aproximadamente dentro do intervalo de cada segmento; isso não equivale a alinhamento real palavra por palavra. Antes de prometer legendas precisamente sincronizadas, precisamos de teste com timestamps de um modelo real.

