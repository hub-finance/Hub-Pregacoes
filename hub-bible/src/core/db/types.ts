/**
 * Modelo de dados do Hub Bible.
 *
 * Todos os registros do usuário carregam `userId` (hoje sempre "local") para que
 * a futura sincronização multi-dispositivo/multi-conta não exija migração de
 * schema, e `updatedAt` para resolução de conflitos por "last write wins".
 */

export type ID = string;

/** Identificador do usuário local enquanto não há conta/sincronização. */
export const LOCAL_USER: ID = 'local';

export interface UserProfile {
  id: ID;
  name: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------ referências ------------------------------ */

/** Referência canônica a um trecho bíblico. `verseEnd` inclusivo. */
export interface VerseRef {
  translation: string;
  book: string; // OSIS: GEN, JHN, REV...
  chapter: number;
  verse: number;
  verseEnd?: number;
}

/* -------------------------------- registros ------------------------------ */

export interface Favorite {
  id: ID;
  userId: ID;
  ref: VerseRef;
  reference: string; // "João 15:5" — desnormalizado para busca/lista
  text: string;
  category: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Highlight {
  id: ID;
  userId: ID;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  /** Chave composta `${translation}:${book}:${chapter}` para leitura do capítulo. */
  chapterKey: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export type NoteTarget = 'verse' | 'chapter' | 'book' | 'sermon' | 'study' | 'devotional' | 'free';

export interface Note {
  id: ID;
  userId: ID;
  targetType: NoteTarget;
  /** Referência textual ("João 15:5", "Sermão: A videira") — sempre preenchida. */
  reference: string;
  ref?: VerseRef;
  /** Vínculo com outro documento (sermão/estudo/devocional). */
  parentId?: ID;
  title?: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Bloco de conteúdo do sermão escrito dentro do aplicativo.
 *
 * O sermão deixou de ser quatro caixas de texto corrido e passou a ser uma
 * sequência de blocos, do jeito que se monta um sermão no Word: um subtítulo,
 * parágrafos, um quadro de destaque, uma citação bíblica, uma lista. Dentro de
 * cada bloco o texto guarda a formatação que o autor deu (negrito, itálico,
 * sublinhado e cor) — daí o conteúdo ser HTML, e não texto puro.
 */
export type SermonBlockType = 'section' | 'text' | 'highlight' | 'scripture' | 'list';

export interface SermonBlock {
  id: ID;
  type: SermonBlockType;
  /** HTML restrito — ver `core/sanitizeHtml.ts` para o que é aceito. */
  html: string;
  /** Só em `scripture`: a referência exibida sob a citação. */
  reference?: string;
}

/** Bloco de um sermão/estudo (ponto, tópico). */
export interface OutlineBlock {
  id: ID;
  title: string;
  scripture: string;
  scriptureText?: string;
  comment: string;
  application: string;
}

export interface Sermon {
  id: ID;
  userId: ID;
  title: string;
  theme: string;
  mainText: string;
  mainTextContent?: string;
  date: string; // ISO yyyy-mm-dd
  category: string;
  introduction: string;
  development: string;
  conclusion: string;
  application: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  /**
   * Conteúdo montado em blocos. Quando existe, é ele que vale: os campos
   * `introduction`/`development`/`conclusion`/`application` acima ficam como
   * estavam, apenas para não perder nada de quem escreveu antes.
   */
  content?: SermonBlock[];
  /** Sermão que chegou pronto num arquivo: exibido como veio, sem reescrever. */
  attachmentId?: ID;
  attachmentFormat?: AttachmentFormat;
  /**
   * Estrutura antiga, em blocos de tópico. Mantida somente para não perder o
   * que já foi escrito: o editor a exibe quando tem conteúdo e oferece juntar
   * ao Desenvolvimento.
   */
  blocks?: OutlineBlock[];
  /** Campo antigo "Apelo", hoje substituído por Aplicação. */
  appeal?: string;
}

/**
 * Que parte do estudo uma seção é.
 *
 * `texto` é referência bíblica, e o app busca o versículo; `livre` é uma seção
 * com título escolhido pelo autor. As demais são as partes clássicas de uma
 * exposição, guardadas como tipo — e não como campo fixo — para que cada estudo
 * tenha só as que precisa, na ordem que precisa.
 */
export type StudySectionKind =
  | 'texto'
  | 'introducao'
  | 'desenvolvimento'
  | 'aplicacao'
  | 'conclusao'
  | 'livre';

export interface StudySection {
  id: ID;
  kind: StudySectionKind;
  /** Só nas seções livres; nas demais o título vem do tipo. */
  title?: string;
  text: string;
}

/**
 * Estudo bíblico. Na tela chama-se **Rhema**, e é onde vivem também as
 * apostilas do Rhema Brasil importadas em PDF — o identificador `study`
 * permanece porque é o nome da tabela desde a primeira versão do banco.
 */
export interface Study {
  id: ID;
  userId: ID;
  title: string;
  theme: string;
  mainText: string;
  category: string;
  introduction: string;
  development: string;
  relatedVerses: string[];
  comments: string;
  application: string;
  conclusion: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Apostila que chegou pronta em arquivo: exibida como veio, sem reescrever. */
  attachmentId?: ID;
  attachmentFormat?: AttachmentFormat;
  /**
   * O corpo do estudo, em seções escolhidas pelo autor.
   *
   * Ausente nos estudos escritos antes disto — aí o corpo vem dos campos fixos
   * acima, convertido na leitura por `sectionsOf`. Os campos antigos continuam
   * gravados de propósito: nada do que já foi escrito se perde.
   */
  sections?: StudySection[];
}

/**
 * Formatos de arquivo exibidos como vieram. PDF e Word saem idênticos ao
 * original; a apresentação é reconstruída a partir do arquivo — chega perto,
 * mas não é o PowerPoint desenhando.
 */
export type AttachmentFormat = 'pdf' | 'docx' | 'pptx';

/**
 * Devocional — e, na tela, também o **Curso**: material de aula que chega
 * pronto em PDF, Word ou apresentação. O identificador `devotional` permanece
 * porque é o nome da tabela desde a primeira versão do banco.
 */
export interface Devotional {
  id: ID;
  userId: ID;
  title: string;
  date: string;
  category: string;
  scripture: string;
  scriptureText?: string;
  reflection: string;
  application: string;
  prayer: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Curso que chegou pronto em arquivo: exibido como veio, sem reescrever. */
  attachmentId?: ID;
  attachmentFormat?: AttachmentFormat;
}

/** Documento livre da Biblioteca Ministerial (liderança, GC, discipulado…). */
export interface LibraryDoc {
  id: ID;
  userId: ID;
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* --------------------------- planos de leitura --------------------------- */

/** Uma leitura diária: lista de trechos "GEN 1-3". */
export interface PlanDay {
  day: number;
  /** Lista de intervalos: [livro OSIS, capítulo inicial, capítulo final]. */
  ranges: Array<[string, number, number]>;
}

export interface ReadingPlan {
  id: ID;
  userId: ID;
  templateId: string;
  name: string;
  description: string;
  totalDays: number;
  days: PlanDay[];
  /** Índices (1-based) dos dias concluídos. */
  completedDays: number[];
  startedAt: number;
  lastReadAt?: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------- histórico e progresso ------------------------ */

export interface ReadingEvent {
  id: ID;
  userId: ID;
  translation: string;
  book: string;
  chapter: number;
  /** Data local yyyy-mm-dd — usada para sequência de dias consecutivos. */
  day: string;
  at: number;
}

export interface KeyValue<T = unknown> {
  key: string;
  value: T;
}

/** Arquivo importado pelo usuário (sermão em PDF ou Word), guardado no aparelho. */
export interface Attachment {
  id: ID;
  userId: ID;
  /** Documento a que pertence (sermão, estudo, material…). */
  docId: ID;
  name: string;
  mime: string;
  size: number;
  format: AttachmentFormat;
  blob: Blob;
  createdAt: number;
}

/** Texto bíblico armazenado localmente (offline). */
export interface CachedBook {
  key: string; // `${translation}:${book}`
  translation: string;
  book: string;
  chapters: string[][];
  /**
   * Números Strong, quando a tradução os traz (módulos do MyBible).
   * Capítulo → versículo → `[posição da palavra, código]`. Fica em paralelo a
   * `chapters` para que o texto continue sendo texto puro na busca e na cópia.
   */
  strongs?: StrongTag[][][];
  /** Títulos de perícope do livro, quando a tradução os traz. */
  pericopes?: Pericope[];
  savedAt: number;
}

/** [posição da palavra no versículo, código Strong] — ex.: `[0, 'H430']`. */
export type StrongTag = [word: number, code: string];

/**
 * Título de perícope — o subtítulo que abre um trecho ("A criação dos céus e da
 * terra"). Vem de módulos que o trazem; as traduções embutidas não têm.
 */
export interface Pericope {
  chapter: number;
  verse: number;
  title: string;
}

/**
 * Cópia de segurança guardada no próprio aparelho.
 *
 * Protege do acidente mais comum — apagar um sermão sem querer — sem depender
 * de internet, conta ou de o usuário lembrar de exportar. Não substitui a cópia
 * fora do aparelho: se o navegador for limpo, estas vão junto.
 */
export interface BackupSnapshot {
  id: ID;
  at: number;
  /** Feita sozinha pelo app ou a pedido. */
  reason: 'auto' | 'manual';
  records: number;
  counts: Record<string, number>;
  /** Tamanho do conteúdo em bytes, para mostrar na lista. */
  size: number;
  /** O arquivo de backup inteiro, serializado. */
  payload: string;
  /**
   * Conteúdo sem o carimbo de hora, para reconhecer duas cópias iguais.
   * `createBackup` grava `exportedAt` com o instante da exportação: comparar o
   * payload inteiro diria "mudou" toda vez, e a lista encheria de repetições.
   */
  signature: string;
}

/* -------------------------------- catálogo ------------------------------- */

export interface TranslationInfo {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  language: string;
  languageLabel: string;
  year?: number;
  license: string;
  licenseUrl?: string;
  publisher?: string;
  sourceUrl?: string;
  bundled: boolean;
  default?: boolean;
  requiresLicense?: boolean;
  stats?: { books: number; chapters: number; verses: number };
  /** Preenchido em runtime: tradução importada pelo usuário. */
  imported?: boolean;
  /** A tradução traz números Strong palavra a palavra. */
  hasStrong?: boolean;
}

export interface BookMeta {
  osis: string;
  order: number;
  name: string;
  abbrev: string;
  testament: 'AT' | 'NT';
  chapters: number;
  verseCounts: number[];
}

export interface TranslationMeta extends TranslationInfo {
  books: BookMeta[];
}

/* ------------------------------ dicionários ------------------------------ */

/**
 * Dicionário importado pelo usuário — tipicamente um léxico de Strong vindo de
 * um módulo `*.dictionary.SQLite3` do MyBible. Como as traduções, o conteúdo
 * fica só neste aparelho.
 */
export interface DictionaryInfo {
  id: ID;
  name: string;
  /** Verbetes indexados por código Strong (H430, G26) e não por palavra. */
  isStrong: boolean;
  entries: number;
  language?: string;
  createdAt: number;
}

export interface DictionaryEntry {
  id: ID;
  dictionaryId: ID;
  /** O verbete como está no arquivo. */
  topic: string;
  /** O verbete normalizado, para casar "H430" com "H0430" e "0430". */
  topicKey: string;
  /** HTML restrito — passa pelo mesmo saneador dos sermões. */
  definition: string;
}

/* ----------------------------- comentários ----------------------------- */

/**
 * Comentário bíblico importado pelo usuário — tipicamente um módulo
 * `*.commentaries.SQLite3` do MyBible (Bíblia de Estudo NTLH, Genebra, NVT…).
 * Como as traduções e os dicionários, o conteúdo fica só neste aparelho.
 */
export interface CommentaryInfo {
  id: ID;
  name: string;
  entries: number;
  /** Notas de rodapé em vez de comentário (is_footnotes = true no módulo). */
  isFootnotes: boolean;
  language?: string;
  createdAt: number;
}

export interface CommentaryEntry {
  id: ID;
  commentaryId: ID;
  book: number;
  chapterFrom: number;
  verseFrom: number;
  chapterTo: number;
  verseTo: number;
  /** Chave de busca rápida `${commentaryId}:${book}:${chapter}`. */
  chapterKey: string;
  /** HTML restrito — passa pelo mesmo saneador dos sermões. */
  text: string;
}

/* ----------------------------- análises de IA ----------------------------- */

/**
 * Análise gerada pela IA e salva localmente. Cada combinação de
 * referência + tipo de análise + tradução gera uma entrada.
 * `lookupKey` é `${task}:${reference}:${translation}` — busca rápida
 * para exibir o resultado já salvo quando o usuário reabre a análise.
 */
export interface AiAnalysis {
  id: ID;
  userId: ID;
  /** Tipo da análise (contexto-historico, exegese…). */
  task: string;
  /** Referência textual — "Efésios 2:5". */
  reference: string;
  /** Tradução em uso quando a análise foi gerada. */
  translation: string;
  /** Chave de busca rápida `${task}:${reference}:${translation}`. */
  lookupKey: string;
  /** Provedor que gerou (Google Gemini, OpenAI…). */
  provider: string;
  /** Segmentos da resposta, serializados. */
  segments: Array<{ kind: string; title?: string; text: string; reference?: string }>;
  /** Referências sugeridas pela IA. */
  suggestedReferences: string[];
  /** Disclaimer exibido ao usuário. */
  disclaimer: string;
  createdAt: number;
  updatedAt: number;
}

/* ----------------------- gerar e exportar arquivos ----------------------- */

/** Família do documento — define o modelo e os padrões de capa, sumário etc. */
export type ExportCategory = 'pregacao' | 'devocional' | 'estudo' | 'treinamento' | 'institucional';

/**
 * Situação do documento de exportação.
 *
 * `aprovado` quer dizer que o rascunho atual é exatamente a última versão
 * aprovada; editar depois disso devolve o documento a `rascunho`, e os arquivos
 * continuam saindo da versão aprovada até que o autor aprove de novo.
 */
export type ExportStatus = 'rascunho' | 'aprovado' | 'finalizado';

export type ExportFormat = 'docx' | 'pdf' | 'md';

export type ExportSourceKind = 'sermon' | 'study' | 'devotional' | 'doc' | 'plan' | 'compiled' | 'blank';

/** De onde veio o conteúdo — para mostrar na biblioteca e voltar à origem. */
export interface ExportSource {
  kind: ExportSourceKind;
  id?: ID;
  title: string;
  /** Documento compilado: as origens, na ordem em que entraram. */
  parts?: Array<{ kind: ExportSourceKind; id: ID; title: string }>;
}

/** Logotipo da capa, já reduzido e guardado como `data:` URL. */
export interface ExportLogo {
  dataUrl: string;
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

/** Tudo o que é aparência do arquivo — nada aqui altera o texto do autor. */
export interface ExportLayout {
  theme: string;
  pageSize: 'A4' | 'A5' | 'LETTER';
  margins: 'estreita' | 'normal' | 'larga';
  /** Tamanho da letra do corpo, em pontos. */
  fontSize: number;
  /** Entrelinha: 1.15, 1.35, 1.6… */
  lineSpacing: number;
  /** Cor de destaque escolhida pelo usuário; vazia, vale a do modelo visual. */
  accentColor: string;
  cover: boolean;
  subtitle: string;
  author: string;
  institution: string;
  dateLabel: string;
  logo?: ExportLogo;
  toc: boolean;
  pageNumbers: boolean;
  pageNumberAlign: 'center' | 'right';
  /** Texto do cabeçalho; vazio, sem cabeçalho. */
  header: string;
  /** Texto do rodapé; vazio, só a numeração (quando ligada). */
  footer: string;
  /** Cada seção principal começa em página nova. */
  breakBeforeSections: boolean;
  /** Linhas para anotações pessoais no fim do documento. */
  notesSpace: boolean;
}

/**
 * Ajustes de estrutura feitos na revisão, guardados à parte dos blocos para que
 * o conteúdo continue sendo exatamente o do autor.
 */
export interface ExportStructure {
  /** Seções que começam em página nova. */
  pageBreaks: ID[];
  /** Seções rebaixadas a subtítulo (nível 2). */
  subheadings: ID[];
  /**
   * Seções só do material do instrutor: entram na versão do instrutor e ficam
   * de fora da versão do participante. Ausente em documentos antigos.
   */
  instructorOnly?: ID[];
}

/** Versão do arquivo quando há partes só do instrutor. */
export type ExportEdition = 'instrutor' | 'participante';

export interface ExportDoc {
  id: ID;
  userId: ID;
  title: string;
  category: ExportCategory;
  /** Identificador do modelo documental (ver `core/export/templates.ts`). */
  model: string;
  source: ExportSource;
  status: ExportStatus;
  /** O conteúdo como veio da origem. Nunca é alterado — serve para restaurar. */
  original: SermonBlock[];
  /** O rascunho em revisão. */
  content: SermonBlock[];
  structure: ExportStructure;
  /** Estrutura com que o documento nasceu (num compilado, os subtítulos de cada parte). */
  originalStructure?: ExportStructure;
  layout: ExportLayout;
  /** Número da última versão aprovada. */
  approvedVersion?: number;
  /**
   * Assinatura do conteúdo aprovado — compara o rascunho com a versão
   * aprovada sem precisar abri-la.
   */
  approvedSignature?: string;
  /** Quantas versões já foram aprovadas — a próxima recebe este número + 1. */
  versionCount: number;
  /** Formatos já gerados, de qualquer versão. */
  formats: ExportFormat[];
  lastExportAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Uma versão aprovada: cópia fiel do que foi aprovado, para gerar e restaurar. */
export interface ExportVersion {
  id: ID;
  docId: ID;
  userId: ID;
  version: number;
  title: string;
  content: SermonBlock[];
  structure: ExportStructure;
  layout: ExportLayout;
  createdAt: number;
}

/** Arquivo efetivamente gerado, guardado no aparelho e ligado à sua versão. */
export interface ExportFile {
  id: ID;
  docId: ID;
  userId: ID;
  versionId: ID;
  version: number;
  format: ExportFormat;
  filename: string;
  mime: string;
  size: number;
  /** Páginas do PDF, quando conhecidas. */
  pages?: number;
  /** Versão do instrutor ou do participante; ausente quando não há essa divisão. */
  edition?: ExportEdition;
  blob: Blob;
  createdAt: number;
}
