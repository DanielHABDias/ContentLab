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
- **Instalação Linux sem npm:** atualização assinada com volta de versão, e desinstalação que pergunta antes de cada parte (F23).

## Correções da F24

- **Render com cauda preta:** o vídeo agora termina no último clip, e não na duração padrão da timeline, que era de 10 s.
- **App instalado não abria:** o `typescript` passou a ser dependência de produção, porque é usado em runtime pelos componentes TSX (encontrado na instalação limpa da F23).

## Limitações conhecidas

- **Instalador:** só existe para Linux x64. Windows e macOS têm apenas o seletor de arquivos nativo.
- **Assinatura:** o instalador ainda não é assinado, porque a chave de release não foi gerada (`scripts/release-keys.mjs`). Sem a chave, atualizar só funciona no modo manual.
- **Voz clonada na CPU:** leva cerca de 30 s por segundo de fala nesta máquina. A GPU AMD sem ROCm não é usada.
- **Escuta pendente:** a qualidade e o ritmo da voz clonada em PT-BR dependem da escuta do titular (`.tools/qa-f17/`).
- **Render com muitos clipes:** gera muitas entradas no FFmpeg. Projetos com mais de 60 s nesse caso são renderizados em segmentos.
- **Excluir perfil de voz:** só procura os takes gerados nos projetos que estão nos Recentes.
- **Remotion:** a licença é gratuita para pessoas físicas e empresas de até 3 funcionários.
- **FFmpeg:** vem do sistema; um FFmpeg redistribuído precisaria ser uma build LGPL.
- **VM:** a instalação limpa foi testada num HOME isolado, sem npm, e não numa VM com outra distribuição.
