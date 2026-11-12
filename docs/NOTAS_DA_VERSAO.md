# Content Lab 2.1.0-rc.1 — release candidate

Primeira versão candidata completa. Ela vai da ideia ao vídeo final, roda localmente e não publica nada sozinha.

## O que entra

- **Projetos:** criar, abrir, configurar, renomear, duplicar, excluir pela lixeira e restaurar. A lista de Recentes tem backup, as revisões são otimistas e o histórico é auditável (F12–F15).
- **Dependências instaláveis pelo app:** tamanho, licença e consentimento aparecem antes de instalar, e cada recurso que depende de algo mostra o que falta (F14).
- **Mídia:** importar arquivos, arrastar para a janela e importar por URL com direitos confirmados. Também há cortes, transcrição PT-BR com whisper large-v3 e busca no texto (F16).
- **Narração:**
  - gravar, importar, ordenar e tratar takes;
  - montar em 48 kHz com loudness medido;
  - voz clonada VoxCPM2 por cena, com consentimento e limite de memória por máquina (F17, F25).
- **Timeline:** mover, aparar, dividir e ripple; desfazer persistente; enquadramento por proporção; legendas por transcrição ou SRT; componentes TSX (F18).
- **Render:** uma fila persistente que sobrevive ao fechamento do app, com prévias feitas pelo mesmo plano do render final, pacotes `.contentlab` e ZIP (F19).
- **Workflow:** aprovações e pedidos de mudança. O modo autônomo para por direitos, consentimento, custo ou aprovação (F20).
- **Acessibilidade:** diálogos acessíveis, uso por teclado, contraste AA, aviso quando o servidor fica offline, seletor nativo no Linux, Windows e macOS, e a tela "Sobre e diagnóstico" (F21).
- **Segurança:** a API local recusa outros sites e DNS rebinding; os pacotes têm limites contra ZIP bomb; as fontes são locais e não existe telemetria (F22).
- **Estilo Diazverso (F27–F28):** cenas HQ do plugin Diazverso com imagem do assunto em cada beat, Anton e Nox embutidos, legenda palavra a palavra (Whisper), SFX originais, trilha licenciada com ducking sob a voz, áreas seguras de Shorts, capítulos e `verificacao.md` na entrega. Disponível pela interface e pelo MCP.
- **Modo composição (F29):** o vídeo inteiro como motion design do kit Diazverso, em beats: ritmo de troca a cada 1,5–3 s, Nox com 8 expressões, cenas das obras em painéis HQ, legenda palavra a palavra, som em cada troca, plano automático e prévia em PNG pelo MCP.
- **Nox em stop motion e caixinhas (F34):** o Nox gesticula trocando de pose a cada fala, sem animação entre as poses; caixinhas HQ de lembrete e recortes PNG por cima das cenas; fundos sempre variando e cena da obra sozinha em tela cheia.
- **Shorts e aparte do Nox (F33):** todas as cenas diagramadas para 9:16; o Nox comenta a cena da obra em aparte, com o fundo desfocado e um balão de ícone; thumbnails limpas, com fundo preto ou branco.
- **Cena 3D (F32):** voo de câmera por painéis da obra no espaço, sem precisar de placa de vídeo.
- **Thumbnail do kit (F31):** thumbnails A/B no estilo do canal, com a cena da obra, até 4 palavras em Anton, o Nox com expressão e uma versão do tamanho do celular para conferir.
- **Fluxo combinado (F30):** antes de criar o projeto, o agente pergunta se é tudo automático, com pausas em etapas escolhidas para você revisar no app, ou com aprovação de cada etapa; e se a narração é voz de IA ou a sua, gravada no app.
- **Instalação Linux sem npm:** atualização assinada com volta de versão, e desinstalação que pergunta antes de cada parte (F23).

## Correções da F24

- **Render com cauda preta:** o vídeo agora termina no último clip, e não na duração padrão da timeline, que era de 10 s.
- **App instalado não abria:** o `typescript` passou a ser dependência de produção, porque é usado em runtime pelos componentes TSX (encontrado na instalação limpa da F23).

## Limitações conhecidas

- **Instalador:** só existe para Linux x64. Windows e macOS têm apenas o seletor de arquivos nativo.
- **Assinatura:** o manifesto de atualização é assinado com Ed25519 e fixa o SHA-256 do pacote. Não há assinatura de código do sistema operacional.
- **Voz clonada na CPU:** leva cerca de 30 s por segundo de fala nesta máquina. A GPU AMD sem ROCm não é usada.
- **Escuta pendente:** a qualidade e o ritmo da voz clonada em PT-BR dependem da escuta do titular (`.tools/qa-f17/`).
- **Render com muitos clipes:** gera muitas entradas no FFmpeg. Projetos com mais de 60 s nesse caso são renderizados em segmentos.
- **Excluir perfil de voz:** só procura os takes gerados nos projetos que estão nos Recentes.
- **Remotion:** a licença é gratuita para pessoas físicas e empresas de até 3 funcionários.
- **FFmpeg:** vem do sistema; um FFmpeg redistribuído precisaria ser uma build LGPL.
- **VM:** a instalação limpa foi testada num HOME isolado, sem npm, e não numa VM com outra distribuição.
