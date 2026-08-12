# Licenciamento do texto bíblico

> Esta é a regra mais importante do projeto. Leia antes de adicionar qualquer tradução.

## Princípio

**Nenhuma tradução protegida por direitos autorais é distribuída com o aplicativo.**

O Hub Bible foi construído com uma arquitetura de múltiplas traduções (`core/bible/repository.ts`),
mas o repositório só contém textos cujo uso e redistribuição são comprovadamente livres.

## Traduções que acompanham o aplicativo

| ID | Tradução | Idioma | Situação | Fonte |
|---|---|---|---|---|
| `pt_almeida` | Almeida (revisão em domínio público) | Português | Domínio público | [seven1m/open-bibles](https://github.com/seven1m/open-bibles) — `por-almeida.usfx.xml`, listada como *Public Domain* |
| `en_kjv` | King James Version (1611/1769) | Inglês | Domínio público | [bibleapi/bibleapi-bibles-json](https://github.com/bibleapi/bibleapi-bibles-json) — `kjv.json` |

Ambas são reconstruíveis a partir da fonte com `npm run bible:build`.

## Traduções registradas, porém **não** distribuídas

Estas aparecem no catálogo do app como "espaço reservado", com cadeado, e só ficam
disponíveis quando o próprio usuário instala uma cópia que já tenha licença para usar
(Configurações › Traduções › Importar):

| ID | Tradução | Detentor dos direitos |
|---|---|---|
| `pt_ara` | Almeida Revista e Atualizada | Sociedade Bíblica do Brasil |
| `pt_nvi` | Nova Versão Internacional | Biblica / Editora Vida |
| `pt_ntlh` | Nova Tradução na Linguagem de Hoje | Sociedade Bíblica do Brasil |
| `pt_kja` | King James Atualizada | Abba Press / BV Books |
| `pt_acf` | Almeida Corrigida Fiel | Sociedade Bíblica Trinitariana do Brasil |

O texto importado fica **somente no dispositivo do usuário** (IndexedDB). Ele não é
enviado a servidores nem embutido no build.

## Antes de incluir uma nova tradução no repositório

Confirme, por escrito, junto ao detentor dos direitos:

1. Direitos autorais e titularidade;
2. Licença de uso;
3. Permissão para **distribuição**;
4. Permissão para uso **em aplicativo**;
5. Condições de **atribuição** exigidas (texto exato do crédito).

Só então adicione a fonte em `scripts/build-bible-data.mjs` (lista `SOURCES`), com os
campos `license`, `licenseUrl` e `publisher` preenchidos — eles são exibidos ao usuário
em Configurações › Sobre e no seletor de traduções.

## Como o usuário instala uma tradução licenciada

`Configurações › Traduções › Importar`, com um arquivo JSON em um destes formatos:

```jsonc
// 1) Formato nativo do Hub Bible
{ "books": { "GEN": [["No princípio…", "…"]], "JHN": [["…"]] } }

// 2) Lista de livros na ordem canônica (66 itens)
[ { "abbrev": "gn", "chapters": [["No princípio…"]] } ]

// 3) Tabela de versículos
{ "resultset": { "row": [ { "field": [1001001, 1, 1, 1, "texto"] } ] } }
```

A conversão está em `normalizeImportedBible()` (`core/bible/repository.ts`).
