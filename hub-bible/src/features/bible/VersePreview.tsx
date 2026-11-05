import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getChapter } from '../../core/bible/repository';
import { bookName } from '../../core/bible/canon';

export interface PreviewTarget {
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
}

export const previewLabel = (t: PreviewTarget) =>
  `${bookName(t.book)} ${t.chapter}:${t.verse}${t.verseEnd && t.verseEnd > t.verse ? `-${t.verseEnd}` : ''}`;

interface Props {
  target: PreviewTarget;
  translation: string;
  onBack: () => void;
  /** Chamado antes de ir ao leitor — fecha a folha, no celular. */
  onNavigate?: () => void;
}

/**
 * O versículo tocado dentro de um painel (comentário, referências), aberto no
 * mesmo lugar, como a prévia da busca: o capítulo com o trecho destacado.
 */
export function VersePreview({ target, translation, onBack, onNavigate }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const chapter = useAsync(
    () => getChapter(translation, target.book, target.chapter).catch(() => [] as string[]),
    [translation, target.book, target.chapter],
  );
  const end = target.verseEnd && target.verseEnd > target.verse ? target.verseEnd : target.verse;

  useEffect(() => {
    if (!chapter.data?.length) return;
    ref.current
      ?.querySelector(`[data-v="${target.verse}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [chapter.data, target.verse]);

  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }} ref={ref}>
      <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="chevron-left" size={18} />
          Voltar
        </button>
        <strong className="truncate" style={{ flex: 1, minWidth: 0 }}>{previewLabel(target)}</strong>
      </div>

      {chapter.loading && <Spinner />}
      {chapter.data && !chapter.data.length && (
        <p className="dim">Esta passagem não está na tradução em uso.</p>
      )}
      {!!chapter.data?.length && (
        <div className="verse-preview-context">
          {chapter.data.map((text, i) => {
            const v = i + 1;
            return (
              <p key={v} data-v={v} className={`verse-preview-line${v >= target.verse && v <= end ? ' current' : ''}`}>
                <sup className="verse-num">{v}</sup> {text}
              </p>
            );
          })}
        </div>
      )}

      <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            onNavigate?.();
            navigate(`/biblia/${target.book}/${target.chapter}?v=${target.verse}`);
          }}
        >
          <Icon name="book" size={16} />
          Abrir no leitor
        </button>
      </div>
    </div>
  );
}

const scroller = (el: Element | null) => el?.closest('.side-panel-body, .sheet-body') ?? null;

/**
 * Abre e fecha a prévia guardando onde a lista estava: ao voltar, a rolagem
 * do painel retorna ao versículo que foi tocado, e não ao topo.
 */
export function usePreview() {
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const saved = useRef<{ box: Element | null; top: number }>({ box: null, top: 0 });

  const open = useCallback((next: PreviewTarget, from?: Element | null) => {
    const box = scroller(from ?? null);
    saved.current = { box, top: box?.scrollTop ?? 0 };
    setTarget(next);
    if (box) box.scrollTop = 0;
  }, []);

  const back = useCallback(() => {
    setTarget(null);
    const { box, top } = saved.current;
    if (box) requestAnimationFrame(() => { box.scrollTop = top; });
  }, []);

  return { target, open, back };
}
