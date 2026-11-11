# Voz local: modelos e expressividade

Pesquisa técnica em 20/10/2026. Não há garantia de que um modelo seja melhor em todas as vozes; comparar a mesma referência e o mesmo texto em português.

## Escolha integrada

**Qwen3-TTS Base 0.6B/1.7B** continua disponível para clonagem. O Base não oferece o mesmo controle por instruções dos modelos CustomVoice/VoiceDesign; estes têm outra função e não são substitutos diretos da clonagem da voz do usuário.

**Chatterbox Multilingual V3**, 500M, oferece clonagem, português e parâmetros explícitos `exaggeration` e `cfg_weight`. Foi adicionado como alternativa expressiva, não como substituição obrigatória. Usa o pacote PyPI oficial `chatterbox-tts==0.1.7` com seleção explícita dos pesos V3 oficiais (o wheel usa V2 por padrão). O adaptador seleciona o arquivo V3 na fronteira de carregamento de safetensors, mantendo a arquitetura/vocoder compartilhados conforme o loader upstream; não renomeia pesos nem faz fallback silencioso para V2. Em runtimes com suporte nativo, usa `t3_model=v3`. Os modelos específicos de português brasileiro anunciados upstream não foram integrados. Turbo/Nano são voltados a inglês e não foram usados para narrar português.

O pacote e os pesos oficiais são distribuídos sob MIT; preservar avisos upstream e a marca d'água Perth. O Content Lab não copia código do Voicebox nem remove watermark. Vozes clonadas exigem autorização do titular, independentemente da licença do software.

O adaptador integra português, inglês e espanhol (as opções atuais da interface). Outros idiomas do upstream não estão habilitados aqui: use Qwen para seus idiomas adicionais. O adaptador evita inicializar recursos chineses desnecessários, que o pacote tenta baixar mesmo para português. Pesos fixados na revisão `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`; tentativas de rede durante a síntese são bloqueadas no subprocesso.

Fontes oficiais consultadas:

- https://github.com/resemble-ai/chatterbox — modelos, idiomas e recomendações de intensidade/CFG.
- https://pypi.org/project/chatterbox-tts/0.1.7/ — versão do pacote integrada.
- https://huggingface.co/ResembleAI/chatterbox — pesos e licença.
- https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-br — especialização brasileira anunciada; não integrada neste adaptador.
- https://github.com/QwenLM/Qwen3-TTS — diferenças entre Base, CustomVoice e VoiceDesign.

## Uso

### Padrões de geração alinhados ao Voicebox

Os valores foram conferidos no Voicebox instalado: `backend/backends/chatterbox_backend.py` (`_GLOBAL_DEFAULTS`) e `backend/backends/pytorch_backend.py`, junto do `generation_config.json` dos dois Qwen Base locais.

| Modelo | Temperatura | Top P | Repetição | Expressividade / CFG |
| --- | --- | --- | --- | --- |
| Qwen 0.6B / 1.7B | 0,9 | 1,0 | 1,05 | Não se aplica |
| Chatterbox Multilingual | 0,8 | 1,0 | 2,0 | 0,5 / 0,5 |

Qwen usa Top K 50 e limite de 8192 tokens, como nos pesos usados pelo Voicebox. O subtalker mantém os padrões do modelo (temperatura 0,9, Top P 1, Top K 50). Não há pausa adicional entre trechos por padrão; o controle continua disponível. Trocar o modelo no formulário restaura os valores iniciais de amostragem e o ponto de partida Natural.

São parâmetros equivalentes, não promessa de áudio idêntico: Content Lab mantém os pesos Chatterbox V3, sua segmentação e retentativas; não reproduz o crossfade/segmentação do Voicebox. Não substituir V3 por V2 para igualar parâmetros.

### Gravação e tratamento

Personalizada inicia com IA DeepFilterNet em limpeza forte/100%, filtro 70 Hz, compressão/de-esser suaves, normalização -16 LUFS e corte apenas nas bordas. Gravar usa a mesma base, sem efeito de pitch. Tudo permanece ajustável; intensidade máxima pode prejudicar a naturalidade em algumas gravações. Transcrição avulsa continua sem tratamento.

Tomadas gravadas e o `audio/narration.wav` unido são WAV PCM 24-bit, mono, 48 kHz, inclusive quando o tratamento é desligado. As tomadas originais são preservadas. Isso não recupera resolução perdida pelo microfone/navegador e não representa um preset proprietário do Kdenlive. A transcrição é feita sobre o áudio final.

1. O inicializador prepara automaticamente os ambientes locais Qwen e Chatterbox. Ao gerar com o modelo escolhido, o aplicativo baixa os pesos ausentes automaticamente e mostra progresso. Configurações → Voz e modelos de IA permite antecipar o download ou reparar o ambiente; não é pré-requisito manual. Apenas visitar a página ou consultar estado não baixa todos os modelos.
2. Em Criar com IA, selecione Chatterbox e uma voz já cadastrada. O perfil local é compartilhado com Qwen; Chatterbox usa o áudio de referência, sem precisar enviar voz ou texto a um serviço de geração.
3. Escolha um ponto de partida e ajuste pela escuta: Natural (intensidade 0,5/CFG 0,5), Contido (0,3/0,3), Dramático (0,75/0,3), Enérgico (0,85/0,4). Não são classes de emoção do modelo, apenas combinações de controles.
4. Intensidade aceita 0–2 e CFG 0–1. Aumentar intensidade pode acelerar ou exagerar a fala; CFG menor costuma ajudar no ritmo. Pausa entre trechos: 0–2 s. Temperatura, top P, penalidade e seed também estão disponíveis.
5. Para mudar interpretação durante a narração, gere trechos separadamente com parâmetros distintos e marque Acrescentar. Ouça, ordene/desmarque tomadas e finalize para atualizar áudio e transcrição. Não coloque instruções ou tags de riso no texto esperando que esse modelo as interprete.

O adaptador divide o texto por sentença e limita cada trecho a 200 caracteres, evitando o encerramento prematuro após a primeira frase observado no teste local. A pausa configurada é aplicada entre esses trechos (não somente entre parágrafos). Revise a transcrição gerada: o modelo ainda pode omitir/repetir conteúdo, e segmentar não é uma garantia linguística. Números decimais e abreviações com ponto podem gerar divisões adicionais; prefira escrevê-los por extenso na narração.

Trechos obviamente curtos/inválidos são tentados no máximo três vezes antes de falhar sem produzir uma tomada final. Essa heurística não comprova fidelidade textual. Com seed definida, as tentativas e sentenças usam deslocamentos determinísticos da seed; sem seed, a amostragem permanece aleatória. Sempre revisar a transcrição e ouvir o resultado.

A geração continua no fluxo de narração oficial: tomadas em `audio/takes/`, áudio unificado e transcrição sincronizada. A categoria histórica de tomadas de IA continua `kind:qwen` no manifesto para compatibilidade; o JSON ao lado da tomada identifica `engine:chatterbox` e os parâmetros usados. Isso não significa que o Qwen foi utilizado.

## Ambiente, recursos e limites

Chatterbox usa Python 3.10–3.12 em `.tools/chatterbox/venv`, separado de `.tools/qwen/venv`; dependências/modelos são locais e ignorados pelo Git. O servidor continua Node. Se Python compatível com venv estiver ausente, uv com hash verificado prepara Python 3.12 portátil local, sem pedir instalação manual. Instalação padrão CPU com PyTorch/torchaudio 2.6.0; CUDA exige ambiente próprio compatível, não detecta nem instala drivers automaticamente. Override opcional: `CONTENTLAB_CHATTERBOX_PYTHON`, sem alterar `CONTENTLAB_QWEN_PYTHON`.

As dependências e os pesos ocupam vários GB. Geração em CPU pode demorar bastante; 500M parâmetros não implica velocidade ou qualidade superior ao Qwen. Abertura da página e consulta de estado não fazem download. Cancelamento interrompe o processo; geração trabalha em staging e só depois grava uma tomada com nome único. Não sobrescrever projetos existentes para fazer testes de qualidade. Falhas de geração não autorizam substituir a narração oficial por áudio incompleto.

A geração é offline após o primeiro download automático do modelo selecionado. Limites: português pode herdar sotaque da referência, intensidade pode alterar ritmo e identidade e alguns textos podem apresentar repetições. Comparar naturalidade, inteligibilidade, fidelidade à voz e prosódia; não afirmar superioridade sem escuta A/B. Homologação física Windows/CUDA é separada dos testes Linux/CPU.

## Verificação desta integração

Em Linux/CPU foram executados 173 testes automatizados, smoke de render/cache e geração real pelo endpoint normal do Content Lab. O teste V3 gerou 4,56 s de áudio, tomada única com metadados V3 e transcrição por palavra com as duas frases completas (10 palavras): “Será que isso muda tudo? Agora, a história fica interessante!”. Exemplos locais estão em `.visual-tests/voice-chatterbox-v3-*`, ignorados pelo Git. Não são arquivos padrão obrigatórios do projeto.

O checkpoint V2 foi descartado como opção da integração após omissões nos testes locais. O V3 passou na conferência textual dessa amostra; isso não comprova superioridade subjetiva de timbre/emoção, nem ausência de omissões em outros textos. A aprovação estética e a comparação com Qwen dependem da escuta do usuário.
