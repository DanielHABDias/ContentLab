# Narração, voz e áudio

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

## Geração por cena

O roteiro vira cenas pelos parágrafos de Abertura, Desenvolvimento e Payoff (Direção visual e Fontes não são narradas). `voice.generate` exige `voice.synthetic` (VoxCPM2 instalado), roda uma geração por vez no computador (`VOICE_BUSY`), cena a cena, com fase, estimativa pela velocidade medida e cancelamento. Cada take gerado guarda `sceneId`, `profileId` e uma chave SHA-256 de modelo + perfil + amostra + texto de referência + texto da cena: gerar de novo reaproveita as cenas iguais e só refaz as que mudaram; takes cujo texto mudou aparecem como desatualizados.

## Modelo escolhido: VoxCPM2

`VoxCPM2` (OpenBMB, Apache-2.0, uso comercial permitido) é a única integração de voz clonada. Ele usa a amostra **e o texto exato lido nela** ("ultimate cloning"), por isso o perfil exige `referenceText`.

### Como foi escolhido (2026-11-11)

Candidatos locais com licença comercial e português: VoxCPM2, Qwen3-TTS 1.7B (Apache-2.0) e Chatterbox Multilingual (MIT). Fish S2 Pro e Voxtral foram descartados porque a licença não concede uso comercial (canal monetizado) e não cabem nesta máquina. Teste às cegas com a voz do usuário (referência de 32 s, 3 frases novas, notas 1–5 "parece comigo / natural"):

| Motor | Parece comigo | Natural | WER | Pico de RAM | s por s de áudio (CPU) |
|---|---|---|---|---|---|
| **VoxCPM2** | **4,7** | **4,3** | 0 | 11,1 GB | ~29 |
| Qwen3-TTS 1.7B | 4,3 | 3,7 | 0 | 10,2 GB | ~10 |
| Chatterbox | 3,0 | 2,3 | 0 | 6,7 GB | ~6 |

Limitações: um ouvinte, três frases; os testes públicos em português (relatórios do VoxCPM2 e do ZONOS2) apontam na mesma direção em similaridade. O Chatterbox foi removido.

### Recursos dinâmicos

`src/setup/hardware.js` lê RAM total e disponível, swap, núcleos, AVX2/AVX-512/bf16, GPU NVIDIA (VRAM e CUDA do driver), AMD (gfx e ROCm) e Apple Silicon, e `planVoiceRuntime` decide:

- dispositivo e build do PyTorch: CPU (`torch 2.15.0`, validada), CUDA `cu130`/`cu128`/`cu126` conforme o driver e ≥ 8 GB de VRAM, ROCm 7.1 só para gfx suportados, MPS no Mac (builds de GPU ainda não validadas);
- núcleos: todos menos ~25% (mínimo 2) reservados ao sistema;
- teto de memória: entre o necessário (11,5 GB em CPU) e a RAM livre menos 0,5 GB, sem passar de RAM total − reserva;
- `unsupported` quando a RAM total não comporta; `needs-free-memory` quando falta RAM livre agora.

`VoxCPMVoice` executa cada geração via `systemd-run --user --scope -p MemoryMax=… -p MemorySwapMax=0 nice -n 15` no Linux. Sem esse limite, a primeira tentativa congelou o sistema; com ele, o processo é encerrado e o usuário recebe `MEMORY_LIMIT`. A velocidade real medida recalibra a estimativa por máquina (`setup-state.json`).

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

Ao abrir “Narração com a sua voz” e antes de gerar a amostra em “Minha voz” (botões “Ouvir como ficou” e “Gerar de novo”), o app confere a RAM. Em “Minha voz”, a conferência que falha não inicia a geração; depois de liberar memória, clique novamente para tentar. Se a geração falhar por memória no servidor, os recursos são conferidos novamente para mostrar o mesmo painel quando ainda faltar RAM. Se faltar memória (`needs-free-memory`), aparece o painel **Libere X GB**: quanto falta e os programas do usuário que mais usam RAM (`src/system/apps.js`, via `ps`, Linux e macOS). Cada um tem **Fechar** com confirmação: primeiro `SIGTERM` e espera até 5 s; se o programa não responder, a interface oferece **Forçar fechamento** (`SIGKILL`, perde o que não foi salvo). Navegadores mostram a opção de fechar só algumas abas pelo gerenciador de tarefas deles (Shift+Esc). Nunca aparecem nem podem ser fechados: processos do sistema e da sessão gráfica, terminais, o próprio Content Lab (node, Python do VoxCPM2, ferramentas de `.tools`) e o Claude Code. Mesma operação na API (`/api/v1/system/apps`, `/api/v1/system/close-app`) e na CLI (`system.apps`, `system.close-app`); o MCP não fecha programas.
