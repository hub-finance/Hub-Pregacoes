import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookPicker } from './BookPicker';
import { TranslationPicker } from './TranslationPicker';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { VerseActionBar } from './VerseActionBar';
import { ShareSheet } from '../share/ShareSheet';
import { Sheet } from '../../components/Sheet';
import { Spinner, TextArea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { db } from '../../core/db/db';
import { bookName } from '../../core/bible/canon';
import { formatSelection } from '../../core/bible/reference';
import { getChapter, getMeta, loadCatalog } from '../../core/bible/repository';
import { categoryColor } from '../../core/categories';
import { listChapterHighlights, setHighlight } from '../../core/data/highlights';
import { addFavorite, findFavoriteFor, removeFavorite } from '../../core/data/favorites';
import { createNote } from '../../core/data/notes';
import { registerReading } from '../../core/data/reading';
import { newSermon, newStudy, saveDoc } from '../../core/data/documents';
import { copyToClipboard } from '../../core/share/share';

const DEFAULT_BOOK = 'JHN';

/**
 * Leitor bíblico.
 *
 * Fluxo: tradução → livro → capítulo → versículo. A tela mantém o texto no
 * centro; toda ação ministerial acontece por seleção de versículo, sem poluir
 * a leitura.
 */
export default function BiblePage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings, update } = useSettings();

  const catalog = useAsync(() => loadCatalog(true), []);
  const availableIds = useMemo(
    () => (catalog.data ?? []).filter((t) => t.bundled || t.imported).map((t) => t.id),
    [catalog.data],
  );
  const translation =
    availableIds.includes(settings.defaultTranslation)
      ? settings.defaultTranslation
      : (availableIds[0] ?? settings.defaultTranslation);

  const meta = useAsync(() => getMeta(translation), [translation]);

  const book = params.book?.toUpperCase() || settings.lastPosition?.book || DEFAULT_BOOK;
  const chapter = Number(params.chapter) || settings.lastPosition?.chapter || 1;

  const chapterText = useAsync(() => getChapter(translation, book, chapter), [translation, book, chapter]);
  const compareText = useAsync(
    () =>
      settings.compareTranslation
        ? getChapter(settings.compareTranslation, book, chapter)
        : Promise.resolve<string[]>([]),
    [settings.compareTranslation, book, chapter],
  );

  const highlights = useLiveQuery(
    () => listChapterHighlights(translation, book, chapter),
    [translation, book, chapter],
    [],
  );
  const chapterFavorites = useLiveQuery(
    async () => {
      const rows = await db.favorites.toArray();
      return rows.filter((f) => f.ref.book === book && f.ref.chapter === chapter);
    },
    [book, chapter],
    [],
  );
  const chapterNotes = useLiveQuery(
    async () => {
      const rows = await db.notes.toArray();
      return rows.filter((n) => n.ref?.book === book && n.ref?.chapter === chapter);
    },
    [book, chapter],
    [],
  );

  const [selection, setSelection] = useState<number[]>([]);
  const [pickingHighlight, setPickingHighlight] = useState(false);
  const [bookPicker, setBookPicker] = useState(false);
  const [translationPicker, setTranslationPicker] = useState(false);
  const [readerSettings, setReaderSettings] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const readerRef = useRef<HTMLDivElement>(null);

  const bookInfo = meta.data?.books.find((b) => b.osis === book);
  const totalChapters = bookInfo?.chapters ?? 1;
  const verses = chapterText.data ?? [];

  /* ------------------------- posição e histórico ------------------------- */

  useEffect(() => {
    if (!params.book && settings.lastPosition) {
      navigate(`/biblia/${settings.lastPosition.book}/${settings.lastPosition.chapter}`, {
        replace: true,
      });
    }
    // executa apenas na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!verses.length) return;
    update({ lastPosition: { translation, book, chapter, at: Date.now() } });
    registerReading(translation, book, chapter).catch(() => undefined);
    setSelection([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translation, book, chapter, verses.length]);

  // âncora ?v=12 — abre o capítulo já no versículo pedido
  useEffect(() => {
    const target = Number(searchParams.get('v'));
    if (!target || !verses.length) return;
    const el = document.getElementById(`v-${target}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setSelection([target]);
    }
  }, [searchParams, verses.length]);

  const goToChapter = useCallback(
    (nextBook: string, nextChapter: number) => {
      setSearchParams({}, { replace: true });
      navigate(`/biblia/${nextBook}/${nextChapter}`);
      readerRef.current?.scrollIntoView({ block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate, setSearchParams],
  );

  const prev = useCallback(() => {
    if (chapter > 1) return goToChapter(book, chapter - 1);
    const books = meta.data?.books ?? [];
    const index = books.findIndex((b) => b.osis === book);
    if (index > 0) goToChapter(books[index - 1].osis, books[index - 1].chapters);
  }, [book, chapter, goToChapter, meta.data]);

  const next = useCallback(() => {
    if (chapter < totalChapters) return goToChapter(book, chapter + 1);
    const books = meta.data?.books ?? [];
    const index = books.findIndex((b) => b.osis === book);
    if (index >= 0 && index < books.length - 1) goToChapter(books[index + 1].osis, 1);
  }, [book, chapter, goToChapter, meta.data, totalChapters]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  /* ------------------------------- seleção ------------------------------- */

  const toggleVerse = (verse: number) =>
    setSelection((prevSel) =>
      prevSel.includes(verse) ? prevSel.filter((v) => v !== verse) : [...prevSel, verse].sort((a, b) => a - b),
    );

  const selectionReference = formatSelection(book, chapter, selection);
  const selectionText = selection.map((v) => verses[v - 1]).filter(Boolean).join(' ');
  const translationLabel = meta.data?.abbrev ?? translation;

  const highlightByVerse = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of highlights ?? []) map.set(h.verse, h.category);
    return map;
  }, [highlights]);

  const favoriteVerses = useMemo(
    () => new Set((chapterFavorites ?? []).map((f) => f.ref.verse)),
    [chapterFavorites],
  );
  const notedVerses = useMemo(
    () => new Set((chapterNotes ?? []).map((n) => n.ref?.verse).filter(Boolean) as number[]),
    [chapterNotes],
  );

  /* -------------------------------- ações -------------------------------- */

  const applyHighlight = async (categoryId: string | null) => {
    for (const verse of selection) {
      await setHighlight(translation, book, chapter, verse, categoryId);
    }
    setPickingHighlight(false);
    notify(categoryId ? 'Marcação aplicada.' : 'Marcação removida.');
  };

  const toggleFavorites = async () => {
    let added = 0;
    let removed = 0;
    for (const verse of selection) {
      const existing = await findFavoriteFor(book, chapter, verse);
      if (existing) {
        await removeFavorite(existing.id);
        removed += 1;
      } else {
        await addFavorite({
          ref: { translation, book, chapter, verse },
          reference: `${bookName(book)} ${chapter}:${verse}`,
          text: verses[verse - 1] ?? '',
          category: 'promessas',
        });
        added += 1;
      }
    }
    notify(added ? `${added} versículo(s) nos favoritos.` : `${removed} removido(s) dos favoritos.`);
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    await createNote({
      targetType: 'verse',
      reference: selectionReference,
      content: noteText.trim(),
      ref: {
        translation,
        book,
        chapter,
        verse: selection[0] ?? 1,
        verseEnd: selection.length > 1 ? selection[selection.length - 1] : undefined,
      },
    });
    setNoteText('');
    setNoteOpen(false);
    notify('Anotação salva.');
  };

  const createFromSelection = async (kind: 'study' | 'sermon') => {
    if (kind === 'study') {
      const study = { ...newStudy(), title: selectionReference, mainText: selectionReference, introduction: selectionText };
      await saveDoc('study', study);
      navigate(`/estudos/${study.id}`);
    } else {
      const sermon = { ...newSermon(), title: selectionReference, mainText: selectionReference, mainTextContent: selectionText };
      await saveDoc('sermon', sermon);
      navigate(`/sermoes/${sermon.id}`);
    }
  };

  /* ------------------------------- render -------------------------------- */

  if (catalog.loading || meta.loading) return <Spinner label="Abrindo a Bíblia…" />;

  if (chapterText.error) {
    return (
      <div className="page">
        <div className="notice" style={{ borderColor: 'var(--danger)' }}>
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Não foi possível abrir este capítulo.</strong>
            <p className="small" style={{ marginTop: 4 }}>
              {chapterText.error.message}
            </p>
            <button className="btn btn-sm" style={{ marginTop: 'var(--sp-3)' }} onClick={chapterText.reload}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ padding: 'var(--sp-3) var(--sp-4) 0', gap: 'var(--sp-2)' }}>
        <button className="chip" onClick={() => setBookPicker(true)} style={{ fontWeight: 650 }}>
          📖 {bookName(book)} {chapter}
        </button>
        <button className="chip" onClick={() => setTranslationPicker(true)}>
          {translationLabel}
        </button>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => setReaderSettings(true)} aria-label="Ajustes de leitura">
          Aa
        </button>
        <button
          className="icon-btn"
          onClick={() => navigate(`/pregacao?ref=${encodeURIComponent(`${book} ${chapter}`)}`)}
          aria-label="Modo pregação"
        >
          🕮
        </button>
      </div>

      <article className="reader" ref={readerRef}>
        <header className="reader-head">
          <h1 className="reader-book">{bookName(book)}</h1>
          <p className="reader-chapter-label">
            Capítulo {chapter} · {translationLabel}
          </p>
        </header>

        {chapterText.loading ? (
          <Spinner label="Carregando capítulo…" />
        ) : (
          <div className={`reader-verses ${settings.verseLayout}`}>
            {verses.map((text, index) => {
              const verse = index + 1;
              const category = highlightByVerse.get(verse);
              const classes = [
                'verse',
                selection.includes(verse) ? 'selected' : '',
                category ? 'highlighted' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <span
                  key={verse}
                  id={`v-${verse}`}
                  className={classes}
                  style={category ? ({ '--hl-color': categoryColor(category) } as React.CSSProperties) : undefined}
                  onClick={() => toggleVerse(verse)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleVerse(verse);
                    }
                  }}
                  aria-label={`Versículo ${verse}`}
                >
                  <span className="verse-num">{verse}</span>
                  {text}
                  {favoriteVerses.has(verse) && (
                    <span className="verse-mark" title="Favorito" aria-label="Favorito">
                      ⭐
                    </span>
                  )}
                  {notedVerses.has(verse) && (
                    <span className="verse-mark" title="Com anotação" aria-label="Com anotação">
                      📝
                    </span>
                  )}{' '}
                  {settings.compareTranslation && compareText.data?.[index] && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.86em',
                        color: 'var(--text-3)',
                        margin: '0.35em 0 0.8em',
                        paddingLeft: '0.8em',
                        borderLeft: '2px solid var(--border)',
                      }}
                    >
                      {compareText.data[index]}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </article>

      <nav className="reader-nav" aria-label="Navegação de capítulos">
        <button className="btn btn-ghost" onClick={prev}>
          ← Anterior
        </button>
        <button className="btn btn-ghost mono-num" onClick={() => setBookPicker(true)}>
          {chapter} / {totalChapters}
        </button>
        <button className="btn btn-ghost" onClick={next}>
          Próximo →
        </button>
      </nav>

      {selection.length > 0 && (
        <VerseActionBar
          reference={selectionReference}
          highlightOpen={pickingHighlight}
          onPickHighlight={applyHighlight}
          onClear={() => {
            setSelection([]);
            setPickingHighlight(false);
          }}
          actions={[
            { id: 'hl', icon: '🖍️', label: 'Destacar', onClick: () => setPickingHighlight(true) },
            { id: 'fav', icon: '⭐', label: 'Favoritar', onClick: toggleFavorites },
            { id: 'note', icon: '📝', label: 'Anotar', onClick: () => setNoteOpen(true) },
            { id: 'share', icon: '📤', label: 'Compartilhar', onClick: () => setShareOpen(true) },
            {
              id: 'copy',
              icon: '📋',
              label: 'Copiar',
              onClick: async () => {
                const ok = await copyToClipboard(`${selectionText}\n— ${selectionReference} (${translationLabel})`);
                notify(ok ? 'Copiado.' : 'Não foi possível copiar.', ok ? 'default' : 'error');
              },
            },
            { id: 'study', icon: '📚', label: 'Estudo', onClick: () => createFromSelection('study') },
            { id: 'sermon', icon: '🎙️', label: 'Sermão', onClick: () => createFromSelection('sermon') },
          ]}
        />
      )}

      <BookPicker
        open={bookPicker}
        books={meta.data?.books ?? []}
        book={book}
        chapter={chapter}
        onClose={() => setBookPicker(false)}
        onSelect={(b, c) => {
          setBookPicker(false);
          goToChapter(b, c);
        }}
      />

      <TranslationPicker
        open={translationPicker}
        translations={catalog.data ?? []}
        current={translation}
        compare={settings.compareTranslation}
        onClose={() => setTranslationPicker(false)}
        onSelect={(id) => update({ defaultTranslation: id })}
        onCompare={(id) => update({ compareTranslation: id })}
      />

      <ReaderSettingsSheet open={readerSettings} onClose={() => setReaderSettings(false)} />

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        reference={selectionReference}
        text={selectionText}
        translationLabel={translationLabel}
      />

      <Sheet
        open={noteOpen}
        title={`Anotar — ${selectionReference}`}
        onClose={() => setNoteOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setNoteOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveNote}>
              Salvar anotação
            </button>
          </>
        }
      >
        <blockquote
          style={{
            fontFamily: 'var(--font-reader)',
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 'var(--sp-3)',
            color: 'var(--text-2)',
            lineHeight: 1.6,
          }}
        >
          {selectionText}
        </blockquote>
        <TextArea
          label="Sua anotação"
          value={noteText}
          onChange={setNoteText}
          rows={6}
          placeholder="O que Deus falou com você neste texto?"
        />
      </Sheet>
    </>
  );
}
