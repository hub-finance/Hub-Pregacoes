import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { createNote, getNote, updateNote } from '../../core/data/notes';
import type { VerseRef } from '../../core/db/types';

/**
 * Bloco de anotações flutuante sobre a Bíblia.
 *
 * Nasceu de um uso concreto: ouvir a pregação com a Bíblia aberta e escrever o
 * que vem à cabeça, sem sair do texto. Por isso é uma janela, e não uma tela —
 * quem escreve continua lendo, rolando e trocando de capítulo por baixo dela.
 *
 * Três decisões que vêm desse uso:
 *
 * 1. **Nada de salvar.** O que se escreve é gravado sozinho, como no resto do
 *    aplicativo. Ninguém toca em "Salvar" no meio de um culto.
 * 2. **A janela lembra onde estava** — posição, tamanho e a anotação aberta —,
 *    porque a mesma anotação continua no capítulo seguinte.
 * 3. **Uma folha em branco, sem quadros.** É bloco de notas: o texto e mais
 *    nada. A referência entra por um botão, quando o autor quiser.
 */

interface Props {
  /** Referência do que está aberto na tela: "João 15". */
  reference: string;
  /** O capítulo aberto, para vincular a anotação ao texto. */
  verseRef: VerseRef;
}

interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE = 'hub-bible:notepad';
const MIN_W = 260;
const MIN_H = 220;
/** Abaixo disto a janela vira uma faixa colada embaixo: arrastar não ajuda. */
const WIDE = 640;

/**
 * O tamanho de partida: um retângulo em pé, mais alto que largo.
 *
 * A primeira versão saiu quase quadrada e cabia pouca coisa — anotação de culto
 * é uma coluna de linhas curtas, uma embaixo da outra, e quem escreve quer ver
 * o que já escreveu sem rolar.
 */
const FORMATO = 3;
const PADRAO = { w: 360, h: 620 };

interface Stored extends Placement {
  open: boolean;
  noteId?: string;
  /** Versão do formato de partida; ver `FORMATO`. */
  v?: number;
}

function read(): Stored {
  const vazio: Stored = { open: false, x: 0, y: 0, ...PADRAO, v: FORMATO };
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return vazio;
    /* a versão é lida do que estava gravado, e não da mistura com o padrão —
       o padrão já traz `v`, e misturar antes de comparar esconderia o formato
       antigo de quem tem a janela quadrada guardada */
    const bruto = JSON.parse(raw) as Partial<Stored>;
    const guardado = { ...vazio, ...bruto };
    // quem já usou a janela antiga recebe o formato novo; a anotação aberta
    // continua sendo a mesma
    if (bruto.v !== FORMATO) return { ...guardado, ...PADRAO, x: 0, y: 0, v: FORMATO };
    return guardado;
  } catch {
    return vazio;
  }
}

function write(value: Stored) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(value));
  } catch {
    /* navegador com armazenamento bloqueado: a janela funciona, só não lembra */
  }
}

export function FloatingNotepad({ reference, verseRef }: Props) {
  const { notify } = useToast();
  const inicial = useRef<Stored>(read());
  const [open, setOpen] = useState(inicial.current.open);
  const [place, setPlace] = useState<Placement>(() => {
    const { x, y, w, h } = inicial.current;
    // primeira abertura: encostada no canto inferior direito, longe do texto
    if (x === 0 && y === 0) {
      // uma janela mais alta que a tela não serve a ninguém: ela encolhe até
      // caber, e continua encostada no canto de baixo
      const altura = Math.min(h, window.innerHeight - 120);
      return {
        w: Math.min(w, window.innerWidth - 32),
        h: altura,
        x: Math.max(12, window.innerWidth - w - 20),
        y: Math.max(12, window.innerHeight - altura - 90),
      };
    }
    return { x, y, w, h };
  });
  const [text, setText] = useState('');
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const noteId = useRef<string | undefined>(inicial.current.noteId);
  const criando = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** O texto mais recente, para gravar ao sair da tela sem esperar o React. */
  const ultimo = useRef('');
  ultimo.current = text;
  /**
   * A anotação de antes já foi lida do banco?
   *
   * Enquanto não foi, nada é gravado. Sem isto, a janela abriria em branco e o
   * salvamento automático apagaria por cima o que estava escrito ontem.
   */
  const carregado = useRef(false);

  /* ------------------------------ persistência ----------------------------- */

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const anterior = noteId.current ? await getNote(noteId.current) : undefined;
      if (!vivo) return;
      if (anterior) {
        setText(anterior.content);
        setSavedAt(anterior.updatedAt);
      } else {
        // apagada em Anotações: a janela recomeça em vez de ressuscitá-la
        noteId.current = undefined;
      }
      carregado.current = true;
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    write({ ...place, open, noteId: noteId.current, v: FORMATO });
  }, [place, open, savedAt]);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* O capítulo aberto agora. Guardado num ref porque muda a cada virada de
     página, e `gravar` não pode ser recriado a cada mudança — se fosse, o
     salvamento automático reiniciaria a contagem e nunca chegaria a gravar. */
  const alvo = useRef({ reference, verseRef });
  alvo.current = { reference, verseRef };

  /** Grava a anotação: cria na primeira letra, atualiza daí em diante. */
  const gravar = useCallback(async (conteudo: string) => {
    if (!conteudo.trim() && !noteId.current) return;
    if (noteId.current) {
      await updateNote(noteId.current, { content: conteudo });
    } else {
      if (criando.current) return;
      criando.current = true;
      try {
        const nota = await createNote({
          targetType: 'chapter',
          reference: alvo.current.reference,
          content: conteudo,
          ref: alvo.current.verseRef,
        });
        noteId.current = nota.id;
      } finally {
        criando.current = false;
      }
    }
    setSavedAt(Date.now());
  }, []);

  // grava sozinho, um pouco depois de parar de digitar
  useEffect(() => {
    if (!open || !carregado.current) return;
    const timer = setTimeout(() => void gravar(text), 600);
    return () => clearTimeout(timer);
  }, [text, open, gravar]);

  // sair da Bíblia não pode levar embora o que ainda não foi gravado
  useEffect(
    () => () => {
      if (carregado.current && ultimo.current.trim()) void gravar(ultimo.current);
    },
    [gravar],
  );

  /* ------------------------- arrastar e redimensionar ---------------------- */

  const arrastar = (e: React.PointerEvent, modo: 'mover' | 'tamanho') => {
    if (!wide) return;
    // os botões moram na mesma barra que serve de alça: sem esta saída, o
    // `preventDefault` de arrastar engoliria o toque e nenhum deles responderia
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const puxador = e.currentTarget as HTMLElement;
    puxador.setPointerCapture(e.pointerId);
    // de onde o dedo saiu e onde a janela estava — as duas coisas são precisas
    // para que ela acompanhe o movimento em vez de saltar para o ponteiro
    const ponteiro = { x: e.clientX, y: e.clientY };
    const origem = { ...place };

    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - ponteiro.x;
      const dy = ev.clientY - ponteiro.y;
      setPlace(
        modo === 'mover'
          ? {
              ...origem,
              // presa à tela: uma janela arrastada para fora não volta
              x: Math.min(Math.max(8, origem.x + dx), window.innerWidth - origem.w - 8),
              y: Math.min(Math.max(8, origem.y + dy), window.innerHeight - 56),
            }
          : {
              ...origem,
              w: Math.min(Math.max(MIN_W, origem.w + dx), window.innerWidth - origem.x - 8),
              h: Math.min(Math.max(MIN_H, origem.h + dy), window.innerHeight - origem.y - 8),
            },
      );
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  };

  /* --------------------------------- ações -------------------------------- */

  /** Escreve a referência do capítulo aberto onde o cursor estiver. */
  const inserirReferencia = () => {
    const area = areaRef.current;
    const corte = area?.selectionStart ?? text.length;
    const antes = text.slice(0, corte);
    const depois = text.slice(corte);
    const trecho = `${antes && !antes.endsWith('\n') ? '\n' : ''}${reference} — `;
    const novo = antes + trecho + depois;
    setText(novo);
    requestAnimationFrame(() => {
      area?.focus();
      const cursor = (antes + trecho).length;
      area?.setSelectionRange(cursor, cursor);
    });
  };

  /** Fecha a anotação atual e abre uma folha em branco. */
  const novaAnotacao = async () => {
    if (text.trim()) await gravar(text);
    noteId.current = undefined;
    setText('');
    setSavedAt(null);
    notify('Anotação guardada. Folha em branco.');
    areaRef.current?.focus();
  };

  const fechar = () => {
    if (text.trim()) void gravar(text);
    setOpen(false);
  };

  /* -------------------------------- desenho -------------------------------- */

  if (!open) {
    return (
      <button
        className="notepad-fab"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => areaRef.current?.focus());
        }}
        aria-label="Abrir o bloco de anotações"
        title="Bloco de anotações"
      >
        <Icon name="note" size={22} />
      </button>
    );
  }

  return (
    <section
      className={`notepad-float${wide ? '' : ' docked'}`}
      style={wide ? { left: place.x, top: place.y, width: place.w, height: place.h } : undefined}
      aria-label="Bloco de anotações"
    >
      <header className="notepad-float-head" onPointerDown={(e) => arrastar(e, 'mover')}>
        <Icon name="note" size={16} className="dim" />
        <span className="notepad-float-title">{reference}</span>
        <span className="spacer" />
        {wide && <span className="notepad-float-grip" aria-hidden="true" />}
        <span className="spacer" />
        <button className="icon-btn" onClick={inserirReferencia} aria-label="Inserir a referência no texto">
          <Icon name="book" size={16} />
        </button>
        <button className="icon-btn" onClick={() => void novaAnotacao()} aria-label="Começar outra anotação">
          <Icon name="plus" size={16} />
        </button>
        <button className="icon-btn" onClick={fechar} aria-label="Fechar o bloco de anotações">
          <Icon name="close" size={16} />
        </button>
      </header>

      <textarea
        ref={areaRef}
        className="notepad-float-area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva o que vier…"
        aria-label="Anotação"
        spellCheck
      />

      <footer className="notepad-float-foot">
        <span className="small dim">{savedAt ? 'Salvo' : text.trim() ? 'Salvando…' : 'Salva sozinho'}</span>
        <span className="spacer" />
        {wide && (
          <span
            className="notepad-float-resize"
            onPointerDown={(e) => arrastar(e, 'tamanho')}
            role="separator"
            aria-label="Redimensionar"
          />
        )}
      </footer>
    </section>
  );
}
