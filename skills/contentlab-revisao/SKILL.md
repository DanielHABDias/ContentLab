---
name: contentlab-revisao
description: Faz controle de qualidade visual e sonoro em planos e renders do Content Lab por checkpoints, detectando clipping, timing, inconsistências e problemas de continuidade.
---


## Gate Diazverso — biblioteca TSX oficial
Consultar [Custom Cenas Diasverso](https://drive.google.com/drive/folders/1yWogLK6bRWXunvdJxTHBMIqB4ibSN44f) e README/TSX específicos. Rejeitar TSX novo/variante ou alteração de código sem pedido explícito do criador; componentes oficiais (7) em 16:9/9:16, escolhidos com parcimônia. Conferir `overlay` (QuadroHQSobreCena, CaixinhaCTAHQ) versus `replace` (demais), assets/fontes e props reais, textos legíveis, safe areas e camadas, além de áudio **externo** ao TSX. Revisar `transcript.words` versus legendas (não aproximar tempo), `sourceStart` de continuidade Página/Linha do Tempo, e diferenças de layout por formato. PNG atual como referência visual; MP4 histórico pode anteceder ajustes. Não considerar mixagem validada só por imagem/MP4 de demonstração.

# Content Lab — Revisão e qualidade

## Meta
Medir se o vídeo informa, se move com naturalidade e respeita a narrativa. **Mais efeitos não significa melhor edição.**

## Inspeção pré-render
- Cena comunica uma ideia identificável? Foco claro em cada momento?
- Há tempo real para ler depois que os elementos aparecem?
- Entradas e saídas justificadas, sem padrões repetitivos desnecessários?
- Tipografia legível em escala de celular, sem clipping ou quebras ruins?
- Assets existem e `contain`/`cover` não causam recortes acidentais?
- IDs, relógios e config compatíveis com o schema/renderer?

## Checkpoints visuais
Inspecione início de cena, primeiro estado legível, pico de movimento, hold, saída, frame anterior e posterior a transições e frames próximos a eventos sonoros. Use contact sheet quando útil. Detecte:
- elementos cortados, caixas excedendo safe area, transparência inesperada;
- colisão entre textos, perda de foco ou movimentos concorrentes;
- curvas com aceleração/desaceleração artificial, jitter e salto entre frames;
- continuidade quebrada de objeto/painel entre cenas;
- frames vazios/pretos inesperados e sobreposição de cenas;
- diferenças negativas entre versão 9:16 e 16:9.

## QA específico da edição Diazverso (15/10/2026)

Sem impor regras de marca ao perfil genérico: conferir em projetos **Diazverso** que a base do vídeo é montagem de cenas e ilustrações, não excesso de TSX; revisar repetição de tomadas, spoilers e correspondência editorial sem exigir literalidade a cada palavra. Ilustrações completas devem ter zoom/pan suave e tamanho maior que a janela durante todo o slide, sem borda preta inesperada. PNGs entram/saem com animação e SFX e possuem balanço sutil; figuras inteiras legíveis. Em longos, TSX horizontal 16:9, clips preservando aspecto original, CRT em filmes/animações/séries (não games), Anton forte, caixas de narrador branco/amarelo com sombra, Nox grande/opinião e CTAs HQ com permanência >=5 s. Título de capítulo integrado a cena com áudio original SOMENTE para recontagem de história de jogo em capítulos.

Em Shorts, confirmar explosão Minecraft por cima do gancho, riser de tensão, whoosh+blur e música posterior, **legendas Bangers obrigatórias** abaixo do centro com sombra e contorno fino e CTA final baseada no componente aprovado `ComicPageCTA.tsx` (thumb e headline específicas). Não aprovar automaticamente experimentos descartados `DiazversoFlowHQ` e variantes. Fonte Avengers para TSX quando houver asset carregado; Bangers para lettering HQ/legendas, Anton para frases fortes.

No QA de efeitos, verificar a família e o relógio: WHOOSH diferente para deslizes, CLICK/POP/BLING para aparições e interações; Metallic Riser apenas TENSÃO e nunca slide. A parte sonora relevante deve cair idealmente **no meio da animação**, não antes, no início automático ou depois. Conferir janela real do gesto, trim do sample e vídeo renderizado. Esta política de marca aprovada substitui a antiga preferência por muitos TSX de 14/10.

## QA de cenas programáveis TSX
Em uma cena contínua, inspecione frames na abertura, trajeto do objeto, movimento de câmera, revelação de tipografia e composição final. Confirmar que o arquivo `custom-scenes/*.tsx` existe, `customComponent.module` aponta corretamente, as dependências instaladas compilam e os assets nomeados resolvem. Verificar `replace` vs `overlay`, clipping de SVG e que o HUD não se move junto da câmera. A validação do schema não executa TSX; só afirmar sucesso após render real e checkpoints. Proteger o cache quando arquivos TSX locais mudarem.

## Áudio
Ouça o arquivo final: voz inteligível, SFX realmente audível no `at`, música sem cortes ou picos, eventos sincronizados à palavra relevante e pausas intencionais preservadas. Não inferir correção sonora só porque o JSON valida.

## Critérios para comparação A/B
Use conteúdo e narração iguais quando comparar uma edição antiga e uma nova. Avalie 1) compreensão; 2) hierarquia; 3) naturalidade do movimento; 4) timing; 5) continuidade; 6) respeito ao perfil de marca. A melhor versão pode conter menos efeitos.

## Limites de afirmação
Distinguir claramente: **validado no schema**, **teste automatizado passou**, **inspecionado em frames** e **MP4+áudio revisados**. Nenhuma dessas etapas substitui automaticamente as outras.
Os testes gerais do repo incluem `node --test server/*.test.mjs`, `node server/smoke.mjs`, `npm run docs:check` e verificação manual de projetos reais no Linux/Windows. Não afirmar execução se não ocorreu.

## Entrega
Registrar achados específicos por tempo/cena, gravidade, causa provável e recomendação; só elevar hipótese estética a padrão permanente após observação repetida.

## QA de sincronismo, profundidade e repetição

Checar os instantes reais de `word.start` e `word.end` contra os frames: a entrada do texto, personagem, vídeo ou conceito deve estar **finalizada até o fim da palavra** e preferencialmente já legível no primeiro fonema. Falha de QA: a voz termina a palavra enquanto a animação ainda resolve o objeto. Conferir também se câmera já chegou ao destino, se houve hold, se o visual saiu cedo e se uma entrada prévia entregou spoiler.

Em TSX espaciais, inspecionar o frame 0, os destinos de câmera, clipping, máscaras, primeiro e último plano, oclusão, skew/perspectiva de vídeos, nitidez tipográfica e estabilidade de frame. Na divisão de camadas, conferir se há recortes reais e se não aparecem buracos/halos. Evitar repetição de uma única composição de card ou do mesmo travelling durante capítulos inteiros. Reunir evidência de render real, não só validação de JSON.

## Auditoria rigorosa pré-edição automática e pós-render — etapa de bloqueio

**Esta skill já existe e é o gate oficial de QA geral. Executar duas passagens em cada projeto gerado para render automático: (A) pré-render, antes de liberar `edit_plan.json` e TSX à edição automática; (B) pós-render, ouvindo/assistindo ao MP4 definitivo.** O gate não representa nova validação implementada no motor; é procedimento da automação/agente que a utiliza. Consultar `references/AUDITORIA_COMPLETA_PRE_E_POS_RENDER.md`. Não declarar fase B concluída sem arquivo MP4 e áudio reproduzidos/inspecionados.

**Bloqueios obrigatórios:**
1. Movimento editorial intencional sem cobertura sonora (SFX ou áudio original embutido verificado); em TSX ler eventos internos, não olhar só `scene.customComponent`.
2. Início **audível** do SFX anterior à animação ou posterior ao fim do movimento: exigir `motionStart <= audibleSfxStart < motionEnd`, salvo ambiguidades de resolução de um frame a conferir manualmente. SFX maior/menor não é erro; apenas garantir o evento principal dentro do gesto, com cauda natural e final suave.
3. Arquivo SFX alongado/deslocado que invade outra narração/ação de maneira inadequada; se corte é necessário, `config.duration` + `fadeOut` realmente suportados e confirmados no render. Nunca corte seco com estalo nem fade fictício em campo desconhecido.
4. SFX sempre repetido na mesma função por automatismo, ou audivelmente abafando voz; duplicidade com áudio embutido personagem/CTA/mídia; áudio com peak/clipping ou fora da timeline.
5. Palavra/imagem/nó/câmera ainda entrando após a locução terminar: cruzar palavra do áudio preparado com frame de assentamento/hold; reprovar temporização tardia, revelação antecipada com spoiler, vídeo/PNG incorreto e asset/TSX inexistente.
6. Campos fora do schema, IDs inválidos, cenas com lacunas não intencionais, clipes sem fonte, overlays fora da área segura, fontes incorretas, tela preta, transição sem continuidade, música disputando a voz, formato/crop incompatíveis.

**Confiabilidade:** validação de JSON e existência de arquivos confirma apenas pré-condições. Analisar janelas de keyframes e tempos relativos TSX com `fps` declarado; se eventos TSX não puderem ser inferidos estaticamente, exigir mapa explícito por `scene.id` e marcar `NÃO VERIFICADO`, não fabricar cobertura. No pós-render, checar frames imediatamente antes/durante/depois de cada evento, waveform/escuta do arquivo final e sincronização por percepção; não presumir que arquivo de SFX encontrado está audível. Identificar duração real depois do corte/auto-trim, fade, `at` e asset real. Corrigir menor conjunto possível e repetir auditoria de cenas alteradas e pontos adjacentes.

**Saída obrigatória:** relatório por `scene.id`, `beat/event`, posição temporal, janela de movimento, SFX/pico, resultado `OK|BLOQUEANTE|ALERTA|NÃO VERIFICADO`, causa e correção; matriz com contagem total de movimentos, cobertura válida, ausências, atrasos, repetições, fadings e inconsistências visuais/áudio. Estado geral: `REPROVADO` (há bloqueante), `PENDENTE DE VERIFICAÇÃO` (faltam dados/render/escuta), `APROVADO PRÉ-RENDER` (etapa A completa), `APROVADO FINAL` (etapas A+B completas). **Não liberar edição automática diante de bloqueantes** nem afirmar `APROVADO FINAL` sem escuta do MP4.


## Padrões oficiais

Consultar scene-library/manifest.json e o README do padrão escolhido antes de criar TSX do zero. A galeria oficial inclui contratos e exemplos. Textos Anton sem sombra; Bangers com tratamento HQ. SFX não são gerados pelos componentes. Flip/Curtain/Blur são transitionOut entre cenas, não presets de cena. Preserve cópias instaladas em projetos e valide sincronismo com transcript.words.
