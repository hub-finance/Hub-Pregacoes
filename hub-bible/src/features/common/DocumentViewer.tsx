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
 * **As páginas são desenhadas só quando chegam perto da tela.** Uma apostila de
 * 60 páginas desenhada de uma vez ocuparia mais de meio gigabyte de memória e
 * derrubaria o aplicativo no tablet; aqui cada página vira imagem ao se
 * aproximar e é liberada ao se afastar, com a altura preservada para a rolagem
 * não saltar.
 *
 * As duas bibliotecas são carregadas sob demanda: quem nunca abre um arquivo
 * importado não paga por elas no primeiro carregamento.
 */
interface Props {
  attachment: Attachment;
  /**
   * Sem moldura e sem barra própria: a página ocupa a coluna inteira.
   * É como o documento aparece na pregação e na aula, onde cada pixel de
   * largura vira tamanho de letra e a barra de baixo já traz os controles.
   */
  dense?: boolean;
  /** Ampliação vinda de fora (modo `dense`). Sem ela, o visualizador controla. */
  zoom?: number;
  /** Número de páginas, para quem exibe essa informação em outro lugar. */
  onPages?: (pages: number) => void;
}

export function DocumentViewer({ attachment, dense, zoom: outerZoom, onPages }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pages, setPages] = useState(0);
  const [ownZoom, setOwnZoom] = useState(1);
  const zoom = outerZoom ?? ownZoom;
  const [hostWidth, setHostWidth] = useState(0);

  /**
   * A largura da coluna manda no tamanho da página — e ela muda: ao arrastar a
   * divisão da tela, ao girar o tablet. Redesenhar a cada pixel travaria o
   * arrasto, então a medida só vale depois que o movimento para.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setHostWidth((previous) => (Math.abs(previous - width) > 16 ? width : previous));
      }, 200);
    });
    observer.observe(host);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';
    setStatus('loading');
    setPages(0);
    const cleanups: Array<() => void> = [];

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
          if (cancelled) {
            void doc.destroy();
            return;
          }
          setPages(doc.numPages);
          onPages?.(doc.numPages);
          cleanups.push(() => void doc.destroy());

          // largura disponível vira a escala: o documento ocupa a coluna toda.
          // Em `dense` não sobra folga nenhuma nas laterais — é o que dá à
          // apostila a largura que a moldura estava consumindo.
          const gutter = dense ? 0 : 24;
          const available = Math.max(240, (hostWidth || host.clientWidth || 640) - gutter);
          const width = available * zoom;
          const first = await doc.getPage(1);
          const base = first.getViewport({ scale: 1 });
          // acima de 2 a nitidez não melhora a olho nu e a memória dobra
          const density = Math.min(window.devicePixelRatio || 1, 2);
          const drawing = new Set<number>();

          const draw = async (slot: HTMLElement, n: number) => {
            if (drawing.has(n) || slot.querySelector('canvas')) return;
            drawing.add(n);
            try {
              const page = await doc.getPage(n);
              const natural = page.getViewport({ scale: 1 });
              const viewport = page.getViewport({ scale: (width / natural.width) * density });
              const canvas = document.createElement('canvas');
              canvas.className = 'doc-page';
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              canvas.style.width = '100%';
              canvas.style.height = 'auto';
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              await page.render({ canvasContext: ctx, viewport }).promise;
              if (cancelled) return;
              slot.replaceChildren(canvas);
              slot.dataset.drawn = 'true';
              page.cleanup();
            } catch {
              // uma página com problema não pode impedir a leitura das outras
            } finally {
              drawing.delete(n);
            }
          };

          const release = (slot: HTMLElement) => {
            const canvas = slot.querySelector('canvas');
            if (!canvas) return;
            // guarda a altura que a página tinha: sem isso a rolagem salta ao
            // liberar uma página que ficou acima da tela
            slot.style.minHeight = `${canvas.getBoundingClientRect().height}px`;
            canvas.width = 0;
            canvas.height = 0;
            canvas.remove();
            delete slot.dataset.drawn;
          };

          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const slot = entry.target as HTMLElement;
                const n = Number(slot.dataset.page);
                if (entry.isIntersecting) void draw(slot, n);
                else release(slot);
              }
            },
            { rootMargin: '900px 0px' },
          );
          cleanups.push(() => observer.disconnect());

          const placeholder = (width * base.height) / base.width;
          for (let n = 1; n <= doc.numPages; n++) {
            const slot = document.createElement('div');
            slot.className = 'doc-page-slot';
            slot.dataset.page = String(n);
            // sem limite de largura: com A+ a página passa da coluna e o
            // painel rola de lado. Era o `max-width: 100%` que fazia o botão
            // de aumentar não surtir efeito nenhum.
            slot.style.width = `${width}px`;
            slot.style.minHeight = `${placeholder}px`;
            host.appendChild(slot);
            observer.observe(slot);
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
      cleanups.forEach((run) => run());
    };
    // `onPages` e `dense` não entram: mudá-los não muda o que está desenhado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment, zoom, hostWidth]);

  return (
    <div className={`doc-viewer${dense ? ' dense' : ''}`}>
      {!dense && (
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
          onClick={() => setOwnZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
          aria-label="Diminuir"
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>A-</span>
        </button>
        <button
          className="icon-btn"
          onClick={() => setOwnZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
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
      )}

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

      {/* nunca escondido com `display: none`: elemento escondido mede zero, e
          era por isso que a página saía sempre com a largura de reserva (640px)
          em vez da largura real da coluna. Vazio, ele não ocupa nada. */}
      <div
        className={`doc-viewer-host${attachment.format === 'docx' ? ' is-docx' : ''}`}
        ref={hostRef}
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
      />
    </div>
  );
}
