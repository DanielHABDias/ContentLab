# Checklist de interface

Resumo do que vale para o Content Lab, tirado das [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) da Vercel. É a fonte da skill `web-design-guidelines` em [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills). Nada foi instalado: use esta lista ao revisar `src/ui/`.

## Acessibilidade e teclado

- Botão só com ícone precisa de `aria-label`, e ícone decorativo leva `aria-hidden`.
- Todo campo tem `<label>`. Rádio e checkbox ficam dentro do label, que funciona como uma área de clique só.
- Diálogo usa `role="dialog"`, `aria-modal` e `useDialogFocus` (`Dialogs.jsx`), que prende o foco, fecha com Esc e devolve o foco a quem abriu.
- Abas usam `role="tab"`, `aria-selected`, `aria-controls` e um `tabpanel`, e as setas trocam de aba.
- O foco aparece com `:focus-visible`. Nunca tire o `outline` sem pôr outro destaque no lugar.
- Aviso assíncrono vai em `aria-live="polite"` e erro em `role="alert"`.

## Formulários e feedback

- O botão de enviar fica habilitado até a requisição começar. Durante o envio, o rótulo termina com “…” (“Criando…”).
- O erro aparece no próprio formulário, diz o que fazer e põe o foco no campo com problema.
- O placeholder mostra um exemplo e termina com “…”.
- Um estado vazio explica o que falta e oferece a ação seguinte.
- Pendência não é erro: “falta preencher” usa `notice info`, e `notice error` fica só para falhas.

## Texto

- Frases curtas, na segunda pessoa e com verbo de ação. O botão diz o que faz (“Criar projeto”, “Preencher agora”).
- Concorde o número com a palavra (“1 evento”, “2 eventos”).
- Nome de som, pose ou cena leva `translate="no"`.

## Layout

- Teste em 16:9 (desktop) e com 375 px de largura: não pode haver rolagem horizontal.
- Imagens têm `width`/`height` e `loading="lazy"` abaixo da dobra.
- Respeite `prefers-reduced-motion` e nunca use `transition: all`.
