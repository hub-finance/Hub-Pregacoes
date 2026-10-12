import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Para } from '../../core/export/inline';
import { metaLine, NOTES_LINES, tocEntries, type RenderDoc, type RenderNode } from '../../core/export/model';
import { MARGINS_MM, PAGE_MM } from '../../core/export/themes';
import '../../styles/export.css';

/**
 * Visualização imediata do documento, desenhada a partir da mesma estrutura
 * que gera o Word e o PDF — mesma ordem, mesmos títulos, mesmas fontes (as do
 * PDF), mesmas cores e proporções da folha.
 *
 * A folha é desenhada no tamanho real (em pontos) e reduzida para caber na
 * tela. O que esta vista não faz é paginar: o texto corre contínuo. A página a
 * página exata é a do botão "Ver o PDF", que gera o arquivo de verdade.
 */

const MM = 72 / 25.4;

/**
 * As fontes do PDF, registradas para a visualização. Pelo `FontFace` e não
 * por CSS porque o endereço precisa ser relativo à página — o app roda também
 * em subpasta e dentro do APK.
 */
let fontsRegistered = false;
function registerPreviewFonts() {
  if (fontsRegistered || typeof FontFace === 'undefined') return;
  fontsRegistered = true;
  const faces: Array<[string, string, string, string]> = [
    ['HubLora', 'Lora-Regular.ttf', 'normal', '400'],
    ['HubLora', 'Lora-Italic.ttf', 'italic', '400'],
    ['HubLora', 'Lora-Bold.ttf', 'normal', '700'],
    ['HubLora', 'Lora-BoldItalic.ttf', 'italic', '700'],
    ['HubSourceSans', 'SourceSans3-Regular.ttf', 'normal', '400'],
    ['HubSourceSans', 'SourceSans3-Italic.ttf', 'italic', '400'],
    ['HubSourceSans', 'SourceSans3-Bold.ttf', 'normal', '700'],
    ['HubSourceSans', 'SourceSans3-BoldItalic.ttf', 'italic', '700'],
  ];
  for (const [family, file, style, weight] of faces) {
    const face = new FontFace(family, `url(./fonts/${file})`, { style, weight });
    document.fonts.add(face);
    // sem a fonte, a visualização segue com a do sistema
    face.load().catch(() => undefined);
  }
}

function Runs({ para }: { para: Para }) {
  return (
    <>
      {para.map((run, i) => {
        if (run.text === '\n') return <br key={i} />;
        const style: CSSProperties = {
          fontWeight: run.bold ? 700 : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: run.underline || run.link ? 'underline' : undefined,
          color: run.color ? `#${run.color}` : undefined,
        };
        return (
          <span key={i} style={style}>
            {run.text}
          </span>
        );
      })}
    </>
  );
}

function Node({ node, doc }: { node: RenderNode; doc: RenderDoc }) {
  const { theme } = doc;
  switch (node.t) {
    case 'heading':
      return (
        <>
          {node.pageBreak && <div className="xp-break">nova página</div>}
          {node.level === 1 ? (
            <h2 className={`xp-h1${theme.headingRule ? ' ruled' : ''}`}>
              {theme.h1Uppercase ? node.text.toUpperCase() : node.text}
            </h2>
          ) : (
            <h3 className="xp-h2">{node.text}</h3>
          )}
        </>
      );
    case 'para':
      return (
        <p className="xp-p">
          <Runs para={node.runs} />
        </p>
      );
    case 'highlight':
      return (
        <div className="xp-highlight">
          {node.paras.map((p, i) => (
            <p key={i}>
              <Runs para={p} />
            </p>
          ))}
        </div>
      );
    case 'quote':
      return (
        <blockquote className="xp-quote">
          {node.paras.map((p, i) => (
            <p key={i}>
              <Runs para={p} />
            </p>
          ))}
          {node.reference && <cite>{node.reference}</cite>}
        </blockquote>
      );
    case 'list': {
      const items = node.items.map((item, i) => (
        <li key={i}>
          <Runs para={item} />
        </li>
      ));
      return node.ordered ? <ol className="xp-list">{items}</ol> : <ul className="xp-list">{items}</ul>;
    }
    case 'table':
      return (
        <table className="xp-table">
          <thead>
            <tr>
              {node.rows[0].map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.slice(1).map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function Sheet({ doc, scale, children, showChrome }: { doc: RenderDoc; scale: number; children: ReactNode; showChrome: boolean }) {
  const { layout } = doc;
  const page = PAGE_MM[layout.pageSize];
  const width = page.width * MM;
  const margin = MARGINS_MM[layout.margins] * MM;
  return (
    <div className="xp-sheet-wrap">
      {/* `zoom`, e não `transform`: com zoom a folha reduzida ocupa o espaço
          reduzido, e a rolagem acompanha o tamanho real do conteúdo */}
      <div
        className="xp-sheet"
        style={{ width, minHeight: page.height * MM, padding: margin, zoom: scale } as CSSProperties}
      >
        {showChrome && layout.header.trim() && <div className="xp-header">{layout.header}</div>}
        {children}
        {showChrome && (layout.footer.trim() || layout.pageNumbers) && (
          <div className="xp-footer" style={{ textAlign: layout.pageNumberAlign === 'right' ? 'right' : 'center' }}>
            {[layout.footer.trim(), layout.pageNumbers ? 'nº da página' : ''].filter(Boolean).join('  ·  ')}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExportPreview({ doc }: { doc: RenderDoc }) {
  const host = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    registerPreviewFonts();
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHostWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { layout, theme } = doc;
  const pageWidth = PAGE_MM[layout.pageSize].width * MM;
  const scale = hostWidth ? Math.min(1.25, hostWidth / pageWidth) : 0.5;
  const font = (kind: 'serif' | 'sans') => (kind === 'serif' ? "'HubLora', Georgia, serif" : "'HubSourceSans', Calibri, sans-serif");

  const vars = {
    '--xp-text': `#${theme.colors.text}`,
    '--xp-muted': `#${theme.colors.muted}`,
    '--xp-title': `#${theme.colors.title}`,
    '--xp-heading': `#${theme.colors.heading}`,
    '--xp-accent': `#${theme.colors.accent}`,
    '--xp-highlight': `#${theme.colors.highlightBg}`,
    '--xp-quote': `#${theme.colors.quoteBg}`,
    '--xp-body': font(theme.body),
    '--xp-head': font(theme.headings),
    '--xp-size': `${layout.fontSize}px`,
    '--xp-leading': String(layout.lineSpacing * 1.2),
    '--xp-title-size': `${layout.fontSize * theme.titleScale}px`,
    '--xp-h1-size': `${layout.fontSize * theme.h1Scale}px`,
    '--xp-h2-size': `${layout.fontSize * theme.h2Scale}px`,
    '--xp-align': theme.justify ? 'justify' : 'left',
  } as CSSProperties;

  const toc = tocEntries(doc);
  const meta = metaLine(layout);

  return (
    <div ref={host} className="xp" style={vars} aria-label="Visualização do documento">
      {layout.cover && (
        <Sheet doc={doc} scale={scale} showChrome={false}>
          <div className="xp-cover">
            {layout.logo && <img src={layout.logo.dataUrl} alt="Logotipo" style={{ width: Math.min(110, layout.logo.width) }} />}
            <div className="xp-cover-title">{doc.title}</div>
            {layout.subtitle.trim() && <div className="xp-cover-subtitle">{layout.subtitle}</div>}
            <div className="xp-cover-rule" />
            {[layout.author, layout.institution, layout.dateLabel]
              .filter((v) => v.trim())
              .map((v) => (
                <div key={v} className="xp-cover-meta">
                  {v}
                </div>
              ))}
          </div>
        </Sheet>
      )}

      {layout.toc && toc.length > 0 && (
        <Sheet doc={doc} scale={scale} showChrome>
          <h2 className="xp-h1">Sumário</h2>
          {toc.map((entry, i) => (
            <div key={i} className={`xp-toc${entry.level === 2 ? ' sub' : ''}`}>
              {entry.text}
            </div>
          ))}
          <p className="xp-note">Os números de página entram no arquivo final.</p>
        </Sheet>
      )}

      <Sheet doc={doc} scale={scale} showChrome>
        {!layout.cover && (
          <>
            <div className="xp-title">{doc.title}</div>
            {layout.subtitle.trim() && <div className="xp-subtitle">{layout.subtitle}</div>}
            {meta && <div className="xp-meta">{meta}</div>}
          </>
        )}
        {doc.nodes.map((node, i) => (
          <Node key={i} node={node} doc={doc} />
        ))}
        {layout.notesSpace && (
          <div className="xp-notes">
            <h3 className="xp-h2">Anotações</h3>
            {Array.from({ length: NOTES_LINES }, (_, i) => (
              <div key={i} className="xp-notes-line" />
            ))}
          </div>
        )}
        {!doc.nodes.length && <p className="xp-note">O documento ainda não tem conteúdo.</p>}
      </Sheet>
    </div>
  );
}
