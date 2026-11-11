# Narração, voz e áudio

Tudo fica em `<projeto>/narration/` (`src/audio/narration-service.js` + `src/server/narration-operations.js`), pela mesma API usada pela interface:

- **Takes**: gravação pelo microfone (só depois do clique em “Permitir microfone”; captura sem cancelamento de eco/ruído do navegador) ou importação de áudio/vídeo. Cada take guarda o original como veio (`takes/<id>/original.*`) e um WAV de trabalho PCM 48 kHz mono (`take.wav`).
- **Montagem não destrutiva**: renomear, cortar (início/fim gravados no manifesto, aplicados com `atrim` só na montagem), reordenar e excluir. `narration.json` tem revisão otimista (`NARRATION_CONFLICT` → HTTP 409).
- **Tratamento** (na ordem): cortar silêncio das pontas, redução de ruído (`afftdn`), high-pass 80 Hz, preset de timbre, compressão leve e loudness EBU R128 (`loudnorm`, alvo -14/-16/-19 LUFS, pico verdadeiro -1,5 dB). Presets do antigo Voice Studio: Original, Quente (-0,5 st, +3 dB graves), Suave (+0,5 st, +1 dB), Equilibrada (0 st, +1,5 dB) e Grave (-1,5 st, +4 dB); tom via `rubberband` com formantes preservados e graves via `bass` em 110 Hz.
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
