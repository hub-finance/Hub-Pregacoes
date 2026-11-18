import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { TextSizeControl } from '../../components/TextSizeControl';
import { SidePanel } from '../../components/SidePanel';
import { useAsync, useIsWide } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { findInlineReferences, type ParsedReference } from '../../core/bible/reference';
import { validateReferences } from '../../core/ai/provider';
import type { Para } from '../../core/export/inline';
import type { RenderDoc, RenderNode } from '../../core/export/model';
import { VersePreview, previewLabel, type PreviewTarget } from '../bible/VersePreview';

/**
 * O documento para estudar, não para conferir a folha: texto corrido na letra
 * de leitura e toda referência bíblica do texto ("Sl 23:1", "Jo 10.11") como
 * link que abre o versículo na Bíblia em uso — como no Assistente bíblico.
 *
 * Só vira link a referência que existe na tradução: "Ef 99:9" fica como texto.
 * Nada aqui altera o documento nem os arquivos gerados.
 */

interface Props {
  doc: RenderDoc;
}

function nodeTexts(node: RenderNode): string[] {
  const join = (p: Para) => p.map((r) => r.text).join('');
  switch (node.t) {
    case 'heading': return [node.text];
    case 'para': return [join(node.runs)];
    case 'highlight': return node.paras.map(join);
    case 'quote': return [...node.paras.map(join), node.reference ?? ''];
    case 'list': return node.items.map(join);
    case 'table': return node.rows.flat();
  }
}

export function StudyTab({ doc }: Props) {
  const { settings } = useSettings();
  const translation = settings.defaultTranslation;
  const isWide = useIsWide();
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const found = useMemo(() => {
    const labels = new Set<string>();
    for (const n of doc.nodes) for (const t of nodeTexts(n)) for (const m of findInlineReferences(t)) labels.add(m.text);
    return [...labels];
  }, [doc]);
  const checked = useAsync(
    () => (found.length ? validateReferences(translation, found).catch(() => [] as string[]) : Promise.resolve([] as string[])),
    [translation, found.join('|')],
  );
  const valid = useMemo(() => new Set(checked.data ?? []), [checked.data]);

  const open = (ref: ParsedReference) => setPreview({ book: ref.book, chapter: ref.chapter, verse: ref.verse ?? 1, verseEnd: ref.verseEnd });

  /** Um trecho de texto com as referências feitas botão. */
  const linked = (text: string, key: string): ReactNode => {
    const matches = findInlineReferences(text).filter((m) => valid.has(m.text));
    if (!matches.length) return text;
    const out: ReactNode[] = [];
    let at = 0;
    matches.forEach((m, i) => {
      if (m.index > at) out.push(text.slice(at, m.index));
      out.push(
        <button key={`${key}-${i}`} type="button" className="ref-link" onClick={() => open(m.ref)}>
          {m.text}
        </button>,
      );
      at = m.index + m.length;
    });
    if (at < text.length) out.push(text.slice(at));
    return out;
  };

  const para = (p: Para, key: string): ReactNode =>
    p.map((r, i) => {
      const k = `${key}-${i}`;
      const parts = r.text.split('\n');
      let content: ReactNode = parts.map((line, j) => (
        <Fragment key={j}>{j > 0 && <br />}{linked(line, `${k}-${j}`)}</Fragment>
      ));
      if (r.italic) content = <em>{content}</em>;
      if (r.bold) content = <strong>{content}</strong>;
      return <Fragment key={k}>{content}</Fragment>;
    });

  const body = doc.nodes.map((n, i) => {
    const key = `n${i}`;
    switch (n.t) {
      case 'heading':
        return n.level === 1 ? <h2 key={key}>{linked(n.text, key)}</h2> : <h3 key={key}>{linked(n.text, key)}</h3>;
      case 'para':
        return <p key={key}>{para(n.runs, key)}</p>;
      case 'highlight':
        return <div key={key} className="xp-study-highlight">{n.paras.map((p, j) => <p key={j}>{para(p, `${key}-${j}`)}</p>)}</div>;
      case 'quote':
        return (
          <blockquote key={key}>
            {n.paras.map((p, j) => <p key={j}>{para(p, `${key}-${j}`)}</p>)}
            {n.reference && <p className="xp-study-ref">— {linked(n.reference, `${key}-r`)}</p>}
          </blockquote>
        );
      case 'list': {
        const items = n.items.map((p, j) => <li key={j}>{para(p, `${key}-${j}`)}</li>);
        return n.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case 'table':
        return (
          <div key={key} className="xp-study-table">
            <table>
              <tbody>
                {n.rows.map((row, r) => (
                  <tr key={r}>{row.map((c, ci) => (r === 0 ? <th key={ci}>{linked(c, `${key}-${r}-${ci}`)}</th> : <td key={ci}>{linked(c, `${key}-${r}-${ci}`)}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });

  const previewBody = preview && (
    <VersePreview target={preview} translation={translation} onBack={() => setPreview(null)} onNavigate={() => setPreview(null)} />
  );

  return (
    <div className={`xp-study-layout${isWide && preview ? ' has-panel' : ''}`}>
      <div className="xp-study-main">
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
          <TextSizeControl />
        </div>
        <p className="small dim" style={{ margin: '0 0 var(--sp-3)' }}>
          {valid.size
            ? `Toque numa referência para ler o versículo na sua Bíblia. ${valid.size} ${valid.size === 1 ? 'referência encontrada' : 'referências encontradas'}.`
            : checked.loading
              ? 'Conferindo as referências…'
              : 'Nenhuma referência bíblica encontrada no texto.'}
        </p>
        <article className="card xp-study">
          <h1>{doc.title}</h1>
          {body}
        </article>
      </div>
      {isWide ? (
        <SidePanel open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </SidePanel>
      ) : (
        <Sheet open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </Sheet>
      )}
    </div>
  );
}
