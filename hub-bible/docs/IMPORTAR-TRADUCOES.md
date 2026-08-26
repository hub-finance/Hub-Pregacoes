# Como instalar uma tradução licenciada

O Hub Bible acompanha cinco traduções livres. Outras **quinze** — ACF, ARA, ARC,
AS21, JFAA, KJA, KJF, NAA, NBV, NTLH, NVI, NVT, O Livro, A Mensagem e VFL — são
protegidas por direitos autorais e **não são distribuídas com o aplicativo**.
Elas estão no catálogo apenas como espaço reservado: nome, sigla e editora. O
texto é do usuário.

Este documento explica como instalar uma dessas traduções a partir de uma cópia
que você tenha o direito de usar.

> **A linha que o projeto segue.** Nenhum texto protegido entra em
> `public/bible/` — o que é publicado é o que qualquer pessoa que instale o app
> recebe, e aí distribuição é distribuição. Já a importação é outra coisa: grava
> no IndexedDB **daquele aparelho** um arquivo que o dono já tem direito de usar,
> e não sai dali. Por isso os quinze espaços ficam abertos para importar, e
> nenhum deles vem preenchido.

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

### Pela leitura (caminho curto)

1. Abra a **Bíblia** e toque na sigla da tradução, no alto.
2. Role a folha até **"Importar do seu arquivo"**.
3. Toque na tradução desejada e escolha o `.json`.
4. Terminada a gravação, a folha fecha **já lendo na tradução importada**.

### Por Configurações

1. Menu → **Configurações** → seção **Traduções**.
2. Toque em **"Importar um arquivo de tradução"** e escolha o `.json`. Se o
   arquivo tiver o nome da sigla (`ARA.json`, `NVI.json`…), o app reconhece
   sozinho a qual das quinze ele pertence.
   Nome desconhecido entra como tradução sua, com o nome do próprio arquivo.
3. Ou, se preferir escolher antes, toque em **Importar** na linha da tradução,
   mais abaixo.
4. Aguarde alguns segundos. Aparece o aviso:
   *"NAA: 66 livros e 31.101 versículos neste aparelho."*

Pronto. A tradução deixa de mostrar o cadeado e passa a funcionar como qualquer
outra:

- aparece no seletor de tradução do leitor (botão **⇄**);
- pode ser usada na **comparação lado a lado**;
- entra na **busca** — verificado: a busca percorre o texto importado normalmente;
- continua disponível **offline**, sem baixar nada de novo;
- **permanece após fechar e reabrir** o aplicativo.

Em *Configurações › Traduções* ela ganha **Substituir arquivo** (para trocar por
uma cópia melhor) e **Remover tradução**. O botão *"Limpar do dispositivo"*, que
as traduções embutidas têm, não aparece nas importadas de propósito: o texto
delas não teria de onde voltar.

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

### Módulo do MyBible (`.SQLite3`)

Escolha o arquivo do módulo como ele está. No Android eles ficam na pasta
`MyBible` da memória interna. É a forma mais comum de circularem as **Bíblias
com números Strong** em português — mas não a única: o JSON também os aceita,
mais abaixo.

O app lê o arquivo por conta própria: `src/core/sqlite/reader.ts` é um leitor de
SQLite somente-leitura escrito para isto (cabeçalho, árvore-B, registros e
páginas de transbordo — sem SQL e sem WebAssembly, que custaria ~1,2 MB no cache
do PWA). `src/core/bible/mybible.ts` entende as tabelas do formato: `info`,
`books`, `verses`.

Da marcação do MyBible, as notas (`<f>`, `<n>`) são descartadas e as demais
etiquetas saem do texto. Os `<S>430</S>` viram etiquetas Strong guardadas **ao
lado** do versículo, com a posição da palavra a que pertencem — o texto continua
texto puro, para a busca e a cópia seguirem funcionando. Módulos que gravam só
o número recebem a letra pelo testamento: `H` no Antigo, `G` no Novo.

Livros fora do cânone de 66 (Tobias, Judite…) são ignorados, e o aviso diz
quais.

A numeração de livros do MyBible vai de dez em dez (10 = Gênesis, 470 = Mateus),
mas há módulos numerados 1..66. A escolha é feita uma vez por arquivo: se quase
todos os números forem os do formato, vale o número; se não, vale o nome que o
próprio módulo declara em `books`. Sem isso, um módulo sequencial leria o
livro 10 como Gênesis — calado e errado.

**Módulos parciais.** Muitos trazem só o Novo Testamento. O aviso da importação
diz a cobertura ("Só o Novo Testamento", "faltam N livros"), a escolha de livro
passa a mostrar apenas o que existe, e trocar para essa tradução enquanto se lê
em Êxodo leva ao primeiro livro dela, com aviso — não a um erro.

> **Para consultar:** toque no versículo e escolha **"No original"**. O léxico
> de Strong acompanha o aplicativo (ver `LICENCAS-BIBLIA.md`), então há o que
> mostrar mesmo sem importar dicionário nenhum.

### JSON

Em um destes três formatos. A conversão está em `normalizeImportedBible()`
(`src/core/bible/repository.ts`).

**Números Strong valem nos três.** Se o texto trouxer a marcação `<S>430</S>`
depois da palavra — a mesma dos módulos do MyBible —, ela é reconhecida na
importação: o texto é gravado limpo e os códigos ficam ao lado, amarrados à
posição da palavra. Nada precisa ser convertido antes, e um arquivo **sem**
marcação nenhuma continua entrando exatamente como sempre entrou.

```json
[{ "abbrev": "gn", "chapters": [[
  "No princípio<S>7225</S> criou<S>1254</S> Deus<S>430</S> os céus<S>8064</S> e a terra<S>776</S>."
]] }]
```

Códigos só com número recebem a letra pelo testamento (`H` no Antigo, `G` no
Novo), como nos módulos. Quem gera o próprio arquivo pode, em vez da marcação,
usar o campo `strongs` do formato nativo — `{ OSIS: capítulo → versículo →
[[posição da palavra, código]] }`; quando ele existe, manda sobre o texto.

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

> A sigla manda quando é reconhecida (`gn`, `Gn`, `Gênesis`, `Genesis`…), e a
> ordem entra como reserva. Assim, um livro faltando no meio da lista não
> desloca todos os seguintes — o que aconteceria se valesse só a posição.

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
