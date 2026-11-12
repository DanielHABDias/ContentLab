# Instalação, atualização e desinstalação

## Decisão de shell

Avaliei o Electron e o Tauri contra um pacote com Node embutido e o navegador do sistema, e fiquei com o Node embutido.

- **Núcleo e contratos sem mudança:** o app continua sendo o mesmo servidor local, e a interface, a CLI e o MCP chamam o mesmo núcleo.
- **Tamanho:** o pacote tem cerca de 126 MB compactado, já com o Node. O Electron somaria mais cerca de 100 MB. O Tauri exigiria Rust e uma ponte nova para o núcleo Node.
- **Reavaliar** quando forem necessários: janela própria, ícone na bandeja, ou assinatura de código exigida pelo Windows ou pelo macOS.

O primeiro sistema oficialmente suportado é o **Linux x64**, instalado por usuário, sem sudo. O seletor de arquivos nativo também funciona no Windows e no macOS (F21), mas esses sistemas ainda não têm instalador.

## Gerar o pacote (quem publica)

```bash
node scripts/release-keys.mjs                       # uma vez: chave privada fora do repo, pública em packaging/
CONTENTLAB_SIGNING_KEY=~/.config/contentlab-release/update-signing-key.pem \
  node scripts/package-linux.mjs --channel stable --base-url https://SEU-HOST/contentlab/stable/ --notes "O que mudou"
```

A pasta `release/` fica com três arquivos:

- `contentlab-<v>-linux-x64.tar.gz`: o app, as dependências de produção, o Node embutido, o launcher, `install.sh` e `licenses/`;
- `.sha256`;
- `stable.json`: o manifesto assinado com Ed25519.

Sem `CONTENTLAB_SIGNING_KEY`, o manifesto sai sem assinatura. Sem `packaging/release-public-key.pem`, o build só aceita atualização manual.

## Instalar (quem usa; não precisa de npm)

```bash
tar -xzf contentlab-2.0.0-linux-x64.tar.gz && ./contentlab-2.0.0-linux-x64/install.sh
```

A instalação cria um item no menu de aplicativos e o comando `~/.local/bin/contentlab`. O FFmpeg e o zenity vêm do sistema, e o app explica como instalá-los em Dependências.

| Parte | Onde fica | O que acontece ao atualizar |
| --- | --- | --- |
| Aplicativo | `~/.local/share/contentlab/app/versions/<v>`, com `current` e `previous` | Instalado ao lado da versão atual; a anterior fica guardada |
| Dados (configurações, Recentes, perfis de voz, mídias originais) | `~/.local/share/contentlab/data` | Intocado |
| Ferramentas e modelos | `~/.local/share/contentlab/tools` | Intocado |
| Cache recriável (render) | `~/.cache/contentlab` | Intocado |
| Projetos novos | `~/Content Lab` (ou outra pasta, em Configurações) | Intocado |

## Atualizar

- **Automático:** em Configurações → Sobre e diagnóstico → Atualizações, escolha o canal (Estável ou Beta) e use "Verificar agora". Também funciona pelo terminal com `contentlab --update`.
  - O manifesto precisa ter assinatura válida.
  - O pacote é conferido por tamanho e SHA-256, e o tar é verificado contra caminhos inseguros.
  - A versão gravada no pacote tem que bater com a anunciada.
  - A troca é atômica, por link, e só acontece depois de tudo verificado.
- **Manual:** `contentlab --install-archive arquivo.tar.gz --version 2.1.0 --sha256 <hash publicado>`. A opção "Só atualizar manualmente" desliga as verificações.
- **Voltar versão:** `contentlab --rollback`, ou o botão "Voltar para …" na mesma tela.

## Desinstalar

`contentlab --uninstall` pergunta sobre cada parte separadamente e mostra o tamanho de cada uma:

1. o aplicativo (sim por padrão);
2. cache e modelos (não por padrão);
3. dados (não por padrão);
4. a pasta padrão de projetos. Para apagá-la é preciso digitar `APAGAR PROJETOS`. Projetos em outras pastas nunca são tocados.

Com `--yes`, sem nenhuma outra opção, só o aplicativo é removido.

## Instalação limpa verificada (2026-11-12)

Fiz a instalação em um HOME vazio, com o PATH reduzido a `/usr/bin:/bin` e com `npm`, `node` e `npx` substituídos por executáveis que falham se forem chamados.

- A instalação, a abertura (o navegador foi chamado), a criação de projeto pela API e o status de atualização funcionaram.
- A desinstalação removeu só o app e manteve o projeto, os dados e os modelos.
- **Bug encontrado e corrigido:** `typescript` estava em devDependencies, mas é usado em runtime pelos componentes TSX.

Esse teste não usou uma VM com outra distribuição. Isso fica para a F24.

## Requisitos (medidos nesta máquina de referência)

Máquina de referência: Ryzen 5 5500 (12 threads), 15,5 GB de RAM e GPU AMD integrada não usada. Valores para Linux x64.

| Uso | Mínimo | Observado |
| --- | --- | --- |
| Editar, transcrever e renderizar | 4 núcleos, 8 GB de RAM, cerca de 5 GB livres (app de 0,4 GB instalado + whisper large-v3 de 3 GB + cache) | Render de 1080p30 abaixo do tempo real em clipes curtos |
| Voz clonada VoxCPM2 (CPU) | 12 GB de RAM livre para o limite de memória, mais 7,5 GB de disco | Cerca de 30 s de processamento por segundo de fala, com 9 threads |
| GPU | Opcional; ainda não usada no render nem na voz | — |

## Ainda falta

- **Assinar o instalador:** a infraestrutura de assinatura das atualizações (Ed25519) está pronta, mas a chave de release ainda não foi gerada. Gerar e guardar essa chave é decisão de quem publica. Não existe assinatura de código do sistema (como o GPG da distribuição).
- **Instaladores para Windows e macOS.**
- **Teste em VM** com outra distribuição.
