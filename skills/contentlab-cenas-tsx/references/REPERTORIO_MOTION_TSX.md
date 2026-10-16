# Técnicas e biblioteca atual

A biblioteca canônica está em scene-library/manifest.json. A galeria da documentação oferece imagens, contratos e exemplos. Os templates anteriores foram retirados; projetos que possuem cópias próprias não são alterados.

| Técnica | Padrão atual |
| --- | --- |
| Percurso, narrativa e evidências | BrainstormHQ: presentation path/narrative/evidence |
| Painéis, escolhas e Parallax | PaginaHQCenas: panelLayout asymmetric/split/parallax |
| Tipografia cinética | TextoHQ: entryAnimation kinetic |
| Carrossel de frases | CarrosselFrasesHQ |
| Notificação e caixas livres | CaixinhaHQ |

Flip, Curtain e Blur são transições do compositor entre cenas reais, não templates TSX. Use transitionOut e transitionDuration na cena anterior; o movimento ocupa o começo da próxima cena, sem encurtar o vídeo. Slide sem blur é legado. Sons são explícitos no plano, centralizados perceptivamente no movimento após aparar silêncio.
