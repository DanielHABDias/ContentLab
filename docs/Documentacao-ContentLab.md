# Content Lab — Documentação oficial

Referência construída a partir de schemas/edit_plan.schema.json e do código atual Node.js, Remotion e FFmpeg.

Esta documentação diferencia propriedades aceitas pelo schema de comportamentos efetivamente implementados.

## Índice

- Visão geral, arquivos, grade, camadas, áudio, timeline, cache, interface e diagnóstico
- Catálogo de recursos implementados
- Referência completa dos campos do JSON
- Exemplos de uso
- Regras de validação

## Redução de respiração nas pausas

Narração → Tratamento (finalidade narração oficial) e Gravar → Ajustar tratamento da gravação oferecem Atenuar respirações nas pausas e intensidade 0–100%, inicialmente 60%. Ao finalizar a gravação, o tratamento habilitado usa essa opção automaticamente. As tomadas e o original permanecem preservados. Não altera um render em andamento nem reprocessa arquivos já prontos sozinho.

É um detector acústico conservador local, não um novo modelo de IA: procura ruídos curtos e pouco periódicos, mais baixos que a fala próxima, com margem de proteção junto às palavras. Intensidade 60 corresponde a até 12 dB de atenuação e 100 a até 20 dB, com rampas suaves. Não garante remover toda respiração; se afetar consoantes, reduza ou desative. Não apaga amostras nem modifica o relógio da narração. Os cortes de silêncio são analisados antes dessa etapa, para a atenuação não criar novos cortes.

API: reduceBreaths (booleano) e breathReductionStrength (0–100, padrão 60). No POST /api/transcription/jobs, campos multipart true/false e número; no POST /api/voice/finalize kind:recording, dentro de treatment. Chamadas antigas de importação sem reduceBreaths mantêm a redução desligada; gravação tem padrão ligado. Zero ou false não aplica atenuação. Metadados registram breathReduction.ranges e attenuationDb quando houve detecção. Não incluir no edit_plan.json. Não se aplica à transcrição avulsa nem automaticamente à geração de voz por IA. O teste de prévia da IA continua avaliando apenas o aprimoramento DeepFilterNet, não esta etapa adicional.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Preparação automática de todas as áreas

Linux: abra run.sh ou o atalho; Windows: iniciar.vbs/iniciar.bat. npm start usa o mesmo inicializador. São conferidos Node 22, pacotes npm/Remotion, Chrome Headless Shell, FFmpeg/FFprobe com rubberband, Whisper CLI e base, yt-dlp standalone, DeepFilterNet e os ambientes CPU Qwen/Chatterbox. Instalações válidas são reutilizadas; falhas interrompem o preparo com erro real. Requer internet/espaço na primeira instalação, que pode demorar e ocupar vários GB. Não significa que o repositório inclui todos esses binários.

yt-dlp é baixado de release oficial com SHA256 fixado, testado e encontrado diretamente em .tools/ytdlp, sem PATH manual nem Python global. YouTube e outras plataformas utilizam esse downloader tanto para metadados quanto para vídeo, preservando cache, cortes e exportação de áudio. No YouTube, o próprio Node 22+ do aplicativo é informado como runtime JavaScript; os scripts EJS já vêm no standalone oficial. Não usa o decifrador de mídia do youtubei.js. Solicitações simultâneas do mesmo vídeo compartilham o download; tentativas independentes usam pastas temporárias exclusivas e uma falha nunca apaga os fragmentos de outra. O cache só fica disponível após validação e publicação dos arquivos completos. Se faltar ao carregar um link, há preparo automático nesse fluxo também. Restrições da origem, login, indisponibilidade ou mudanças do site ainda podem impedir um vídeo público. Não contorna autenticação nem DRM.

Python 3.10–3.12 compatível é reutilizado para criar os ambientes; se ausente, uv oficial verificado prepara Python 3.12 dentro de .tools/python. Pesos de Qwen/Chatterbox são baixados automaticamente ao gerar com o modelo escolhido; outras qualidades Whisper são baixadas ao transcrever. O base está preparado na abertura, sem substituir a escolha small/medium. Configurações permite antecipar download/reparar, sem obrigação de instalação manual. Modelos já presentes ficam offline e as demais variantes não são baixadas por visita à página.

No Ubuntu/Zorin/Debian, o inicializador instala curl/certificados, Zenity e compiladores do Whisper quando faltam; esses pacotes podem pedir senha de administrador. Não altera PATH permanente. CUDA/drivers, contas OAuth, permissões de microfone e mídia particular não são dependências instaláveis automaticamente. Windows x64/arm64 possui fluxo implementado, mas exige homologação física; Linux x64 é a prioridade validada. macOS e distribuições sem apt-get não têm essa mesma cobertura automática de pacotes do sistema.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Gravação com tratamento completo ao finalizar

Em Narração → Gravar, Tratar a gravação ao finalizar vem ativado. As tomadas WAV em audio/takes continuam brutas e nunca são processadas no lugar. Ao finalizar: unir seleção, redução de ruído DeepFilterNet forte a 100%, filtro passa-altas de 70 Hz, compressão suave 2:1, de-esser suave, normalização -16 LUFS com pico alvo -1,5 dBTP e remoção de silêncio nas bordas. Tomadas e WAV final gravados são mono, 48 kHz, PCM 24-bit, inclusive sem tratamento. Não muda pitch. Pausas internas são preservadas por padrão, e a transcrição é gerada somente no áudio final tratado.

Ajustar tratamento da gravação permite desligar tudo, desativar apenas a IA ou cada filtro, trocar intensidade/modo da IA, volume alvo, filtro de graves e optar por reduzir pausas longas. Estes controles pertencem à gravação e não herdam valores da aba Tratamento ou da geração de voz por IA. Não existe configuração universalmente melhor: ouça e diminua a intensidade se houver artefatos. DeepFilterNet local pode baixar cerca de 35 MB no primeiro uso com integridade verificada; não garante eliminar eco ou vozes concorrentes.

A IA e os filtros trabalham em staging; transcrição ou tratamento com erro não substituem o bundle anterior. A versão anterior é preservada em backup antes de trocar áudio/transcrição. Na raiz de audio permanece somente narration.wav mais takes; arquivos intermediários são temporários. Metadados narration.build.json registram tratamento efetivo e cortes. Repetir finalização usa as tomadas originais, não acumula filtros sobre o resultado anterior.

POST /api/voice/finalize com kind:recording aceita treatment:{enabled,enhancementEngine,enhancementMode,enhancementStrength,compression,deesser,normalize,targetLufs,highpassHz,trimEdges,removeMiddleSilence,minSilence,thresholdDb}. Ausente usa a receita padrão; enabled:false une sem tratamento. kind:qwen não aplica esse tratamento de gravação. Esses campos não pertencem ao edit_plan.json. Timings anteriores precisam ser revisados após novos cortes da voz.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Voz expressiva: alternativa Chatterbox Multilingual

Padrões de amostragem alinhados ao Voicebox instalado: Qwen 0.6B/1.7B usa temperatura 0,9, Top P 1, repetição 1,05, Top K 50 e limite de 8192 tokens; Chatterbox usa temperatura 0,8, Top P 1, repetição 2,0, intensidade 0,5 e CFG 0,5. Pausa extra padrão 0 s. Trocar modelo restaura esses valores. Content Lab mantém pesos V3 e segmentação própria; não promete áudio idêntico ao Voicebox. Os parâmetros continuam ajustáveis. Veja docs/VOICE_MODELS.md para fontes e diferenças.

Além de Qwen Base 0.6B/1.7B, o Content Lab oferece Chatterbox Multilingual V3 500M com clonagem e português. Usa chatterbox-tts 0.1.7 com seleção explícita dos pesos V3 oficiais, sem fallback para V2. O wheel fixa V2 por padrão: o adaptador seleciona V3 na fronteira do loader de safetensors; runtimes com suporte nativo usam t3_model=v3. Arquitetura e vocoder são compartilhados conforme o loader upstream. Turbo/Nano em inglês e finetune pt-br não fazem parte desta integração. Não há garantia de superioridade para toda voz.

O inicializador prepara os ambientes Qwen/Chatterbox; Gerar baixa automaticamente os pesos do modelo selecionado se ausentes. Configurações permite antecipar o download ou reparar o ambiente. Instala em .tools/chatterbox/venv separado do Qwen, Python 3.10–3.12, CPU por padrão; CUDA exige ambiente compatível. Override CONTENTLAB_CHATTERBOX_PYTHON. Os ambientes podem ocupar vários GB na primeira inicialização. Gerar inicia o download do modelo escolhido com progresso; abrir páginas/consultar estado não baixa todos os pesos. Voz/texto não são enviados a serviços de geração; inferência offline após download.

Em Criar com IA escolha modelo e perfil existente. Intensidade expressiva (exaggeration) 0–2, padrão 0,5; condicionamento CFG (cfgWeight) 0–1, padrão 0,5. Natural, Contido, Dramático e Enérgico são combinações numéricas sugeridas, não emoções garantidas. Intensidade maior pode acelerar; CFG menor pode ajudar a controlar ritmo. Para alternar interpretação, gere trechos separados, marque Acrescentar e organize as tomadas. Marca d'água Perth é mantida.

API: POST /api/voice/runtime recebe engine:qwen ou chatterbox (ausente mantém qwen). POST /api/voice/models/download recebe model:chatterbox-multilingual ou os IDs Qwen. POST /api/voice/generate usa esse model, profileId, texto e opções existentes, com exaggeration e cfgWeight adicionais para Chatterbox. Esses campos não pertencem ao edit_plan.json. Manifestos mantêm kind:qwen para agrupar tomadas de IA antigas; metadados registram engine:chatterbox, modelo e parâmetros. Comparar a mesma voz/texto por escuta antes de escolher.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Gravar ou gerar narração com IA

A gravação usa timeline com régua de tempo, cursor e barra de rolagem horizontal nativa, sem slider de Posição. O zoom regula 24–320 pixels por segundo, preservando o centro do trecho visível; a onda mantém envelopes mínimos/máximos detalhados também em tomadas longas. O canvas desenha somente a janela visível. Durante a captura, a timeline acompanha o fim; na pausa, a barra permite voltar e selecionar. O histórico de desfazer cobre cortes recentes e reinicia ao acrescentar nova gravação para não perder áudio posterior. Falha de decodificação preserva o trecho em memória e oferece nova tentativa.

Um único botão alterna Gravar, Pausar e Continuar; Espaço também pausa/continua. Salvar clipe fecha a tomada para começar outra. Durante a pausa, clique posiciona o cursor, arrastar seleciona e Delete/Backspace apaga; Ctrl/Cmd+Z desfaz. Ouvir reproduz a seleção ou a partir do cursor, e vira Parar durante a escuta. Apagar seleção só aparece quando existe intervalo selecionado. Atalhos não interceptam campos de texto ou ações nativas de botões. Continuar acrescenta áudio ao fim do clipe, sem inserir a pausa nem sobrescrever no cursor. Captura WAV mono PCM16 a 48 kHz, limite de 20 minutos por clipe. Salve antes de recarregar/fechar a página. A narração oficial e sua transcrição só mudam ao finalizar a narração pelo fluxo existente.

Selecione a pasta universal e abra Narração → Gravar. Autorize o microfone, grave e finalize cada tomada. Ouça, ordene, desmarque ou exclua o que não deseja; Finalizar narração e transcrever une as tomadas selecionadas em audio/narration.wav e gera a transcrição por palavra e por trecho. Sem edit_plan.json e sem macros escondidos. O estado de conclusão aparece na interface. As tomadas originais ficam em audio/takes; exclusões são recuperáveis em .trash. Reabrir restaura a lista e Recarregar reconhece arquivos externos com os nomes suportados.

Para clonagem local, Configurações → Voz e modelos de IA separa a biblioteca de vozes, cadastro e preparação do ambiente. Use uma amostra autorizada com texto fiel; recomendado 10–30 segundos, aceito 3–60. Os modelos disponíveis são Qwen 0.6B e 1.7B; os ambientes são preparados na inicialização e o modelo escolhido é baixado automaticamente ao gerar, reutilizando cache local. Modelos de vários GB e geração por CPU podem ser lentos. O backend Node chama o worker Python isolado em .tools/qwen; não requer migrar o servidor para Python nem instalar pacotes globais.

Em Narração → Criar com IA, selecione voz/modelo, informe o texto e ajuste os controles disponíveis: idioma, CPU/CUDA compatível, seed, temperatura, top P, penalidade de repetição e pausa entre trechos. O tamanho do modelo não garante entonação: ouça e aprove o resultado. As tomadas geradas podem ser organizadas e finalizadas como as gravadas. Gravação e geração são narração oficial do projeto; transcrição avulsa para pesquisa é outra finalidade em Tratamento e não substitui esses arquivos.

Após finalizar gravação/IA, somente narration.wav fica na raiz de audio, além das tomadas na subpasta. Para limpar ruído, normalizar, cortar silêncios ou alterar timbre, use Tratamento → finalidade de narração oficial, com confirmação. Esse fluxo preserva original, prepared e final conforme o manual. A transcrição resultante precisa ser usada com a versão de áudio que lhe deu origem.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Downloads e transcrições avulsas: projeto opcional

Vídeos e cortes funcionam sem projeto. Por padrão são salvos em Downloads ou no destino avulso escolhido. Marque Guardar nos assets do projeto ativo para usar assets/<fonte>; sem projeto válido, desmarque essa opção. A seleção universal não muda o destino avulso.

Em Tratamento, Transcrição avulsa é a finalidade padrão: exige arquivo local e salva JSON, TXT e SRT em Downloads/transcricao-<identificador exclusivo> sem alterar audio/narration.wav ou transcript.json do projeto. Não aplica cortes, limpeza nem efeitos: timestamps referem-se ao áudio original, úteis para orientar cortes. Downloads no modo transcrição também usam subpasta exclusiva a cada execução, inclusive dentro dos assets se solicitado.

Para tratar e substituir a narração oficial, escolha explicitamente Tratar e atualizar a narração oficial do projeto e confirme. Gravar/finalizar e gerar voz por IA continuam sendo etapas da narração oficial. API POST /api/transcription/jobs: scope=narration é obrigatório para alterar arquivos oficiais; qualquer outro valor (inclusive ausente) usa modo avulso.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Uma pasta de projeto para todas as etapas

O seletor universal no topo é a única seleção de projeto. Aceita uma pasta existente vazia, sem edit_plan.json. Restaura o último caminho no mesmo navegador. Recarregar projeto relê arquivos externos, plano, tomadas e thumbnails; não inicia render. Alterações não salvas do editor exigem confirmação para descartar; gravação/tomada não salva impede a troca. Multi-editor mantém sua lista explícita de projetos para renders em lote.

Vídeos e cortes recebem projectRoot e sourceName opcionais na API; a interface só envia o projeto ativo quando Guardar nos assets estiver marcado. Nesse caso usa assets/<obra-ou-fonte>/clips, audio ou transcripts. Sem marcar, usa Downloads ou o destino avulso escolhido. Transcrições sempre ganham uma subpasta exclusiva. sourceName vazio usa o título normalizado. O cache continua independente. Banco de mídia guarda imagens no projeto e copia vídeos do cache para assets. Downloads permanecem vinculados à pasta capturada no início, mesmo após trocar de projeto. Cortes/imagens com nomes repetidos não sobrescrevem arquivos.

Narração usa audio/narration.wav e audio/takes. Reabrir reconhece o manifesto salvo. Recarregar também descobre WAVs recording-UUID.wav e narration.ai-UUID.wav copiados para audio/takes (ou na raiz de audio em projetos antigos), mede suas durações e remove da lista entradas cujo arquivo foi removido externamente, sem apagar gravações. Outros arquivos aparecem no inventário, mas não viram tomadas automaticamente. Pastas de recuperação são ignoradas.

Thumbnails usam thumbnails/project.json para o rascunho automático e a mesma pasta para imagens/JSONs/ZIPs exportados. Selecionar outra pasta carrega sua própria coleção, sem reutilizar silenciosamente personagens ou imagens do projeto anterior. Alteração externa no JSON é protegida por revisão SHA-256; recarregue para incorporar mudanças. Rascunhos antigos globais do navegador não são migrados automaticamente para uma pasta nova: importe seu JSON. Exportações aceitam até 95 MB por arquivo.

APIs locais: POST /api/workspace/project com projectRoot e reload:true relê a pasta; GET /api/workspace/thumbnails?projectRoot=... lê estado e revisão; POST /api/workspace/thumbnails recebe multipart projectRoot/file, ou kind:draft/revision para rascunho. POST /api/workspace/edit-plan cria um plano vazio na pasta ativa, sem sobrescrever um existente. Só o Editor exige o plano para edição/renderização. Subpastas por symlink e nomes que saem do projeto são recusados. O projeto dos downloads, da narração e das thumbnails não é determinado por estado global do servidor; cada requisição leva sua pasta explicitamente.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Narração: aprimoramento local de voz com IA

Os players das três áreas de Narração e da biblioteca de vozes usam forma de onda real, controles próprios de play/pause, tempo, velocidade 1×/1,25×/1,5×/2×, volume e mute. Clique na onda para buscar; por teclado, setas movem 5 s, Home/End vão ao início/fim e espaço alterna reprodução. Abrir outro player pausa o anterior. As ondas dos arquivos salvos são calculadas localmente com FFmpeg, sem alterar o áudio; o parâmetro waveform=1 nos endpoints existentes de áudio retorna duration e 640 picos, preservando validações de projeto/perfil. A análise é carregada quando o player aparece, com cache por tamanho/data e limite de duas análises simultâneas. Tomadas ainda no navegador usam Web Audio (até 48 MB); caso a onda falhe, a reprodução continua disponível sem desenhar ondas falsas. Arquivos acima de quatro horas não recebem análise visual. Botões de Narração usam grafite e bordas discretas, sem modificar as demais áreas do Studio.

Cada tomada gravada ou gerada por IA possui Excluir, com confirmação. A exclusão remove a tomada da lista e das próximas finalizações, movendo o WAV e metadados associados para audio/takes/.trash/take-* (recuperação manual, sem apagar definitivamente). A narração final e a transcrição atuais não são alteradas: finalize novamente com as tomadas restantes para atualizá-las. Não é permitido excluir durante processamento do projeto; revisões concorrentes da lista são rejeitadas. DELETE /api/voice/takes/:name recebe projectRoot e revision no corpo JSON. Desmarcar continua disponível para ignorar uma tomada sem excluí-la.

Narração possui três áreas independentes: Gravar, Criar com IA e Tratamento (a antiga Importar e tratar, mesmo endereço #transcription). O bloco superior contém somente o seletor de projeto. Gravar aplica o tratamento explícito da própria gravação antes de transcrever; gerar voz por IA mantém seu fluxo separado sem limpeza adicional automática. As opções da aba Tratamento não são importadas silenciosamente. Configurações → Voz e modelos de IA separa vozes salvas com player e botão de seleção, cadastro de nova voz e modelos/ambiente recolhidos. A lista de vozes é carregada por GET /api/voice/profiles, independentemente da verificação dos modelos. GET /api/voice/profiles/:id/audio fornece apenas a amostra local do perfil validado.

Aprimorar voz com IA fica em Tratamento e nos controles próprios de Gravar. Personalizada e gravação iniciam com limpeza Forte a 100%, compressão/de-esser suaves e pausas internas preservadas. A transcrição avulsa não aplica tratamento. Escolha Natural ou Forte e intensidade 0–100%. A primeira utilização baixa o executável oficial DeepFilterNet 0.5.6, cerca de 35 MB, para .tools/voice-enhancement, com SHA-256 fixo verificado antes de executar. Não instala pacotes globais, não exige NVIDIA e não envia áudio à internet. Download automático disponível em Linux x64 e Windows x64; suporte físico a cada plataforma deve ser validado separadamente.

Ouvir teste de até 20 segundos cria uma prévia antes/depois temporária (disponível por uma hora), sem alterar a narração nem a transcrição. Usa o upload selecionado ou o original salvo. O aprimoramento completo é aplicado ao Tratar e transcrever, ou ao finalizar a gravação com sua opção explícita de IA ativada. A redução forte usa o pós-filtro do mesmo DeepFilterNet, não um segundo modelo restaurador. Não é Adobe Podcast V1/V2 e não garante eliminar eco, música ou vozes concorrentes. Avalie perda de naturalidade antes de aprovar.

Receitas ajustáveis: Preservar interpretação desativa cortes internos, compressão e IA; Narração equilibrada usa cortes internos e compressão suave; Limpeza forte inclui IA forte a 100%, compressão e de-esser suave. Todas usam inicialmente filtro de 70 Hz, normalização -16 LUFS com pico alvo -1,5 dBTP e nenhum pitch. A receita só preenche os controles; não executa nem representa uma configuração universalmente melhor. O usuário pode desativar a normalização, escolher -18/-16/-14 LUFS, filtro 0/70/90 Hz e decidir sobre compressão/sibilância. Decupagem significa cortes automáticos de silêncio, não edição por texto nem remoção automática de erros e repetições.

POST /api/transcription/jobs aceita também trimEdges e normalize (booleanos, padrão true), compression e deesser (booleanos, padrão false), targetLufs (-24 a -12, padrão -16) e highpassHz (0–120, padrão 70); no multipart use strings true/false. A compressão é 2:1 com ataque 15 ms e liberação 180 ms, antes da normalização. O de-esser é suave; ambos preservam a duração. A transcrição continua sendo feita após os cortes e antes do efeito de timbre. Alterar cortes exige revisar o edit_plan.json existente.

A API de preparo aceita enhancementEngine:off/deepfilter, enhancementMode:natural/strong e enhancementStrength:0–100. POST /api/voice/finalize e /api/voice/generate recebem esses campos em enhancement. Na importação são campos multipart de POST /api/transcription/jobs. POST /api/voice/enhancement/preview aceita multipart com projectRoot, os mesmos campos e file opcional ou kind:recording/qwen. Retorna jobId; consulte GET /api/voice/jobs/:id e ouça /audio (depois) e /audio?variant=original (antes). Não incluir estes parâmetros no edit_plan.json: são opções do preparo de narração, não do schema de edição.

A ferramenta compensa o atraso do modelo e conserva a duração ao misturar original e voz limpa. Na importação, a IA precede a análise de silêncio; os cortes são então aplicados e a transcrição usa a voz limpa antes do efeito de timbre. Importar e tratar preserva audio/narration.original.ext, narration.prepared.wav e narration.wav; o seletor permite ouvir o original, a voz limpa e a final. Gravação/IA mantém tomadas originais em audio/takes/ e somente narration.wav na raiz de audio, sem cópia prepared ou assembled. Transcrições e metadados ficam na raiz do projeto. Projetos antigos continuam legíveis e seus arquivos não são apagados automaticamente.

Aprimorar e refazer a transcrição pode alterar timestamps, especialmente se mudar os cortes de silêncio. Faça isso antes de criar o edit_plan.json; se o vídeo já foi editado, revise a sincronização. Falhas no download ou no modelo são exibidas como erro, sem fingir que houve aprimoramento e sem substituir o áudio final antes de concluir o processamento.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Studio de thumbnails: fundos e contorno

As skills genéricas incluídas no ZIP cobrem pesquisa de temas (contentlab-pesquisa), título e thumbnail como promessa conjunta (contentlab-packaging), gancho/progressão/payoff (contentlab-roteiro), descrições/capítulos/tags (contentlab-metadados) e revisão. Perfis de canal ficam externos. Métodos de referência fundamentados podem substituir preferências antigas, sem contrariar fatos, contratos técnicos ou regras oficiais; não há garantia de CTR/retenção nem publicação automática.

Controles de fundo de thumbnails são contextuais: no estilo paper, Tom do papel (Claro/Escuro) substitui Cor base. Nos outros estilos, apenas Cor base aparece. Trocar o estilo não apaga color nem paperTone; importar um JSON ou restaurar o rascunho aplica a mesma visibilidade.

Todos os fundos e texturas de thumbnail (papel, halftone, filme, estrelas, grade e página HQ) ficam atrás dos personagens, inclusive os secundários. Novas coleções usam secundários com opacidade 100%; luminosidade e saturação podem deixá-los discretos sem transparência. Valores menores de opacity deixam o fundo aparecer através da figura intencionalmente; projetos importados preservam o valor do JSON.

Thumbnails exportam Full HD por padrão (1920×1080 horizontal, 1080×1920 vertical, 1920×1920 quadrado), ou 4K (3840×2160, 2160×3840, 3840×3840). output.resolution:full_hd/4k, output.format:jpeg/png/webp e output.quality:0.5–1 (padrão 0.95) são opcionais; ausentes usam Full HD/JPG. A prévia leve não limita a resolução exportada. O ZIP segue a mesma configuração. background.sideLights.left/right contém color, opacity:0–100 e reach:1–100 (% da largura): degradês independentes dos PNGs. São desenhados sobre os secundários, abaixo da sombra, texto e protagonista. Foto contextual fica abaixo da página HQ; photoFit:cover/contain, photoX/photoY:0.5 e photoScale:1 centralizam sem distorção. Importar nova foto reinicia posição e zoom; há botão de centralizar. Não alterar skills pessoais sem autorização.

Luzes dos personagens laterais: glowMode:lateral cria um degradê da borda correspondente em direção ao centro, acima dos secundários e abaixo da sombra inferior, do título e do protagonista. glowColor, glowOpacity e glowSize controlam cor, força e alcance percentual da largura. glowMode:radial (ou ausente) mantém o brilho antigo atrás da figura. title.lineHeight controla a distância entre linhas em unidades do tamanho da fonte; ausente mantém 0.91. O preenchimento atrás e o contorno à frente compartilham exatamente a mesma geometria. Novas coleções usam fundo preto, página transparente e texto branco; coleções existentes não são migradas automaticamente.

A aba Thumbnails importa/exporta um projeto JSON independente do edit_plan.json, com imagens incorporadas. Inverter cor dos efeitos (background.invertEffects: boolean, ausente=false) troca claro/escuro somente da textura. Papel, filme, grade e estrelas são derivados do próprio scene-library/background-hq/BackgroundHQ.tsx no instante fixo 1 segundo via SVG, não de frames dos vídeos. Preserva a foto, a cor base e o primeiro plano; opacidade 0 desliga a textura. Os TSX animados não são modificados.

O título aceita title.mode split (padrão legado: preenchimento atrás e contorno à frente), front (sólido à frente), behind (sólido atrás) e outline (somente contorno à frente). title.align:left/center/right usa x como âncora; title.width:0.1–0.95 limita o bloco. Atalhos simples/esquerda/direita/profundidade alteram somente o título e preservam os assets. A prévia reduzida de 160 px sem guias ajuda a conferir leitura. Fonte no peso real 400 (sem negrito artificial). Contorno aceita 0–160 com passo 0,1 (até 24 px em 1280), inclusive traços finos: valor 1 = 0,15 px na largura 1280, escalado na prévia e exportação. Personagens têm saturation e brightness de 0 a 200%, ausentes=100; novas coleções deixam as laterais discretas, sem alterar coleções antigas. Leia docs/THUMBNAIL_STUDIO.md.

A coleção de thumbnails usa version:1, name, media, background, base, variants e selected. Cada variante tem id, name, format (long/vertical/square) e layers. Imagens reais são incorporadas em media como data URLs PNG/JPEG/WebP, referenciadas por chaves, não por project:// ou links remotos. O JSON exportado pelo usuário é a melhor base para preservar ajustes aprovados; não substitui nem modifica o edit_plan.json de vídeo.

O fundo global é compartilhado, enquanto personagens e textos são independentes depois de criar cada variante. Posições x/y são frações da tela, não células do grid de vídeo. A composição pode deixar laterais contextuais discretas e protagonista nítido, sem impor essas escolhas a todos os projetos. Conferir leitura mobile, rosto, alinhamento exato das duas passadas do título e enquadramento em cada formato. A skill ZIP inclui docs/THUMBNAIL_STUDIO.md com o contrato detalhado e orientações de uso; não publica imagens ou altera perfis de canal.

![Grade de nove células](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/grid.svg)

## Visão geral e fluxo de trabalho

Content Lab funciona localmente com servidor Node.js, interface JavaScript, renderização visual Remotion e ferramentas FFmpeg. A IA pode criar um edit_plan.json, que a interface permite validar e ajustar por cena.

Comece pela aba Narração: escolha uma pasta que pode estar vazia, importe a gravação, aplique limpeza de silêncios e efeito opcional, ouça o resultado e gere transcript.json/txt/srt. Nenhum edit_plan.json é exigido nessa etapa. Com a transcrição preparada, peça ao ChatGPT o guia e o edit_plan.json; abra a mesma pasta no Editor, organize assets, valide, salve e renderize.

A referência de campos desta página é derivada do schema instalado. Um campo previsto no JSON não significa automaticamente que todo componente visual use esse campo: essas limitações são mencionadas em cada descrição.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Organização de arquivos e URIs

Organize edit_plan.json, audio/narration.wav e assets dentro da pasta do projeto. Caminhos project:// apontam para a raiz do projeto. Arquivos builtin:// vêm da biblioteca instalada.

O atributo sources.assets indica uma pasta, mas não completa os caminhos das camadas: cada asset deve ter seu URI completo e existente. A narração e a transcrição usam caminhos relativos.

Na aba Narração, a voz é preparada antes do plano; o editor oferece um atalho para voltar a essa aba. Ao criar edit_plan.json depois, use audio.narration = 'audio/narration.wav' e sources.transcript = 'transcript.json'; o MP4 usa a voz já tratada. No Editor, use Listar para consultar URIs de assets e Validar JSON antes do render.

Use / como separador nos caminhos tanto no Windows quanto no Linux. Nomes, subpastas e extensões precisam corresponder exatamente aos arquivos: no Linux, Narracao.wav não é igual a narracao.wav. Caminhos que saem da pasta do projeto, inclusive por links simbólicos, são bloqueados.

Para criar cenas de motion design, vá à seção Sua linha do tempo no Editor automático, clique em + Nova cena e abra Editar propriedades avançadas (fundo, câmera, elementos, animações). Use background.color para cor, background.asset com URI builtin:// ou project:// para mídia própria e background.loop:true para repetir um fundo de vídeo. Adicione quantas camadas quiser e defina cells livremente no grid 3×3, sem obrigatoriedade de duas imagens ou de uma composição esquerda/direita.

Se a pasta já possui narração, a aba Narração pode reaproveitar o original arquivado para gerar novas versões, sobrescrevendo audio/narration.wav e as transcrições sem apagar o original. O mesmo projeto posteriormente recebe edit_plan.json; não precisa criar pastas paralelas.

Para imagens, vídeos, músicas e SFX, use URIs project:// desde a raiz da pasta do projeto (ex.: project://assets/personagens/heroi.png); arquivos incorporados ao aplicativo usam builtin://. O atributo sources.assets nunca preenche automaticamente o caminho dos elementos.

Para gameplay, preserve a proporção. contain mostra todo o quadro e é o padrão visual; cover recorta e stretch estica. Não amplie um clipe 1920×1080 quando a saída também é 1920×1080.

### Estrutura sugerida do projeto

```text
meu-video/
├── edit_plan.json                     criado DEPOIS da narração
├── audio/
│   ├── narration.original.wav         gravação original preservada
│   ├── narration.prepared.wav         voz limpa (antes do efeito)
│   └── narration.wav                  voz final, com efeito opcional
├── assets/
│   ├── abertura.mp4
│   └── personagens/
│       └── heroi.png                 subpastas permitidas
├── custom-scenes/
│   └── MinhaCena.tsx                  componente Remotion local (opcional)
├── transcript.json                    gerado após preparar a narração
├── transcript.txt                     texto gerado
├── transcript.srt                     legendas geradas
├── transcript.build.json              origem dos timestamps
├── narration.build.json               opções e arquivo de origem
└── output/                            produzido após render
```

![Comparação entre contain e cover](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/fitting.svg)

## Layouts, grade 3×3 e profundidade

Na grade, 1/2/3 ocupam a primeira linha, 4/5/6 a linha central e 7/8/9 a inferior. cells [2,5,8] ocupa a coluna central; cells [5,8] ocupa os dois quadrados centrais inferiores; cells [5] somente o centro. A mídia é encaixada automaticamente na caixa: contain preserva o PNG sem recorte e cover preenche com possível recorte.

As camadas podem usar transform e keyframes para posição, escala, rotação e opacidade. transform.opacity de 0 a 1 controla a transparência; keyframes[].opacity anima esse valor; z maior fica na frente. Use transform.scale somente para ajuste fino após definir cells.

PNG com transparência assimétrica pode parecer deslocado apesar de estar centralizado matematicamente. transform.offsetX/offsetY permitem corrigir a posição em pixels: positivo move para direita/baixo; negativo move para esquerda/cima. Os offsets não modificam a caixa do grid e margens transparentes internas continuam fazendo parte do PNG.

![Grade de nove células](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/grid.svg)

## Camadas, animações, textos e efeitos

Tipos disponíveis: image e video para mídia, overlay para sobreposições, text para frase estática, kinetic_text para palavras em movimento, caption para legendas, filter para tratamento visual e sfx para som.

Para overlay de vídeo com style green_screen, green_screen_default ou green_screen_soft, o render visual remove a cor config.keyColor (padrão #00FF00) usando config.similarity e config.blend e preserva a transparência sobre as camadas inferiores. O arquivo original continua sendo a fonte de áudio quando muted:false; trimDb e fades controlam esse som separadamente. Confira o resultado no MP4: a validação do JSON sozinha não verifica o recorte do chroma.

Os presets de entrada, movimento contínuo e saída ficam em animation. Os keyframes usam segundos relativos ao início da cena; já start/end/at usam tempo absoluto.

Suavidade não significa lentidão: o motor usa interpolação contínua de ordem C2 (smootherstep) por padrão em keyframes de elementos e câmera, entradas, saídas e carrosséis. Uma duração de 0.1 segundo continua tendo exatamente 0.1 segundo. animation.enterDuration/exitDuration e config.transitionDuration controlam TEMPO, independentemente da curva. easing:linear continua disponível para movimento intencionalmente linear; ease_in/out aceleram/desaceleram. Não adicionar segundos automaticamente em nome da fluidez.

O pan e slow_zoom_in/out usam início e fim assentados; float_soft, wiggle_soft, pulse_soft e camera.shake têm envelope de amplitude suave para não começar ou encerrar com saltos. No word_stack_vertical a posição, escala, opacidade e cor dos textos mudam continuamente; word_stream_horizontal também elimina a antiga palavra-fantasma ao terminar a passagem. Transições fade, slide_left e blur_left/right/up/down usam curvas suaves e chegam à posição final no último frame, sem expandir a timeline; o blur só cresce no meio da passagem e recua antes do corte. Em resoluções pequenas, a intensidade espacial do blur é reduzida para preservar a direção visual do movimento.

Limitação física: uma transição de 0.1 s em 30 fps tem apenas 3 frames; em 60 fps tem 6. O software não inventa quadros nem transforma 0.1 s em 0.4 s: caso queira mais amostras de movimento, aumente project.fps conscientemente. cut continua instantâneo por definição, e texto digitado/reveal continua discreto por caractere; suavizar não deve mudar sua cadência semântica.

Legenda bangers_highlight_block: o fundo colorido da palavra anterior desaparece enquanto o da próxima cresce suavemente, sem mover ou apagar as letras. O tempo padrão é 0.10 segundo e pode ser ajustado via config.highlightTransitionDuration:0.1 (sem mudança dos timestamps nem da duração da fala). Para transições de cena, o fade agora preserva corretamente a direção: cena anterior no início, próxima cena no final, inclusive quando restam somente três frames.

Estilos tradicionais de texto e legendas continuam disponíveis para camadas simples. Para novas composições especiais, use TextoHQ e CarrosselFrasesHQ; word_stream_horizontal e word_stack_vertical não são mais oferecidos como presets do catálogo público. Permanecem como compatibilidade de planos existentes.

Para novas edições, use CarrosselFrasesHQ: próxima frase menor acima, ativa central e anterior abaixo. O componente inclui faixa horizontal central e pode ocupar a largura integral da tela. word_stack_vertical é aceito somente para projetos anteriores; seus parâmetros não são intercambiáveis com as props do preset.

No novo CarrosselFrasesHQ, activeBandColor e activeBandOpacity controlam a faixa central. Use phrases com text/at; at representa a chegada, não o começo do movimento. A documentação do preset descreve os limites de tempo.

Campos específicos de config já usados pelo render: maxWords, highlightColors, highlightPaddingX/Y, highlightRadius, transitionDuration, items, inactiveOpacity, slotGap, activeScale, inactiveScale, direction, align, inactiveColor, panelColor, panelOpacity, panelRadius, panelPaddingX/Y, opacity, scanlineOpacity, vignette, flicker e jitter. config aceita outras chaves sintaticamente, mas elas só produzem efeito se o componente as interpretar.

O validador produz avisos para duas camadas de texto sobrepostas em tempo e região; isso não é erro bloqueante, pois composições intencionais são permitidas.

![Composição das camadas z](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/layers.svg)

## Áudio, narração, música e SFX

Crie a transcrição antes do edit_plan.json: a aba Narração reduz silêncio no início, no fim e intervalos internos longos conforme o parâmetro escolhido, salva audio/narration.wav com pitch opcional e transcreve a versão limpa sem efeito de pitch. O JSON posterior usa esses timestamps originais da voz preparada. As pausas deliberateadas posteriores devem usar audio.silenceInserts no edit_plan.json: o renderer aplica a inserção aos tempos das palavras uma só vez. narrationTrim e sourceCuts são destinados a edições posteriores do áudio de entrada, não devem reproduzir cortes que a aba Narração já fez.

O estágio independente de Narração usa silencedetect com limite padrão -42 dB e redução de pausas internas acima de 0,7 s, mantendo pequena margem para evitar cortes secos; ajuste ou desative a redução interna se comprometer a expressão. A limpeza é executada ANTES do Whisper. O modo Corpo natural usa somente reforço moderado de graves por equalização (sem mudar pitch e sem exigir rubberband); os modos Grave suave/equilibrado/profundo mudam pitch apenas -0,2/-0,4/-0,7 semitons, com preservação de formantes, janela longa e suavização quando rubberband estiver instalado. Os modos são interpretações próprias, não cópia de efeitos proprietários de terceiros. Você pode ouvir A/B a versão limpa narration.prepared.wav e a voz final narration.wav na aba; comparar a mesma frase antes de aprovar. O Studio reconhece narração já preparada e evita repetir normalização e trim no render. Em fluxos legados, voice.autoTrimSilence controla bordas e sourceCuts/silenceInserts ainda funcionam.

A música tem start/end na timeline e pode escolher um trecho do arquivo usando sourceStart/sourceEnd; o trim automático tira silêncio das bordas do trecho selecionado antes de aplicar loop e fades, e loop repete somente a parte audível quando necessário. Duas músicas podem se cruzar: a primeira termina em 20 s com fadeOut de 3 s; a próxima começa em 17 s com fadeIn de 3 s. A sobreposição de 17 a 20 s produz o crossfade no mixer. Ducking reduz o volume durante a voz. Mudanças só de som não invalidam clipes visuais.

![Trim de silêncio nas bordas dos SFX](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/audio.svg)

## Cenas programáveis Remotion (TSX) — do ChatGPT ao vídeo

Quando a composição precisar de uma câmera virtual que percorre um espaço maior, SVGs procedurais, partículas, tipografia coreografada, grades reativas ou outros movimentos complexos, use uma cena programável TSX. Não precisa fragmentar uma animação contínua em dezenas de cenas: uma cena da timeline pode conter a composição React inteira. Para imagens simples, textos e cartões comuns, continue usando os elementos existentes.

Primeiro escolha entre os padrões da Galeria de cenas especiais. Só gere um TSX novo quando a intenção não for coberta pela biblioteca. Para alterações, preserve o módulo, IDs, tempo e assets; não reescreva o plano inteiro por mudanças pontuais.

Para criar ou aprimorar motion autorizado, a skill contentlab-cenas-tsx inclui references/MOTION_CRAFT.md: brief de intenção, entrada/foco/saída, câmera e mídia separadas, reuso, responsividade e mapa de eventos. A pesquisa em Remotion, LottieFiles, GSAP e Hyperframes fornece princípios adaptados; não instala novas dependências, troca o renderer ou modifica automaticamente os presets.

Uma abertura prioritária pode receber planejamento beat a beat dos primeiros 30 segundos, com evidência real, imagens em pan/zoom, tipografia legível e mudanças motivadas pela fala. Mais TSX não significa automaticamente melhor edição. Conferir uma prévia curta com narração antes da montagem completa, sem exigir render integral para testar o trecho.

O visual nomeado deve chegar legível na palavra; preparar a entrada antes dela quando não causar spoiler. Para whoosh de transição, alinhar corpo/pico perceptivo ao meio do movimento e manter início audível dentro da janela, considerando o trim real do mixer. Click, pop, sino e escrita seguem o gesto específico. Não aplicar offset sonoro fixo a todos os arquivos. Frames isolados e JSON válido não certificam suavidade nem sincronia auditiva.

Todos os 15 presets oferecem backgroundStyle:comic_page (Página HQ transparente) e backgroundOpacity:0–100. A arte PNG original mantém as divisórias e o canal alfa, sem impor cor de fundo. Em retrato, cover centralizado pode recortar as laterais sem distorcer. Para mídia por trás, use customComponent.mode:overlay. A galeria instala o TSX e todos os companions do manifesto, inclusive HQComicPage.tsx e HQMotion.tsx quando necessário. Na cópia manual, copie todos para custom-scenes, compartilhando uma única cópia compatível de cada auxiliar. O BackgroundHQ também oferece essa página na aba Thumbnails, com intensidade e inversão dos efeitos.

Os fundos mantêm a ordem dos hooks ao alternar estilos; opacidade zero evita trabalho procedural invisível. A biblioteca prepara medidas estáticas e eventos antes dos frames; o movimento continua determinístico. TextoHQ oferece kineticUnit:letter/word. QuadroHQSobreCena oferece compactAt/compactDuration/compactScale com defaults 2/0.65/0.58. CaixinhaHQ permite motionCurve:smooth/snappy; o clique permanece em actionAt. Encerramento aceita timingScale:0.5–2, characterScale:0.5–1.5 e fadeOutDuration vertical (0 mantém visível; ausente preserva o comportamento anterior). Tempos e SFX são configurados separadamente. Página e Linha do Tempo concluem expansões no último frame exibido. Não alegar ganho percentual de render a partir de um teste isolado do cálculo da espiral.

Baixe ou salve o arquivo TSX gerado pelo ChatGPT em seu computador e coloque-o dentro da pasta do projeto: custom-scenes/MinhaCena.tsx. A interface atual não baixa nem instala automaticamente o código produzido no chat; essa cópia é manual. Use project://custom-scenes/MinhaCena.tsx em timeline[].customComponent.module. A geração e o download do arquivo dependem das ferramentas que estiverem disponíveis no ChatGPT.

No edit_plan.json existente, use customComponent: {module: 'project://custom-scenes/MinhaCena.tsx', mode: 'replace', props: {...}, assets: {...}}. mode replace entrega toda a composição visual ao componente; mode overlay desenha o TSX sobre as camadas tradicionais. Elementos overlay com z igual ou maior que 900 ficam acima do TSX em ambos os modos, inclusive chroma key; em mode overlay, os demais elementos tradicionais ficam abaixo. O JSX deve ter export default. Não cole código TSX dentro do JSON: o contrato só contém referência, parâmetros e URIs de assets.

Em props, forneça valores JSON reutilizáveis como títulos, cores e dados, sem repetir a estrutura de cada elemento. Em assets, dê nomes a URIs locais como project://assets/logo.svg, project://assets/mascote.png ou builtin://...; o componente recebe os URLs pelo objeto assets. Retículas, curvas, linhas, diagramas e cards normalmente devem ser desenhados com React/SVG/CSS por código, sem downloads desnecessários. Não suponha que arquivos citados existem antes de conferir.

No TSX, importações suportadas são React, Remotion e módulos locais de custom-scenes, respeitadas as dependências realmente instaladas. Use useCurrentFrame e useVideoConfig para calcular qualquer quadro por tempo; use SVG, interpolate, spring e cálculos determinísticos conforme a necessidade. Não use setInterval, relógio real, CSS animations/transitions, URLs externas não verificadas nem aleatoriedade sem semente, pois os quadros devem renderizar corretamente em qualquer ordem.

Cenas TSX dentro de custom-scenes/ são renderizadas sem configuração adicional. TSX é código executável e não possui sandbox completo: abra somente projetos e componentes cuja origem você conhece e revisou. O Content Lab exige caminho project://custom-scenes/...tsx local, rejeita links simbólicos e não executa código inserido diretamente no JSON; essas restrições de caminho não tornam seguro um TSX desconhecido.

Depois de copiar TSX e atualizar o JSON, clique Validar JSON, salve, renderize e confira o MP4. A validação do JSON não comprova que o TSX compilou: importações, fonte, layout, clipping e comportamento de frames exigem render. O cache da cena identifica mudanças nos arquivos da pasta custom-scenes; mantenha IDs estáveis e repita a inspeção de quadros após modificar o TSX.

O catálogo oficial de 15 cenas está na Galeria de cenas especiais. Prepare um preset na pasta do projeto; o aplicativo copia uma versão local para custom-scenes sem sobrescrever código existente. O JSON aponta project://custom-scenes/Nome.tsx. As instruções e parâmetros de cada padrão acompanham a galeria e a skill.

![Composição das camadas z](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/layers.svg)

## Cenas, tempo e transições

A lista timeline é ordenada pelo start absoluto. Cada cena possui ID estável; cenas não se sobrepõem. A duração real resulta da diferença entre end e start.

Transições disponíveis: cut, fade, blur_left, blur_right, blur_up, blur_down, flip e curtain; slide_left é aceito apenas para compatibilidade. Flip gira um quadro no eixo vertical e troca sua face; Curtain move o quadro anterior para a esquerda e revela a próxima cena fixa por baixo. Usam mídia real da cena entrante, não textos de demonstração, sem encurtar a timeline. A passagem ocupa o início da próxima cena. Não são TSX do catálogo de cenas.

O cache mantém MP4s individuais por ID. A montagem e o áudio final continuam sendo etapas necessárias mesmo quando todas as cenas visuais são reaproveitadas.

![Timeline com cenas identificadas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/timeline.svg)

## Inserção de tempo e sincronização

Ao inserir ou duplicar uma cena, o storyboard desloca as cenas seguintes, seus efeitos sonoros, a trilha global e as palavras da transcrição. Uma pausa correspondente é registrada na narração.

Mover manualmente somente uma cena é uma decisão visual: isso não insere silêncio automaticamente na voz. Use Desfazer e Refazer para recuperar alterações do storyboard.

Se a cena nova também precisar de fala nova, atualize a gravação e seus dados de transcrição; o silenceInsert serve como espaço reservado de voz.

![Deslocamento de áudio e vídeo após inserir uma cena](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/ripple.svg)

## Cache, prévias de cena e exportação

Aproveitar cache compara os dados visuais relevantes, assets e a identidade do renderer para detectar cenas que exigem novo MP4. Refazer tudo limpa output/ com confirmação e reconstrói os clipes.

Render CPU usa automaticamente uma ou duas cenas em subprocessos independentes, conforme CPUs disponíveis, RAM e resolução; sob pressão de memória, espera trabalhos ativos terminarem. GPU habilitada ou CONTENTLAB_REMOTION_CONCURRENCY diferente de 1 mantém uma cena por vez. CONTENTLAB_SCENE_CONCURRENCY=1 força sequencial; 2 solicita até duas sem ultrapassar os limites seguros. Não exige GPU ou alteração no JSON e não reduz qualidade/FPS. A fila de projetos continua sequencial. A montagem preserva ordem, cache concluído sobrevive a falhas e o cancelamento aguarda limpeza dos workers. performance.sceneConcurrency e performance.sceneTimings no relatório permitem medir o ganho real, que depende da máquina e não é garantido.

O storyboard permite reproduzir o vídeo individual já renderizado. Quando o JSON é alterado, a interface distingue o clipe anterior do resultado novo. A reprodução por cena não codifica um Preview completo.

Os clipes individuais não incluem obrigatoriamente toda a mixagem. Conferir o vídeo final ainda é importante para validar narração, música, efeitos e transições.

![Quadros em movimento durante uma transição](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/transitions.svg)

## O que a interface oferece

Vídeos e cortes: carregamento de fonte YouTube, importação local, lista de arquivos em cache, marcação e exportação de trechos de vídeo e áudio.

Narração: escolha a pasta mesmo sem edit_plan.json, selecione a gravação (ou reutilize a original preservada), ajuste remoção de pausas longas e o efeito grave opcional. O app salva audio/narration.original.ext, audio/narration.prepared.wav, audio/narration.wav, transcript.json/txt/srt e metadados. Ouça pelo player integrado e compare a versão limpa sem efeitos com o áudio final no seletor A/B. Comece pelo Corpo natural (EQ leve sem pitch) se o grave antigo soar artificial; os outros presets são progressivamente mais intensos e precisam de escuta real. Grave suave/equilibrado/profundo usam o filtro rubberband. Os inicializadores Linux/Windows verificam o filtro em ffmpeg -filters e, quando ausente, instalam automaticamente em .tools/ffmpeg um FFmpeg portátil GPL com librubberband e checksum SHA256 verificado; reutilizam instalações completas. Não é necessário instalar manualmente o filtro ao usar run.sh ou iniciar.bat. O comando npm start usa o inicializador completo, com preparação automática. Para desenvolvimento sem bootstrap, executar node server/http.mjs. O arquivo final já pode ser usado no plano e render. Os inicializadores instalam whisper-cli/modelo quando necessário.

Instalação automática: no Linux, execute bash run.sh ou use o atalho criado por instalar-atalho.sh; no Windows, abra iniciar.vbs ou iniciar.bat. Os inicializadores verificam Node.js 22+, FFmpeg/FFprobe COM filtro rubberband, whisper.cpp, modelo Whisper, dependências npm/Remotion e Chrome Headless Shell para renderizar, baixando apenas o que estiver ausente ou sem capacidade necessária. Binários locais ficam na pasta .tools ignorada pelo Git; no Zorin/Ubuntu o compilador para whisper.cpp pode exigir sudo. O Studio não precisa alterar a instalação global de Node. O download inicial requer internet; as aberturas posteriores reaproveitam o material instalado.

Editor automático: abrir/criar projeto depois do preparo da voz, conferir assets, buscar e selecionar cenas, criar, inserir, duplicar e excluir, ajustar tempos, editar camadas, abrir a aba Narração quando necessário, validar e salvar o JSON, visualizar clipes em cache e exportar o MP4. Pausas editoriais são inseridas na timeline por audio.silenceInserts.

Na seção Sua linha do tempo, + Nova cena cria uma cena editável; + Adicionar camada inclui imagem, vídeo, texto, legenda, overlay ou efeito sonoro; e Propriedades avançadas contém background, grid/cells, câmera, animações, transformações e keyframes. Não há um formulário paralelo limitado a esquerda/direita: toda a composição usa o mesmo editor visual e um único edit_plan.json.

Documentação: referência pesquisável de campos e exemplos, disponível no próprio site e como arquivo Markdown ou HTML. A skill ZIP inclui os documentos e diagramas.

![Estrutura do edit_plan.json](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/structure.svg)

## Diagnóstico e boas práticas

Arquivo não encontrado: confira URI, extensão, maiúsculas/minúsculas, symlinks e a pasta do projeto. Propriedade rejeitada: consulte a tabela de campos; objetos do schema geralmente proíbem chaves adicionais.

Áudio dessincronizado: confira sourceCuts, silenceInserts e at dos SFX. Imagem ampliada ou cortada: use contain e remova zoom não intencional. Texto sobreposto: revise start/end, cells, z e os avisos da validação.

Primeiro render após atualizar o motor pode recalcular assinaturas do cache. Não suponha que estilos/presets previstos apenas no schema já criam comportamentos inexistentes.

![Comparação entre contain e cover](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/docs/figures/fitting.svg)

## Catálogo de recursos implementados

### Layouts

`fullscreen` · `3x3` · `custom_grid` · `three_columns` · `left_right` · `character_vs` · `center_column`

### Transições

`cut` · `fade` · `blur_left` · `blur_right` · `blur_up` · `blur_down` · `slide_left` · `flip` · `curtain`

### Animações de entrada

`cut` · `none` · `fade` · `pop_in` · `slide_from_left` · `slide_from_right` · `slide_up` · `slide_down` · `center_reveal`

### Animações contínuas

`none` · `float_soft` · `wiggle_soft` · `pulse_soft` · `slow_zoom_in` · `slow_zoom_out` · `pan`

### Animações de saída

`cut` · `none` · `fade` · `fade_out` · `slide_to_left` · `slide_to_right` · `slide_to_bottom` · `center_close`

### Estilos de texto

`impact` · `impact_yellow` · `paper_word` · `versus_big` · `word_pop` · `anton` · `bangers`

### Estilos de legenda

`anton_karaoke` · `bangers_highlight_block`

### Filtros

`dim` · `crt_tv`

### Estilos de overlay

`green_screen` · `green_screen_default` · `green_screen_soft`

## Galeria de cenas especiais

Oferecimento do DiasVerso.

Os 15 padrões são genéricos e aceitam 16:9/9:16. Na documentação do aplicativo, escolha uma pasta de projeto e prepare o preset. O TSX é copiado para custom-scenes/ sem sobrescrever uma versão diferente; o plano não é alterado nem renderizado automaticamente. Alternativamente copie o arquivo indicado abaixo. Leia os parâmetros e exemplos antes de usar. Fontes e mídias pertencem a customComponent.assets; props recebe apenas dados JSON. SFX continuam na timeline.

### Fundo HQ

Fundos sólido, retícula, papel, grade, estrelas e filme.

Módulo: `project://custom-scenes/BackgroundHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Fundo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/background-hq/preview-0-16x9.png)
![Exemplo de Fundo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/background-hq/preview-0-9x16.png)
![Exemplo de Fundo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/background-hq/preview-1-16x9.png)
![Exemplo de Fundo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/background-hq/preview-1-9x16.png)

Guia: [background-hq](../scene-library/background-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/background-hq/exemplo-cena.json) · [exemplo-pagina-hq.json](../scene-library/background-hq/exemplo-pagina-hq.json)

```ts
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Barra de progresso HQ

Progresso com pausas e mudanças de cor.

Módulo: `project://custom-scenes/BarraLoadingHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Barra de progresso HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/barra-loading-hq/preview-0-16x9.png)
![Exemplo de Barra de progresso HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/barra-loading-hq/preview-0-9x16.png)

Guia: [barra-loading-hq](../scene-library/barra-loading-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/barra-loading-hq/exemplo-cena.json)

```ts
type ProgressPoint = {at:number; value:number; easing?:'linear'|'smooth'};
type ColorPoint = {at:number; color:string};
type Props = HQComicPageOptions & {points?:ProgressPoint[]; colors?:ColorPoint[]; position?:'top'|'bottom'|'center';
  width?:number; height?:number; margin?:number; x?:number; y?:number;
  trackColor?:string; outlineColor?:string; texture?:boolean; opacity?:number};
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Brainstorm HQ

Nós, percursos, narrativa e evidências com câmera.

Módulo: `project://custom-scenes/BrainstormHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-0-16x9.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-0-9x16.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-1-16x9.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-1-9x16.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-2-16x9.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-2-9x16.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-3-16x9.png)
![Exemplo de Brainstorm HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/brainstorm-hq/preview-3-9x16.png)

Guia: [brainstorm-hq](../scene-library/brainstorm-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/brainstorm-hq/exemplo-cena.json) · [exemplo-evidencias.json](../scene-library/brainstorm-hq/exemplo-evidencias.json) · [exemplo-narrativo.json](../scene-library/brainstorm-hq/exemplo-narrativo.json) · [exemplo-percurso.json](../scene-library/brainstorm-hq/exemplo-percurso.json)

```ts
type Node = {id:string; text?:string; subtitle?:string; asset?:string; x?:number; y?:number; color?:string};
type Step = {node:string; from?:string; hold:number; moveDuration?:number; connect?:boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; nodes:Node[]; steps:Step[]; backgroundColor?:string; cardColor?:string; textColor?:string;
  lineColor?:string; zoomOutDuration?:number; presentation?:'cards'|'path'|'narrative'|'evidence'; heading?:string; pathBend?:number; dotColor?:string; dotSize?:number; assets?:Record<string,string>};
type JourneyPoint={x:number;y:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Caixinha HQ

Caixas livres e presets sociais com entradas e gestos.

Módulo: `project://custom-scenes/CaixinhaHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-0-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-0-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-1-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-1-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-2-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-2-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-3-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-3-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-4-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-4-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-5-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-5-9x16.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-6-16x9.png)
![Exemplo de Caixinha HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/caixinha-hq/preview-6-9x16.png)

Guia: [caixinha-hq](../scene-library/caixinha-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/caixinha-hq/exemplo-cena.json) · [exemplo-centro-livre.json](../scene-library/caixinha-hq/exemplo-centro-livre.json) · [exemplo-instagram.json](../scene-library/caixinha-hq/exemplo-instagram.json) · [exemplo-like-pop.json](../scene-library/caixinha-hq/exemplo-like-pop.json) · [exemplo-livre.json](../scene-library/caixinha-hq/exemplo-livre.json) · [exemplo-produto.json](../scene-library/caixinha-hq/exemplo-produto.json) · [exemplo-sininho-vertical.json](../scene-library/caixinha-hq/exemplo-sininho-vertical.json)

```ts
type Preset = 'inscricao' | 'like' | 'sininho' | 'produto' | 'instagram' | 'livre';
type Corner = 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito' | 'centro';
type Animation = 'lateral' | 'vertical' | 'pop';
type IconName = 'youtube' | 'like' | 'sininho' | 'seta' | 'instagram' | 'none';
type Action = 'auto' | 'clique' | 'sininho' | 'pulo' | 'none';
type Props = HQComicPageOptions & {fontFamily?: HQFont; preset?: Preset; corner?: Corner; animation?: Animation; exitAnimation?: Animation;
  motionCurve?:'smooth'|'snappy';text?: string; instagramHandle?: string; boxColor?: string; textColor?: string; icon?: IconName;
  at?: number; holdDuration?: number; animationDuration?: number;
  action?: Action; actionAt?: number; actionDuration?: number; assets?: {bangers?: string; anton?: string}};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Carrossel de frases HQ

Próxima frase acima, ativa central e anterior abaixo.

Módulo: `project://custom-scenes/CarrosselFrasesHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Carrossel de frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/carrossel-frases-hq/preview-0-16x9.png)
![Exemplo de Carrossel de frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/carrossel-frases-hq/preview-0-9x16.png)
![Exemplo de Carrossel de frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/carrossel-frases-hq/preview-1-16x9.png)
![Exemplo de Carrossel de frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/carrossel-frases-hq/preview-1-9x16.png)

Guia: [carrossel-frases-hq](../scene-library/carrossel-frases-hq/README.md). Exemplos: [exemplo-anton-overlay.json](../scene-library/carrossel-frases-hq/exemplo-anton-overlay.json) · [exemplo-cena.json](../scene-library/carrossel-frases-hq/exemplo-cena.json)

```ts
type Phrase={text:string;at:number;color?:string};
type Props=HQBackgroundOptions & {phrases:Phrase[];fontFamily?:HQFont;align?:'left'|'right';
  activeColor?:string;inactiveColor?:string;inactiveOpacity?:number;inactiveScale?:number;
  activeBandColor?:string;activeBandOpacity?:number;
  motionDuration?:number;textScale?:number;assets?:{bangers?:string;anton?:string}};
type Layout={lines:string[];size:number;height:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Comparativo de ideias HQ

Compare de duas a quatro imagens e textos.

Módulo: `project://custom-scenes/ComparativoIdeiasHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-0-16x9.png)
![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-0-9x16.png)
![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-1-16x9.png)
![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-1-9x16.png)
![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-2-16x9.png)
![Exemplo de Comparativo de ideias HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/comparativo-ideias-hq/preview-2-9x16.png)

Guia: [comparativo-ideias-hq](../scene-library/comparativo-ideias-hq/README.md). Exemplos: [exemplo-2-ideias.json](../scene-library/comparativo-ideias-hq/exemplo-2-ideias.json) · [exemplo-3-ideias.json](../scene-library/comparativo-ideias-hq/exemplo-3-ideias.json) · [exemplo-4-ideias.json](../scene-library/comparativo-ideias-hq/exemplo-4-ideias.json)

```ts
type Item = {asset: string; text: string; at?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; items: Item[]; title?: string; backgroundColor?: string; textColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; assets?: Record<string, string>};
type Slot = {x: number; y: number; width: number; height: number; fromX: number; fromY: number};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type TextLayout = {lines: string[]; size: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Encerramento HQ

Indicação de vídeo no vertical; dois vídeos e canal no horizontal.

Módulo: `project://custom-scenes/ComicPageCTA.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Encerramento HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/cta-encerramento-hq/preview-0-16x9.png)
![Exemplo de Encerramento HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/cta-encerramento-hq/preview-0-9x16.png)

Guia: [cta-encerramento-hq](../scene-library/cta-encerramento-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/cta-encerramento-hq/exemplo-cena.json)

```ts
type Props = HQComicPageOptions & {channelName?:string;topTitle?:string;subscribeText?:string;calloutText?:string;fontFamily?: HQFont;
  /** Texto abaixo da thumbnail. */
  timingScale?:number;fadeOutDuration?:number;characterScale?:number;
  headline?: string;
  /** Somente a faixa diagonal superior; os demais detalhes vermelhos são fixos. */
  stripeColor?: string;
  leftTitle?: string;
  rightTitle?: string;
  assets?: {thumbnail?: string; character?: string; bangers?: string; anton?: string;
    thumbnailLeft?: string; thumbnailRight?: string; channelIcon?: string};
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Diálogo HQ

Dois participantes alternam destaque e falas.

Módulo: `project://custom-scenes/DialogoHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Diálogo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/dialogo-hq/preview-0-16x9.png)
![Exemplo de Diálogo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/dialogo-hq/preview-0-9x16.png)

Guia: [dialogo-hq](../scene-library/dialogo-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/dialogo-hq/exemplo-cena.json)

```ts
type Speaker='left'|'right';
type Participant={asset:string;name?:string;color?:string;scale?:number};
type Turn={speaker:Speaker;text:string;at:number;duration:number;animation?:'escrita'|'none';writeDuration?:number;textDelay?:number;textColor?:string};
type Props=HQBackgroundOptions & {left:Participant;right:Participant;turns:Turn[];fontFamily?:HQFont;
  textColor?:string;motionDuration?:number;highlightOpacity?:number;assets?:Record<string,string>};
type Bounds={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
type TextLayout={lines:string[];size:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Galeria de cartas HQ

Imagens entram e se empilham por coluna.

Módulo: `project://custom-scenes/GaleriaCartasHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Galeria de cartas HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/galeria-cartas-hq/preview-0-16x9.png)
![Exemplo de Galeria de cartas HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/galeria-cartas-hq/preview-0-9x16.png)

Guia: [galeria-cartas-hq](../scene-library/galeria-cartas-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/galeria-cartas-hq/exemplo-cena.json)

```ts
type Card = {asset: string; title: string; caption?: string; at?: number; cardColor?: string; accentColor?: string};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; title: string; subtitle?: string; items: Card[]; columns?: number;
  backgroundColor?: string; cardColor?: string; textColor?: string; cardTextColor?: string; accentColor?: string;
  startDelay?: number; stagger?: number; entryDuration?: number; textDuration?: number; stackOffset?: number;
  assets?: Record<string, string>};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type TextLayout = {lines: string[]; size: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Imagem e frases HQ

Imagem com brilho e frases sincronizadas ao lado.

Módulo: `project://custom-scenes/ImagemFrasesHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Imagem e frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/imagem-frases-hq/preview-0-16x9.png)
![Exemplo de Imagem e frases HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/imagem-frases-hq/preview-0-9x16.png)

Guia: [imagem-frases-hq](../scene-library/imagem-frases-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/imagem-frases-hq/exemplo-cena.json)

```ts
type Phrase = {text: string; at: number; color?: string; size?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; phrases: Phrase[]; imageSide?: 'left' | 'right'; label?: string;
  backgroundColor?: string; textColor?: string; mutedColor?: string; accentColor?: string; glowColor?: string;
  glowIntensity?: number; imageScale?: number; assets?: {image?: string; bangers?: string; anton?: string}};
type Line = {text: string; size: number; height: number};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Linha do tempo HQ

Clipes percorridos em ordem ou reverso, com expansão.

Módulo: `project://custom-scenes/LinhaDoTempoHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Linha do tempo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/linha-do-tempo-hq/preview-0-16x9.png)
![Exemplo de Linha do tempo HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/linha-do-tempo-hq/preview-0-9x16.png)

Guia: [linha-do-tempo-hq](../scene-library/linha-do-tempo-hq/README.md). Exemplos: [exemplo-cena.json](../scene-library/linha-do-tempo-hq/exemplo-cena.json)

```ts
type Clip = {asset: string; title?: string; subtitle?: string; sourceStart?: number; hold?: number; crt?: boolean};
type Props = HQBackgroundOptions & {fontFamily?: HQFont; clips: Clip[]; direction?: 'forward' | 'reverse'; backgroundColor?: string; accentColor?: string; textColor?: string;
  startDelay?: number; moveDuration?: number; enterDuration?: number; enterLast?: boolean; assets?: Record<string, string>};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Página HQ Cenas

Grid, dois painéis, divisão de escolhas e Parallax.

Módulo: `project://custom-scenes/PaginaHQCenas.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-0-16x9.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-0-9x16.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-1-16x9.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-1-9x16.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-2-16x9.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-2-9x16.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-3-16x9.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-3-9x16.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-4-16x9.png)
![Exemplo de Página HQ Cenas](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/pagina-hq-cenas/preview-4-9x16.png)

Guia: [pagina-hq-cenas](../scene-library/pagina-hq-cenas/README.md). Exemplos: [exemplo-cena.json](../scene-library/pagina-hq-cenas/exemplo-cena.json) · [exemplo-dois-paineis.json](../scene-library/pagina-hq-cenas/exemplo-dois-paineis.json) · [exemplo-dois-videos.json](../scene-library/pagina-hq-cenas/exemplo-dois-videos.json) · [exemplo-parallax.json](../scene-library/pagina-hq-cenas/exemplo-parallax.json) · [exemplo-split-choice.json](../scene-library/pagina-hq-cenas/exemplo-split-choice.json)

```ts
type Panel = {asset: string; label?: string; sourceStart?: number; crt?: boolean; mediaType?:'video'|'image'; fit?:'cover'|'contain'; at?:number; accentColor?:string; backgroundColor?:string};
type Focus = {panel: number; at: number; until: number};
type Entry = {panel: number; at: number; duration?: number};
type Props = HQBackgroundOptions & {fontFamily?: HQFont;
  panels: Panel[];
  focus: Focus[];
  enter?: Entry;
  backgroundColor?: string;
  accentColor?: string;
  panelLayout?: 'grid'|'asymmetric'|'split'|'parallax';
  parallaxDuration?:number;
  splitColors?: [string,string];
  dividerColor?:string;
  heading?:string;
  headingColor?:string;
  entryDuration?:number;
  assets?: Record<string, string>;
};
type Interval = {at: number; until: number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Personagem, espiral e legenda

Personagem sobe sobre espiral pixelada e legenda por palavra.

Módulo: `project://custom-scenes/PersonagemEspiralLegenda.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Personagem, espiral e legenda](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/personagem-espiral-legenda/preview-0-16x9.png)
![Exemplo de Personagem, espiral e legenda](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/personagem-espiral-legenda/preview-0-9x16.png)

Guia: [personagem-espiral-legenda](../scene-library/personagem-espiral-legenda/README.md). Exemplos: [exemplo-cena.json](../scene-library/personagem-espiral-legenda/exemplo-cena.json)

```ts
type Word = {word?: string; text?: string; start: number; end: number};
type Props = HQComicPageOptions & {fontFamily?: HQFont;
  assets?: {character?: string; bangers?: string; anton?: string};
  backgroundVariant?: 'espiral' | 'crescente';
  captions?: Caption[]; words?: Word[]; transcriptOffset?: number;
  entryDuration?: number; entryDelay?: number; characterScale?: number;
  headAnchor?: {x: number; y: number}; sway?: number; maxWords?: number;
  captionColor?: string; highlightColors?: string[];
};
type Bounds = {x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Quadro HQ sobre cena

Etiqueta e caixa de narração sobre mídia externa.

Módulo: `project://custom-scenes/QuadroHQSobreCena.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Quadro HQ sobre cena](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/quadro-hq-sobre-cena/preview-0-16x9.png)
![Exemplo de Quadro HQ sobre cena](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/quadro-hq-sobre-cena/preview-0-9x16.png)

Guia: [quadro-hq-sobre-cena](../scene-library/quadro-hq-sobre-cena/README.md). Exemplos: [exemplo-cena.json](../scene-library/quadro-hq-sobre-cena/exemplo-cena.json)

```ts
type Props = HQComicPageOptions & {fontFamily?: HQFont;
  compactAt?:number;compactDuration?:number;compactScale?:number;
  upperText: string;
  lowerText: string;
  tagColor?: string;
  assets?: {anton?: string; bangers?: string};
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```

### Texto HQ

Frases/palavras com Anton ou Bangers, escrita e Kinetic.

Módulo: `project://custom-scenes/TextoHQ.tsx`. Fontes: Anton ou Bangers quando há texto; Anton sem sombra.

![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-0-16x9.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-0-9x16.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-1-16x9.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-1-9x16.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-2-16x9.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-2-9x16.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-3-16x9.png)
![Exemplo de Texto HQ](https://raw.githubusercontent.com/DanielHABDias/ContentLab/main/scene-library/texto-hq/preview-3-9x16.png)

Guia: [texto-hq](../scene-library/texto-hq/README.md). Exemplos: [exemplo-anton-palavra-por-palavra.json](../scene-library/texto-hq/exemplo-anton-palavra-por-palavra.json) · [exemplo-frase.json](../scene-library/texto-hq/exemplo-frase.json) · [exemplo-kinetic.json](../scene-library/texto-hq/exemplo-kinetic.json) · [exemplo-sequencia.json](../scene-library/texto-hq/exemplo-sequencia.json)

```ts
type Entrance='abrir'|'escrita'|'kinetic'|'none'|null;
type Exit='fechar'|'none'|null;
type TextStyle=HQBackgroundOptions & {fontFamily?:HQFont;textColor?:string;textScale?:number;
  kineticUnit?:'letter'|'word';kineticDirection?:'up'|'down'|'left'|'right';kineticStagger?:number;kineticAccentColor?:string;
  entryAnimation?:Entrance;exitAnimation?:Exit;entryDuration?:number;exitDuration?:number;entryDelay?:number;writeDuration?:number};
type TextStep=TextStyle & {text:string;at:number;duration:number};
type Props=TextStyle & {text?:string;texts?:TextStep[];assets?:{bangers?:string;anton?:string}};
type PreparedStep=TextStep & {fontFamily:HQFont;textColor:string;textScale:number;entryAnimation:Entrance;exitAnimation:Exit;
  entryDuration:number;exitDuration:number;entryDelay:number};
type Layout={lines:string[];fontSize:number};
type HQBackgroundOptions = {
  backgroundStyle?: 'comic_page' | 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
type HQFont = 'Bangers' | 'Anton';
type HQComicPageOptions = {backgroundStyle?:'comic_page';backgroundOpacity?:number};
```


## Referência completa dos campos do JSON

Obrigatório significa exigido dentro do objeto pai. Um bloco opcional pode ter campos obrigatórios quando preenchido.

### Projeto

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `project` | object | Sim | — | `{}` | Metadados gerais de formato e identificação da produção. |
| `project.name` | string | Sim | mín. caracteres 1 | `"Meu vídeo"` | Nome do vídeo exibido no projeto e no relatório de render. |
| `project.format` | enum | Sim | opções: youtube_long, youtube_short, custom | `"youtube_long"` | Formato de saída: youtube_long, youtube_short ou custom. |
| `project.profile` | string | Sim | mín. caracteres 1 | `"generic"` | Identificador textual do perfil; não carrega automaticamente templates diferentes. |
| `project.resolution` | object | Não | — | `{}` | Dimensões que substituem as do formato escolhido. |
| `project.resolution.width` | integer | Sim | mín. 1 | `1920` | Largura do MP4 em pixels. |
| `project.resolution.height` | integer | Sim | mín. 1 | `1080` | Altura do MP4 em pixels. |
| `project.fps` | number | Não | maior que 0 | `30` | Quadros por segundo do vídeo final. |
| `project.seed` | integer | Não | — | `1` | Semente para efeitos determinísticos, quando utilizados. |

### Fontes

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `sources` | object | Não | — | `{}` | Referências a arquivos auxiliares do projeto. |
| `sources.assets` | string | Não | — | `"exemplo"` | Nome da pasta de mídia; não resolve automaticamente URIs de camada. |
| `sources.transcript` | string | Não | — | `"exemplo"` | Arquivo de palavras e frases temporizadas relativo à pasta do projeto. |
| `sources.assetCatalog` | string | Não | — | `"exemplo"` | Caminho de catálogo de mídia; previsto no contrato, mas sem uso direto confirmado no render atual. |

### Áudio

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `audio` | object | Sim | — | `{}` | Configurações de narração, música, efeitos e mixagem. |
| `audio.narration` | string | Sim | mín. caracteres 1 | `"audio/narration.wav"` | Caminho relativo do arquivo de voz obrigatório. |
| `audio.sourceCuts` | array | Não | — | `[]` | Recortes da narração original, concatenados antes da mixagem. |
| `audio.sourceCuts[].start` | number | Sim | mín. 0 | `0` | Início do recorte na gravação original, em segundos. |
| `audio.sourceCuts[].end` | number | Sim | maior que 0 | `12` | Fim do recorte na gravação original, em segundos. |
| `audio.voice` | object | Não | — | `{}` | Parâmetros de tratamento da voz principal. |
| `audio.voice.preset` | string | Não | — | `"exemplo"` | Nome textual do preset de voz; o FFmpeg atual usa principalmente os campos numéricos. |
| `audio.voice.trimDb` | number | Não | — | `1` | Ganho final de voz em decibéis. |
| `audio.voice.normalize` | boolean | Não | — | `true` | Habilita a normalização de loudness da voz; padrão ativo. |
| `audio.voice.targetLufs` | number | Não | mín. -30; máx. -5 | `-30` | Loudness alvo da narração, normalmente -16 LUFS. |
| `audio.voice.truePeakDb` | number | Não | mín. -9; máx. 0 | `-9` | Limite de pico verdadeiro da narração, normalmente -1,5 dBTP. |
| `audio.voice.highpassHz` | number | Não | mín. 0; máx. 300 | `0` | Frequência de filtro passa-altas, normalmente 70 Hz; zero desliga. |
| `audio.voice.fadeIn` | number | Não | mín. 0 | `0.4` | Fade-in da narração em segundos, aplicado no começo audível da voz. |
| `audio.voice.fadeOut` | number | Não | mín. 0 | `0.8` | Fade-out da narração em segundos, aplicado no fim audível da voz mesmo com música após a fala. |
| `audio.voice.autoTrimSilence` | boolean | Não | — | `true` | Trim automático do silêncio apenas no começo/fim da narração; padrão ligado. Não remove pausas internas. |
| `audio.ducking` | object | Não | — | `{}` | Redução da música quando a narração está ativa. |
| `audio.ducking.enabled` | boolean | Não | — | `true` | Ativa o compressor sidechain comandado pela voz. |
| `audio.ducking.threshold` | number | Não | maior que 0; máx. 1 | `1` | Limiar linear do compressor, padrão aproximado 0,02. |
| `audio.ducking.ratio` | number | Não | mín. 1; máx. 20 | `1` | Razão de compressão do áudio musical, padrão 6. |
| `audio.ducking.attackMs` | number | Não | mín. 0.1; máx. 2000 | `0.1` | Ataque da redução musical em milissegundos. |
| `audio.ducking.releaseMs` | number | Não | mín. 1; máx. 9000 | `1` | Liberação da redução musical em milissegundos. |
| `audio.music` | array | Não | — | `[]` | Lista de clipes musicais posicionados na timeline. |
| `audio.music[].asset` | string | Sim | — | `"project://audio/trilha.wav"` | URI do arquivo de música existente. |
| `audio.music[].start` | number | Sim | mín. 0 | `0` | Início absoluto da música em segundos. |
| `audio.music[].end` | number | Sim | maior que 0 | `1` | Fim absoluto da música em segundos. |
| `audio.music[].preset` | string | Não | — | `"exemplo"` | Intensidade da trilha; valores usuais subtle, normal e present, dependendo do motor. |
| `audio.music[].trimDb` | number | Não | — | `1` | Volume da música em decibéis, sobrepondo o preset. |
| `audio.music[].fadeIn` | number | Não | mín. 0 | `0` | Duração da subida de volume inicial. |
| `audio.music[].fadeOut` | number | Não | mín. 0 | `0` | Duração da descida de volume final. |
| `audio.music[].sourceStart` | number | Não | mín. 0 | `12` | Ponto inicial da música dentro do arquivo de origem, em segundos (padrão 0). |
| `audio.music[].sourceEnd` | number | Não | maior que 0 | `32` | Ponto final da música dentro do arquivo de origem, em segundos; ausente significa fim do arquivo. |
| `audio.music[].loop` | boolean | Não | — | `true` | Repete apenas o trecho musical selecionado até preencher start/end; padrão true. |
| `audio.music[].autoTrimSilence` | boolean | Não | — | `true` | Trim automático do silêncio nas bordas do trecho musical, antes de loop e fades; padrão ligado, não corta pausas internas. |
| `audio.silenceInserts` | array | Não | — | `[]` | Pausas adicionadas à narração para preservar sincronização quando cenas são inseridas. |
| `audio.silenceInserts[].at` | number | Sim | mín. 0 | `5` | Posição absoluta da pausa na timeline resultante. |
| `audio.silenceInserts[].duration` | number | Sim | maior que 0 | `2` | Duração positiva da pausa adicionada à voz. |
| `audio.narrationTrim` | object | Não | — | `{}` | Trecho único da gravação original que será mantido, com start/end em segundos; não combinar com sourceCuts. |
| `audio.narrationTrim.start` | number | Sim | mín. 0 | `2` | Início do trecho contínuo da voz no arquivo original. |
| `audio.narrationTrim.end` | number | Sim | maior que 0 | `30` | Fim do trecho contínuo da voz no arquivo original. |

### Cenas e transições

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline` | array | Sim | — | `[]` | Lista ordenada de cenas com intervalos absolutos sem sobreposição. |
| `timeline[].id` | string | Sim | mín. caracteres 1 | `"batman"` | Identificador único, estável e chave de reaproveitamento do cache. |
| `timeline[].start` | number | Sim | mín. 0 | `0` | Instante absoluto do começo da cena. |
| `timeline[].end` | number | Sim | maior que 0 | `5` | Instante absoluto do fim da cena, posterior ao começo. |
| `timeline[].layout` | texto ou objeto | Não | — | `{}` | Layout predefinido como fullscreen, 3x3 ou character_vs. |
| `timeline[].layout.grid` | objeto | Não | fixo: 3x3 | `"3x3"` | Grade declarada na forma de objeto: atualmente 3x3. |
| `timeline[].layout.preset` | string | Não | — | `"exemplo"` | Nome textual do layout a ser aplicado. |
| `timeline[].transitionOut` | string | Não | opções: cut, fade, blur_left, blur_right, blur_up, blur_down, slide_left, flip, curtain | `"fade"` | Transição entre cenas: cut, fade, blur_left, blur_right, blur_up, blur_down, slide_left (legado), flip ou curtain. Flip gira o quadro no eixo vertical; curtain desliza a cena anterior revelando a próxima por baixo. |
| `timeline[].transitionDuration` | number | Não | maior que 0 | `0.35` | Duração temporal da transição que introduz a próxima cena. |
| `timeline[].customComponent` | object | Não | — | `{}` | Composição programável Remotion/TSX; código local confiável sob custom-scenes/. |
| `timeline[].customComponent.module` | string | Sim | — | `"exemplo"` | URI project://custom-scenes/...tsx; o componente local renderiza sem configuração extra, mas deve ser confiável. |
| `timeline[].customComponent.mode` | enum | Não | opções: replace, overlay | `"replace"` | replace substitui a parte visual por TSX; overlay sobrepõe TSX às camadas normais. |
| `timeline[].customComponent.props` | object | Não | — | `{}` | Parâmetros JSON fornecidos ao componente TSX como propriedades React. |
| `timeline[].customComponent.assets` | object | Não | — | `{}` | Mapa de nomes para URIs existentes; arquivos expostos ao TSX pelo prop assets. |

### Fundo

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].background` | object | Não | — | `{}` | Fundo sólido, com imagem ou com vídeo. |
| `timeline[].background.color` | string | Não | — | `"exemplo"` | Cor CSS/hexadecimal usada como fundo sólido. |
| `timeline[].background.asset` | string | Não | — | `"project://assets/fundo.mp4"` | URI de imagem ou vídeo de fundo. |
| `timeline[].background.fit` | enum | Não | opções: cover, contain, stretch | `"contain"` | contain preserva o quadro; cover recorta; stretch estica. |
| `timeline[].background.loop` | boolean | Não | — | `true` | Repetir vídeo de fundo até acabar a cena. |
| `timeline[].background.muted` | boolean | Não | — | `true` | Quando false, incluir áudio original da mídia de fundo. |
| `timeline[].background.preset` | enum | Não | opções: subtle, normal, strong | `"subtle"` | Intensidade do áudio de fundo, se ativado. |
| `timeline[].background.trimDb` | number | Não | — | `1` | Ganho em decibéis do áudio original do fundo. |
| `timeline[].background.fadeIn` | number | Não | mín. 0 | `0` | Fade de entrada do áudio do fundo. |
| `timeline[].background.fadeOut` | number | Não | mín. 0 | `0` | Fade de saída do áudio do fundo. |

### Camadas e seus parâmetros

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].elements` | array | Sim | — | `[]` | Lista de camadas gráficas e/ou efeitos sonoros. |
| `timeline[].elements[].type` | enum | Sim | opções: video, image, text, kinetic_text, caption, overlay, filter, sfx | `"image"` | Tipo: video, image, text, kinetic_text, caption, overlay, filter ou sfx. |
| `timeline[].elements[].asset` | string | Não | — | `"project://assets/heroi.png"` | Arquivo da camada com URI project:// ou builtin://. |
| `timeline[].elements[].text` | string | Não | — | `"exemplo"` | Texto exibido na camada. |
| `timeline[].elements[].style` | string | Não | — | `"exemplo"` | Nome de estilo de texto, legenda, overlay ou filtro. |
| `timeline[].elements[].fontAsset` | string | Não | — | `"exemplo"` | URI para arquivo de fonte que substitui a tipografia padrão. |
| `timeline[].elements[].fontScale` | number | Não | maior que 0; máx. 3 | `1` | Multiplicador de tamanho do texto, maior que zero. |
| `timeline[].elements[].reveal` | object | Não | — | `{}` | Revelação de texto com velocidade e atraso. |
| `timeline[].elements[].reveal.charactersPerSecond` | number | Sim | maior que 0 | `1` | Quantidade de caracteres revelados por segundo. |
| `timeline[].elements[].reveal.delay` | number | Não | mín. 0 | `0` | Atraso antes de iniciar a revelação textual. |
| `timeline[].elements[].textStyle` | object | Não | — | `{}` | Detalhes personalizados de texto, contorno e sombra. |
| `timeline[].elements[].textStyle.fontFamily` | enum | Não | opções: Anton, Bangers | `"Anton"` | Família de fonte aceita pelo schema, como Anton ou Bangers. |
| `timeline[].elements[].textStyle.uppercase` | boolean | Não | — | `true` | Controla exibição de palavras em letras maiúsculas. |
| `timeline[].elements[].textStyle.color` | string | Não | — | `"exemplo"` | Cor CSS do preenchimento do texto. |
| `timeline[].elements[].textStyle.outlineColor` | string | Não | — | `"exemplo"` | Cor do contorno do texto. |
| `timeline[].elements[].textStyle.outlineWidth` | number | Não | mín. 0; máx. 40 | `0` | Espessura do contorno em pixels. |
| `timeline[].elements[].textStyle.shadow` | object | Não | — | `{}` | Objeto de sombra do texto. |
| `timeline[].elements[].textStyle.shadow.color` | string | Não | — | `"exemplo"` | Cor CSS da sombra, podendo incluir transparência. |
| `timeline[].elements[].textStyle.shadow.blur` | number | Não | mín. 0; máx. 100 | `0` | Raio de desfoque da sombra. |
| `timeline[].elements[].textStyle.shadow.offsetX` | number | Não | mín. -100; máx. 100 | `-100` | Deslocamento horizontal da sombra em pixels. |
| `timeline[].elements[].textStyle.shadow.offsetY` | number | Não | mín. -100; máx. 100 | `-100` | Deslocamento vertical da sombra em pixels. |
| `timeline[].elements[].start` | number | Não | mín. 0 | `0` | Início absoluto da camada; usa o início da cena se ausente. |
| `timeline[].elements[].end` | number | Não | maior que 0 | `1` | Fim absoluto da camada; usa o fim da cena se ausente. |
| `timeline[].elements[].at` | number | Não | mín. 0 | `1.25` | Disparo absoluto do SFX, marcado pelo início audível depois do trim. |
| `timeline[].elements[].cells` | array | Não | mín. itens 1; sem duplicatas | `[2,5,8]` | Células únicas de 1 a 9 que delimitam a região ocupada. |
| `timeline[].elements[].fit` | enum | Não | opções: cover, contain, stretch, smart_cover | `"contain"` | contain preserva, cover recorta, stretch deforma, smart_cover se comporta como cover atualmente. |
| `timeline[].elements[].box` | texto ou objeto | Não | — | `{}` | Caixa decorativa: string de preset ou objeto de configurações. |
| `timeline[].elements[].box.preset` | string | Não | — | `"exemplo"` | Nome opcional do preset da caixa. |
| `timeline[].elements[].box.padding` | number | Não | mín. 0 | `0` | Preenchimento interno da caixa. |
| `timeline[].elements[].box.radius` | number | Não | mín. 0 | `0` | Raio de arredondamento da caixa. |
| `timeline[].elements[].box.shadow` | string | Não | — | `"exemplo"` | Descrição textual de sombra da caixa. |
| `timeline[].elements[].box.background` | string | Não | — | `"exemplo"` | Cor do fundo da caixa. |
| `timeline[].elements[].box.border` | string | Não | — | `"exemplo"` | Descrição CSS da borda da caixa. |
| `timeline[].elements[].animation` | object | Não | — | `{}` | Preset de entrada, movimento contínuo e saída. |
| `timeline[].elements[].animation.enter` | string | Não | — | `"exemplo"` | Nome do preset de entrada, como fade ou pop_in. |
| `timeline[].elements[].animation.idle` | string | Não | — | `"exemplo"` | Nome do preset contínuo, como float_soft ou pan. |
| `timeline[].elements[].animation.exit` | string | Não | — | `"exemplo"` | Nome do preset de saída, como fade_out ou cut. |
| `timeline[].elements[].animation.enterDuration` | number | Não | maior que 0 | `1` | Duração de entrada em segundos. |
| `timeline[].elements[].animation.exitDuration` | number | Não | maior que 0 | `1` | Duração de saída em segundos. |
| `timeline[].elements[].z` | integer | Não | — | `1` | Ordem de empilhamento; valores maiores ficam à frente. |
| `timeline[].elements[].loop` | boolean | Não | — | `true` | Repete a mídia da camada em vídeo. |
| `timeline[].elements[].muted` | boolean | Não | — | `true` | Se false, inclui som original do vídeo/overlay. |
| `timeline[].elements[].preset` | enum | Não | opções: subtle, normal, strong | `"subtle"` | Preset de intensidade sonora da camada. |
| `timeline[].elements[].trimDb` | number | Não | — | `1` | Ganho do áudio da camada em decibéis. |
| `timeline[].elements[].fadeIn` | number | Não | mín. 0 | `0` | Tempo de fade-in do áudio original da camada. |
| `timeline[].elements[].fadeOut` | number | Não | mín. 0 | `0` | Tempo de fade-out do áudio original da camada. |
| `timeline[].elements[].sync` | string | Não | — | `"exemplo"` | Rótulo aceito pelo schema; não presume sincronização automática universal. |
| `timeline[].elements[].emphasis` | array | Não | — | `[]` | Palavras enfatizadas na autoria; o efeito depende do estilo utilizado. |
| `timeline[].elements[].range` | object | Não | — | `{}` | Intervalo de referência para palavras da transcrição. |
| `timeline[].elements[].range.start` | number | Sim | mín. 0 | `0` | Início do intervalo de transcrição. |
| `timeline[].elements[].range.end` | number | Sim | maior que 0 | `1` | Fim do intervalo de transcrição. |
| `timeline[].elements[].config` | object | Não | — | `{}` | Objeto de opções específicas de cada efeito; nem toda chave arbitrária é interpretada. |
| `timeline[].elements[].id` | string | Não | mín. caracteres 1 | `"personagem"` | Identificador da camada visual, único dentro da cena. |
| `timeline[].elements[].transform` | object | Não | — | `{}` | Valores de posição, escala, rotação e opacidade inicial. |
| `timeline[].elements[].transform.x` | number | Não | mín. 0; máx. 1 | `0` | Posição horizontal normalizada entre zero e um. |
| `timeline[].elements[].transform.y` | number | Não | mín. 0; máx. 1 | `0` | Posição vertical normalizada entre zero e um. |
| `timeline[].elements[].transform.offsetX` | number | Não | — | `0` | Deslocamento horizontal em pixels após o encaixe no grid; positivo move para a direita. |
| `timeline[].elements[].transform.offsetY` | number | Não | — | `24` | Deslocamento vertical em pixels após o encaixe no grid; positivo move para baixo. |
| `timeline[].elements[].transform.scale` | number | Não | maior que 0; máx. 8 | `1.25` | Multiplicador de escala; maior que 1 amplia o objeto. |
| `timeline[].elements[].transform.rotation` | number | Não | mín. -360; máx. 360 | `-360` | Ângulo de rotação em graus. |
| `timeline[].elements[].transform.opacity` | number | Não | mín. 0; máx. 1 | `0` | Opacidade entre 0 (invisível) e 1 (visível). |
| `timeline[].elements[].keyframes` | array | Não | — | `[]` | Lista de mudanças de movimento ao longo da cena. |
| `timeline[].elements[].keyframes[].t` | number | Sim | mín. 0 | `0` | Tempo do keyframe relativo ao início da cena. |
| `timeline[].elements[].keyframes[].x` | number | Não | mín. 0; máx. 1 | `0` | Posição horizontal do keyframe. |
| `timeline[].elements[].keyframes[].y` | number | Não | mín. 0; máx. 1 | `0` | Posição vertical do keyframe. |
| `timeline[].elements[].keyframes[].scale` | number | Não | maior que 0; máx. 8 | `1` | Escala interpolada do keyframe. |
| `timeline[].elements[].keyframes[].rotation` | number | Não | mín. -360; máx. 360 | `-360` | Ângulo do keyframe. |
| `timeline[].elements[].keyframes[].opacity` | number | Não | mín. 0; máx. 1 | `0` | Opacidade do keyframe. |
| `timeline[].elements[].keyframes[].easing` | enum | Não | opções: linear, ease_in, ease_out, ease_in_out | `"linear"` | Curva de interpolação do keyframe. |

### Câmera

| Caminho | Tipo | Obrigatório | Restrições | Exemplo | Significado |
|---|---|---|---|---|---|
| `timeline[].camera` | object | Não | — | `{}` | Transformações da câmera virtual aplicada às camadas, sem ampliar automaticamente o fundo. |
| `timeline[].camera.keyframes` | array | Não | — | `[]` | Lista de quadros-chave da câmera. |
| `timeline[].camera.keyframes[].t` | number | Sim | mín. 0 | `0` | Tempo do quadro-chave relativo ao início da cena. |
| `timeline[].camera.keyframes[].x` | number | Não | mín. 0; máx. 1 | `0` | Centro horizontal normalizado da câmera. |
| `timeline[].camera.keyframes[].y` | number | Não | mín. 0; máx. 1 | `0` | Centro vertical normalizado da câmera. |
| `timeline[].camera.keyframes[].scale` | number | Não | mín. 1; máx. 4 | `1` | Escala/zoom da câmera. |
| `timeline[].camera.keyframes[].easing` | enum | Não | opções: linear, ease_in, ease_out, ease_in_out | `"linear"` | Curva temporal de interpolação da câmera. |
| `timeline[].camera.shake` | array | Não | — | `[]` | Lista de trechos de tremor da câmera. |
| `timeline[].camera.shake[].start` | number | Sim | mín. 0 | `0` | Início relativo do tremor em segundos. |
| `timeline[].camera.shake[].end` | number | Sim | maior que 0 | `1` | Fim relativo do tremor em segundos. |
| `timeline[].camera.shake[].amplitude` | number | Não | mín. 0; máx. 0.03 | `0` | Amplitude do tremor. |
| `timeline[].camera.shake[].frequency` | number | Não | maior que 0; máx. 20 | `1` | Frequência da oscilação do tremor. |

## Exemplos de uso

Alguns exemplos abaixo são fragmentos de cena ou áudio. Complete o projeto principal e valide os caminhos antes de renderizar.

### Cena programável TSX — Texto HQ

Prepare Texto HQ pela galeria ou copie scene-library/texto-hq/TextoHQ.tsx para custom-scenes/TextoHQ.tsx. Exemplo completo de plano; forneça audio/narration.wav. Os demais presets possuem snippets e contratos na galeria.

```json
{
  "project": {
    "name": "Exemplo de cena especial",
    "format": "youtube_long",
    "profile": "generic"
  },
  "audio": {
    "narration": "audio/narration.wav"
  },
  "timeline": [
    {
      "id": "texto_kinetic",
      "start": 0,
      "end": 6,
      "layout": "fullscreen",
      "background": {
        "color": "#B72840"
      },
      "elements": [],
      "customComponent": {
        "module": "project://custom-scenes/TextoHQ.tsx",
        "mode": "replace",
        "props": {
          "fontFamily": "Bangers",
          "entryAnimation": "kinetic",
          "entryDuration": 1,
          "entryDelay": 0,
          "kineticStagger": 0.035,
          "kineticAccentColor": "#F7CE46",
          "backgroundStyle": "halftone",
          "backgroundColor": "#B72840",
          "texts": [
            {
              "text": "IDEIAS EM\nMOVIMENTO",
              "at": 0,
              "duration": 3,
              "kineticDirection": "up"
            },
            {
              "text": "OUTRO\nCAMINHO",
              "at": 3,
              "duration": 3,
              "kineticDirection": "left",
              "backgroundColor": "#2459C9",
              "exitAnimation": "fechar",
              "exitDuration": 0.4
            }
          ]
        },
        "assets": {
          "bangers": "builtin://fonts/Bangers-Regular.ttf"
        }
      },
      "transitionOut": "cut"
    }
  ]
}
```

### Projeto completo com pastas e URIs

Exemplo ilustrativo: crie/importa narração no Editor, respeite os nomes reais dos arquivos e valide o JSON. transcript.json é gerado automaticamente após preparar a voz.

```json
{
  "project": {
    "name": "Meu vídeo",
    "format": "youtube_long",
    "profile": "generic"
  },
  "sources": {
    "assets": "assets",
    "transcript": "transcript.json"
  },
  "audio": {
    "narration": "audio/narracao.wav",
    "music": [
      {
        "asset": "project://audio/musica.mp3",
        "start": 0,
        "end": 5,
        "fadeIn": 0.3,
        "fadeOut": 0.5
      }
    ]
  },
  "timeline": [
    {
      "id": "intro",
      "start": 0,
      "end": 5,
      "layout": "3x3",
      "background": {
        "color": "#121826"
      },
      "elements": [
        {
          "id": "abertura",
          "type": "video",
          "asset": "project://assets/abertura.mp4",
          "start": 0,
          "end": 5,
          "fit": "contain",
          "cells": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9
          ]
        },
        {
          "id": "heroi",
          "type": "image",
          "asset": "project://assets/personagens/heroi.png",
          "start": 0,
          "end": 5,
          "cells": [
            2,
            5,
            8
          ],
          "fit": "contain",
          "z": 2
        }
      ],
      "transitionOut": "cut"
    }
  ]
}
```

### Plano completo mínimo

Narração obrigatória e uma cena de texto.

```json
{
  "project": {
    "name": "Introdução",
    "format": "youtube_long",
    "profile": "generic"
  },
  "sources": {
    "assets": "assets"
  },
  "audio": {
    "narration": "audio/narration.wav"
  },
  "timeline": [
    {
      "id": "intro",
      "start": 0,
      "end": 4,
      "layout": "fullscreen",
      "background": {
        "color": "#152238"
      },
      "elements": [
        {
          "id": "titulo",
          "type": "text",
          "text": "MEU PRIMEIRO VÍDEO",
          "style": "impact",
          "start": 0,
          "end": 4
        }
      ]
    }
  ]
}
```

### Personagem centralizado

PNG em coluna central, com animação e proporção preservada.

```json
{
  "id": "personagem",
  "start": 4,
  "end": 9,
  "layout": "3x3",
  "background": {
    "color": "#10151F"
  },
  "elements": [
    {
      "id": "heroi",
      "type": "image",
      "asset": "project://assets/heroi.png",
      "start": 4,
      "end": 9,
      "cells": [
        2,
        5,
        8
      ],
      "fit": "contain",
      "transform": {
        "scale": 1.25
      },
      "animation": {
        "enter": "pop_in",
        "idle": "float_soft",
        "exit": "cut"
      }
    }
  ]
}
```

### Gameplay sem recorte

Vídeo 16:9 mantido inteiro em fullscreen.

```json
{
  "id": "arkham",
  "start": 9,
  "end": 15,
  "layout": "fullscreen",
  "background": {
    "asset": "project://assets/arkham.mp4",
    "fit": "contain",
    "loop": true
  },
  "elements": [
    {
      "id": "subtitulo",
      "type": "text",
      "text": "ARKHAM KNIGHT",
      "start": 10,
      "end": 14,
      "cells": [
        7,
        8,
        9
      ],
      "style": "impact_yellow"
    }
  ]
}
```

### Narração, ducking e efeito sonoro

Áudio global e SFX disparado pelo início audível.

```json
{
  "audio": {
    "narration": "audio/narration.wav",
    "sourceCuts": [
      {
        "start": 0,
        "end": 12
      }
    ],
    "silenceInserts": [
      {
        "at": 5,
        "duration": 2
      }
    ],
    "voice": {
      "normalize": true,
      "targetLufs": -16,
      "truePeakDb": -1.5
    },
    "ducking": {
      "enabled": true,
      "threshold": 0.02,
      "ratio": 6,
      "attackMs": 40,
      "releaseMs": 350
    },
    "music": [
      {
        "asset": "project://audio/trilha.wav",
        "start": 0,
        "end": 14,
        "preset": "subtle",
        "fadeIn": 1,
        "fadeOut": 1
      }
    ]
  },
  "scene": {
    "id": "impacto",
    "start": 5,
    "end": 7,
    "elements": [
      {
        "type": "sfx",
        "asset": "project://audio/impacto.wav",
        "at": 5.2,
        "preset": "normal",
        "config": {
          "duration": 1.5
        }
      }
    ]
  }
}
```

### Trim e crossfade de duas músicas

Recortar trechos da fonte e sobrepor fades em segundos absolutos. Narração com corte simples e fades próprios.

```json
{
  "audio": {
    "narration": "audio/narration.wav",
    "narrationTrim": {
      "start": 2,
      "end": 30
    },
    "voice": {
      "normalize": true,
      "fadeIn": 0.4,
      "fadeOut": 0.8
    },
    "music": [
      {
        "asset": "project://audio/trilha-a.wav",
        "start": 0,
        "end": 20,
        "sourceStart": 12,
        "sourceEnd": 32,
        "autoTrimSilence": true,
        "fadeOut": 3
      },
      {
        "asset": "project://audio/trilha-b.wav",
        "start": 17,
        "end": 40,
        "sourceStart": 5,
        "sourceEnd": 45,
        "fadeIn": 3,
        "fadeOut": 2
      }
    ]
  }
}
```

### Carrossel vertical de frases em largura total

Padrão atual CarrosselFrasesHQ: próxima menor acima, ativa no centro com faixa, anterior abaixo. Configure phrases/at conforme a transcrição.

```json
{
  "id": "carrossel_frases_hq",
  "start": 0,
  "end": 10,
  "layout": "fullscreen",
  "background": {
    "color": "#111522"
  },
  "elements": [
    {
      "id": "carrossel_whoosh_0",
      "type": "sfx",
      "asset": "builtin://sfx/Whoosh curto 04.mp3",
      "at": 0.455,
      "fadeOut": 0.04,
      "config": {
        "duration": 0.24,
        "preset": "subtle",
        "trimDb": -28
      }
    },
    {
      "id": "carrossel_whoosh_1",
      "type": "sfx",
      "asset": "builtin://sfx/Whoosh 03.mp3",
      "at": 2.655,
      "fadeOut": 0.04,
      "config": {
        "duration": 0.24,
        "preset": "subtle",
        "trimDb": -28
      }
    },
    {
      "id": "carrossel_whoosh_2",
      "type": "sfx",
      "asset": "builtin://sfx/Whoosh aéreo 03.mp3",
      "at": 4.855,
      "fadeOut": 0.04,
      "config": {
        "duration": 0.24,
        "preset": "subtle",
        "trimDb": -28
      }
    },
    {
      "id": "carrossel_whoosh_3",
      "type": "sfx",
      "asset": "builtin://sfx/Whoosh 03.mp3",
      "at": 7.055,
      "fadeOut": 0.04,
      "config": {
        "duration": 0.24,
        "preset": "subtle",
        "trimDb": -28
      }
    }
  ],
  "customComponent": {
    "module": "project://custom-scenes/CarrosselFrasesHQ.tsx",
    "mode": "replace",
    "props": {
      "phrases": [
        {
          "text": "Herói NÃO É JUIZ",
          "at": 0.8
        },
        {
          "text": "Herói NÃO É JÚRI",
          "at": 3
        },
        {
          "text": "NEM O CARRASCO",
          "at": 5.2,
          "color": "#EF3F49"
        },
        {
          "text": "ONDE FICA O LIMITE?",
          "at": 7.4
        }
      ],
      "fontFamily": "Bangers",
      "align": "left",
      "motionDuration": 0.45,
      "backgroundStyle": "halftone",
      "backgroundColor": "#10131E",
      "activeColor": "#F4C542",
      "inactiveColor": "#9698A2",
      "inactiveOpacity": 0.38,
      "inactiveScale": 0.6,
      "activeBandColor": "#A0A0A0",
      "activeBandOpacity": 0.12
    },
    "assets": {
      "bangers": "builtin://fonts/Bangers-Regular.ttf"
    }
  },
  "transitionOut": "cut"
}
```

### Legendas e texto cinético

Duas modalidades que usam a transcrição temporizada.

```json
{
  "id": "dialogo",
  "start": 15,
  "end": 21,
  "layout": "3x3",
  "elements": [
    {
      "id": "legenda",
      "type": "caption",
      "start": 15,
      "end": 21,
      "cells": [
        7,
        8,
        9
      ],
      "style": "bangers_highlight_block",
      "config": {
        "maxWords": 7,
        "highlightColors": [
          "#2563EB",
          "#E53935"
        ]
      }
    }
  ],
  "customComponent": {
    "module": "project://custom-scenes/TextoHQ.tsx",
    "mode": "overlay",
    "props": {
      "text": "UMA NOVA IDEIA",
      "entryAnimation": "kinetic",
      "entryDuration": 0.5,
      "backgroundOpacity": 0
    },
    "assets": {
      "bangers": "builtin://fonts/Bangers-Regular.ttf"
    }
  }
}
```

### Movimento suave em 0,1 segundo

Curva suave independente do tempo declarado: 0.1 s continua 0.1 s; sem aumentar a animação.

```json
{
  "id": "micro-motion",
  "start": 0,
  "end": 2,
  "layout": "3x3",
  "background": {
    "color": "#111111"
  },
  "camera": {
    "keyframes": [
      {
        "t": 0,
        "x": 0.48,
        "y": 0.5,
        "scale": 1
      },
      {
        "t": 0.1,
        "x": 0.5,
        "y": 0.5,
        "scale": 1.02,
        "easing": "ease_in_out"
      }
    ]
  },
  "elements": [
    {
      "id": "titulo",
      "type": "text",
      "text": "SUAVE E RÁPIDO",
      "start": 0,
      "end": 2,
      "cells": [
        4,
        5,
        6
      ],
      "style": "anton",
      "animation": {
        "enter": "slide_up",
        "enterDuration": 0.1
      },
      "keyframes": [
        {
          "t": 0,
          "opacity": 0
        },
        {
          "t": 0.1,
          "opacity": 1
        }
      ]
    }
  ]
}
```

### Animação e câmera

Keyframes com tempos relativos ao início da cena.

```json
{
  "id": "close",
  "start": 21,
  "end": 26,
  "layout": "fullscreen",
  "camera": {
    "keyframes": [
      {
        "t": 0,
        "x": 0.5,
        "y": 0.5,
        "scale": 1
      },
      {
        "t": 4.7,
        "x": 0.5,
        "y": 0.5,
        "scale": 1.1,
        "easing": "ease_in_out"
      }
    ]
  },
  "elements": [
    {
      "id": "avatar",
      "type": "image",
      "asset": "project://assets/avatar.png",
      "start": 21,
      "end": 26,
      "cells": [
        2,
        5,
        8
      ],
      "keyframes": [
        {
          "t": 0,
          "scale": 1,
          "opacity": 0
        },
        {
          "t": 0.5,
          "scale": 1.2,
          "opacity": 1
        }
      ]
    }
  ]
}
```

### Filtros e transição

Efeito CRT e transição para a cena seguinte.

```json
{
  "id": "filtro",
  "start": 26,
  "end": 30,
  "background": {
    "color": "#203854"
  },
  "elements": [
    {
      "id": "crt",
      "type": "filter",
      "style": "crt_tv",
      "start": 26,
      "end": 30,
      "config": {
        "scanlineOpacity": 0.18,
        "vignette": 0.42,
        "flicker": 0.035,
        "jitter": 1.5
      }
    }
  ],
  "transitionOut": "fade",
  "transitionDuration": 0.35
}
```

## Regras práticas e validação

- IDs de cena devem ser exclusivos e estáveis, e camadas visuais exigem ID único dentro da cena.
- Cenas são sequenciais, com fim posterior ao início; keyframes são ordenados e relativos ao começo da cena.
- Assets são obrigatórios para image, video, overlay e sfx. Use project:// ou builtin:// para mídias existentes.
- Narração é obrigatória; depois da importação o Content Lab prepara a voz e cria o transcript.json automaticamente com whisper.cpp, quando instalado.
- Sobreposições de texto podem gerar avisos, sem bloquear composições intencionais.
- Pausas internas de SFX são preservadas; somente silêncio inicial/final é removido antes do disparo em at.
- config aceita opções livres, mas só as consumidas pelo renderer alteram o resultado.

