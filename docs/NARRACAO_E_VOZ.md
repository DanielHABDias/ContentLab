# Narração, voz e áudio

Cada gravação é um take WAV independente, associado a um trecho do roteiro. Takes podem ser cortados, removidos, regravados, reordenados e montados sem alterar os originais. O tratamento local usa redução de ruído opcional, high-pass, compressão leve e normalização EBU R128; o alvo padrão é -16 LUFS e o pico verdadeiro -1,5 dB.

## Perfil e consentimento

Um perfil de voz guarda nome, amostra, texto efetivamente lido, titular e data do consentimento. Geração é bloqueada sem esses campos. Recomenda-se amostra limpa de 10–30 segundos, uma única pessoa, sem música/reverberação e com fala natural em português brasileiro. O perfil e a saída permanecem locais.

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
