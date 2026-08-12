import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { downloadBlob } from '../../core/share/share';
import { formatBytes } from '../../core/data/attachments';
import type { Attachment } from '../../core/db/types';

/**
 * Exibe o arquivo importado com a formatação que ele já tem.
 *
 * PDF é desenhado página a página com o pdf.js — o mesmo motor do Firefox, que
 * respeita fontes, colunas e posicionamento do original. DOCX é renderizado com
 * as folhas de estilo do próprio documento, preservando títulos, negritos,
 * listas, tabelas e quebras de página.
 *
 * As duas bibliotecas são carregadas sob demanda: quem nunca abre um arquivo
 * importado não paga por elas no primeiro carregamento.
 */
export function DocumentViewer({ attachment }: { attachment: Attachment }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    setStatus('loading');
    setPages(0);

    (async () => {
      try {
        if (attachment.format === 'pdf') {
          // a versão 4 é a que roda em Chrome de Android mais antigo; as
          // seguintes usam recursos de JavaScript que nem todo aparelho tem
          const pdfjs = await import('pdfjs-dist');
          const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

          const buffer = await attachment.blob.arrayBuffer();
          const doc = await pdfjs.getDocument({ data: buffer }).promise;
          if (cancelled) return;
          setPages(doc.numPages);

          // largura disponível vira a escala: o documento ocupa a coluna toda
          const available = host.clientWidth || 640;

          for (let n = 1; n <= doc.numPages; n++) {
            if (cancelled) return;
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const scale = (available / base.width) * zoom * (window.devicePixelRatio || 1);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.className = 'doc-page';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${available * zoom}px`;
            canvas.style.height = 'auto';
            host.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
          }
        } else {
          const { renderAsync } = await import('docx-preview');
          const buffer = await attachment.blob.arrayBuffer();
          if (cancelled) return;
          await renderAsync(buffer, host, undefined, {
            className: 'docx',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: true,
            breakPages: true,
            experimental: true,
          });
        }
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setMessage((err as Error).message || 'Não foi possível abrir o arquivo.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attachment, zoom]);

  return (
    <div className="doc-viewer">
      <div className="doc-viewer-bar">
        <Icon name={attachment.format === 'pdf' ? 'print' : 'note'} size={18} className="dim" />
        <span className="truncate" style={{ flex: 1, fontSize: '0.86rem', fontWeight: 550 }}>
          {attachment.name}
        </span>
        <span className="small dim mono-num">
          {pages ? `${pages} pág · ` : ''}
          {formatBytes(attachment.size)}
        </span>
        <button
          className="icon-btn"
          onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
          aria-label="Diminuir"
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>A-</span>
        </button>
        <button
          className="icon-btn"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
          aria-label="Aumentar"
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>A+</span>
        </button>
        <button
          className="icon-btn"
          onClick={() => downloadBlob(attachment.blob, attachment.name)}
          aria-label="Baixar arquivo original"
        >
          <Icon name="download" size={18} />
        </button>
      </div>

      {status === 'loading' && (
        <p className="small dim center" style={{ padding: 'var(--sp-5)' }}>
          Abrindo o documento…
        </p>
      )}
      {status === 'error' && (
        <div className="notice" style={{ margin: 'var(--sp-4)', borderColor: 'var(--danger)' }}>
          <Icon name="warning" size={20} style={{ flex: 'none', color: 'var(--danger)' }} />
          <div>
            <strong>Não foi possível exibir este arquivo.</strong>
            <p className="small" style={{ marginTop: 4 }}>{message}</p>
            <button
              className="btn btn-sm"
              style={{ marginTop: 'var(--sp-3)' }}
              onClick={() => downloadBlob(attachment.blob, attachment.name)}
            >
              Baixar o original
            </button>
          </div>
        </div>
      )}

      <div
        className={`doc-viewer-host${attachment.format === 'docx' ? ' is-docx' : ''}`}
        ref={hostRef}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}
