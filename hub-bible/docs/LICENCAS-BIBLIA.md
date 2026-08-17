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
| `pt_blivre` | Bíblia Livre (2018) | Português | Domínio público | [damarals/biblias](https://github.com/damarals/biblias) — marcada com † (domínio público) |
| `pt_tb` | Tradução Brasileira (1917) | Português | Domínio público | [damarals/biblias](https://github.com/damarals/biblias) — marcada com † (domínio público) |
| `pt_alm1911` | Almeida 1911 | Português | Domínio público | [damarals/biblias](https://github.com/damarals/biblias) — marcada com † (domínio público) |
| `en_kjv` | King James Version (1611/1769) | Inglês | Domínio público | [bibleapi/bibleapi-bibles-json](https://github.com/bibleapi/bibleapi-bibles-json) — `kjv.json` |

Todas são reconstruíveis a partir da fonte com `npm run bible:build`.

### Observações de procedência

- **Almeida 1911** e **Tradução Brasileira (1917)** são anteriores a 1930: estão em domínio
  público por decurso de prazo. A *Tradução Brasileira* teve reedição da SBB em 2010; o texto
  distribuído aqui é o histórico, marcado como domínio público pela fonte. Se você pretende
  uso comercial, vale confirmar diretamente com a SBB se a edição de 2010 traz material editorial
  sob direitos.
- **Bíblia Livre** foi produzida justamente para ser livre, com dedicação ao domínio público.
- **Almeida (`pt_almeida`)** vem do catálogo open-bibles, que a lista como *Public Domain*.
  É a revisão Almeida do início do século XX. Há datasets de terceiros que rotulam texto
  semelhante como "Almeida Revisada Imprensa Bíblica" com direitos reservados — por isso a
  procedência adotada aqui é a do open-bibles/eBible, que declara domínio público.

## Traduções registradas, porém **não** distribuídas

Estas aparecem no catálogo do app como "espaço reservado", com cadeado, e só ficam
disponíveis quando o próprio usuário instala uma cópia que já tenha licença para usar
(Configurações › Traduções › Importar):

| ID | Tradução | Detentor dos direitos |
|---|---|---|
| `pt_acf` | Almeida Corrigida Fiel (1994) | Sociedade Bíblica Trinitariana do Brasil |
| `pt_ara` | Almeida Revista e Atualizada (1993) | Sociedade Bíblica do Brasil |
| `pt_arc` | Almeida Revista e Corrigida (1995) | Sociedade Bíblica do Brasil |
| `pt_as21` | Almeida Século 21 (2009) | Editora Vida Nova |
| `pt_jfaa` | Almeida Atualizada | edição atualizada de Almeida |
| `pt_kja` | King James Atualizada (1999) | Abba Press / BV Books |
| `pt_kjf` | King James Fiel | BV Books |
| `pt_naa` | Nova Almeida Atualizada (2017) | Sociedade Bíblica do Brasil |
| `pt_nbv` | Nova Bíblia Viva (2007) | Editora Mundo Cristão |
| `pt_ntlh` | Nova Tradução na Linguagem de Hoje (1988) | Sociedade Bíblica do Brasil |
| `pt_nvi` | Nova Versão Internacional | Biblica / Editora Vida |
| `pt_nvt` | Nova Versão Transformadora (2016) | Editora Mundo Cristão |
| `pt_ol` | O Livro (2000) | Biblica |
| `pt_mens` | A Mensagem (2016) | Editora Vida |
| `pt_vfl` | Versão Fácil de Ler (2017) | Bible League International |

A lista sai de `LICENSED_SLOTS`, em `scripts/build-bible-data.mjs`; `catalog.json`
é gerado a partir dela. Acrescentar um slot é acrescentar **nome, sigla e
editora** — nunca texto.

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
