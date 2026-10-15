---
name: contentlab-timeline-audio
description: Planeja sincronismo com narração, transcript, SFX, música, cortes, pausas e timeline absoluta do Content Lab.
---

# Content Lab — Timeline, voz e áudio

## Diazverso — áudio e tempo nos TSX oficiais
Consultar [Custom Cenas Diasverso](https://drive.google.com/drive/folders/1yWogLK6bRWXunvdJxTHBMIqB4ibSN44f) e README específico da cena. Os sete TSX são **visuais**: narração, música e SFX ficam no `edit_plan.json`. `timeline[].start/end` em segundos absolutos, tempos de props em segundos relativos (exceto contrato individual), `sfx.at` absoluto. Para PersonagemEspiralLegenda, usar timestamps reais de `transcript.words` + `transcriptOffset` ou `captions` em milissegundos; nunca dividir uniformemente as palavras. Ao expandir Página HQ e Linha do Tempo HQ, continuar o vídeo no sourceStart efetivamente reproduzido sem reiniciar. Teclado só durante escrita, clique no instante exato de pressão, sino durante tremida, whoosh no movimento; `trimDb` não assegura loudness. Nenhum TSX novo pode ser criado por padrão, salvo pedido explícito do criador.


## Fonte temporal
A narração **preparada** é a referência para sincronizar palavras, legendas e beats. O fluxo preferido agora começa na aba **Narração**, sem `edit_plan.json`: o Content Lab remove silêncio das bordas e reduz pausas internas longas (configurável), preserva `audio/narration.original.*`, salva `audio/narration.prepared.wav` e gera o áudio final `audio/narration.wav` com grave opcional. O `transcript.json` é produzido sobre a versão limpa, **antes do pitch**. Depois o ChatGPT cria `edit_plan.json` com `audio.narration: "audio/narration.wav"` e `sources.transcript: "transcript.json"`. `silenceInserts` é etapa de edição posterior: aplique as pausas pelo JSON e deixe o renderer remapear apenas essas inserções. Não duplicar `sourceCuts` de cortes que a aba Narração já realizou.

## Regras de relógio
- `scene.start/end` e `element.start/end`: segundos **absolutos** no vídeo.
- `keyframes[].t` dentro de cenas: segundos **relativos** ao início da cena.
- Eventos de SFX `at`: posição audível absoluta.
- Diferencie duração da cena, janela de visibilidade, entrada, hold e saída.
- Em narrações com timestamps de palavras, ancore revelações nos beats semânticos relevantes; o tempo de leitura pode exigir manter a informação após o enunciado.

## Tratamento de voz
- O fluxo novo na aba Narração reduz silêncio de início/fim e, opcionalmente, pausas internas longas. O auto-trim antigo do plano ainda remove **apenas silêncio inicial e terminal**. Use `audio.voice.autoTrimSilence:false` quando o silêncio de borda for intencional.
- Para um único intervalo de corte da voz use `audio.narrationTrim`; para múltiplos intervalos use `sourceCuts`; não use os dois juntos.
- Após mudar cortes, pausas ou o áudio, a transcrição preparada pode ser regenerada; preserve backup de correções manuais.
- Correções ortográficas no texto da transcrição não autorizam deslocar arbitrariamente timestamps.
- `audio.voice.fadeIn/fadeOut` se refere ao áudio da voz, inclusive encerramento antes de uma cauda musical.

## Timbre natural e referência externa de grave
Os arquivos `audio/narration.original.*`, `audio/narration.prepared.wav` e `audio/narration.wav` têm funções diferentes: gravação bruta preservada, voz limpa/cortada e normalizada que alimenta o Whisper, e **voz final com o tratamento escolhido**. Original no seletor copia `prepared` para `narration.wav`; Corpo natural adiciona EQ suave sem mudar frequência fundamental; Grave suave/equilibrado/profundo alteram o pitch apenas um pouco, preservando a duração, e devem ser aprovados pela escuta.
O Studio agora oferece comparação **A/B** da voz limpa contra a final. Não afirmar que o preset reproduz o Super Grave de algum editor comercial, pois seus parâmetros não são públicos. Se o efeito soar artificial, recomendar primeiro **Corpo natural**, ou Original; depois comparar o mesmo trecho antes de escolher uma opção mais profunda. O pitch só afeta a voz final, não o relógio da transcrição: o `transcript.json` vem de `prepared` antes do processamento do efeito.

## Música e SFX
- Música: `start/end` localizam na timeline final; `sourceStart/sourceEnd` delimitam a região da fonte; `loop` repete o trecho selecionado.
- Música tem auto-trim nas bordas da seleção antes de loop/fades, salvo `autoTrimSilence:false`.
- Crossfades exigem sobreposição real dos intervalos e fades complementares; não confundir transição sonora com visual.
- O início do SFX é seu `at` audível depois da limpeza das bordas. Não remover silenciosamente pausas internas.
- O compositor visual atual coloca a transição `blur_*` no **início da cena entrante**, durante `transitionDuration`; não antecipe o whoosh para o fim da cena anterior. Para centralizar um SFX curto: `at = cena_entrante.start + (duração_visual - duração_audível_após_trim)/2`. Faça arredondamento em frames e confirme num preview curto com áudio. O `at` é absoluto mesmo quando o SFX está listado na cena entrante.
- Priorize a voz e variedade funcional de SFX. Movimentos/animações editoriais requerem cobertura sonora; silêncio é válido em quadros estáticos ou exceções narrativas explicitadas, nunca por omissão.

## Alteração editorial
Ao inserir ou duplicar cenas, mantenha alinhamento dos tempos posteriores e da voz por `silenceInserts` quando adequado; verifique música, SFX e legendas. Não reconfigure automaticamente tempos aprovados só para suavizar movimentos. A renderização final exige ouvir o áudio, além de inspecionar imagens.

## Narração em cenas TSX
Uma cena TSX ainda possui `timeline[].start/end` absolutos; internamente o `useCurrentFrame()` começa em zero para aquela cena e `useVideoConfig().fps` define a conversão para segundos. Forneça ao componente **tempos relativos** aos beats já conferidos na voz preparada. A cena programável não substitui `audio.narration`, música, SFX ou FFmpeg do projeto. Não gere um player de áudio paralelo dentro da composição sem pedido específico.

## Saída para outras skills
Produza mapa de beats (tempo → informação → ação visual → hold → possível SFX) e restrições temporais. O motion é construído sobre esse mapa, não o contrário.

## Âncora de chegada visual — extensão obrigatória do mapa de beats

Entregar a composição/motion estes tempos do `transcript.json` no áudio preparado: `scene.start`, `word.start`, `word.end`, `localWordStart = word.start - scene.start`, `localWordEnd = word.end - scene.start`, `visualReadyBy`, hold e saída. O visual da palavra/ideia falada precisa **estar completamente legível até localWordEnd**, idealmente em localWordStart. O movimento de câmera para o elemento e a entrada de imagens/vídeos obedecem ao mesmo limite. Não usar o início da palavra como ordem para COMEÇAR uma animação longa; preferir chegar a tempo.

Referência observada em `VD_0005/PerguntaAbertura.tsx`: a entrada do personagem termina por volta de +2,91 s e a palavra “Batman” começa por volta de +2,93 s no relógio local. Esses números não são presets, e sim demonstração da relação desejada. Se não for possível dar preroll por ser frame 0, usar o estado legível desde o primeiro frame. Conferir timestamps de fala e o MP4 final antes de afirmar sincronização.

## Regra de SFX por animação/movimento — implementação do relógio

Toda animação/movimento editorial possui **evento sonoro correspondente** (ou áudio embutido existente e verificado). Para cada `scene.id`, mapear `motionStartAbs`, `motionEndAbs` e `sfxAudibleStartAbs`; exigir `motionStartAbs <= sfxAudibleStartAbs < motionEndAbs`. Se a janela de animação for de um frame, sincronizar no próprio frame quando tecnicamente possível e conferir escuta; não fingir garantia subframe. O pico/ataque útil deve cair durante a ação, não apenas uma cauda distante. `element.at` é tempo absoluto **audível após auto-trim das bordas do SFX**, não relativa à cena e não deslocamento arbitrário a partir da palavra. Em cena TSX, derivar tempos locais de `useCurrentFrame/useVideoConfig` e somar `scene.start`. Eventos distintos dentro da mesma composição podem usar SFX distintos, enquanto uma textura contínua pode cobrir uma movimentação única longa sem cortes desnecessários.

É aceitável SFX com duração diferente da animação, mais curto ou mais longo, desde que comece e marque o movimento; cauda fora da janela visual pode soar naturalmente. Se o arquivo for **muito maior** ou invadir a fala/beat seguinte, limitar `elements[].config.duration` (duração máxima de SFX no mixer) e aplicar `elements[].fadeOut` em segundos no final do trecho audível. O mixer instalado suporta `fadeIn` e `fadeOut` na raiz do elemento, enquanto `config.duration` é da configuração do SFX; nunca inventar `audio.sfx`, `config.fadeOut` nem recortar o arquivo original. `fadeOut` não deve exceder a duração audível escolhida. Não alterar velocidade da imagem/voz para igualar SFX. Preservar `trimDb` para volume sob narração e não aplicar duplo efeito quando vídeo/CTA já tem áudio.

Exemplo estrutural (ajustar duração e instante aos eventos reais; asset deve existir):
```json
{"id":"fx_painel_entrada","type":"sfx","asset":"builtin://sfx/Whoosh 01.mp3","at":12.24,"fadeOut":0.08,"config":{"duration":0.32,"preset":"subtle","trimDb":-18}}
```
Esse exemplo não prova que existe animação em 12,24 s; primeiro localizar seu intervalo. A verificação automática inspeciona janelas e paths; a verificação perceptual exige preview com áudio, pois `at` exato no JSON não prova que o SFX é ouvido no movimento. Variar categorias de SFX ao longo do vídeo; não usar whoosh indiscriminadamente. Silêncio deve ser escolha justificada, não esquecimento de uma animação.


## Regra editorial Diazverso — som a serviço do movimento (15/10/2026)

Para projetos Diazverso, sincronizar o ATAQUE AUDÍVEL ou PICO ÚTIL do SFX ao **meio da animação** (ou ponto de passagem/impacto no corpo do gesto), NÃO antecipar antes, nem agendar automaticamente no primeiro frame. Calcular pelo evento real e pela porção audível do arquivo, inspecionar no MP4. `at` pode vir antes do pico apenas para compensar o ataque do sample, desde que o início audível não soe antes do gesto.

- Deslize, deslocamento de PNG, slide de caixa HQ e transição: preferir WHOOSH, alternando as opções reais do acervo; não repetir um único arquivo por automatismo.
- Aparição curta, ícone, botão ou clique: POP/BLING/CLICK conforme a ação; sino pede bell/sino. CTAs HQ com entrada/saída em whoosh, contração + retorno no clique e hold visível de pelo menos 5 segundos.
- `Riser metálico`/Metallic Rise: SÓ construir tensão e preparar uma virada; **NUNCA** sonorizar slide ou entrada de PNG/caixa. Em Shorts pode anteceder o primeiro whoosh após o gancho Minecraft, com música começando depois do blur.
- Preservar a narração e áudio embutido de clipes/CTAs. Não gerar SFX para cortes secos sem gesto e não fingir cobertura só pelo JSON.
- Preferências atuais de trilha de Shorts: Bully Main Theme, Bully Walk Theme, L's Theme A, Kuroi Light, GTA IV Main Theme, GTA San Andreas Opening Intro e GTA V Welcome to Los Santos (não GTA V Pause Menu). Pasta NoCopyright do Drive NÃO comprova licença nem Content ID seguro.

## Biblioteca local de música aprovada versus direitos de redistribuição

Ver `MUSIC_LIBRARY_DIAZVERSO.md` (auditoria VD_0005). `Something is Going On - Godmode`, `The New Order - Aaron Kenny` e `Future Rennaisance - Godmode` já estão em `builtin-assets/music/`. `A Great Darkness Approaches, Can You Feel It_ - ELPHNT`, `Elegy - Asher Fulero` e `Frightmare - Jimena Contreras` estão no acervo pessoal mas **não** no repositório. Existe `scripts/import-diazverso-music.mjs` para instalar localmente somente após revisão da licença no YouTube Studio; não comitar esses MP3s no GitHub. Verificar atribuição por faixa e destino de publicação. Música marcada "NoCopyright" no Drive **não** significa domínio público. OST de GTA V e outras faixas comerciais exigem cautela especial e não devem ser promovidas como livre uso.

A importação é local e não reescreve qualquer `edit_plan.json` antigo. Para projetos novos, pode-se usar `builtin://music/...` somente se o arquivo existir na instalação real; caso contrário, `project://assets/music/...` com MP3 legitimamente fornecido. Não declarar como instalado só porque o nome está no catálogo.
