# Instagram: login OAuth no Content Lab local

O Content Lab não precisa ser hospedado. A Meta exige uma URL de retorno HTTPS para o Instagram Login; a integração depende de um aplicativo cadastrado na Meta e de uma conta Instagram profissional (Criador ou Empresa).

## Preparação única na Meta

1. Acesse https://developers.facebook.com/apps/ e crie ou abra seu aplicativo.
2. Configure **Instagram API with Instagram Login**. Solicite `instagram_business_basic`, `instagram_business_content_publish` e `instagram_business_manage_insights` (algumas permissões exigem revisão para contas externas).
3. Tenha uma URL pública HTTPS controlada por você que aponte **somente para a ponte local** abaixo. Um túnel com domínio estável simplifica esse retorno.
4. Registre no painel da Meta a URL completa, por exemplo: `https://seu-dominio.example/api/social/oauth/instagram/callback`. Copie essa mesma URL para **Configurações → Configuração avançada → Instagram → Retorno HTTPS** no Content Lab.
5. Cadastre uma vez o App ID e o App Secret do **aplicativo Meta**, nunca a senha do Instagram. Depois, use **Conectar Instagram** para entrar pelo site oficial.

## Ponte local isolada (sem publicar o Content Lab inteiro)

Com o Content Lab rodando normalmente em `http://127.0.0.1:5000`:

Em outro terminal, execute:

```bash
node server/instagram-bridge.mjs
```

O processo abre uma ponte HTTP **somente em `127.0.0.1:5151`**. A ponte aceita exclusivamente `GET /api/social/oauth/instagram/callback`, valida a presença de `state` e `code` ou `error`, e devolve ao navegador um redirecionamento local para a porta do Content Lab. Ela **não** expõe edição, publicação, arquivos, credenciais ou outros endpoints do aplicativo.

Exponha exclusivamente a porta **5151**, usando um túnel HTTPS de sua confiança, por exemplo:

```bash
ngrok http 5151
```

A URL HTTPS do túnel precisa incluir `/api/social/oauth/instagram/callback` e **ser a mesma** cadastrada na Meta e no Content Lab. Use preferencialmente um domínio estável; URLs aleatórias que mudam após cada reinício precisam ser atualizadas nas duas configurações. O processo da ponte deve continuar rodando enquanto você conecta a conta.

Depois de conectado, a ponte e o túnel podem ser encerrados: as consultas e publicações utilizam as APIs oficiais diretamente, e o Content Lab renova a sessão pelo backend local. Para autorizar novamente quando a sessão for revogada, reinicie a ponte e o túnel com a URL cadastrada.

### Limites e segurança

- **Não direcione o túnel para a porta 5000.** Isso exporia a API local do Content Lab, inclusive funcionalidades de projetos, a terceiros. A ponte dedicada só permite o callback.
- Provedores de túneis HTTPS podem observar os parâmetros do callback OAuth. Escolha um serviço confiável ou use um proxy HTTPS próprio. O `state` de uso único, a expiração e a troca do código mediante credenciais do aplicativo reduzem o risco, mas não eliminam a necessidade de confiar no encaminhamento.
- Não compartilhe o `.env`, credenciais do aplicativo nem os arquivos de sessão.
- Esta ponte **não substitui** o registro do aplicativo na Meta nem concede permissões de publicação automaticamente. O portal deve liberar a conta e os escopos necessários.
- Nenhum login com conta real foi realizado durante os testes automatizados do Content Lab. O fluxo deve ser validado com sua própria conta profissional antes de publicar vídeos.

## Documentação

- Meta for Developers: https://developers.facebook.com/apps/
- Instagram API with Instagram Login: https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
- Introdução ao ngrok: https://ngrok.com/docs/using-ngrok-with/local-https
