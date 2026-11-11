# Arquitetura do Content Lab

## Decisão

O Content Lab é uma aplicação local em TypeScript/JavaScript, dividida em núcleo determinístico, adaptadores de mídia e superfícies de uso. React/Vite atende a interface; Node executa persistência, FFmpeg, render, CLI e MCP. Remotion é a primeira opção para preview e motion design TSX, sempre atrás de um adaptador para manter o documento do projeto independente do renderizador.

```text
Interface React ─┐
CLI local ───────┼─> comandos validados ─> núcleo ─> projeto/versionamento
MCP stdio ───────┘                         │
                                           ├─> mídia/cache/transcrição/áudio
                                           ├─> timeline/operações/undo
                                           └─> jobs preview/render/pacote
```

Humano e agente enviam os mesmos comandos ao núcleo. Nenhuma superfície escreve diretamente no manifesto ou na timeline.

## Contratos

- `contentlab-project-v1`: projeto, modo de aprovação, etapas, mídia e timeline.
- `contentlab-timeline-v1`: tracks ordenadas e clips genéricos; fundo é apenas uma camada visual.
- `contentlab-operation-v1`: lote atômico com `operationId`, `baseRevision`, `dryRun` e até 100 ações.
- IDs são estáveis. Escritas usam revisão otimista, journal append-only, arquivo temporário, `fsync` quando disponível e rename atômico.
- Mudanças numa etapa reaberta preservam versões e invalidam dependentes aprovados.

Os schemas executáveis estão em `src/core/contracts.js`. Migrações futuras são funções puras `vN → vN+1`; versões desconhecidas falham sem alterar arquivos.

## Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `core` | contratos, comandos, workflow, histórico e eventos |
| `storage` | layout local, locks, snapshots, journal e integridade |
| `media` | importação, hash, cache, cortes, ffprobe e transcrição |
| `audio` | takes, perfis consentidos, tratamento e mixagem |
| `timeline` | operações, layout por proporção, keyframes e undo/redo |
| `render` | preview, Remotion/FFmpeg, jobs, cache e validação |
| `package` | `.contentlab`, ZIP, extração segura e manifesto |
| `adapters` | UI, CLI e MCP stdio |

## Segurança e permissões

- Raízes de projeto e mídia são explícitas; todo caminho é normalizado e conferido contra a raiz.
- Links, arquivos, TSX, pacotes e saídas de agentes são não confiáveis até validação.
- TSX reutilizável passa por allowlist de imports e build isolado; não executa código arbitrário no processo principal.
- MCP usa `stdio`; logs vão para `stderr`, nunca `stdout`. Aprovação de etapa só ocorre por comando explícito autorizado.
- Clonagem de voz exige consentimento registrado no perfil. Upload/publicação não pertencem ao núcleo.

## Testes

Contratos e comandos têm testes unitários; armazenamento, ferramentas e jobs usam integração com diretórios temporários; UI usa testes de comportamento; render inclui frames dourados nas duas proporções e inspeção de mídia com ffprobe. E2E cobre UI, CLI e MCP contra o mesmo projeto.
