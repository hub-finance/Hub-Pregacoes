# Como instalar uma tradução licenciada

O Hub Bible acompanha cinco traduções livres. **ARA, NVI, NTLH, KJA, NAA e ACF**
são protegidas por direitos autorais e não são distribuídas com o aplicativo —
elas aparecem no catálogo com um cadeado 🔒.

Este documento explica como instalar uma dessas traduções a partir de uma cópia
que você tenha o direito de usar.

---

## Antes de tudo: de onde vem o arquivo

O aplicativo aceita o arquivo que você indicar. **Quem responde pela origem dele
é você.** O texto fica gravado apenas no seu aparelho — não é enviado a
servidores, não é sincronizado e não é redistribuído a ninguém.

Caminhos legítimos para obter o arquivo:

1. **Pedir autorização à editora.** É mais viável do que parece para uso pessoal
   e ministerial, sem fins comerciais. Há modelos de carta no fim deste
   documento.
2. **Licença de dados.** Algumas sociedades bíblicas licenciam o texto para
   aplicativos, com contrato e, às vezes, taxa.
3. **Cópia que já lhe pertence** em formato aberto, quando a licença do produto
   que você comprou permitir uso pessoal em outro dispositivo.

Baixar um arquivo pirata de uma tradução protegida é violação de direito autoral,
mesmo que o uso seja só seu e mesmo dentro da igreja.

### Sobre `github.com/damarals/biblias` — conferido em 13/08/2026

Coletânea de 18 Bíblias em português, em Zefania XML, SQLite e JSON. É a fonte
mais prática para quem já tem direito de usar uma tradução, porque **o JSON das
releases entra no Hub Bible sem conversão nenhuma** (formato "lista de livros na
ordem canônica", item 2 mais abaixo). Verificado ponta a ponta com o arquivo da
Bíblia Livre: importou e a tradução passou a aparecer disponível.

Sobre a licença, é preciso ler com cuidado, porque as duas coisas coexistem no
mesmo repositório:

| | |
|---|---|
| **A licença MIT do repositório** | cobre o *toolkit* em Python de Daniel Amaral — o código que baixa, valida e converte. |
| **O texto bíblico** | não. O próprio README diz: *"As de domínio público (†) podem ser redistribuídas livremente; **as demais pertencem a suas editoras**."* |

Marcadas com † lá: **Tradução Brasileira, Bíblia Livre e Almeida 1911** — as três
já acompanham o Hub Bible. Todas as outras (ARA, ARC, ACF, NAA, NTLH, NVI, NVT,
KJA, KJF, AS21, NBV, OL, MENS, VFL, JFAA) aparecem na tabela **com o nome da
editora ao lado**, e é essa coluna que manda.

Ou seja: o repositório é ótimo como *formato* e péssimo como *licença* para
distribuição. Serve para você instalar no seu aparelho uma tradução que você já
tem direito de usar; não serve para embutir no aplicativo que é compartilhado
com outras pessoas.

---

## Passo a passo (conferido no aplicativo)

1. Abra o **Hub Bible** no tablet ou no celular.
2. Menu → **Configurações**.
3. Role até a seção **Traduções**.
4. Abaixo das traduções instaladas há o aviso ⚖️ e a lista **"Requer licença"**,
   com ARA, NVI, NTLH, KJA, NAA e ACF.
5. Toque em **Importar** na linha da tradução desejada.
6. O seletor de arquivos do Android abre. Escolha o arquivo `.json`.
7. Aguarde alguns segundos. Aparece o aviso:
   *"ARA: 66 livros e 31.102 versículos importados."*

Pronto. A tradução deixa de mostrar o cadeado e passa a funcionar como qualquer
outra:

- aparece no seletor de tradução do leitor (botão **⇄**);
- pode ser usada na **comparação lado a lado**;
- entra na **busca** — verificado: a busca percorre o texto importado normalmente;
- continua disponível **offline**, sem baixar nada de novo;
- **permanece após fechar e reabrir** o aplicativo.

---

## Trazer de outra instalação do Hub Bible

Se você tem outro aplicativo montado sobre este mesmo projeto, o texto está
servido em `/bible/<traducao>/<LIVRO>.json` — 66 arquivos separados. A tela de
importação espera **um arquivo só**, então há um script que junta tudo:

```bash
# descubra os ids disponíveis abrindo no navegador:
#   https://seu-app.vercel.app/bible/catalog.json

node scripts/preparar-importacao.mjs https://seu-app.vercel.app pt_ara ara.json
```

O resultado é um `ara.json` pronto para escolher em *Configurações › Traduções ›
Importar*. Passe o arquivo para o tablet por Google Drive, e-mail ou cabo.

> **O arquivo gerado é para o seu dispositivo.** Se a tradução tem direitos
> autorais, ele não pode ser publicado, repassado a outras pessoas nem incluído
> no build de um aplicativo que outros instalem. Ter o aplicativo de origem não
> é ter a licença do texto.

## Formatos de arquivo aceitos

O arquivo precisa ser **JSON**, em um destes três formatos. A conversão está em
`normalizeImportedBible()` (`src/core/bible/repository.ts`).

### 1. Formato do Hub Bible

Chaves em código OSIS (`GEN`, `EXO`, … `REV`), cada livro com uma lista de
capítulos, e cada capítulo com a lista de versículos:

```json
{
  "books": {
    "GEN": [["No princípio criou Deus…", "E a terra era sem forma…"]],
    "JHN": [["No princípio era o Verbo…"]]
  }
}
```

### 2. Lista de livros na ordem canônica

*É o formato dos arquivos `.json` de `damarals/biblias` — entra direto, sem
conversão.*

66 itens, de Gênesis a Apocalipse, na ordem. É o formato mais comum em arquivos
públicos:

```json
[
  { "abbrev": "gn", "chapters": [["No princípio criou Deus…"]] },
  { "abbrev": "ex", "chapters": [["Estes são os nomes…"]] }
]
```

> A ordem é o que vale — o campo `abbrev` é ignorado. O 1º item é tratado como
> Gênesis, o 43º como João, o 66º como Apocalipse.

### 3. Tabela de versículos

```json
{
  "resultset": {
    "row": [{ "field": [1001001, 1, 1, 1, "No princípio criou Deus…"] }]
  }
}
```

Os campos são: `id`, `número do livro (1–66)`, `capítulo`, `versículo`, `texto`.

---

## Onde o texto fica guardado

No **IndexedDB** do navegador, banco `hub-bible`, tabela `books`. Em termos
práticos: dentro do aplicativo, no aparelho.

- Não sobe para servidor nenhum.
- Não entra no backup em JSON de *Configurações › Exportar meus dados* — esse
  backup leva só o que **você** criou (favoritos, anotações, sermões, estudos,
  devocionais, planos).
- Se você trocar de aparelho, precisa importar o arquivo de novo.

## Como remover

*Configurações › Traduções* → na tradução importada, **Remover tradução**.
Apaga o texto e o registro dela do aparelho.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| *"O arquivo não é um JSON válido."* | O arquivo está corrompido ou não é JSON. Se for `.xml`, `.sqlite` ou `.zip`, precisa ser convertido antes. |
| *"Formato de arquivo não reconhecido."* | O JSON é válido, mas a estrutura não é nenhuma das três acima. |
| *"Nenhum livro reconhecido no arquivo."* | A lista veio fora da ordem canônica ou com menos livros. |
| Importou, mas faltam livros | O arquivo estava incompleto. O app instala o que encontrar e informa quantos livros entraram. |
| O seletor de arquivos não abre | Dê ao navegador permissão de acesso a arquivos nas configurações do Android. |

---

## Modelo de carta para pedir autorização

Adapte com seus dados e envie pelo canal de contato da editora. Guarde a
resposta — ela é o seu documento de autorização.

### O que pedir — e o que guardar da resposta

Peça três coisas, sempre por escrito:

1. **Autorização de uso** do texto no seu aplicativo, com o alcance descrito
   (só seus dispositivos, ou também os membros da igreja — seja honesto sobre
   qual dos dois).
2. **O texto em formato digital**, ou a indicação de onde obtê-lo legalmente.
3. **A forma exata do crédito** que devem exibir — normalmente uma linha de
   copyright que precisa aparecer junto ao texto.

Guarde a resposta em PDF ou impressa. Ela é o seu documento de autorização.

### Sociedade Bíblica do Brasil — ARA, ARC, NTLH, NAA

> **Assunto:** Solicitação de autorização de uso de texto bíblico para uso pessoal e ministerial
>
> Prezados senhores,
>
> Sou [cargo — pastor, líder, membro] da [nome da igreja], em [cidade/estado].
> Utilizo um aplicativo de leitura e preparo de mensagens instalado apenas nos
> meus próprios dispositivos, sem qualquer distribuição a terceiros e sem
> finalidade comercial.
>
> Venho solicitar autorização para utilizar o texto da [ARA / NTLH / NAA] nesse
> aplicativo de uso pessoal, bem como orientação sobre a forma adequada de obter
> o texto em formato digital e sobre os créditos que devo exibir.
>
> Esclareço que o texto ficará armazenado exclusivamente no meu dispositivo, não
> será publicado, compartilhado, redistribuído nem disponibilizado on-line, e que
> me comprometo a exibir a atribuição de direitos autorais na forma que os
> senhores indicarem.
>
> Coloco-me à disposição para prestar qualquer esclarecimento e agradeço
> antecipadamente a atenção.
>
> Atenciosamente,
> [nome completo] · [igreja] · [telefone] · [e-mail]

### Biblica / Editora Vida — NVI

Mesmo texto, trocando a tradução por **Nova Versão Internacional (NVI)**.

Canal: site oficial da SBB, seção de contato — peça o setor de **direitos
autorais / permissões**.

### BV Books — King James Atualizada (KJA)

Mesmo texto, trocando a tradução. Canal: site oficial da BV Books, contato.

### Mundo Cristão — Nova Versão Transformadora (NVT)

Mesmo texto. Canal: site oficial da Mundo Cristão, contato.

### Biblica / Editora Vida — Nova Versão Internacional (NVI)

Mesmo texto. A Biblica mantém política própria de permissões para uso não
comercial — vale procurar a página de *permissions* antes de escrever.

### Sociedade Bíblica Trinitariana do Brasil — Almeida Corrigida Fiel (ACF)

Mesmo texto, trocando por **Almeida Corrigida Fiel (ACF)**.

---

## Se a autorização vier

Me avise. Com a autorização em mãos, embutir a tradução no aplicativo é um
trabalho de minutos: entra em `scripts/build-bible-data.mjs` como fonte, com os
campos `license`, `licenseUrl` e `publisher` preenchidos com o texto exato que a
editora exigir — eles aparecem no seletor de traduções e em Configurações ›
Sobre. Ver `LICENCAS-BIBLIA.md`.

---

## Enquanto a resposta não vem

O aplicativo já traz **quatro traduções completas em português**, todas livres:

| Sigla | Tradução | Perfil |
|---|---|---|
| **BL** | Bíblia Livre (2018) | grafia atual — a mais próxima de uma leitura moderna |
| **AL** | Almeida (domínio público) | Almeida clássica, grafia atual |
| **TB** | Tradução Brasileira (1917) | erudita; usa "Jeová" para o Nome divino |
| **1911** | Almeida 1911 | grafia da época, valor histórico |

Para pregação e estudo do dia a dia, **Bíblia Livre** na leitura e **Tradução
Brasileira** na comparação cobrem bem o que a NVI e a NAA fariam.
