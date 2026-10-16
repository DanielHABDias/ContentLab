# Migração da biblioteca de cenas especiais

## Implementado

- 15 componentes em `scene-library/`, com manifesto, contratos completos, guias, exemplos e 62 imagens neutras em 16:9/9:16.
- As técnicas de percurso, narrativa/evidências, painéis/escolhas, cinética e Parallax foram incorporadas aos componentes existentes, sem duplicá-los.
- Galeria na documentação oficial, com parâmetros, sons, exemplos e preparação do TSX numa pasta de projeto. A instalação não muda o plano, não renderiza e não sobrescreve uma versão diferente.
- Cópias de produção existentes continuam independentes. Os estilos tradicionais antigos permanecem apenas como compatibilidade interna, não como recomendação para novas composições especiais.
- Flip e Curtain são transições nativas entre duas cenas; Blur continua nas quatro direções. Definir `transitionOut` na cena anterior e `transitionDuration` em segundos. A passagem ocupa o início da cena entrante e não encurta o vídeo. A identidade do cache de montagem foi atualizada.
- Templates antigos de examples/custom-scenes retirados. Seus equivalentes constam em MOTION_TECHNIQUES.md. Os originais e os perfis/guias privados foram guardados em backup local fora da distribuição.
- A skill ZIP contém o catálogo, os mesmos manuais do site, fontes de componentes, exemplos, imagens e referências dos módulos genéricos. Não distribui os perfis editoriais privados.

## Validações realizadas em Linux

- TypeScript estrito dos 15 componentes; 62 frames renderizados com mídia neutra.
- Schema e existência dos assets de todos os exemplos; hashes dos componentes conferidos.
- Instalação real pela API e proteção de conflito, sem alteração do edit_plan.json.
- Testes de pixels de Flip/Curtain em horizontal e vertical: estado inicial, giro/revelação e frame final; Blur e duração curta também verificados.
- Suíte Node completa, smoke de render/cache, render pela ponte de customComponent e seis checkpoints.
- Documentação gerada e sincronizada, health e downloads MD/HTML/ZIP verificados; ZIP íntegro com os 15 TSX.

## Limites

Windows não foi executado nesta máquina. Os testes existentes de inicialização continuam presentes, mas não equivalem a homologação visual real em Windows. As prévias são demonstrativas e não substituem a revisão de enquadramento/sincronismo com a mídia de cada produção. Não foi renderizado nenhum vídeo do usuário, alterado o Drive, criado commit ou feito push.

Reabra o Content Lab para carregar as alterações do servidor. A galeria fica em Documentação → Galeria de cenas especiais. Para usar as mídias neutras dos exemplos, copie `scene-library/demo-assets` para `assets/exemplos` do projeto, ou substitua os URIs por seus assets.
