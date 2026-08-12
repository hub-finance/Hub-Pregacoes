# Pendências — retomar daqui

Estado em **12/08/2026**. Tudo o que está descrito abaixo foi levantado e
verificado; nada aqui é suposição. O que já foi entregue está no `README.md`.

---

## 1. Títulos de perícope

Os subtítulos que aparecem no meio do texto em leitores como o Olive Tree —
por exemplo *"A criação dos céus e da terra e de tudo o que neles há"* antes de
Gênesis 1.

**Situação:** os arquivos que temos **não trazem** esses títulos.

O `por-almeida.usfx.xml` (fonte da tradução `pt_almeida`) contém apenas cinco
tipos de marcação — conferido com contagem de tags:

| Tag | Ocorrências |
|---|---|
| `<book>` | 66 |
| `<h>` (nome do livro) | 66 |
| `<c>` (capítulo) | 1.189 |
| `<v>` / `<ve>` (versículo) | 31.098 |

Não há `<s>`, que é a tag USFX de título de seção. As outras três traduções
(`pt_blivre`, `pt_tb`, `pt_alm1911`) vêm em JSON de array canônico, que também
não carrega títulos.

**O que fazer:** procurar uma fonte livre com `<s>` preservado. Candidatos a
investigar no eBible.org/USFX ou em módulos Zefania XML — o Zefania tem
`<CAPTION>` para títulos de seção, e `damarals/biblias` publica em Zefania.
Vale baixar o `BLIVRE.xml` (Zefania) e conferir se traz `<CAPTION>`; se trouxer,
é a via mais curta, porque a Bíblia Livre já é domínio público e já está no app.

**Impacto no código:** o payload de livro ganharia um campo opcional
`headings: Array<{ chapter, verse, text }>`, gerado por
`scripts/build-bible-data.mjs` e renderizado em `BiblePage` antes do versículo
correspondente. Não quebra as traduções que não tiverem títulos.

---

## 2. Palavras com números de Strong

As palavras coloridas do print de referência: cada uma ligada ao dicionário
hebraico/grego (Strong). Aparecem na *Bíblia Almeida Strong*.

**Situação:** precisa de um texto com marcação palavra a palavra. Nenhuma das
cinco traduções embutidas tem isso.

**O que fazer:** localizar um Almeida com Strong em domínio público e conferir a
licença antes de qualquer coisa (ver `LICENCAS-BIBLIA.md`). Além do texto,
seria preciso o dicionário Strong em português.

**Impacto no código — o ponto mais importante desta lista.** Hoje um versículo
é uma `string` simples:

```ts
CachedBook.chapters: string[][]   // capítulo -> versículo -> texto
```

Strong exige nível de palavra. A abordagem que **não** quebra o que já existe:
manter `chapters` como está (é o que alimenta busca, compartilhamento e Modo
Pregação) e acrescentar uma estrutura paralela opcional:

```ts
tokens?: Array<Array<Array<{ t: string; s?: string }>>>  // t = texto, s = Strong
```

Quem tiver `tokens` renderiza palavras clicáveis; quem não tiver segue com a
`string`. Sem `tokens`, nada muda. Arquivos a tocar: `core/db/types.ts`,
`core/bible/repository.ts`, `features/bible/BiblePage.tsx` e o ETL.

Atenção ao tamanho: com marcação por palavra o arquivo cresce muito — provavelmente
vale servir a versão com Strong como tradução separada, e não substituir a atual.

---

## 3. Notas de rodapé

Os marcadores † do texto de referência.

**Situação:** mesma de 1 e 2 — a fonte atual não traz. Em USFX viriam em `<f>`.
Se a fonte encontrada para os títulos de perícope também trouxer notas, os dois
itens saem juntos.

---

## 4. Ensinar a importar as traduções com direitos autorais

**Pendência de explicação, não de código.** O recurso está pronto e funcionando:
*Configurações › Traduções › Importar*. Ver `TranslationManager.tsx` e
`normalizeImportedBible()` em `core/bible/repository.ts`.

Traduções já registradas como espaço reservado: **ARA, NVI, NTLH, KJA, NAA, ACF**.

Falta entregar ao usuário:

1. Passo a passo com prints da importação no tablet.
2. Os três formatos de JSON aceitos, com exemplo de cada.
3. **Modelo de carta** pedindo autorização de uso à Sociedade Bíblica do Brasil
   (ARA, NTLH, NAA), à Biblica/Editora Vida (NVI) e à BV Books (KJA), para uso
   pessoal e ministerial, não comercial.

**Limite a deixar claro na conversa:** o app aceita o arquivo, mas quem responde
pela origem dele é o usuário. O caminho correto é uma cópia licenciada ou
autorização da editora. O texto importado fica apenas no dispositivo, em
IndexedDB — não é distribuído nem sincronizado.

---

## 5. Continuar os testes no tablet

Já verificado em navegador headless a 390px, 1024px e 2000px. Falta o uso real:

- [ ] Largura de leitura ficou boa em paisagem? (padrão novo: 58rem; preset
      "Cheia" = 76rem)
- [ ] Cronômetro legível de relance à distância do púlpito
- [ ] Modo Pregação com um sermão real, do início ao apelo
- [ ] Instalação na tela inicial e funcionamento em modo avião
- [ ] Baixar todas as traduções para uso offline e conferir o espaço ocupado

---

## Fontes já investigadas

Para não repetir trabalho:

| Fonte | Conteúdo | Serve? |
|---|---|---|
| `seven1m/open-bibles` | `por-almeida.usfx.xml`, domínio público | ✅ em uso — mas sem títulos/notas/Strong |
| `damarals/biblias` | 18 Bíblias em português; 3 marcadas † domínio público | ✅ em uso (BLIVRE, TB, ALM1911) — verificar os XML Zefania para títulos |
| `bibleapi/bibleapi-bibles-json` | KJV e outras | ✅ em uso (KJV) |
| `thiagobodruk/biblia` | NVI, ACF, AA | ❌ direitos reservados às editoras — não usar |
| `ebible.org` | catálogo amplo | ⚠️ inacessível pela rede do ambiente de trabalho; usar espelhos no GitHub |
