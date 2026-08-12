# Publicação na Vercel

O repositório já vem com [`vercel.json`](../../vercel.json) na raiz. Ele diz à Vercel
como construir o app que está dentro de `hub-bible/` e define o cache correto para PWA.

```jsonc
installCommand   npm --prefix hub-bible ci
buildCommand     npm --prefix hub-bible run build
outputDirectory  hub-bible/dist
```

Não é preciso mexer em nenhuma dessas opções no painel.

---

## Primeira publicação (uma vez só)

1. Acesse **[vercel.com/new](https://vercel.com/new)** e entre com a conta do GitHub.
2. Em *Import Git Repository*, escolha **`hub-finance/Hub-Pregacoes`**.
   Se o repositório não aparecer, clique em *Adjust GitHub App Permissions* e libere o acesso a ele.
3. Na tela de configuração, **não altere nada** — Framework, Build Command, Output Directory e
   Install Command já vêm do `vercel.json`. Deixe o *Root Directory* como está (a raiz do repositório).
4. Clique em **Deploy**. O build leva cerca de 30 segundos.
5. Ao terminar, a Vercel entrega uma URL HTTPS, algo como
   `https://hub-pregacoes.vercel.app`.

> **Importante:** a branch de produção é a branch padrão do repositório.
> Enquanto o app estiver apenas na branch `claude/bible-ministerial-app-50yppx`,
> a Vercel vai gerar uma *Preview URL* para ela (também em HTTPS, também instalável).
> Depois que a branch for mesclada, a URL de produção passa a servir o app.
> Se preferir, em *Settings › Git › Production Branch* você pode apontar a produção
> para essa branch.

---

## Instalar no tablet Android

1. Abra a URL HTTPS no **Chrome** do tablet.
2. Menu (⋮) › **Instalar aplicativo** (ou *Adicionar à tela inicial*).
3. O Hub Bible passa a abrir em tela cheia, com ícone próprio, sem barra do navegador.
4. Dentro do app: **Configurações › Traduções › Baixar para uso offline**.
   A partir daí a Bíblia inteira funciona sem rede.

---

## Atualizações

Todo `git push` para a branch dispara um novo deploy automaticamente.

No aparelho, quando houver versão nova, aparece um aviso **“Nova versão disponível”**
com o botão *Atualizar* — nada é trocado no meio de uma leitura ou de um sermão sem
a sua confirmação. Se você ignorar, a atualização entra na próxima vez que abrir o app.

---

## O que o `vercel.json` resolve

| Recurso | Cache | Por quê |
|---|---|---|
| `sw.js` | sem cache, revalidação obrigatória | senão o navegador seguraria o service worker antigo e o app nunca atualizaria |
| `index.html` | sem cache, revalidação obrigatória | garante que a nova versão seja detectada |
| `assets/*`, `workbox-*` | 1 ano, imutável | os nomes têm hash: mudou o conteúdo, mudou o nome |
| `bible/*` | 7 dias + `stale-while-revalidate` | o texto bíblico não muda; o service worker já guarda cópia local |
| todas as rotas | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` | proteções básicas de cabeçalho |

`github.silent: true` evita que a Vercel comente em cada commit e pull request.

---

## Domínio próprio (opcional)

Em *Settings › Domains*, adicione o domínio e siga as instruções de DNS.
O PWA funciona igual — apenas reinstale a partir do novo endereço, porque o
navegador trata cada domínio como um app separado (favoritos e anotações ficam
vinculados ao endereço em que foram criados).

Antes de trocar de domínio com conteúdo já criado: **Configurações › Exportar meus dados**,
e depois **Restaurar backup** no endereço novo.
