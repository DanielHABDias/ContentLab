# Segurança, privacidade e retenção

Content Lab é um app local. Nada é enviado para fora do computador, exceto downloads que a pessoa pede explicitamente: dependências em Dependências, e URLs de mídia com direitos confirmados. Não há telemetria.

## Modelo de ameaças

| Superfície | Ameaça | Proteção | Teste |
| --- | --- | --- | --- |
| API HTTP local (`127.0.0.1`) | Um site aberto no navegador chama a API (CSRF) ou usa DNS rebinding | Só aceita `Host` local, recusa `Sec-Fetch-Site` de outro site e `Origin` diferente, e exige o cabeçalho `x-contentlab-client` em escritas. CSP `frame-ancestors 'none'`, `nosniff`, `no-referrer`. | `http-server.test.js` |
| Interface | Carregar código de terceiros, ou vazar o IP para CDN de fontes | As fontes são locais (`@fontsource`) e a CSP é `default-src 'self'` | build |
| Pacotes `.contentlab`/ZIP | Path traversal, caminho absoluto, symlink, entrada duplicada, blob adulterado, ZIP bomb | `safeRelative`, recusa de symlink e de duplicatas, SHA-256 e tamanho de cada blob, escrita com `wx` (nunca sobrescreve). Limites antes de descompactar: 50 000 entradas, 6 GB no total (`CONTENTLAB_MAX_PACKAGE_BYTES`), taxa de compressão até 200:1 acima de 64 MB, e cada entrada não passa do tamanho declarado. | `package-service.test.js` |
| Caminhos de projeto e mídia | Escrita fora das raízes | Tudo é escrito dentro da pasta do projeto ou das raízes de Configurações. Os nomes de arquivo são sanitizados e as prévias são servidas só por nome validado por regex. | testes de mídia, edição e narração |
| URLs (yt-dlp) | Mídia sem direitos ou binário malicioso | Exige confirmar os direitos. O yt-dlp tem versão fixada e SHA-256 verificado. | `media-operations.test.js` |
| Componentes TSX | Execução arbitrária no processo principal | Allowlist de imports. Transpila e renderiza em processo filho com `--max-old-space-size`, `PATH`/`HOME` mínimos e timeout. | `component-registry` / runtime |
| FFmpeg, ffprobe, whisper, VoxCPM2, yt-dlp, git/cmake | Travar, consumir memória, ou injeção de shell | Sempre `execFile`/`spawn` sem shell, com timeout, `maxBuffer` e cancelamento. O render manda SIGTERM e depois SIGKILL após 5 s, com timeout de 6 h (`CONTENTLAB_RENDER_TIMEOUT_MS`). A voz roda sob `systemd-run MemoryMax`. Os temporários (`.partial`, staging, textos de legenda) são removidos em caso de erro. | testes de render e narração |
| Perfis de voz | Clonar voz de terceiros | Exige consentimento explícito e o nome do titular. Sem consentimento válido, a geração é recusada (`CONSENT_REQUIRED`). Só são usados modelos com licença comercial. | `narration-service.test.js` |
| Relatórios | Vazar dados pessoais | O "Sobre e diagnóstico" troca a pasta pessoal por `~` e não inclui títulos, roteiros, caminhos de projeto nem perfis de voz. | `local-application-service.test.js` |

CLI e MCP chamam o núcleo diretamente, sem HTTP. O processo principal não executa código vindo de projetos ou pacotes.

## Retenção e exclusão

| Dado | Onde fica | Quando sai |
| --- | --- | --- |
| Projeto (manifesto, histórico, roteiro, takes) | Pasta do projeto | Quando a pessoa exclui o projeto: vai para a lixeira do sistema e, sem lixeira, exige uma segunda confirmação. |
| Mídia original | Cache deduplicado por SHA-256 | Em "Analisar mídias sem uso", com seleção e confirmação. Nunca é removida automaticamente. |
| Cortes, downloads temporários, cache de render, prévias | Raízes de cache | Em "Limpar derivados", que pede confirmação. Tudo pode ser recriado. |
| Perfil de voz (amostra, consentimento) | `<dados>/voices/<id>/` | "Excluir perfil" mostra os takes gerados em cada projeto e apaga tudo junto. |
| Registro de Recentes | `<dados>/` | Guarda só caminhos e mantém um backup a cada alteração. |
| Pacotes exportados | Onde a pessoa escolher | Por padrão excluem `cache/`, prévias e staging de narração e o lock. Renders só entram se forem pedidos. |

Nada expira sozinho: o Content Lab avisa sobre os limites de disco em Configurações, mas não apaga sem confirmação.

## Licenças e redistribuição

| Componente | Licença | Como chega | Pode ir no instalador? |
| --- | --- | --- | --- |
| Node.js | MIT | Requisito | Sim |
| FFmpeg/ffprobe | LGPL-2.1+ ou GPL-2.0+, conforme a build | Pacote do sistema | Só uma build LGPL, com aviso e o código-fonte correspondente. Hoje o Content Lab usa a build do sistema e não redistribui. |
| zenity | LGPL-2.1+ | Pacote do sistema (Linux) | Não é empacotado |
| yt-dlp | Unlicense | Baixado em Dependências (versão e hash fixados) | Sim |
| whisper.cpp | MIT | Compilado em Dependências | Sim, com o aviso MIT |
| Pesos Whisper large-v3 | MIT | Baixados com consentimento (cerca de 3 GB) | Possível, mas são baixados sob demanda pelo tamanho |
| VoxCPM2 | Apache-2.0 | Baixado com consentimento | Sim, com NOTICE. O uso comercial é permitido. |
| PyTorch | BSD-3-Clause | pip no venv isolado | Baixado sob demanda |
| Inter e Barlow Condensed | OFL-1.1 | npm `@fontsource` (no bundle) | Sim |
| Dependências npm de produção | Verificadas pelo `npm audit --omit=dev` a cada etapa | — | — |

Antes de distribuir (F23): incluir os textos das licenças em `licenses/` e manter os itens pesados como download sob demanda.
