import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { BookPicker } from '../bible/BookPicker';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName } from '../../core/bible/canon';
import { parseReference } from '../../core/bible/reference';
import { getChapter, getMeta } from '../../core/bible/repository';

/**
 * Painel de leitura para a tela dividida do Modo Pregação.
 *
 * Acompanha a referência do ponto que está sendo pregado: ao avançar para um
 * tópico com outro texto, o painel muda de capítulo sozinho — mas o pregador
 * pode navegar livremente sem perder o passo do sermão.
 */
export function ScripturePane({ reference }: { reference?: string } = {}) {
  const { settings, update } = useSettings();
  const [book, setBook] = useState('JHN');
  const [chapter, setChapter] = useState(1);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [manual, setManual] = useState(false);
  const [picker, setPicker] = useState(false);

  // segue a referência do sermão enquanto o usuário não navegar por conta própria
  useEffect(() => {
    const parsed = reference ? parseReference(reference) : null;
    if (!parsed) return;
    setBook(parsed.book);
    setChapter(parsed.chapter);
    setHighlight(parsed.verse ?? null);
    setManual(false);
  }, [reference]);

  const meta = useAsync(() => getMeta(settings.defaultTranslation), [settings.defaultTranslation]);
  const verses = useAsync(
    () => getChapter(settings.defaultTranslation, book, chapter),
    [settings.defaultTranslation, book, chapter],
  );

  const totalChapters = useMemo(
    () => meta.data?.books.find((b) => b.osis === book)?.chapters ?? 1,
    [meta.data, book],
  );

  const move = (delta: number) => {
    const next = chapter + delta;
    if (next < 1 || next > totalChapters) return;
    setChapter(next);
    setHighlight(null);
    setManual(true);
  };

  useEffect(() => {
    document.querySelector('.pane-verse.target')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [verses.data, highlight]);

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
        {manual && reference && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const parsed = parseReference(reference);
              if (!parsed) return;
              setBook(parsed.book);
              setChapter(parsed.chapter);
              setHighlight(parsed.verse ?? null);
              setManual(false);
            }}
          >
            Voltar ao texto
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => move(1)}
          aria-label="Próximo capítulo"
          disabled={chapter >= totalChapters}
        >
          <Icon name="chevron-right" size={18} />
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

      <div className="preach-pane-body">
        {verses.loading && <p className="small dim center">Carregando…</p>}
        {(verses.data ?? []).map((text, index) => {
          const number = index + 1;
          return (
            <p
              key={number}
              className={`pane-verse${highlight === number ? ' target' : ''}`}
            >
              <span className="verse-num">{number}</span>
              {text}
            </p>
          );
        })}
      </div>

      <BookPicker
        open={picker}
        books={meta.data?.books ?? []}
        book={book}
        chapter={chapter}
        onClose={() => setPicker(false)}
        onSelect={(nextBook, nextChapter) => {
          setPicker(false);
          setBook(nextBook);
          setChapter(nextChapter);
          setHighlight(null);
          // escolha do usuário manda: o painel para de seguir a referência do
          // ponto até ele tocar em "Voltar ao texto"
          setManual(true);
        }}
      />
    </aside>
  );
}
