# Correções: cache, sincronização, SFX e transições

**Arquitetura:** Node.js + Remotion + FFmpeg. **Schema único:** `schemas/edit_plan.schema.json`.

## 1. Cache visual mais seletivo

`server/cache.mjs` passa a identificar o renderer por hash do conteúdo dos arquivos visuais e das fontes, usando caminhos relativos. Mudanças de mtime após `git pull`, de servidor HTTP ou do motor de áudio não devem invalidar todos os clipes.

O fingerprint das cenas visuais desconsidera `sfx`, configurações apenas de áudio, `transitionOut` e `transitionDuration`. Uma cena deslocada integralmente, com todos os seus elementos, mantém a mesma identidade visual. **Arquivos de mídia de entrada ainda são identificados por caminho, tamanho e mtime**, evitando ler vídeos inteiros para cada checagem. Isso pode invalidar uma cena se o arquivo de mídia for tocado ou movido.

**Migração:** a primeira renderização com essa nova estratégia poderá atualizar a assinatura e recriar os clipes existentes; as seguintes devem aproveitar melhor o cache.

## 2. Sincronização de cenas e narração

O editor dispõe de operações com histórico de desfazer/refazer e edição de cenas:

- **Inserir após / Duplicar:** desloca as cenas posteriores, suas camadas e os `at` dos SFX nelas. Também desloca intervalos globais de música.
- **Narração:** em vez de manter a voz no tempo anterior após a inserção, acrescenta `audio.silenceInserts` com a nova pausa e preserva a fala que já existia. A pausa é silenciosa **somente na narração**: música de fundo pode continuar.
- **Transcrição:** as palavras são remapeadas após `sourceCuts` e os intervalos de silêncio adicionados, mantendo legendas posteriores alinhadas.
- **Mover uma cena manualmente:** move suas próprias camadas/SFX, mas **não** cria automaticamente pausas na narração. Nesse caso o usuário está escolhendo um novo momento visual e a ferramenta não deve alterar a voz sem intenção.
- **Excluir uma cena:** mantém uma lacuna; não corta narração existente silenciosamente.

### Exemplo

```json
{
  "audio": {
    "narration": "audio/narration.wav",
    "silenceInserts": [
      {"at": 12.5, "duration": 5}
    ]
  }
}
```

`at` indica a posição na **timeline resultante** e `duration` é em segundos. Não inserir pausas sobrepostas. As pausas são aplicadas **depois** de `sourceCuts`.

A inserção cria um trecho visual adicional **sem voz nova**. Para narrá-lo, a gravação deverá ser atualizada posteriormente. Esse modelo evita que a voz posterior perca sincronização.

## 3. Remoção automática de silêncio dos efeitos sonoros

Ao montar o vídeo final, para cada arquivo **SFX**, o pipeline executa `ffprobe` e `ffmpeg silencedetect` para identificar silêncio contínuo no início e no fim. Configuração padrão:

- limiar aproximado **-50 dBFS**;
- silêncio mínimo detectável **40 ms**;
- proteção de **8 ms** de borda para preservar transientes;
- análise reutilizada quando o mesmo arquivo aparece várias vezes no render;
- caso inteiramente silencioso: o efeito não é incluído na mixagem.

O filtro `atrim` remove apenas as bordas, preservando **todos os silêncios internos**. Depois normaliza/ajusta o volume e atrasa o efeito até `at`. O tempo de inserção do efeito representa seu **início audível**, não o começo vazio do arquivo recebido. O trim não altera o arquivo original no projeto; modifica apenas a reprodução no resultado final.

Se o material tiver ruído acima de -50 dBFS na borda, esse ruído poderá impedir a detecção; isso é preferível a destruir propositalmente caudas baixas de reverberação. Música e narração **não** recebem remoção automática de silêncio nas bordas nesta etapa.

## 4. Transições com movimento e duração constante

As transições agora usam o **vídeo real dos primeiros frames da cena que entra**, e não uma única imagem estática dela. Para preservar os tempos absolutos do JSON, a transição é renderizada no início da cena de entrada: o último frame da cena anterior é mantido brevemente, enquanto o vídeo novo avança. O corpo da cena de entrada começa imediatamente após os frames que já apareceram na transição, sem repeti-los.

Assim, a duração total e os tempos de voz/SFX mantêm a mesma referência. Um crossfade com **as duas cenas em movimento simultaneamente** exigiria outra política de sobreposição e edição dos intervalos e não é o comportamento deste contrato.

As peças de composição continuam armazenadas em `output/final/pieces`; a assinatura do compositor mudou para invalidar as transições antigas uma vez.

## 5. Melhorias associadas

- `fit` padrão de vídeos/imagens agora é `contain`; `cover` ou `smart_cover` precisam ser escolhidos explicitamente, evitando cortes indesejados.
- A validação exibe **avisos**, sem bloquear o render, quando duas camadas de texto compartilham região e tempo de forma significativa. Composições intencionais ainda podem ser renderizadas.
- O editor visual ganhou **Desfazer** e **Refazer** (histórico de rascunhos visuais, até 80 estados). Edição manual do JSON reinicia esse histórico.

## Testes

```bash
node --test server/*.test.mjs
node server/smoke-audio-sync.mjs
node server/smoke-transitions.mjs
node server/smoke-ui.mjs
```

Os testes combinam verificação unitária de assinaturas/intervalos, síntese de arquivos reais com FFmpeg, renderização real de transições e interação com o navegador. O VD_0005 completo permanece fora dos testes, conforme solicitado.

## Próxima etapa

Com o pipeline temporal mais previsível, será possível avaliar o JSON de autoria da IA e uma biblioteca de templates/presets de cena. Essa refatoração não faz parte desta correção.
