# Validação final — 2.1.0-rc.1

Executada em 12 de novembro de 2026: Linux x64 (Zorin OS 18.1), Node 24.21.0, FFmpeg/ffprobe 6.1.1, Ryzen 5 5500 e 15,5 GB de RAM.

## Gates

| Gate | Resultado |
| --- | --- |
| `npm run check` | 182 testes em 26 arquivos e build aprovados |
| `npm run qa:e2e` (servidor real, HTTP, FFmpeg real) | 22/22 etapas; matriz em [QA_E2E_RC.md](QA_E2E_RC.md) |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npm run doctor` | 8/8 dependências prontas, essenciais OK |
| Instalação limpa (HOME vazio, sem npm/node no PATH) | Instala, abre, cria projeto e desinstala mantendo os projetos (F23) |
| Varredura de demos e placeholders | Nenhuma demonstração, "em breve" ou botão sem ação; só dicas de campo |
| Inventário de controles | Nenhum controle sem nome acessível nas telas principais (F21) |

## Matriz E2E coberta

Coberto pelo `qa:e2e`:

- primeira execução;
- criar, configurar e reabrir;
- importar mídia com direitos;
- narração: importar e montar;
- timeline com vídeo, narração, legendas SRT, desfazer e refazer;
- prévia de frame;
- render conferido por ffprobe;
- pedido de mudança no histórico;
- exportar `.contentlab`, importar e reabrir com revisão e timeline idênticas.

Rodou em dois formatos: projeto longo 16:9 e Short 9:16.

Recuperação depois de `kill -9`:

- durante o render, o job é retomado e não sobram `.partial`;
- o projeto continua íntegro;
- durante a importação, nenhuma mídia fica registrada pela metade e repetir a importação funciona.

Coberto por testes de unidade e integração: excluir e restaurar pela lixeira, instalar dependências (download pausado, retomado ou com falha), transcrição, voz clonada (planos de hardware e limite de memória) e pacotes maliciosos.

## Revisão visual e auditiva

- **Vídeo:** o frame do render e a prévia do mesmo plano mostram a legenda acentuada idêntica, dentro da área segura e quebrada corretamente em 9:16.
- **Áudio dos renders:** cerca de -15 LUFS, pico -11 dBFS, sem clipping. Foi medido com tons sintéticos.
- **Voz clonada real (F17):** gerada e medida (-17,7 LUFS, -1,5 dBTP), mas a escuta do ritmo depende do titular da voz.

## Não verificado nesta máquina

- VM com outra distribuição.
- Windows e macOS.
- GPU.
- Assinatura do instalador (falta a chave de release).

Detalhes em [NOTAS_DA_VERSAO.md](NOTAS_DA_VERSAO.md).

## Comandos

```bash
npm run doctor
npm run check
npm run qa:e2e
npm audit --omit=dev
npm run package:linux
```
