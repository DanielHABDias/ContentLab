# Studio UI — nova interface do Content Lab

## Identidade visual

Interface original do Content Lab com linguagem editorial de software criativo: fundo claro, superfícies suaves, tipografia de sistema, cartões bem espaçados, navegação lateral e azul discreto nas ações primárias.

- Monograma autoral **CT** em SVG: `frontend/static/contentlab-mark.svg`.
- Sistema de design: `frontend/static/studio.css`, carregado após `style.css` para manter compatibilidade dos componentes antigos.
- Responsivo: navegação lateral em telas largas; navegação horizontal e layout empilhado em telas menores.
- Usabilidade: rótulos claros, contraste, navegação por teclado, controles com foco e respeito a movimento reduzido.

O projeto é inspirado na clareza visual de aplicativos contemporâneos e **não** replica logotipos, ícones ou identidade comercial da Apple.

## Publicações (prévia de interface)

A aba **Publicações** apresenta a futura distribuição de Shorts para YouTube, Instagram e TikTok, sem autenticação nem upload nesta versão.

- Seleção múltipla de MP4s locais para testar a interface; a leitura automática de `output/final/final.mp4` por projeto será implementada depois.
- Edição de título e descrição por vídeo, seletor de frame temporal com prévia do próprio MP4 e seleção opcional de imagem externa.
- Prévias de texto por plataforma: YouTube preserva título e descrição separados; Instagram e TikTok unem ambos com uma linha em branco e substituem `#Shorts` por `#Viral` somente na prévia dessas redes.
- Calendário simulado de um vídeo por dia no YouTube, com data e horário definidos. Instagram e TikTok aparecem como envio imediato futuro.
- Contas marcadas como não conectadas e botão de envio/agendamento permanentemente desabilitado. Nenhuma configuração é salva e nenhum arquivo sai do navegador.

## Editor de cenas

Ao abrir um projeto, o storyboard fica dividido em duas áreas:

**Lista de cenas:** número, ID, intervalo, quantidade de camadas, resumo dos elementos, campo de busca e status do cache.

**Painel da cena:** vídeo individual salvo em `output/final/scenes/` (quando disponível), status, início/fim/ID, ações rápidas de inserir, duplicar e excluir, botão para adicionar camada e parâmetros avançados de fundo/câmera/animação.

Uma edição simples não exige editar JSON manualmente. Os campos do editor visual continuam produzindo `edit_plan.json`, que é a fonte única da verdade. O usuário precisa **Validar JSON → Salvar plano** para renderizar.

**Motion design:** o fluxo é sempre **Sua linha do tempo → + Nova cena → Adicionar camada → Editar propriedades avançadas**. No painel da cena é possível compor qualquer quantidade de PNGs, vídeos, textos ou efeitos, escolher posições no grid 3×3, configurar fundos de cor/imagem/vídeo (incluindo `background.loop`), câmera, transições e keyframes. Não há mais um formulário duplicado restringindo a cena a apenas duas imagens laterais.

### Ações e linha do tempo

O storyboard possui **Desfazer** e **Refazer** para edições visuais, inclusive criação, exclusão, inserção e duplicação. Inserir/duplicar agora escreve uma pausa na narração (`audio.silenceInserts`) e desloca eventos posteriores; editar manualmente o JSON reinicia o histórico visual. Veja [guia de sincronização](CORRECOES_CACHE_AUDIO_TRANSICOES.md).


- **+ Nova cena:** acrescenta uma cena de cinco segundos após o último trecho.
- **Inserir após:** insere imediatamente depois da cena selecionada e desloca os timestamps absolutos das cenas seguintes, incluindo camadas e SFX, para evitar sobreposição.
- **Duplicar:** duplica uma cena e seus elementos, cria um ID novo e insere após a original; as seguintes são deslocadas.
- **Excluir:** remove a cena mantendo o intervalo anterior da timeline como espaço em preto. O usuário recebe confirmação.
- **Adicionar camada:** escolha entre imagem, vídeo, texto, legenda, sobreposição ou SFX. Complete os assets em **Propriedades avançadas**.
- **Buscar:** filtra por ID, número, tempo ou texto de camadas sem descartar a cena em edição.

### Cache por cena

O endpoint `GET /api/editor/scenes?projectRoot=...` lista os estados `ready`, `changed` e `missing`. A assinatura atual leva em conta o JSON salvo e suas dependências.

O endpoint `GET /api/editor/scenes/:id/media?projectRoot=...` transmite **somente** o MP4 previamente gerado para um ID pertencente ao projeto. Há verificação de manifesto, nome de arquivo derivado de ID seguro, tamanho, mtime e links simbólicos.

- **Em cache:** arquivo consistente com a cena salva.
- **Alterada:** o JSON mudou; o vídeo anterior ainda pode ser visto, mas é identificado como versão anterior.
- **Sem render:** não há segmento íntegro em cache.
- A reprodução de uma cena **não** inicia renderização nem cria Preview completo.
- Os clipes por cena são visuais e não contêm toda a mixagem da narração/trilha.

**Aproveitar cache** continua sendo o comando para atualizar os clipes modificados e gerar o MP4 final; **Refazer tudo** apaga `output/` após confirmação.

## Validação

O CI inclui testes Node de estado do cache/segurança e teste de interface em Chromium/Chrome headless: carregar projeto, selecionar e buscar cenas, criar e duplicar, preservar os IDs e exportar captura de tela.

Os testes de integração existentes do render, transcrição, downloads e inicialização Node no Windows/Linux permanecem ativos.

## Próximas melhorias

O editor já utiliza os vídeos em cache para revisão por cena, mas o futuro `@remotion/player` trará mudanças de posição/escala com atualização de frames sem render. Isso será uma próxima etapa, distinta do antigo Preview de vídeo completo.
