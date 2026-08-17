import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { BookPicker } from '../bible/BookPicker';
import { TranslationPicker } from '../bible/TranslationPicker';
import { VerseActionBar } from '../bible/VerseActionBar';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName } from '../../core/bible/canon';
import { categoryColor } from '../../core/categories';
import { formatSelection, parseReference } from '../../core/bible/reference';
import { getChapter, getMeta, loadCatalog } from '../../core/bible/repository';
import { listChapterHighlights, setHighlight } from '../../core/data/highlights';
import { addFavorite, findFavoriteFor, removeFavorite } from '../../core/data/favorites';
import { copyToClipboard } from '../../core/share/share';

const DEFAULT_BOOK = 'JHN';

/**
 * A Bíblia na tela dividida — a mesma de sempre, em coluna estreita.
 *
 * Não é um resumo do leitor nem um apêndice do material que está ao lado: abre
 * onde a leitura parou, troca de livro e de tradução, mostra as marcações que
 * já existem e deixa marcar, favoritar e copiar versículo durante a aula ou a
 * pregação. O que muda daqui vale no leitor, e vice-versa.
 *
 * Quando vem de um sermão, ela ainda acompanha a referência do ponto — mas
 * basta navegar para assumir o controle, e "Voltar ao texto" devolve o passo.
 */
export function ScripturePane({ reference }: { reference?: string } = {}) {
  const { settings, update } = useSettings();
  const { notify } = useToast();
  const [translation, setTranslation] = useState(settings.defaultTranslation);
  const [book, setBook] = useState(settings.lastPosition?.book ?? DEFAULT_BOOK);
  const [chapter, setChapter] = useState(settings.lastPosition?.chapter ?? 1);
  const [highlight, setHighlightVerse] = useState<number | null>(null);
  const [manual, setManual] = useState(false);
  const [picker, setPicker] = useState(false);
  const [translationPicker, setTranslationPicker] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [pickingHighlight, setPickingHighlight] = useState(false);

  // segue a referência do sermão enquanto o usuário não navegar por conta própria
  useEffect(() => {
    const parsed = reference ? parseReference(reference) : null;
    if (!parsed) return;
    setBook(parsed.book);
    setChapter(parsed.chapter);
    setHighlightVerse(parsed.verse ?? null);
    setManual(false);
  }, [reference]);

  const meta = useAsync(() => getMeta(translation), [translation]);
  const catalog = useAsync(() => loadCatalog(), []);
  const verses = useAsync(() => getChapter(translation, book, chapter), [translation, book, chapter]);
  const highlights = useLiveQuery(
    () => listChapterHighlights(translation, book, chapter),
    [translation, book, chapter],
    [],
  );

  const totalChapters = useMemo(
    () => meta.data?.books.find((b) => b.osis === book)?.chapters ?? 1,
    [meta.data, book],
  );
  const highlightByVerse = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of highlights ?? []) map.set(h.verse, h.category);
    return map;
  }, [highlights]);

  /** Toda navegação daqui é leitura de verdade: guarda onde parou. */
  const goTo = (nextBook: string, nextChapter: number) => {
    setBook(nextBook);
    setChapter(nextChapter);
    setHighlightVerse(null);
    setSelection([]);
    setManual(true);
    update({ lastPosition: { translation, book: nextBook, chapter: nextChapter, at: Date.now() } });
  };

  const move = (delta: number) => {
    const next = chapter + delta;
    if (next < 1 || next > totalChapters) return;
    goTo(book, next);
  };

  useEffect(() => {
    document.querySelector('.pane-verse.target')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [verses.data, highlight]);

  /* ------------------------------ ações do versículo ----------------------- */

  const rows = verses.data ?? [];
  const selectionReference = formatSelection(book, chapter, selection);
  const selectionText = selection.map((v) => rows[v - 1]).filter(Boolean).join(' ');

  const applyHighlight = async (categoryId: string | null) => {
    for (const verse of selection) {
      await setHighlight(translation, book, chapter, verse, categoryId);
    }
    setPickingHighlight(false);
    setSelection([]);
    notify(categoryId ? 'Marcado.' : 'Marcação removida.');
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
          text: rows[verse - 1] ?? '',
          category: 'promessas',
        });
        added += 1;
      }
    }
    setSelection([]);
    notify(added ? `${added} versículo(s) nos favoritos.` : `${removed} removido(s) dos favoritos.`);
  };

  return (
    <aside
      className="preach-pane"
      aria-label="Bíblia"
      style={{ '--pane-scale': settings.panelScale } as React.CSSProperties}
    >
      <header className="preach-pane-head">
        <button
          className="icon-btn"
          onClick={() => move(-1)}
          aria-label="Capítulo anterior"
          disabled={chapter <= 1}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        {/* o nome do livro é o botão para trocar de livro: é onde a mão vai */}
        <button
          className="preach-pane-ref truncate"
          onClick={() => setPicker(true)}
          aria-label="Trocar de livro ou capítulo"
        >
          {bookName(book)} {chapter}
          <Icon name="chevron-down" size={15} className="dim" />
        </button>
        <button
          className="icon-btn"
          onClick={() => move(1)}
          aria-label="Próximo capítulo"
          disabled={chapter >= totalChapters}
        >
          <Icon name="chevron-right" size={18} />
        </button>
        <button
          className="chip"
          style={{ minHeight: 34, fontSize: '0.72rem' }}
          onClick={() => setTranslationPicker(true)}
          aria-label="Trocar de tradução"
        >
          {meta.data?.abbrev ?? translation}
        </button>
        {/* o tamanho da letra daqui é independente do leitor e do sermão:
            na tela dividida, cada lado pede um corpo diferente */}
        <button
          className="icon-btn"
          onClick={() => update({ panelScale: Math.max(0.6, Number((settings.panelScale - 0.1).toFixed(2))) })}
          aria-label="Diminuir a letra da Bíblia"
        >
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>A-</span>
        </button>
        <button
          className="icon-btn"
          onClick={() => update({ panelScale: Math.min(2, Number((settings.panelScale + 0.1).toFixed(2))) })}
          aria-label="Aumentar a letra da Bíblia"
        >
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>A+</span>
        </button>
      </header>

      {manual && reference && (
        <button className="btn btn-sm btn-ghost pane-back" onClick={() => {
          const parsed = parseReference(reference);
          if (!parsed) return;
          setBook(parsed.book);
          setChapter(parsed.chapter);
          setHighlightVerse(parsed.verse ?? null);
          setSelection([]);
          setManual(false);
        }}>
          ← Voltar ao texto do sermão
        </button>
      )}

      <div className="preach-pane-body">
        {verses.loading && <p className="small dim center">Carregando…</p>}
        {rows.map((text, index) => {
          const verse = index + 1;
          const category = highlightByVerse.get(verse);
          const classes = [
            'pane-verse',
            highlight === verse ? 'target' : '',
            selection.includes(verse) ? 'selected' : '',
            category ? 'highlighted' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <p
              key={verse}
              className={classes}
              style={
                category ? ({ '--hl-color': categoryColor(category) } as React.CSSProperties) : undefined
              }
              onClick={() =>
                setSelection((prev) =>
                  prev.includes(verse) ? prev.filter((v) => v !== verse) : [...prev, verse].sort((a, b) => a - b),
                )
              }
              role="button"
              tabIndex={0}
            >
              <span className="verse-num">{verse}</span>
              {text}
            </p>
          );
        })}
      </div>

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
            { id: 'hl', icon: 'highlighter', label: 'Destacar', onClick: () => setPickingHighlight(true) },
            { id: 'fav', icon: 'star', label: 'Favoritar', onClick: toggleFavorites },
            {
              id: 'copy',
              icon: 'copy',
              label: 'Copiar',
              onClick: async () => {
                const ok = await copyToClipboard(
                  `${selectionText}\n— ${selectionReference} (${meta.data?.abbrev ?? translation})`,
                );
                notify(ok ? 'Copiado.' : 'Não foi possível copiar.', ok ? 'default' : 'error');
                setSelection([]);
              },
            },
          ]}
        />
      )}

      <BookPicker
        open={picker}
        books={meta.data?.books ?? []}
        book={book}
        chapter={chapter}
        onClose={() => setPicker(false)}
        onSelect={(nextBook, nextChapter) => {
          setPicker(false);
          goTo(nextBook, nextChapter);
        }}
      />

      {/* a tradução escolhida aqui vale só para este painel: numa aula dá para
          ler noutra versão sem mexer no leitor que ficou aberto atrás */}
      <TranslationPicker
        open={translationPicker}
        translations={catalog.data ?? []}
        current={translation}
        compare={null}
        onClose={() => setTranslationPicker(false)}
        onSelect={(id) => {
          setTranslationPicker(false);
          setTranslation(id);
        }}
        onCompare={() => undefined}
        onImported={() => catalog.reload()}
      />
    </aside>
  );
}
