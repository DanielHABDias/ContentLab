# Narração, voz e áudio

Cada gravação é um take WAV independente, associado a um trecho do roteiro. Takes podem ser cortados, removidos, regravados, reordenados e montados sem alterar os originais. O tratamento local usa redução de ruído opcional, high-pass, compressão leve e normalização EBU R128; o alvo padrão é -16 LUFS e o pico verdadeiro -1,5 dB.

## Perfil e consentimento

Um perfil de voz guarda nome, amostra, texto efetivamente lido, titular e data do consentimento. Geração é bloqueada sem esses campos. Recomenda-se amostra limpa de 10–30 segundos, uma única pessoa, sem música/reverberação e com fala natural em português brasileiro. O perfil e a saída permanecem locais.

## Modelo escolhido

`Chatterbox Multilingual V3 PT-BR` é a única integração. A variante dedicada ao português brasileiro, clonagem por referência, watermark e licença MIT pesaram a favor; XTTS-v2 foi descartado por licença não comercial. A escolha tem risco registrado: o upstream Chatterbox foi arquivado em agosto de 2026, então dependências serão fixadas e a inicialização não fingirá suporte se o runtime não passar no diagnóstico.

Esta máquina não possui o runtime/pesos; a aplicação retorna essa pendência de modo explícito. A validação auditiva final exige corpus PT-BR autorizado e comparação cega no hardware do usuário antes de declarar qualidade de produção.
