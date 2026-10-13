---
name: contentlab-revisao
description: Faz controle de qualidade visual e sonoro em planos e renders do Content Lab por checkpoints, detectando clipping, timing, inconsistências e problemas de continuidade.
---

# Content Lab — Revisão e qualidade

## Meta
Medir se o vídeo informa, se move com naturalidade e respeita a narrativa. **Mais efeitos não significa melhor edição.**

## Inspeção pré-render
- Cena comunica uma ideia identificável? Foco claro em cada momento?
- Há tempo real para ler depois que os elementos aparecem?
- Entradas e saídas justificadas, sem padrões repetitivos desnecessários?
- Tipografia legível em escala de celular, sem clipping ou quebras ruins?
- Assets existem e `contain`/`cover` não causam recortes acidentais?
- IDs, relógios e config compatíveis com o schema/renderer?

## Checkpoints visuais
Inspecione início de cena, primeiro estado legível, pico de movimento, hold, saída, frame anterior e posterior a transições e frames próximos a eventos sonoros. Use contact sheet quando útil. Detecte:
- elementos cortados, caixas excedendo safe area, transparência inesperada;
- colisão entre textos, perda de foco ou movimentos concorrentes;
- curvas com aceleração/desaceleração artificial, jitter e salto entre frames;
- continuidade quebrada de objeto/painel entre cenas;
- frames vazios/pretos inesperados e sobreposição de cenas;
- diferenças negativas entre versão 9:16 e 16:9.

## Áudio
Ouça o arquivo final: voz inteligível, SFX realmente audível no `at`, música sem cortes ou picos, eventos sincronizados à palavra relevante e pausas intencionais preservadas. Não inferir correção sonora só porque o JSON valida.

## Critérios para comparação A/B
Use conteúdo e narração iguais quando comparar uma edição antiga e uma nova. Avalie 1) compreensão; 2) hierarquia; 3) naturalidade do movimento; 4) timing; 5) continuidade; 6) respeito ao perfil de marca. A melhor versão pode conter menos efeitos.

## Limites de afirmação
Distinguir claramente: **validado no schema**, **teste automatizado passou**, **inspecionado em frames** e **MP4+áudio revisados**. Nenhuma dessas etapas substitui automaticamente as outras.
Os testes gerais do repo incluem `node --test server/*.test.mjs`, `node server/smoke.mjs`, `npm run docs:check` e verificação manual de projetos reais no Linux/Windows. Não afirmar execução se não ocorreu.

## Entrega
Registrar achados específicos por tempo/cena, gravidade, causa provável e recomendação; só elevar hipótese estética a padrão permanente após observação repetida.
