import { Fragment, type ReactNode } from 'react';
import { findReferences, hubBibleLink } from '../../core/bible';
import { useHubUrl } from './useHubUrl';

/**
 * O texto de uma seção desenhado com as convenções do app: destaque (`> `),
 * lista (`- `), glossário (`Termo: definição`) e referências bíblicas, que
 * viram link para o Hub Bible quando o endereço dele está configurado.
 */
export function WithRefs({ text }: { text: string }) {
  const hubUrl = useHubUrl();
  const refs = findReferences(text);
  if (!refs.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let last = 0;
  refs.forEach((r, i) => {
    const raw = r.raw;
    out.push(text.slice(last, r.index));
    const href = hubBibleLink(hubUrl, r);
    out.push(
      href ? (
        <a key={i} className="xr-ref" href={href} target="_blank" rel="noopener noreferrer" title={`Abrir ${r.label} no Hub Bible`}>
          {raw}
        </a>
      ) : (
        <span key={i} className="xr-ref" title={r.label}>
          {raw}
        </span>
      ),
    );
    last = r.index + raw.length;
  });
  out.push(text.slice(last));
  return (
    <>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  );
}

const DEFINITION = /^\s*([\p{L}][\p{L}\s'’-]{1,48}?)\s*[:–—]\s+(.{8,})$/u;

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) {
      const p = para.join(' ');
      blocks.push(
        <p key={blocks.length} className="xr-p">
          <WithRefs text={p} />
        </p>,
      );
    }
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="xr-ul">
          {list.map((item, i) => (
            <li key={i}>
              <WithRefs text={item} />
            </li>
          ))}
        </ul>,
      );
    }
    list = [];
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^>\s?(.*)$/.exec(line);
    const l = /^(?:[-*•]|\d+[.)])\s+(?:\[\s?[xX]?\]\s*)?(.*)$/.exec(line);
    const d = DEFINITION.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push(
        <div key={blocks.length} className="xr-highlight">
          <WithRefs text={h[1]} />
        </div>,
      );
    } else if (l) {
      flushPara();
      list.push(l[1]);
    } else if (d && d[1].split(/\s+/).length <= 5 && !/\d/.test(d[1])) {
      flushPara();
      flushList();
      blocks.push(
        <p key={blocks.length} className="xr-p">
          <strong>{d[1]}:</strong> <WithRefs text={d[2]} />
        </p>,
      );
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="xr-rich">{blocks.length ? blocks : <p className="dim small">Esta parte ainda está sem texto.</p>}</div>;
}
