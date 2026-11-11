# Validação da biblioteca — versão 3

Os 15 componentes foram compilados com TypeScript estrito e exercitados em 16:9 e 9:16, com 35 exemplos oficiais e variantes adicionais de texto, enquadramento e entrada. Foram gerados 183 resultados de teste de imagem/continuidade sem erros de execução. As prévias do catálogo são demonstrativas e usam imagens e clipes de teste, não assets dos projetos de vídeo.

## Correções principais

- Fundos: ordem estável dos hooks ao alternar estilos; estrelas preparadas uma vez e transparência preservada.
- Brainstorm: cronologia e medidas de texto preparadas; conexões das cartas na frente, ligadas às bordas.
- Texto: preparação dos blocos e entrada cinética opcional por palavra, sem perder a chegada da última unidade.
- Comparativo, galeria, imagem/frases e diálogo: leitura dos limites transparentes das imagens compartilhada em cache, com proteção contra carregamentos assíncronos tardios.
- Galeria: deslocamento de entrada reduzido e processamento linear das pilhas, preservando as bordas visíveis.
- Linha do tempo e Página HQ: expansão completa no último frame; preparação dos intervalos e montagem seletiva dos vídeos fora de quadro na linha do tempo.
- Espiral: geometria e buffer reutilizados, mantendo a aparência pixelada e a ondulação aprovada.
- Quadro: compactação configurável no horizontal e ajuste de textos longos.
- Encerramento: ajuste de títulos longos e escala proporcional no vertical; controles opcionais de tempo, personagem e saída.
- Caixinha: curva de deslizamento opcional, sem alterar o pop ou as ações dos presets.
- Loading: pontos preparados e progresso final correto, preservando pausas e gradientes.
- Carrossel: comportamento aprovado preservado e incluído nos testes de chegada e exemplos visuais.

## Limites da validação

As verificações de imagem não substituem assistir ao vídeo final com seus assets reais. Não foi renderizado um vídeo de produção nem feita audição completa de uma mixagem. Os efeitos sonoros continuam externos ao TSX e precisam acompanhar os tempos configurados no plano. Nenhum TSX de projetos antigos foi sobrescrito automaticamente.

O ganho medido no cálculo isolado da espiral não é uma estimativa de ganho do render completo; navegador, composição, mídia e codificação têm custos próprios.

## Manutenção

`node scripts/sync-scene-library.mjs --check` verifica a sincronização dos fundos incorporados, dos auxiliares e dos contratos do catálogo. Execute sem `--check` após modificar a implementação canônica. Copie sempre todos os arquivos listados em `companions` ao instalar manualmente uma cena.
