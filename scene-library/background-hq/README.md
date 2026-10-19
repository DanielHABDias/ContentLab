# Background HQ

TSX independente que mostra **somente o fundo**, sem título, caixas, imagens, legendas ou sons. Funciona em 16:9 e 9:16. Novo padrão solicitado em 16/10/2026; aguarda aprovação visual.

## Estilos e parâmetros

| Campo | Valores / padrão |
| --- | --- |
| `backgroundStyle` | `halftone` (padrão), `solid`, `stars`, `film`, `paper`, `grid`. |
| `backgroundColor` | #RRGGBB; padrão #2459C9; usado em `halftone` e `solid`. |
| `backgroundOpacity` | Percentual **0–100**, padrão 100. 0 = totalmente transparente; 50 = metade; 80 = 80%. Não é escala 0–1. |
| `paperTone` | `light` (padrão) ou `dark`, só para `paper`. |
| `gridBackgroundColor` | #RRGGBB, padrão #10101A; só para `grid`. |
| `gridLineColor` | #RRGGBB, padrão #858595; só para `grid`. |

- **Halftone:** cor sólida com pontos HQ discretos; sem movimento.
- **Solid:** somente a cor escolhida, sem retícula nem textura; sem movimento.
- **Stars:** pontos/bolas claros sobre preto azulado, movimento radial fixo.
- **Film:** filme escuro com riscos, poeira e leve oscilação de exposição; movimento fixo, sem áudio.
- **Paper:** oito poses de dobras HQ, trocadas seis vezes por segundo, sem interpolação. Lembra fotografias sucessivas de papel amassado, não uma textura sendo arrastada. O ciclo dura 8/6 segundo. Claro ou escuro. É uma releitura gráfica, não cópia fotográfica do vídeo de referência.
- **Grid:** linhas retangulares movem-se continuamente **da esquerda para a direita**, a 28 unidades por segundo em um plano de altura 1000; repetição de 84 unidades, equivalente a três segundos. Não oscila nem volta para a esquerda. A repetição geométrica cobre a borda sem salto visível.

Não existem controles de velocidade, densidade, animação ou cor próprios de estrelas/filme. As cores do papel são definidas por paperTone. Cada animação usa o frame e FPS da composição, não o relógio do navegador. A duração total é `end - start` da cena: os fundos continuam pelo tempo necessário.

## Instalação, camadas e transparência

Copie `BackgroundHQ.tsx` para `custom-scenes/` do projeto e adapte `exemplo-cena.json`. Não exige fontes ou vídeos. Copie também HQComicPage.tsx da mesma pasta; ele inclui a imagem da página transparente.

Use **mode overlay** para manter a cena/vídeo comum abaixo. O background é desenhado acima dessa cena; em 100% ele a cobre, em 50% mistura, em 0% não a altera. Se usar `replace`, a cena comum não será desenhada: reduzir a opacidade não recupera uma camada que foi removida. O exemplo usa cor azul na base apenas como demonstração; para ver um clipe, mantenha/configure esse clipe na cena base real do Content Lab.

Nos oito componentes de conteúdo com fundos selecionáveis, backgroundOpacity controla **apenas a camada do fundo**, sem apagar textos, imagens, cartões ou suas próprias animações. Essa opção não combina múltiplos módulos automaticamente. Quando for preciso manter uma cena comum por trás desses TSX, use também o modo overlay.

## Exemplos de props

```json
{"backgroundStyle":"solid","backgroundColor":"#A61C35","backgroundOpacity":80}
```
```json
{"backgroundStyle":"paper","paperTone":"dark","backgroundOpacity":50}
```
```json
{"backgroundStyle":"grid","gridBackgroundColor":"#10101A","gridLineColor":"#75A3E8","backgroundOpacity":100}
```

Prévias 16:9 e 9:16 em PNG mostram o grid. Há imagens adicionais por estilo e de transparência. PNG é referência estática; a prévia local de Remotion permite conferir o movimento. Não há som incorporado ou som obrigatório, nem render final de vídeo.


## Consulta e exemplos disponíveis

Voltar ao catálogo e à instalação. Este guia descreve o contrato atual; não é necessário aplicar atualizações antigas em sequência.

- exemplo-cena.json

Os JSONs são **cenas para inserir em `timeline`**, não planos completos. Preserve as configurações globais do projeto e adapte `id`, `start`, `end`, caminhos e SFX absolutos. Arquivos `project://` são relativos à raiz do projeto de edição, não à pasta desta biblioteca. Imagens/clipes/fontes precisam existir no destino; exemplos não baixam assets nem transcrição. A orientação vem da resolução do projeto, sem prop `aspectRatio`. Nenhum TSX toca sons automaticamente. PNGs documentam um instante, não o movimento ou a mixagem; prévias antigas não certificam todas as opções atuais.


## Contrato TypeScript completo

Props são JSON; assets fica em customComponent.assets, nunca dentro de props. Tempos são relativos à cena, exceto SFX no plano.

```ts
type HQBackgroundOptions = {
  backgroundStyle?: 'halftone' | 'solid' | 'stars' | 'film' | 'paper' | 'grid';
  backgroundColor?: string;
  backgroundOpacity?: number;
  paperTone?: 'light' | 'dark';
  gridBackgroundColor?: string;
  gridLineColor?: string;
};
```

## Instalação oficial

Na Documentação, selecione este padrão e prepare-o na pasta do projeto. A instalação copia o TSX sem sobrescrever versões existentes. O JSON aponta project://custom-scenes/BackgroundHQ.tsx. Consulte os exemplos abaixo e substitua mídias/tempos antes de renderizar.

- [exemplo-cena.json](exemplo-cena.json)

## Página HQ transparente — fundo adicional

Use `backgroundStyle: "comic_page"` e `backgroundOpacity: 0–100` (100 por padrão). Usa exatamente o PNG bannerSemFundo_3, com divisórias e transparência. Não pinta cor atrás: use `mode: "overlay"` para manter a cena base. A opacidade afeta só a arte; a opacidade global do componente continua valendo.

16:9 e 9:16 sem deformar, com `cover` central (recorta laterais no vertical). As divisórias são decoração, não slots automáticos. O visual anterior permanece quando a opção não é escolhida.

**Instalação:** a Galeria prepara o TSX e `HQComicPage.tsx` em `custom-scenes/`. Manualmente, copie ambos da mesma pasta. Todos os presets compartilham uma cópia idêntica do auxiliar no projeto; preserve cópias diferentes. O PNG já está embutido, sem asset extra nem rede. Exemplo de props adicionais: `{"backgroundStyle":"comic_page","backgroundOpacity":70}`. Preserve as demais props/assets obrigatórias do guia.

Exemplo adicional: `exemplo-pagina-hq.json`. Prévias sobre amarelo para evidenciar a transparência: `previa-pagina-hq-16x9.png` e `previa-pagina-hq-9x16.png`. O amarelo pertence à cena base, não ao PNG.
