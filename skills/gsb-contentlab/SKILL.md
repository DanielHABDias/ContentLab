---
name: gsb-contentlab
description: Perfil de integração da configuração GSB com o Content Lab, usando as skills especializadas de direção visual, motion, áudio, contrato e revisão sem duplicar as regras gerais.
---

# GSB — Aplicação ao Content Lab

## Papel
Este perfil é a ponte entre instruções específicas do GSB e a gramática geral de edição do Content Lab. Não substitui a configuração anterior de GSB sem inspeção/migração de suas regras reais.

## Ordem de operação
1. Leia as instruções de GSB e materiais aprovados realmente presentes na conversa/projeto.
2. Extraia **somente** as regras verificáveis de conteúdo, voz, visual, duração, formatos e restrições.
3. Acione `skills/contentlab-direcao/SKILL.md`, composição, motion, timeline e revisão conforme necessidade.
4. Decida o nível de intensidade visual por cena, preservando a identidade original do GSB.
5. Use `skills/contentlab-contrato/SKILL.md` para emitir JSON válido sem campos fantasmas.

## Responsabilidades do GSB
- Especificar público, objetivo, referências permitidas e elementos obrigatórios.
- Indicar quando preferir composições contidas, equilibradas ou dinâmicas, e justificar exceções.
- Determinar fontes, paleta, tipografia e linguagem *somente* quando houver regras aprovadas no material original.
- Rever cada saída com os critérios de marca e QA.

## Limites
Não assumir que GSB significa Diazverso. Não transportar características de Nox, quadrinhos, paleta ou voz para o GSB sem evidência explícita. Não inventar regras ausentes. Não migrar nem excluir a skill anterior de GSB sem acesso ao seu texto completo. O sistema de edição continua sendo o mesmo Content Lab, com schema único.
