# Gerar e Exportar Arquivos

Módulo que transforma o conteúdo escrito no app (mensagens do Gerador, estudos
do Rhema, cursos/devocionais e materiais antigos da biblioteca) em arquivos
**Word (.docx)**, **PDF** e **Markdown (.md)** — gerados de verdade, no próprio
aparelho, sem internet e sem servidor.

Rota: `#/exportar` (lista e biblioteca) e `#/exportar/:id` (revisão do documento).

---

## Princípio de autoria

O arquivo traz **somente o texto do autor**. A conversão da origem para o
documento muda a forma (blocos: seção, parágrafo, destaque, citação, lista),
nunca o conteúdo: campo vazio não vira título com caixa em branco, nada é
resumido, completado ou reescrito. Os modelos documentais definem só padrões de
aparência e estrutura (capa, sumário, numeração, quebras, espaço para
anotações). Este módulo **não chama a IA**.

A origem nunca é alterada: o documento de exportação guarda uma cópia
(`original`) e um rascunho (`content`). "Restaurar texto original" volta à cópia.

## Fluxo

Escolher conteúdo → categoria e modelo → revisar (conteúdo, estrutura,
formatação, visualização) → **aprovar** (vira versão N) → gerar os arquivos da
versão aprovada → baixar, compartilhar ou guardar.

- Os arquivos saem sempre da **versão aprovada**, nunca do rascunho. Word e PDF
  da mesma versão têm o mesmo conteúdo (os dois partem da mesma estrutura,
  `core/export/model.ts`); a paginação pode variar entre os formatos.
- Editar depois de aprovar devolve a situação a **Rascunho**; os arquivos
  continuam saindo da última versão aprovada até nova aprovação.
- Situações: **Rascunho** → **Aprovado** (rascunho = versão aprovada, sem
  arquivo) → **Finalizado** (há arquivo guardado da versão aprovada).
- Cada arquivo gerado é **conferido** antes de ser oferecido: o .docx é aberto
  como pacote e o documento principal é verificado; o PDF precisa do cabeçalho
  `%PDF-`, do `%%EOF` e de páginas; o Markdown, de texto e título. A tela só diz
  "gerado e conferido" depois disso.
- Se guardar na biblioteca falhar (falta de espaço, por exemplo), o arquivo
  gerado continua disponível para baixar, e a tela diz o que aconteceu.

## Integração com as telas (fase 3)

- **Atalhos nas telas de origem**, que abrem o novo documento com a origem, a
  categoria e o modelo já escolhidos (`#/exportar?origem=…&id=…&categoria=…&modelo=…`):
  - Gerador: **Finalizar e exportar** (pregação › mensagem completa);
  - Cursos: **Gerar Word ou PDF** (devocional › diário);
  - Rhema: **Exportar estudo** e **Transformar em apostila** (treinamento › apostila);
  - Plano de leitura: **Gerar arquivo do plano** (devocional › plano de leitura bíblica).
  Material que só existe como arquivo importado não mostra o atalho.
- **Plano de leitura como origem:** a descrição do plano e uma tabela por semana
  (dia, leitura, ✓ lido / ☐ a ler), tudo vindo do próprio plano.
- **Vários conteúdos num documento só** ("Juntar vários num só documento"):
  série de mensagens, série de estudos, plano devocional de 7, 14, 21 ou 30
  dias, apostila com vários módulos. Cada conteúdo vira um título, numerado pelo
  modelo ("Dia 3 — …", "Mensagem 2 — …"), na ordem em que foi marcado; os
  títulos de dentro dele viram subtítulos. Ao reordenar na Estrutura, o título
  leva junto os seus subtítulos e a numeração acompanha a nova ordem.
- **Material do instrutor e do participante:** na Estrutura, "Só instrutor"
  marca uma seção. Na geração, saem duas versões de cada formato — a do
  instrutor (completa) e a do participante (sem essas seções e o que vem abaixo
  delas) —, com o nome do arquivo terminando em `- instrutor` / `- participante`.

## Onde está o código

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Interface | `features/export/ExportPage.tsx` | Lista, pesquisa e filtros (categoria, situação, período), duplicar, excluir |
| | `features/export/NewExportSheet.tsx` | Novo documento: categoria, modelo, título, conteúdo de origem |
| | `features/export/ExportEditorPage.tsx` | Revisão em abas; PDF de conferência |
| | `features/export/ContentTab.tsx` | Título, estrutura (título/subtítulo, nova página, ordem das seções) e o editor em blocos do Gerador |
| | `features/export/LayoutTab.tsx` | Modelo, modelo visual, cor, folha, letra, capa, logotipo, sumário, numeração, cabeçalho, rodapé |
| | `features/export/FilesTab.tsx` | Aprovar, gerar, baixar, compartilhar; arquivos e versões |
| | `features/export/ExportPreview.tsx` | Visualização imediata, com as fontes e cores do arquivo |
| Motor de modelos | `core/export/templates.ts` | Categorias e modelos — **para acrescentar um modelo, basta uma entrada aqui** |
| Formatação | `core/export/themes.ts` | Os 5 modelos visuais, margens, folhas, fontes |
| | `core/export/inline.ts` | Leitura do HTML dos blocos (sem DOM) |
| | `core/export/model.ts` | Estrutura comum aos três geradores |
| Geradores | `core/export/docx.ts` · `pdf.ts` · `markdown.ts` | Word, PDF e Markdown |
| Conferência e nomes | `core/export/files.ts` | Nome de arquivo seguro, tipos, limites, conferência |
| Origem | `core/export/sources.ts` | Conversão de sermão, estudo, devocional e material |
| Orquestração | `core/export/generate.ts` | Validar → montar → gerar → conferir → guardar → registrar |
| Entrega | `core/export/deliver.ts` | Download no navegador; no APK, grava em Documentos |
| Armazenamento e versões | `core/data/exportDocs.ts` | Rascunho, aprovação, versões, arquivos, biblioteca, preferências, registro operacional |

Banco (Dexie v7, só tabelas novas): `exportDocs`, `exportVersions`,
`exportFiles`. `exportDocs` e `exportVersions` entram no backup; os arquivos
gerados (`exportFiles`, binários) não — podem ser gerados de novo a partir da
versão.

## Bibliotecas

| Biblioteca | Para quê | Por quê |
|---|---|---|
| `docx` 9.5 | Word | Gera .docx editável no navegador, com estilos de título, listas numeradas, tabelas, cabeçalho/rodapé e campos de página |
| `pdfmake` 0.2 | PDF | Pagina, gera sumário com os números de página reais, cabeçalho/rodapé por página, tabelas e listas; embute as fontes |
| `jszip` (já existia) | Conferência do .docx | Abre o pacote gerado |
| Lora e Source Sans 3 (`public/fonts/`, OFL) | Fontes do PDF | Acentos e símbolos iguais em qualquer aparelho; entram no precache (funciona offline) |

As três bibliotecas são carregadas **sob demanda**: o carregamento inicial do
app não cresce.

## Testes

```bash
npm run test:export
```

Gera arquivos reais fora do navegador e os abre para conferir: pregação em Word,
PDF e Markdown; Word + PDF da mesma versão com o mesmo conteúdo; devocional com
espaço para anotações; apostila com capa, sumário (números de página conferidos
contra a página real de cada módulo) e quebras; documento longo sem truncamento;
logotipo na capa; acentos e símbolos; tabelas, listas, citações e links;
arquivos corrompidos recusados; o fluxo completo de dados (origem intacta,
aprovação, versões, restauração, duplicação, exclusão, pesquisa e filtros,
isolamento do usuário local) e a falha ao guardar. Os arquivos ficam em
`scripts/.cache/export-test/` para inspeção.

## Limitações conhecidas

- **Sem servidor, sem contas.** Os documentos e arquivos ficam no aparelho (como
  todo o app). Não há link de download protegido nem compartilhamento entre
  usuários; o compartilhamento é o do próprio aparelho.
- **Sumário no Word:** os títulos aparecem em qualquer leitor; os números de
  página são calculados pelo leitor (o Word recalcula ao abrir e pede para
  atualizar os campos). O PDF já sai com os números definitivos.
- **Fontes no Word:** o .docx indica Georgia e Calibri (as do Office); o PDF usa
  Lora e Source Sans 3, embutidas. A aparência é próxima, não idêntica.
- **Tabelas** são escritas no texto, uma linha por linha da tabela, com as
  colunas separadas por `|`.
- **Imagens:** só o logotipo da capa (PNG ou JPEG, até 2 MB). Os blocos do
  editor não têm imagem.
- **Estudos do Rhema:** a seção "Texto principal" guarda a referência; o texto
  do versículo é trazido na revisão, pelo botão "Trazer texto" da citação.
- Cursos e estudos que só existem como **arquivo importado** (PDF/Word) não podem
  ser formatados — o texto está no arquivo original.
- PowerPoint, TXT e HTML **não** aparecem como opção: não estão implementados.
- Num plano devocional de N dias, o app avisa quando a quantidade escolhida é
  diferente de N, mas não impede — os dias são os devocionais que o autor tem.
- Fase ainda não feita: sugestões da IA com aceitar/editar/rejeitar.
