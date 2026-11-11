# Narração, voz e áudio

Cada gravação é um take WAV independente, associado a um trecho do roteiro. Takes podem ser cortados, removidos, regravados, reordenados e montados sem alterar os originais. O tratamento local usa redução de ruído opcional, high-pass, compressão leve e normalização EBU R128; o alvo padrão é -16 LUFS e o pico verdadeiro -1,5 dB.

## Perfil e consentimento

Um perfil de voz guarda nome, amostra, texto efetivamente lido, titular e data do consentimento. Geração é bloqueada sem esses campos. Recomenda-se amostra limpa de 10–30 segundos, uma única pessoa, sem música/reverberação e com fala natural em português brasileiro. O perfil e a saída permanecem locais.

## Modelo escolhido

`Chatterbox Multilingual V3 PT-BR` é a única integração. A variante dedicada ao português brasileiro, clonagem por referência, watermark e licença MIT pesaram a favor; XTTS-v2 foi descartado por licença não comercial. A escolha tem risco registrado: o upstream Chatterbox foi arquivado em agosto de 2026, então dependências serão fixadas e a inicialização não fingirá suporte se o runtime não passar no diagnóstico.

O assistente de dependências instala `chatterbox-tts` 0.1.7 (wheel SHA-256 `83782500…4eb113c`) num ambiente Python isolado, baixa os pesos na revisão fixada `5bb1f6ee58e5` (o pacote usaria `main`, que muda) e cria o comando `contentlab-chatterbox` (`tools/chatterbox/contentlab_chatterbox.py`), que carrega os pesos com `from_local`, usa `language_id="pt"` e mantém a marca d'água Perth. Sem instalação, a geração de voz fica bloqueada na etapa Narração com atalho para instalar. A validação auditiva final exige corpus PT-BR autorizado e comparação cega no hardware do usuário antes de declarar qualidade de produção.
