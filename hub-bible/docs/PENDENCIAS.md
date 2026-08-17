# Pendências — retomar daqui

Estado em **12/08/2026**. Tudo o que está descrito abaixo foi levantado e
verificado; nada aqui é suposição. O que já foi entregue está no `README.md`.

---

## 1. Títulos de perícope

Os subtítulos que aparecem no meio do texto em leitores como o Olive Tree —
por exemplo *"A criação dos céus e da terra e de tudo o que neles há"* antes de
Gênesis 1.

### Resolvido em 17/08/2026 — pela mesma porta do Strong

Não pelo lado que estava sendo procurado. Nenhuma tradução **embutível** traz
títulos, e isso não mudou; o que mudou é que o app passou a ler módulos do
MyBible, e esses **trazem**, na tabela `stories`.

- `readPericopes()` em `core/bible/mybible.ts` lê `stories` e resolve o livro
  pela mesma regra do texto (número ou nome, decidida por arquivo).
- Guardados em `CachedBook.pericopes` (`Pericope = { chapter, verse, title }`),
  ao lado do texto, que continua puro.
- `getChapterPericopes()` no repositório devolve um mapa versículo → título;
  vazio nas traduções que não têm, e a tela não sabe a diferença.
- Desenhados por `.pericope` em `reader.css`: itálico, sem numeração, cor de
  destaque — aparato editorial, e a tipografia diz isso. Ficam **fora** do
  `<span>` do versículo, então não entram na seleção nem na cópia.

Conferido: módulo com 7 títulos importado, "A criação dos céus e da terra" e
"A criação do homem" aparecendo em Gênesis 1, zero títulos na Almeida embutida,
e o título fora da seleção ao tocar no versículo 1.

**A restrição de direitos continua valendo** e é o motivo de isto só existir por
importação: títulos de perícope são trabalho editorial de quem os escreveu.
Vindos do arquivo de quem já tem a edição, ficam no aparelho como o resto —
nunca embutidos no aplicativo.

### O levantamento que continua valendo

**Situação das fontes embutíveis:** os arquivos que temos **não trazem** esses
títulos.

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

**Pista do Zefania: descartada em 13/08/2026.** Baixei os três XML Zefania de
domínio público de `damarals/biblias` e contei as tags. Nenhum traz títulos:

| Arquivo | `<CAPTION>` | `<NOTE>` | `<STYLE>` |
|---|---|---|---|
| `BLIVRE.xml` | 0 | 0 | 0 |
| `TB.xml` | 0 | 0 | 0 |
| `ALM1911.xml` | 0 | 0 | 0 |

Os três contêm apenas `XMLBIBLE > BIBLEBOOK > CHAPTER > VERS`. O
`por-almeida.usfx.xml` também não tem `<s>`. Ou seja: **nenhuma das quatro
traduções em português embutidas tem títulos de perícope na origem.**

**Obstáculo estrutural, não só de disponibilidade.** Títulos de perícope são
trabalho editorial — quem os escreveu detém direitos sobre eles, mesmo quando o
texto bíblico embaixo está em domínio público. Os títulos do leitor de
referência pertencem àquela edição. Portanto isto não se resolve "achando o
arquivo certo": ou se encontra uma edição cujos títulos estejam comprovadamente
livres, ou se obtém autorização, ou o recurso não entra.

**Impacto no código:** o payload de livro ganharia um campo opcional
`headings: Array<{ chapter, verse, text }>`, gerado por
`scripts/build-bible-data.mjs` e renderizado em `BiblePage` antes do versículo
correspondente. Não quebra as traduções que não tiverem títulos.

---

## 2. Palavras com números de Strong

As palavras coloridas do print de referência: cada uma ligada ao dicionário
hebraico/grego (Strong). Aparecem na *Bíblia Almeida Strong*.

### O que já está feito (17/08/2026) — a via do MyBible

O caminho que resolveu a falta de fonte livre foi **não procurar fonte**: o
usuário já tem, no aparelho dele, um módulo do MyBible com Strong em português
(a *Bíblia+*, 16,5 MB). O app passou a ler esse formato.

- `src/core/sqlite/reader.ts` — leitor de SQLite somente-leitura, escrito à mão
  (árvore-B de tabela, registros, páginas de transbordo). Sem WebAssembly, que
  custaria ~1,2 MB no cache do PWA para um recurso usado uma vez. Conferido
  contra 7.200 linhas geradas pelo `sqlite3` do Python, com páginas de 512,
  4096 e 65536 bytes, UTF-8 e UTF-16, transbordo e todos os tipos.
- `src/core/bible/mybible.ts` — tabelas `info`/`books`/`verses`, a numeração de
  livros do formato, a limpeza da marcação e a extração das etiquetas Strong
  com a posição da palavra.
- `src/core/bible/mybibleImport.ts` — grava como tradução do aparelho.
- Guardadas em `CachedBook.strongs` (`StrongTag = [palavra, código]`), ao lado
  do texto, que continua puro. `TranslationInfo.hasStrong` marca a tradução.

Conferido no navegador com um módulo de 11,7 MB montado no formato: 66 livros,
31.101 versículos, importação em ~1,1 s, leitura sem marcação vazando, busca
encontrando o texto importado.

### Concluído em 17/08/2026 — a consulta e o dicionário

- `core/data/dictionaries.ts` — importa módulos `*.dictionary.SQLite3`, grava em
  `dictionaries` + `dictionaryEntries` (Dexie v4) e consulta por código.
  `topicKey()` normaliza o verbete, porque os arquivos discordam na grafia do
  mesmo código: `H430`, `H0430`, `0430`, `430` caem todos na mesma chave.
- **Um botão só.** Bíblia e dicionário chegam no mesmo formato; o próprio
  arquivo diz o que é (`moduleKind`), então não se pede ao usuário que saiba.
- `features/bible/StrongSheet.tsx` — o versículo palavra por palavra. Abre pela
  ação **"No original"** da barra do versículo, que só existe quando a tradução
  tem `hasStrong`.

**Por que não é toque na palavra dentro do texto:** no tablet, palavra em meio a
parágrafo é alvo pequeno demais, e tocar no texto já significa selecionar o
versículo. Na folha cada palavra vira botão de 34 px.

Conferido: Bíblia com Strong e dicionário de 803 verbetes importados pelo mesmo
botão; Gn 1.1 abre com `No H7225 · principio H7225 · creou H1254 · Deus H430`, e
tocar em "No" traz *"reshit — princípio, primeiro, o melhor"*. Na Almeida
embutida a ação não aparece.

Falta só o que depende de licença: **nenhum léxico em português é embutível**, então
a consulta continua dependendo do arquivo do usuário. O levantamento abaixo
explica por quê.

O levantamento abaixo continua valendo para quem quiser uma fonte **embutível**
— que segue não existindo em português.

**Situação das traduções embutidas:** nenhuma das cinco tem marcação palavra a
palavra, e isso não mudou.

**Varredura de 13/08/2026 — nada em português.** Nas fontes alcançáveis, texto
com números de Strong só existe em inglês e francês:

| Catálogo | Com Strong | Idioma |
|---|---|---|
| `scrollmapper/bible_databases` | KJV, KJVA, RLT | inglês |
| `scrollmapper/bible_databases` | FreJND (Darby) | francês |
| `seven1m/open-bibles` | nenhum em português | — |

Os números de Strong em si são de 1890 e estão em domínio público. O que não
existe livre é o **mapeamento** desses números sobre um texto em português —
isso é trabalho editorial de quem fez, com direitos próprios.

**Levantamento de 14/08/2026 — as fontes existem, mas em inglês.** Conferido
baixando os arquivos:

| Fonte | O que é | Licença | Tamanho |
|---|---|---|---|
| `openscriptures/strongs` | Léxico de Strong (1890) completo | CC BY-SA, sobre texto em domínio público | grego 1,2 MB · hebraico 2,0 MB |
| `STEPBible/STEPBible-Data` | TBESG e TBESH, léxicos breves da Tyndale House | CC BY 4.0 | — |

**Em português, nada com licença utilizável.** O "Dicionário Bíblico Strong"
em português é da Sociedade Bíblica do Brasil e tem direitos autorais; os PDFs
que circulam em SlideShare e Internet Archive não são fonte licenciada. Busca
no GitHub por léxico bíblico em português só devolve dicionários da língua
portuguesa (fserb/pt-br, unitex-pt-br e afins), que não servem.

**Caminho viável hoje:** aplicar Strong sobre a **KJV**, que já está embutida e
tem versão com Strong em domínio público, com as definições em inglês. Daria a
palavra clicável com o original hebraico/grego — ferramenta de estudo ao lado
do texto em português.

**Para ter as definições em português**, três saídas, em ordem de custo:

1. **Traduzir o léxico de Strong.** O texto de 1890 é domínio público, então a
   tradução é permitida e seria nossa. São ~14.000 verbetes curtos; feito por
   máquina, precisa vir rotulado como tradução automática, sem se passar por
   obra de referência revisada.
2. **Licenciar** um léxico em português de uma editora.
3. **Deixar em inglês** e assumir isso na interface.

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
*Configurações › Traduções*, e também pela sigla da tradução dentro da leitura.
Ver `TranslationManager.tsx`, `TranslationPicker.tsx`, o gancho compartilhado
`features/bible/useTranslationImport.tsx` e `normalizeImportedBible()` em
`core/bible/repository.ts`.

Espaços reservados (17/08/2026): os **quinze** títulos protegidos de
`damarals/biblias` — ACF, ARA, ARC, AS21, JFAA, KJA, KJF, NAA, NBV, NTLH, NVI,
NVT, OL, MENS, VFL. Nenhum traz texto; só nome, sigla e editora.

Decisão do usuário, registrada aqui para não se perder: **uso pessoal, sem
distribuição.** O que isso mudou foi o caminho de importação, não a regra — o
build segue sem nenhum texto protegido. Conferido ponta a ponta com o JSON de
release de `damarals/biblias` (formato "lista canônica", 4 MB): *66 livros e
31.101 versículos neste aparelho*, tradução aparecendo no seletor, na comparação
e na busca.

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
- [ ] Escrever um sermão inteiro no editor de blocos, com o teclado do tablet
- [ ] Colar um trecho do Word dentro de um bloco e ver se o negrito veio junto
- [ ] Importar as ~20 apostilas do Rhema Brasil e conferir o espaço ocupado
      (verificado em Chromium com uma apostila de 56 páginas: só 2 a 4 páginas
      ficam desenhadas por vez, 7 MB de memória; falta a medição no tablet real
      com PDFs cheios de imagem)
- [ ] Dar uma aula inteira no Modo Aula, com a Bíblia ao lado
- [ ] Abrir um curso real em `.pptx` — o desenho da apresentação é reconstruído
      pelo `pptx-preview`, não pelo PowerPoint, e vale conferir num arquivo de
      verdade (com imagens, máscaras e SmartArt) se algum slide escorrega. O
      caminho seguro, quando escorregar, é salvar como PDF.

---

## 6. iPhone e iPad — ainda não verificado

O aplicativo é um PWA e o Safari do iOS suporta PWA desde a versão 11.3, então
a expectativa é de que funcione. Mas **isto ainda não foi verificado em aparelho
Apple nenhum** — toda a verificação até aqui foi feita em Chromium.

Pontos que precisam de conferência no iOS, por serem onde o Safari costuma
divergir:

- Instalação: no iPhone é Compartilhar › "Adicionar à Tela de Início" (não há
  aviso automático de instalação como no Chrome).
- IndexedDB: o Safari apaga os dados de sites sem uso por 7 dias. Um aplicativo
  *instalado na tela de início* está isento dessa limpeza, mas convém confirmar
  — é o que guarda sermões, anotações e as Bíblias baixadas.
- `contenteditable` no editor de blocos: a seleção e a barra de formatação
  precisam ser testadas com o teclado virtual do iOS.
- `execCommand('foreColor')` e o comportamento do Enter dentro dos blocos.
- Wake Lock (manter a tela acesa no Modo Pregação): o Safari só passou a
  suportar na versão 16.4; em iOS mais antigo a tela apaga durante a pregação.
- `env(safe-area-inset-*)` no iPhone com entalhe — já usamos, falta ver.
- Impressão/PDF pelo `window.open` — o bloqueio de pop-up do Safari é mais
  rígido.

---

## Traduções protegidas — as três vias investigadas (13/08/2026)

Levantamento fechado. Resultado de cada uma:

### 1. API licenciada — não avaliável daqui, mas é a via mais promissora

A rede do ambiente de trabalho bloqueia todos os serviços de API bíblica
(`api.scripture.api.bible`, `abibliadigital.com.br`, `bolls.life`,
`getbible.net` — todos respondem `000`/403 no proxy). Não deu para verificar
quais traduções em português cada um oferece nem sob que termos, e construir
uma integração sem conseguir testá-la seria trabalho no escuro.

**O que precisa ser feito, por alguém com rede aberta:**

1. Verificar em cada serviço quais traduções em português estão disponíveis e
   sob quais condições — em geral é preciso aceitar um contrato por tradução,
   não basta a chave.
2. Confirmar se o uso pretendido (app gratuito, não comercial, distribuído a
   terceiros) está coberto.
3. Só então implementar.

**Como implementar quando houver serviço confirmado.** O repositório já tem o
`TranslationInfo` com `requiresLicense`, e o leitor busca o texto por
`getChapter(translation, book, chapter)` em `core/bible/repository.ts`. Um
provedor on-line entra como um terceiro degrau na cascata, depois de memória e
IndexedDB: busca o capítulo pela API, grava no IndexedDB e segue igual. Nenhuma
tela precisa mudar. A chave do usuário fica em `settings`, nunca no repositório.

### 2. Mais traduções em domínio público — nada novo encontrado

Varri os catálogos alcançáveis. Em português existem apenas:

| Fonte | Tradução | Situação |
|---|---|---|
| `seven1m/open-bibles` | Almeida | **já embutida** |
| `damarals/biblias` | Bíblia Livre, Tradução Brasileira, Almeida 1911 | **já embutidas** |
| `wldeh/bible-api` | Bíblia Livre Para Todos (BLT) | campo de copyright **vazio** — sem declaração de licença; e os arquivos de texto retornam 404 no repositório |
| `wldeh/bible-api` | Translation for Translators | **só Novo Testamento** |
| `gratis-bible/bible` | nenhuma em português | — |

Conclusão: **as quatro que o app já traz são o que existe de livre e completo
em português** nas fontes públicas alcançáveis. Campo de copyright vazio não é
declaração de domínio público, e por isso a BLT não entrou.

### 3. Autorização das editoras — pronta para enviar

`IMPORTAR-TRADUCOES.md` traz o modelo de carta para SBB (ARA, ARC, NTLH, NAA),
BV Books (KJA), Mundo Cristão (NVT), Biblica (NVI) e Trinitariana (ACF), com o
que pedir e o que guardar da resposta.

É a via mais curta e definitiva: com a autorização, embutir a tradução é
trabalho de minutos.

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

---

## 7. Salvar os dados fora do aparelho — decidido em 17/08/2026

Hoje tudo vive no IndexedDB de um aparelho só. O usuário decidiu o caminho, em
duas etapas:

1. **Agora — cópia no Google. ✅ construído em 17/08/2026.**
   `core/backupStore.ts` traz as duas camadas: cópias automáticas no próprio
   Dexie (tabela `backups`, as 6 últimas, uma a cada 3 dias, disparadas 8 s
   depois da abertura) e o envio para fora pelo contrato `BackupTarget` — hoje
   a folha de compartilhamento do Android, onde "Salvar no Drive" é um toque, e
   o arquivo baixado. A tela é `features/settings/BackupPanel.tsx`, organizada
   pela pergunta *"se eu perder este tablet agora, o que sobra?"*: o estado da
   cópia **fora** do aparelho vem primeiro, em vermelho enquanto não houver
   nenhuma. Restaurar — de arquivo ou de uma cópia local — grava antes o estado
   atual, para haver caminho de volta.

   Duas armadilhas encontradas na verificação: a assinatura que evita cópias
   repetidas **não pode** incluir `exportedAt`, que muda a cada chamada de
   `createBackup` (sem isso nada nunca é igual e a lista enche de repetições); e
   `navigator.share` não existe no Chromium sem interface, então o destino da
   folha some no teste — o do arquivo cobre a verificação.

   *O upload automático de verdade no Drive (sem o toque) exigiria um client ID
   OAuth criado pelo usuário no Google Cloud; entra como mais um `BackupTarget`
   se a folha se mostrar insuficiente.*
2. **Depois — servidor com conta e sincronização.** Foi a opção que ele quis
   para o futuro ("muito bom essa segunda opção"). O contrato já existe em
   `core/sync/syncAdapter.ts`: `SYNCABLE_TABLES`, `collectLocalChanges`,
   `applyRemoteChanges` e resolução por `updatedAt`. Ligar um servidor é
   registrar um adaptador, sem mexer em tela.

**A trava de licença vale aqui também.** As traduções importadas (ARA, Bíblia+…)
**não podem** subir para servidor nem sincronizar entre pessoas: sair do aparelho
deixa de ser uso pessoal e vira distribuição. `SYNCABLE_TABLES` já não inclui
`books` nem `attachments` — manter assim.

Ao construir, usar um contrato de destino (`BackupTarget`) em vez de chamar o
Google direto das telas, para que o servidor da etapa 2 entre pelo mesmo lugar.
O upload automático de verdade no Drive (sem o toque na folha) exige um client ID
OAuth criado pelo próprio usuário no Google Cloud — só vale a pena se a folha de
compartilhamento se mostrar insuficiente.

---

## 8. Rodar como APK e como aplicativo de iOS — planejar, não hoje

Pedido registrado em 17/08/2026, explicitamente para depois. O que já joga a
favor: o app é um PWA completo, com service worker, manifesto e ícones, e usa
`HashRouter` justamente para funcionar dentro de uma WebView sem reescrita de
rotas no servidor.

Caminhos a comparar quando chegar a hora:

| Caminho | O que dá | O que custa |
|---|---|---|
| **TWA / Bubblewrap** (Android) | APK que embrulha o PWA; publicável na Play Store | conta de desenvolvedor (US$ 25, uma vez), assinatura, Digital Asset Links |
| **Capacitor** (Android + iOS) | um projeto para os dois; acesso a arquivos, biometria e armazenamento nativos | build nativo, e para iOS exige Mac + conta Apple (US$ 99/ano) |
| **Continuar só PWA** | zero custo, atualização instantânea, sem revisão de loja | não aparece nas lojas; instalação depende do navegador |

Antes de decidir, verificar o app num iPhone/iPad de verdade (§6): parte da
motivação para empacotar costuma ser justamente o que a Apple limita no PWA.
