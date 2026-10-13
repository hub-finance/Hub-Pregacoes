import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../../components/Toast';
import { listActions } from '../../core/actions';
import { downloadBlob, safeName } from '../../core/backup';
import { boardContent, BOARDS, type BoardKind } from '../../core/boards';
import type { MaterialReading } from '../../core/text';
import type { ActionItem, Material } from '../../core/types';
import { renderBoard, type BoardPalette } from '../boards/draw';

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));

/**
 * Quadros visuais: o material nos formatos de quadro dos exemplos (DNA do
 * livro, folha de consulta, mapa de conceitos, painel, fluxograma, cartões),
 * como imagem para baixar ou compartilhar. O conteúdo é sempre o do texto.
 */
export function BoardsTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { notify } = useToast();
  const [kind, setKind] = useState<BoardKind>('dna');
  const [palette, setPalette] = useState<BoardPalette>('papel');
  const [url, setUrl] = useState('');
  const actions = useLiveQuery(() => listActions(material.id), [material.id], [] as ActionItem[]);
  const content = useMemo(() => boardContent(material, reading, actions), [material, reading, actions]);
  const board = BOARDS.find((b) => b.id === kind)!;
  const fileName = (k: BoardKind) => `${safeName(material.title)} - ${BOARDS.find((b) => b.id === k)!.label}.png`;

  useEffect(() => {
    let live = true;
    // espera as fontes do sistema para o primeiro desenho sair com as letras certas
    void document.fonts?.ready.then(() => {
      if (live) setUrl(renderBoard(kind, content, palette).toDataURL('image/png'));
    });
    return () => {
      live = false;
    };
  }, [kind, content, palette]);

  if (!material.sections.length)
    return (
      <div className="empty">
        <h3>Os quadros precisam de texto</h3>
        <p className="small">Escreva ou cole o conteúdo na aba Editar; cada parte vira um bloco dos quadros.</p>
      </div>
    );

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        O material nos formatos de quadro: escolha o modelo, veja e baixe a imagem. Tudo vem do próprio texto; frases longas
        aparecem encurtadas no quadro, e o texto inteiro continua nas outras abas.
      </p>
      <div className="chip-row" role="radiogroup" aria-label="Modelo de quadro">
        {BOARDS.map((b) => (
          <button key={b.id} role="radio" aria-checked={kind === b.id} className={`chip${kind === b.id ? ' active' : ''}`} onClick={() => setKind(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <span className="small dim">{board.lead}</span>
        <div className="chip-row" role="radiogroup" aria-label="Cores">
          {(
            [
              ['papel', 'Papel', '#FBF7EE'],
              ['noite', 'Azul e dourado', '#0D1B2A'],
            ] as const
          ).map(([id, label, bg]) => (
            <button key={id} role="radio" aria-checked={palette === id} className={`chip${palette === id ? ' active' : ''}`} onClick={() => setPalette(id)}>
              <span className="chip-dot" style={{ background: bg, border: '1px solid var(--border-strong)' }} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {!material.centralIdea.trim() && (kind === 'dna' || kind === 'consulta') && (
        <p className="small muted" style={{ margin: 0 }}>
          Dica: escreva a ideia central na aba DNA — ela entra em destaque no quadro. Sem ela, o quadro usa o primeiro destaque do texto.
        </p>
      )}
      <div className="xr-board-frame">{url && <img src={url} alt={`${board.label} de ${material.title}`} className="xr-board" />}</div>
      <div className="row row-wrap">
        <button
          className="btn btn-primary"
          onClick={async () => {
            downloadBlob(await toBlob(renderBoard(kind, content, palette)), fileName(kind));
            notify('Imagem baixada.');
          }}
        >
          Baixar imagem (PNG)
        </button>
        <button
          className="btn"
          onClick={async () => {
            try {
              const file = new File([await toBlob(renderBoard(kind, content, palette))], fileName(kind), { type: 'image/png' });
              if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: material.title });
              else {
                downloadBlob(file, file.name);
                notify('Este aparelho não compartilha imagens; a imagem foi baixada.');
              }
            } catch (err) {
              if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
            }
          }}
        >
          Compartilhar
        </button>
        <button
          className="btn"
          onClick={async () => {
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip();
            for (const b of BOARDS) zip.file(fileName(b.id), await toBlob(renderBoard(b.id, content, palette)));
            downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName(material.title)} - quadros.zip`);
            notify('Os 6 quadros foram baixados num arquivo .zip.');
          }}
        >
          Baixar os 6 quadros (.zip)
        </button>
      </div>
    </div>
  );
}
