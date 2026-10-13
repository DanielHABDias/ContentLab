---
name: contentlab-cenas-tsx
description: Cria cenas Remotion complexas como arquivos TSX dentro da subpasta custom-scenes de cada projeto de vídeo, integrados ao edit_plan.json por customComponent.
---

# Content Lab — Cenas programáveis TSX

## Quando acionar
Use para cenas em um mesmo espaço visual: câmera acompanhando trajetórias, diagramas procedurais, linha do tempo, multiverso, grafos, geometria SVG, grades, partículas, grupos de cards coordenados ou tipografia com muitos keyframes. Para cenas simples, preferir componentes declarativos do JSON. O critério não é "parecer bonito", é reduzir complexidade de autoria e manter uma cena coesa.

## Contrato instalado (não inventar integração)
O Content Lab suporta `timeline[].customComponent` com `module`, `mode`, `props` e `assets`. `module` deve referir `project://custom-scenes/Arquivo.tsx`; a pasta é na **raiz do projeto de vídeo**, não na pasta do repositório ContentLab. `replace` substitui a composição visual normal; `overlay` apresenta o TSX sobre a renderização da cena. A narração e o mixer FFmpeg continuam no projeto; não criar um segundo player/renderer.

O arquivo TSX precisa **exportar um componente React como default**. Recebe propriedades vindas de `props` e um objeto `assets` com URLs dos assets declarados. **Criar e manter o TSX diretamente na subpasta `custom-scenes/` do vídeo sempre que houver acesso de escrita à pasta de destino**; se apenas a pasta do Drive estiver acessível, publicar nela e orientar a cópia para o projeto local. O site não instala código TSX automaticamente e o JSON não aceita código executável.

## Regra obrigatória de localização, persistência e entrega
- Cada vídeo possui sua própria pasta canônica: `Guia de Edições/Vídeos Longos/VD_XXXX/` ou `Guia de Edições/Shorts/SH_XXXX/` no Drive e sua pasta correspondente no projeto local. **Criar primeiro a subpasta `custom-scenes/` dentro da pasta desse vídeo (se ainda não existir)**, nunca em pasta global de assets, repositório do Content Lab, raiz do Drive ou diretório temporário.
- Um TSX criado para a cena `MinhaCena` deve ficar em `VD_XXXX/custom-scenes/MinhaCena.tsx`; no plano do MESMO vídeo usar exatamente `customComponent.module: "project://custom-scenes/MinhaCena.tsx"`. Salvar `edit_plan.json` na raiz do vídeo, não dentro de `custom-scenes/`.
- **Quando houver conectores e permissão**, escrever/publicar cada `.tsx` imediatamente na subpasta `custom-scenes/` do vídeo no Google Drive e, quando o ambiente local também estiver acessível e autorizado, no caminho equivalente no computador. Quando não houver acesso de escrita, entregar arquivos para cópia e informar claramente que a instalação ainda está pendente; nunca afirmar que estão salvos apenas por terem sido produzidos na conversa.
- Não entregar os componentes **somente** em texto solto, ZIP ou link de download se for possível gravá-los na pasta do vídeo. Um ZIP é cópia opcional e deve reproduzir exatamente a estrutura `custom-scenes/` e a versão canônica dos TSX. Não deixar versões divergentes ou criar backups duplicados sem solicitação.
- Ao finalizar, verificar que **todos** os caminhos `customComponent.module` existentes em `edit_plan.json` correspondem aos arquivos reais na subpasta do vídeo; abrir/ler os TSX publicados para conferir o conteúdo, e registrar no `guia_de_edicao.md` quais cenas os utilizam. Preservar IDs/tempos, `props` e `assets` aprovados.
- Aplicar esta regra sempre que a direção do Diazverso, a decupagem ou o contrato solicitarem TSX, inclusive em revisões e novos vídeos.

## Entrega econômica de tokens
1. Identifique só os dados que faltam: duração, proporção, beats/fala, elementos centrais, assets existentes e identidade visual.
2. Decida se é **uma cena contínua** com mundo/câmera próprios ou várias cenas independentes. Se a câmera percorre um cenário persistente, em geral escolha uma cena.
3. Gere **um arquivo `MinhaCena.tsx` completo** e grave-o na subpasta `custom-scenes/` da pasta do vídeo conforme a regra acima; não despeje seu código em longas respostas. Se não houver permissão para gravar, entregue o arquivo para instalação manual (ou um único bloco de código como último recurso). Nunca afirmar que criou ou instalou um arquivo sem verificar.
4. Forneça um **fragmento JSON mínimo** para `customComponent` ou uma cena completa apenas se o usuário pedir; nunca reimprimir todo o `edit_plan.json` sem necessidade.
5. Se estiver revisando uma cena existente, altere o menor trecho de código possível, preserve os demais arquivos/IDs e evite retransmitir TSX ou JSON inalterado.

## Biblioteca visual recomendada para TSX — Modern Editorial UI
Quando o briefing pedir o acabamento refinado do Studio do Content Lab, criar no próprio componente **primitivas React/SVG reutilizáveis** (`Card`, `SectionTitle`, `AccentPill`, `SoftPanel`, `TimelineNode`) sem depender de downloads para cada forma. Evitar pacote NPM extra se SVG/CSS bastar.
- Tokens de referência *adaptáveis*: `#F5F6F8` (canvas claro), `#FFFFFF` (card), `#171A22` (texto), `#8B93A0` (secundário), `#E3E6EB` (borda), `#1769E0` (acento); variante dark `#0D111B` com painel `#19263D`/gradiente azul e detalhes de marca somente quando significativos.
- Tipografia de UI: `Inter` quando fornecida com licença e asset resolvido, ou sans-serif disponível no render; no Studio há uma pilha CSS com fontes Apple como fallback, **não um arquivo SF Pro distribuído**. Anton/Bangers continuam possíveis para títulos de impacto.
- Desenhar cantos arredondados, linhas finas, sombras difusas, hierarquia título/subtítulo com contraste e respiro proporcional à resolução, não importar screenshots do site como assets.
- Animar por frame: card sobe poucos pixels com opacidade, vira/funde entre estados, foco troca suavemente e depois faz hold; não duplicar padrões de hover CSS. `interpolate/spring` com limites para não provocar overshoot inútil.
- Aplicar os princípios à informação narrada: comparações, linhas do tempo, rankings, relações, mapas, cards de contexto. Para matéria real, usar o asset verificado como mídia principal e cards como apoio.
- Gerar **um arquivo TSX completo + JSON mínimo** e revisar pequenos patches para economizar tokens. Não converter cada card em um novo arquivo.
A composição deve parecer um vídeo editorial sofisticado, não uma gravação de interface ou uma imitação de marca comercial.

## Implementação recomendada
- `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()` e SVG/React para movimento determinístico; calcule cada instante sem `setInterval`, `Date.now`, CSS keyframes/transition ou estado dependente da ordem dos frames.
- Agrupe objetos e movimento de câmera em um sistema de coordenadas consistente; mantenha HUD/legendas fixas fora do grupo transformado pela câmera.
- Use React/SVG para grades, linhas, círculos, conectores, cartões e painéis sempre que forem geometria, em vez de solicitar imagens externas.
- Use `assets` do JSON para imagens e fontes verificadas (URIs `project://` ou `builtin://`), sem URLs externas inventadas. Em TSX, consuma `assets.logo`, `assets.nox` etc. Não presuma bibliotecas NPM não instaladas.
- Separe composição de entrada, transformação, hold e saída, sincronizadas com beats; uma cena pode conter vários momentos sem cortar o cenário persistente.
- `props` recebe parâmetros serializáveis (textos, cores, valores), para facilitar reaproveitamento e evitar regeração de código. O TSX pode importar módulos locais em `custom-scenes/`; evite dependências arbitrárias.
- Respeite 9:16 e 16:9 por layout/reflow ou componentes apropriados; não dependa de crop automático.

## Ativar e validar
Código TSX é executável e **não está em sandbox**. O Content Lab renderiza componentes locais em `custom-scenes/` sem configuração extra; por isso, exigir revisão de origem antes de abrir um projeto de terceiros. A verificação do JSON não compila o TSX: renderizar, olhar checkpoints de frames, conferir clipping/timing e ouvir áudio final.
O cache por cena deve perceber alterações das fontes dentro de `custom-scenes/`; preservar IDs estáveis e nunca concluir paridade pixel-perfect com a referência sem comparação de frames.

## Exemplo oficial
`examples/custom-scenes/FollowDot.tsx` + `examples/programmatic-motion-edit-plan.json`. É uma demonstração procedural validada no CI, não cópia do vídeo fonte. Para trabalhar com um roteiro real, usar a narração preparada e assets próprios.

## Evolução da linguagem TSX: direção espacial e variedade

Em vídeos explicativos autorais do Diazverso, **considerar TSX como primeira opção criativa** quando a composição envolver elementos e câmera no mesmo espaço, vídeos em perspectiva, tipografia percorrida pela câmera, relações entre personagens ou divisão/recomposição de camadas. TSX não é só último recurso para JSON muito complexo; ele permite motion autoral coeso. Isso não obriga cada cena a usar código: imagem/clipe original pertinente e corte simples continuam importantes.

**Regra temporal obrigatória:** localizar os tempos `start/end` da palavra-chave no áudio preparado. Converter para o relógio local (`localStart=word.start-scene.start`, `localEnd=word.end-scene.start`). A entrada do objeto visual (texto, personagem, imagem ou vídeo) deve **estar concluída no máximo em `localEnd`**, idealmente já completamente legível em `localStart`. A câmera também precisa chegar ao destino focal quando a narração o nomeia. Não começar a animação apenas no primeiro fonema e terminá-la depois da palavra. Para falas rápidas, antecipar preparação sem spoiler, encurtar entrada ou agrupar pensamentos. Se a cena começa exatamente na palavra, mostrar estado legível no frame zero. Manter hold real durante a pronúncia.

**Ideias para explorar e variar:** câmera em palco horizontal/diagonal maior que o viewport; palavra em diagonal superior direita e próximo foco abaixo; vídeo em placa inclinada com perspectiva 2.5D; painéis de HQ que mudam de plano; galeria de mídias em ângulos distintos; grafo de personagens com zoom de detalhe até visão geral; fundo/meio/primeiro plano com parallax; desmembrar camadas e recompô-las; máscaras desenhadas; trilha SVG que conecta revelações; texto que se redistribui como espaço físico. Escolher o movimento com base na tese e variar a linguagem entre beats, não apenas trocar a cor do mesmo card.

**Camadas separadas:** usar recortes PNG com transparência, máscaras verificadas ou objetos SVG/DOM independentes para profundidade/oclusão reais no projeto. Uma única imagem achatada não tem, por si só, planos independentes. Se não existirem recortes, preferir split de cartões/painéis visivelmente estilizado ou preparar os assets antes. CSS `perspective`/`translateZ` cria ilusão **2.5D**, não reconstrução tridimensional automática. Evitar deformar rostos, texto e mídias.

**Exemplos verificados na pasta VD_0005 (não são templates fixos):** `PerguntaAbertura.tsx` usa câmera por palco horizontal e conclui o PNG antes da fala “Batman”; `OutraRazao.tsx` espalha palavras num caminho e conclui as entradas antes dos termos; `ConflitoCentral.tsx` move o foco por nós de um argumento; `LegadoEmRede.tsx` aproxima partes da rede e depois apresenta o conjunto; `ArgumentosEmConflito.tsx` coordena vários beats sem cortar a cena. O `edit_plan.json` desse vídeo tem 101 cenas, com dez usos de TSX. Aprender a mecânica, sem copiar textos, cores ou segundos em outros vídeos.

Ver `references/REPERTORIO_MOTION_TSX.md` para catálogo, anchors temporais, perspectiva, camadas e checkpoints de render. Não inventar novos campos do JSON ou dependências.

## Cobertura sonora de TSX programável

Ao criar um componente TSX, entregar também **mapa externo de eventos de movimento e SFX**. O componente React/Remotion representa o VISUAL: seu áudio principal continua no `edit_plan.json` via mixer FFmpeg. Não adicionar player próprio para imitar o SFX. Para cada trajetória intencional, entrada, snap, rotação, abertura de camadas, passagem de câmera, conexão SVG ou revelação, registrar `sceneStart`, `localMovementStart/End`, `absMovementStart/End`, `sfxAsset`, `at` e possível `fadeOut`. Se vários elementos participam do mesmo movimento, um som bem escolhido pode acompanhá-los; se existem vários beats com transformações independentes, avaliar cobertura sonora de cada beat.

Regra exigida: **início audível do SFX dentro do movimento** — não adiantado e não depois de completada a animação. O som pode durar menos ou mais; a parte informativa do som precisa acontecer durante o gesto. Se a cauda for exagerada, usar `config.duration` e `fadeOut` do elemento `type:"sfx"` no JSON, para encurtar suavemente sem mexer no TSX. Usar sons diferentes para mecanismos e moods diferentes, não simplesmente o mesmo whoosh em cada deslocamento. Aplicar `contentlab-revisao` com análise pré-render e escuta do render. Uma cena TSX sem arquivo correspondente ao `customComponent.module` ou sem SFX para seus movimentos identificados não está pronta.
