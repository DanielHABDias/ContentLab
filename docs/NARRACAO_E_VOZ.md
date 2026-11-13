# Narração, voz e áudio

## Gravar, pausar e editar pela onda

Em **Eu gravo**, permita o microfone e use **Gravar**, **Pausar gravação**, **Retomar gravação** e **Parar e salvar**. Pausar mantém o mesmo take e não inclui o intervalo parado. O monitor mostra a onda real do microfone. Ao salvar, o editor do take abre; também é possível abri-lo pelo botão **Editar** de qualquer take gravado ou importado. Se o envio falhar, mantenha a aba aberta e use **Tentar salvar gravação**: o áudio capturado continua disponível nela.

No editor, arraste sobre a onda para selecionar um trecho. **Excluir seleção** remove o erro e junta as partes restantes; **Manter seleção** conserva só o trecho escolhido. Amplie com Zoom e use a roda do mouse sobre a onda para navegar para os lados, sem barra de rolagem visível. É possível desfazer/refazer e restaurar o original antes de salvar. A seleção é apenas visual: Salvar guarda os cortes já aplicados, mesmo com outro trecho selecionado, sem exigir limpar a seleção. **Cancelar** descarta os ajustes. Os cortes são intervalos do arquivo original, preservado no disco; o preview, a montagem e a transcrição da narração final usam somente os intervalos mantidos. Alterar um take usado numa montagem marca essa montagem como desatualizada e exige montar/transcrever novamente.

Ao clicar em **Montar narração final** ou **Montar de novo**, o botão mostra **Iniciando montagem…** imediatamente e impede cliques repetidos. Depois, mostra **Montando narração…** e a fase atual junto ao botão, até terminar também a transcrição. Uma falha ao iniciar libera o botão e mostra um aviso para tentar novamente.

Os players de áudio em narração, previews, mídias e Minha voz mostram ondas calculadas a partir do arquivo, com posição, volume e velocidade. As ondas de arquivos longos são calculadas em fluxo no servidor local; uma falha nelas não bloqueia a reprodução.

## Ler durante a gravação

Em **Narração → Eu gravo**, clique em **Abrir roteiro em outra aba**, disponível no roteiro e ao lado dos controles de gravação. O atalho fica separado dos controles de captura. Mova a aba para a segunda tela e mantenha a gravação na aba principal; o botão Parar e salvar fica na faixa inferior do gravador. A aba de leitura exibe somente falas, separadas por capítulos com títulos de orientação, com ajuste de tamanho do texto e atalhos de capítulos. Abrir ou fechar essa aba não interrompe o microfone da aba principal. Se editar o roteiro, clique em **Atualizar roteiro** na aba de leitura; o texto não muda automaticamente durante a fala.


Tudo fica em `<projeto>/narration/` (`src/audio/narration-service.js` + `src/server/narration-operations.js`), pela mesma API usada pela interface:

- **Takes**: gravação pelo microfone (só depois do clique em “Permitir microfone”; captura sem cancelamento de eco/ruído do navegador) ou importação de áudio/vídeo. Cada take guarda o original como veio (`takes/<id>/original.*`) e um WAV de trabalho PCM 48 kHz mono (`take.wav`).
- **Montagem não destrutiva**: renomear, cortar (início/fim gravados no manifesto, aplicados com `atrim` só na montagem), reordenar e excluir. `narration.json` tem revisão otimista (`NARRATION_CONFLICT` → HTTP 409).
- **Tratamento** com modelos locais (`treatParts`): 1) **limpeza por IA** com o DeepFilterNet3 (`bin/deep-filter`, dependência “Limpeza de voz com IA”, ~0,15 s de processamento por segundo de áudio em CPU), que tira ruído de fundo sem robotizar a voz; 2) **Silero VAD** (`bin/whisper-vad-speech-segments` + `models/ggml-silero-v5.1.2.bin`, parte do item Whisper) acha os trechos de fala; `editPlan` dá folga de 80 ms antes e 140 ms depois de cada fala, **silencia respiros** e ruídos entre as frases e **encurta pausas** acima do limite (0,25/0,4/0,7 s; pontas com 0,2 s), com fades de 12 ms; 3) high-pass 70 Hz e compressão de locução relativa ao nível medido da fala; 4) ganho linear medido até o alvo (−14/−16/−19 LUFS) com limitador de pico (−2 dBFS). Sem `loudnorm` dinâmico, sem `afftdn` e sem timbre/mudança de tom. Recurso sem modelo instalado fica travado na interface com atalho para instalar, e a API recusa com `DEPENDENCY_MISSING`. O formato antigo (`denoise`, `trimSilence`, `preset`) continua aceito ao ler narrações existentes.
- **Preview A/B**: os primeiros 20 s sem e com tratamento, ambos medidos.
- **Medição**: `measureAudio` informa duração, codec, taxa, canais, loudness integrado e pico verdadeiro (`ebur128`) e se o arquivo é WAV 48 kHz mono.
- **Montar narração**: job com progresso e cancelamento; a saída precisa ser WAV 48 kHz mono, fica medida no manifesto e entra no catálogo do projeto como mídia de áudio (direitos: própria). Excluir um take usado marca a montagem como desatualizada.

## Perfil e consentimento

Perfis ficam fora dos projetos, em `<dados>/voices/<id>/` (permissão 0700/0600), e são criados a partir de um take: o assistente pede nome, titular, o texto exato lido e a marcação explícita de consentimento. O servidor recusa sem consentimento (`CONSENT_REQUIRED`), sem texto (`REFERENCE_TEXT_REQUIRED`) ou com amostra fora de 3–60 s ou silenciosa; a data do consentimento é gravada pelo servidor. Recomenda-se amostra limpa de 10–30 s, uma pessoa, sem música/reverberação e fala natural em PT-BR.

**Excluir perfil** primeiro mostra o relatório (projetos dos Recentes afetados, takes gerados, bytes e montagens que os usam) e só apaga com confirmação: remove a amostra, os takes gerados com esse perfil, a montagem que os usava e a mídia correspondente no catálogo. Projetos fora dos Recentes não são varridos.

## Transcrição automática e gravação por capítulo

Na opção **Eu gravo**, o roteiro de leitura é agrupado por capítulos e contém somente o texto dos blocos de narração. Os títulos são orientação, identificados como não narrados; cenas, direção e fontes não aparecem na leitura. A voz clonada usa exatamente os mesmos blocos narráveis.

Após montar os takes, o app transcreve o WAV final com Whisper `large-v3` completo em português. O job só conclui depois de salvar os tempos de início/fim de cada palavra; falha preserva o áudio e bloqueia a passagem à edição até retomar a transcrição. A interface mostra o estado e permite tentar novamente. Pelo MCP, `narration_transcript` fornece as palavras e tempos paginados para orientar cortes, mídia e legendas.

## Geração por cena

O [roteiro em capítulos e blocos](ROTEIRO.md) vira um take por bloco `narration`, na ordem dos capítulos e blocos. Só `text` é enviado à voz: títulos de capítulo/bloco, `scene` (cena/som original), `direction` e fontes nunca são narrados. IDs estáveis preservam o cache ao mover ou renomear. Projetos antigos continuam usando os parágrafos de Abertura, Desenvolvimento e Payoff até a primeira edição em blocos. `voice.generate` exige `voice.synthetic` (VoxCPM2 instalado), roda uma geração por vez no computador (`VOICE_BUSY`), cena a cena, com fase, estimativa pela velocidade medida e cancelamento. Cada take gerado guarda `sceneId`, `profileId` e uma chave SHA-256 de modelo + perfil + amostra + texto de referência + texto da cena: gerar de novo reaproveita as cenas iguais e só refaz as que mudaram; takes cujo texto mudou aparecem como desatualizados.

## Modelo escolhido: VoxCPM2

`VoxCPM2` (OpenBMB, Apache-2.0, uso comercial permitido) é a única integração de voz clonada. Ele usa a amostra **e o texto exato lido nela** ("ultimate cloning"), por isso o perfil exige `referenceText`.

### Recursos dinâmicos

`src/setup/hardware.js` lê RAM total e disponível, swap, núcleos, AVX2/AVX-512/bf16, GPU NVIDIA (VRAM e CUDA do driver), AMD (gfx e ROCm) e Apple Silicon, e `planVoiceRuntime` decide:

- dispositivo e build do PyTorch: CPU (`torch 2.15.0`, validada), CUDA `cu130`/`cu128`/`cu126` conforme o driver e ≥ 8 GB de VRAM, ROCm 7.1 só para gfx suportados, MPS no Mac (builds de GPU ainda não validadas);
- núcleos: todos menos ~25% (mínimo 2) reservados ao sistema;
- teto de memória: entre o necessário (11,5 GB em CPU) e a RAM livre menos 0,5 GB, sem passar de RAM total − reserva;
- `unsupported` quando a RAM total não comporta; `needs-free-memory` quando falta RAM livre agora.

`VoxCPMVoice` executa cada geração via `systemd-run --user --scope -p MemoryMax=… -p MemorySwapMax=0 nice -n 15` no Linux. Se o processo exceder o limite, ele é encerrado e o usuário recebe `MEMORY_LIMIT`. A velocidade real medida recalibra a estimativa por máquina (`setup-state.json`).

### Marca d'água

O VoxCPM2 não declara marca d'água. O canal deve continuar sinalizando conteúdo sintético realista conforme as regras do YouTube, e o consentimento do titular continua obrigatório.

A validação auditiva final continua exigindo corpus PT-BR autorizado no hardware do usuário antes de declarar qualidade de produção.

## “Minha voz”: gravar o perfil (fora dos projetos)

A tela **Minha voz**, na barra lateral, é o único lugar onde a voz da pessoa é gravada. Ela não pertence a nenhum projeto: os perfis são do computador e valem para todos.

1. O app mostra um texto de leitura de cerca de 147 palavras, umas 60 s em ritmo de narração. Ele cobre bem os sons do PT-BR e tem perguntas, exclamações e números, para o modelo aprender entonação e não só timbre.
2. O microfone só é pedido quando a pessoa clica em "Começar a gravar". A gravação para sozinha em 58 s, porque o limite da amostra é de 60 s.
3. A amostra vai para uma área temporária global (`<dados>/voices/.staging/<uuid>/amostra.wav`), convertida em WAV e medida. A pessoa ouve antes de criar o perfil e pode gravar de novo; a área temporária é apagada ao criar o perfil ou ao fechar o diálogo.
4. O texto de referência já vem preenchido com o texto lido e pode ser corrigido se alguma palavra mudou. Amostras com menos de 20 s recebem um aviso, porque soam mais robóticas.
5. Criar o perfil exige o nome do titular e o consentimento marcado.

**Ouvir como ficou:** cada perfil tem o botão "Ouvir como ficou", que gera uma frase curta com a própria voz clonada (`voice.check`, `<dados>/voices/<id>/check.wav`) e a mostra logo abaixo da amostra gravada. É a forma de conferir o resultado antes de usar o perfil num vídeo. Em CPU a geração leva minutos; o job mostra a estimativa e pode ser cancelado. Uma geração de voz por vez no computador, seja de cena ou de conferência (`VOICE_BUSY`).

**Vários perfis:** dá para ter quantos perfis quiser (voz calma, voz animada, outra pessoa com autorização por escrito) e escolher qual usar em cada projeto, na etapa Narração.

## Quem narra é escolhido na etapa Narração

`narrationBy` começa `null` ao criar o projeto. Na etapa Narração a pessoa escolhe:

- **Voz de IA (sua voz clonada)**: só aparece habilitada quando existe ao menos um perfil em Minha voz. Sem perfil, o rádio fica desabilitado, a tela explica por quê e oferece o atalho para Minha voz; o servidor também recusa (`VOICE_PROFILE_REQUIRED`) tanto em `createProject` quanto em `project.update`, venha a chamada da interface, da CLI ou do MCP.
- **Eu gravo**: a pessoa grava ou importa os takes na própria etapa e a seção de voz clonada some da tela.

Não existe voz sintética genérica no Content Lab: a narração por IA é sempre a voz clonada da pessoa, com consentimento registrado.

## Liberar memória para a voz clonada

O painel aparece **somente depois de uma tentativa de geração que encontra falta de memória**, tanto em Narração quanto em Minha voz. Não aparece ao abrir a página nem por causa de tarefas antigas que falharam. A conferência é feita antes de iniciar a geração; uma falta de memória durante o job também abre o painel.

**Tentar de novo** remove o painel imediatamente, confere os recursos atuais e repete a mesma solicitação (perfil e cenas). O painel só volta se a memória continuar insuficiente. Outros erros usam o aviso correspondente. Não há troca automática de modo.

O painel mostra quanto falta e os programas do usuário que mais usam RAM (`src/system/apps.js`, via `ps`, Linux e macOS). Cada programa tem **Fechar** com confirmação: primeiro `SIGTERM`, com espera de até 5 s; se não responder, oferece **Forçar fechamento** (`SIGKILL`, perde o que não foi salvo). Navegadores mostram a alternativa de fechar abas pelo gerenciador de tarefas deles (Shift+Esc). O filtro bloqueia os nomes de processos centrais da sessão gráfica, terminais, Content Lab e Claude Code; nomes internos desconhecidos ainda podem aparecer, pois o agrupamento é pelo nome do processo. API: `/api/v1/system/apps`, `/api/v1/system/close-app`; CLI: `system.apps`, `system.close-app`. O MCP não fecha programas.

## Modos de voz

Em **Configurações → Voz de IA**, a pessoa escolhe um modo global, usado tanto pela narração dos projetos quanto por “Ouvir como ficou”. A escolha persiste em `settings.json`, com revisão otimista; configurações antigas continuam no modo Padrão. Mudar pastas ou limites preserva a escolha. Áudios anteriores não são apagados, mas o cache de novas gerações distingue o modo utilizado.

| Modo | Execução | Reserva em CPU |
|---|---|---|
| Padrão | VoxCPM2 original, PyTorch/BF16 | 11,5 GiB |
| Econômico | VoxCPM2 com BaseLM Q8 e parte acústica F16, llama.cpp-omni em CPU | 10,5 GiB |

O modo econômico mantém o perfil e o texto completo da referência. Não encurta a amostra nem reduz os passos de difusão. A saída é decodificada em streaming com contexto e só é promovida depois de validar duração e WAV 48 kHz mono. A reserva de memória é de 10,5 GiB no modo econômico; falta de memória encerra a geração sem recorrer a swap.

O modo econômico tem instalação própria em Dependências: motor compilado do commit `e1047e121ee83cfa70865c0e4d7ebfb858c2cc69` de `tc-mb/llama.cpp-omni`, com bibliotecas estáticas e CPU, e dois pesos do repositório `DennisHuang648/VoxCPM2-GGUF`, revisão `169f64d8b98bbaab1761e4ca3a83e6af653456cc`. Os downloads somam 3.552.406.272 bytes, possuem SHA-256 fixado no catálogo e passam pelo mesmo instalador com consentimento, progresso, retomada e verificação. O modo Padrão continua disponível.

Quando o modo Padrão não cabe na RAM, o painel também oferece **Trocar para modo econômico**. O clique salva a preferência e fecha o painel; se faltar a instalação, mostra o atalho para Dependências. A pessoa tenta gerar novamente, com o modo escolhido. No modo Econômico o painel continua permitindo fechar aplicativos e tentar de novo, sem oferecer uma troca para o mesmo modo.
