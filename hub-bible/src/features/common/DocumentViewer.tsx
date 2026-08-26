import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { downloadBlob } from '../../core/share/share';
import { formatBytes } from '../../core/data/attachments';
import type { Attachment } from '../../core/db/types';
import { useRegisterSearch } from '../../app/SearchScope';
import {
  PdfTextIndex,
  searchRendered,
  type DocumentHit,
} from '../../core/data/documentSearch';

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
interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Folga deixada em volta do texto, em pontos.
 *
 * O suficiente para a letra não encostar na borda da tela, e nada além disso:
 * cada ponto aqui é largura que sai do tamanho da letra.
 */
const TRIM_PADDING = 5;

/**
 * Onde está o texto dentro da página.
 *
 * Uma apostila em A4 gasta perto de um quarto da largura com margem branca.
 * Exibindo a folha inteira numa coluna estreita, essa margem come o tamanho da
 * letra. Medindo onde o texto realmente começa e termina, a mesma coluna passa
 * a mostrar só o que se lê — e a letra cresce na mesma proporção.
 *
 * Devolve `null` quando cortar seria arriscado: página sem texto, ou com o
 * texto ocupando pouco espaço (capa, página de abertura, folha com imagem
 * grande), onde o que está fora do bloco de texto provavelmente importa.
 */
async function contentBox(
  page: { getTextContent: () => Promise<{ items: unknown[] }> },
  natural: { width: number; height: number },
): Promise<Area | null> {
  try {
    const content = await page.getTextContent();
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;

    for (const raw of content.items) {
      const item = raw as { transform?: number[]; width?: number; height?: number; str?: string };
      if (!item.transform || !item.str?.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      left = Math.min(left, x);
      right = Math.max(right, x + (item.width ?? 0));
      // a linha de base fica acima do fundo da letra: desce um pouco
      bottom = Math.min(bottom, y - (item.height ?? 10) * 0.3);
      top = Math.max(top, y + (item.height ?? 10));
    }
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

    const x = Math.max(0, left - TRIM_PADDING);
    const width = Math.min(natural.width, right + TRIM_PADDING) - x;
    const y = Math.max(0, bottom - TRIM_PADDING);
    const height = Math.min(natural.height, top + TRIM_PADDING) - y;

    // texto ocupando pouco da folha: o que sobra em volta costuma ser desenho
    if (width < natural.width * 0.55 || height < natural.height * 0.3) return null;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

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
  /** Aparar as margens brancas da página. */
  trim?: boolean;
  /** Número de páginas, para quem exibe essa informação em outro lugar. */
  onPages?: (pages: number) => void;
}

export function DocumentViewer({ attachment, dense, zoom: outerZoom, trim, onPages }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pages, setPages] = useState(0);
  const [ownZoom, setOwnZoom] = useState(1);
  const zoom = outerZoom ?? ownZoom;
  const [hostWidth, setHostWidth] = useState(0);

  /* Busca dentro do material. Fica aqui, e não na tela que abre o documento,
     porque é aqui que se sabe onde cada página foi parar. */
  const indexRef = useRef<PdfTextIndex | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<DocumentHit & { node?: HTMLElement }>>([]);
  const [searching, setSearching] = useState(false);

  /* A lupa do alto da tela abre esta busca. Só enquanto o material está
     desenhado: numa apostila que falhou não há o que procurar. */
  useRegisterSearch(() => setSearchOpen(true), !dense && status === 'ready');

  /**
   * Procura o termo e leva ao trecho.
   *
   * No PDF o texto vem do próprio arquivo, página a página, porque as páginas
   * só viram imagem ao chegarem perto da tela. Em Word e apresentação o
   * conteúdo já está desenhado, e aí quem responde é o texto da tela.
   *
   * A busca começa depois de uma pausa na digitação: numa apostila de sessenta
   * páginas, procurar a cada letra é procurar seis vezes o que se queria uma.
   */
  useEffect(() => {
    const termo = query.trim();
    if (!searchOpen || termo.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelado = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const index = indexRef.current;
        if (index) {
          await index.search(
            termo,
            (parciais) => {
              // mostrar o que já se achou enquanto o resto é lido
              if (!cancelado) setHits([...parciais]);
            },
            () => cancelado,
          );
        } else if (hostRef.current) {
          if (!cancelado) setHits(searchRendered(hostRef.current, termo));
        }
        if (!cancelado) setSearching(false);
      })();
    }, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen, status]);

  /** Rola até o achado. No PDF, até a página; nos demais, até o parágrafo. */
  const goTo = (hit: DocumentHit & { node?: HTMLElement }) => {
    const alvo =
      hit.node ??
      hostRef.current?.querySelector<HTMLElement>(`.doc-page-slot[data-page="${hit.page}"]`);
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          /* O índice guarda o texto já extraído: sem ele, cada letra digitada
             na busca releria a apostila inteira. */
          indexRef.current = new PdfTextIndex(doc);
          cleanups.push(() => {
            indexRef.current = null;
            void doc.destroy();
          });

          // largura disponível vira a escala: o documento ocupa a coluna toda.
          // Em `dense` não sobra folga nenhuma nas laterais — é o que dá à
          // apostila a largura que a moldura estava consumindo.
          const gutter = dense ? 0 : 8;
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
              const box = trim ? await contentBox(page, natural) : null;
              const area = box ?? { x: 0, y: 0, width: natural.width, height: natural.height };
              const scale = (width / area.width) * density;
              // desloca o desenho para que a área de texto comece no canto do
              // quadro; o resto da folha fica fora do canvas
              const viewport = page.getViewport({
                scale,
                offsetX: -area.x * scale,
                offsetY: -(natural.height - area.y - area.height) * scale,
              });
              const canvas = document.createElement('canvas');
              canvas.className = 'doc-page';
              canvas.width = Math.round(area.width * scale);
              canvas.height = Math.round(area.height * scale);
              canvas.style.width = '100%';
              canvas.style.height = 'auto';
              // quanto a letra cresceu por causa do corte — 1 significa página
              // inteira. Serve para conferir o corte sem abrir o código.
              canvas.dataset.fit = (natural.width / area.width).toFixed(2);
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

          // altura de reserva: a proporção da primeira página serve para todas
          const sample = trim ? await contentBox(first, base) : null;
          const ratio = sample
            ? sample.height / sample.width
            : base.height / base.width;
          const placeholder = width * ratio;
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
        } else if (attachment.format === 'pptx') {
          // A apresentação é reconstruída a partir do arquivo: o desenho fica
          // próximo do original, mas não é o PowerPoint desenhando. Quem quiser
          // fidelidade total salva como PDF, que o visualizador exibe idêntico.
          const { init } = await import('pptx-preview');
          // o A+/A- vale aqui também: o slide é desenhado na largura pedida
          const available = (hostWidth || host.clientWidth || 960) - (dense ? 0 : 8);
          const width = Math.max(320, available * zoom);
          const previewer = init(host, { width, height: Math.round((width * 9) / 16) });

          /* Antes de desenhar, tirar do manifesto as partes que ele declara e o
             arquivo não traz. É uma sujeira comum em apresentações que trocaram
             de modelo, e o desenhista para na primeira que não encontra. */
          const { repairPptx } = await import('../../core/data/pptxRepair');
          const { buffer } = await repairPptx(await attachment.blob.arrayBuffer());
          if (cancelled) return;

          await previewer.preview(buffer);
          if (cancelled) return;

          /* O desenhista de apresentações não reclama quando não entende o
             arquivo: termina sem erro nenhum e deixa o quadro vazio. Sem esta
             conferência, a tela dava tudo por certo e não mostrava nada — nem
             slide, nem aviso, nem caminho de saída. Contar os slides é a única
             forma de saber se ele fez alguma coisa. */
          if (!host.querySelector('.pptx-preview-slide-wrapper')) {
            throw new Error(
              'O aplicativo não conseguiu redesenhar esta apresentação. ' +
                'No PowerPoint, abra o arquivo e use "Salvar como" escolhendo PDF: ' +
                'o PDF é exibido aqui exatamente como no original.',
            );
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
        /* Limpar o que ficou pela metade: escondido, o quadro vazio continua
           ocupando a altura que reservou, e o aviso apareceria empurrado para
           longe do arquivo a que se refere. */
        host.innerHTML = '';
        setMessage((err as Error).message || 'Não foi possível abrir o arquivo.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((run) => run());
    };
    // `onPages` não entra: mudá-lo não muda o que está desenhado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment, zoom, hostWidth, trim, dense]);

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
        {/* A busca vem antes do zoom: numa apostila de sessenta páginas, achar
            o trecho é o que se faz primeiro. */}
        <button
          className={`icon-btn${searchOpen ? ' active' : ''}`}
          onClick={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery('');
          }}
          aria-label="Procurar neste material"
          aria-pressed={searchOpen}
        >
          <Icon name="search" size={18} />
        </button>
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

      {/* O painel de busca fica logo abaixo da barra, colado ao arquivo a que
          se refere, e some junto com ela no modo sem moldura. */}
      {!dense && searchOpen && (
        <div className="doc-search">
          <div className="search-field">
            <Icon name="search" size={18} className="dim" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar neste material"
              aria-label="Procurar neste material"
            />
            {query && (
              <button className="icon-btn" onClick={() => setQuery('')} aria-label="Limpar">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          {query.trim().length >= 2 && (
            <p className="small dim" style={{ margin: 'var(--sp-2) 0 0' }}>
              {searching
                ? `Procurando… ${hits.length} até agora`
                : hits.length
                  ? `${hits.length} ${hits.length === 1 ? 'trecho encontrado' : 'trechos encontrados'}`
                  : 'Nada encontrado neste material.'}
            </p>
          )}

          {hits.length > 0 && (
            <ol className="doc-hits">
              {hits.map((hit, i) => (
                <li key={i}>
                  <button onClick={() => goTo(hit)}>
                    {hit.page && <span className="doc-hit-page">pág. {hit.page}</span>}
                    <span className="doc-hit-text">
                      {hit.snippet.slice(0, hit.at)}
                      <mark>{hit.snippet.slice(hit.at, hit.at + hit.length)}</mark>
                      {hit.snippet.slice(hit.at + hit.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
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
        className={`doc-viewer-host is-${attachment.format}`}
        ref={hostRef}
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
      />
    </div>
  );
}
