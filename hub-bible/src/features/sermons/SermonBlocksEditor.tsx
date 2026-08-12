import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { escapeHtml } from '../../core/backup';
import { sanitizeHtml } from '../../core/sanitizeHtml';
import { BLOCK_LABEL, htmlToPlain, newBlock } from '../../core/data/sermonContent';
import { useSettings } from '../../core/settings/SettingsContext';
import { formatReference, parseReference } from '../../core/bible/reference';
import { getVerses } from '../../core/bible/repository';
import type { SermonBlock, SermonBlockType } from '../../core/db/types';

/**
 * Montagem do sermão em blocos.
 *
 * A liberdade que o pastor tem no Word — um subtítulo aqui, um quadro em
 * destaque ali, a citação separada do corpo — vive aqui em forma de blocos que
 * se inserem, movem e trocam de tipo. Dentro do bloco, a barra de formatação
 * cuida do negrito, do itálico, do sublinhado e da cor.
 *
 * O campo de escrita é um `contenteditable`, e por isso duas regras valem em
 * todo este arquivo:
 *
 * 1. O React nunca escreve dentro dele durante a digitação — se escrevesse, o
 *    cursor saltaria para o começo a cada tecla. O conteúdo só é gravado no DOM
 *    quando vem de fora (ao abrir o sermão, ao trazer um texto bíblico).
 * 2. Tudo o que chega colado passa pelo `sanitizeHtml` antes de entrar.
 */

/** Ordem em que os tipos aparecem na barra de inserir e no seletor. */
const BLOCK_ORDER: SermonBlockType[] = ['section', 'text', 'highlight', 'scripture', 'list'];

const BLOCK_ICON: Record<SermonBlockType, IconName> = {
  section: 'sermon',
  text: 'text',
  highlight: 'highlighter',
  scripture: 'quote',
  list: 'list',
};

const PLACEHOLDER: Record<SermonBlockType, string> = {
  section: 'Título da seção — Introdução, 1. O chamado, Conclusão…',
  text: 'Escreva aqui.',
  highlight: 'O que a igreja não pode deixar passar.',
  scripture: 'Digite a referência acima e toque em "Trazer texto".',
  list: 'Um ponto por linha.',
};

/**
 * Cores fixas, não as do tema: o sermão é exportado em PDF e impresso, e ali a
 * cor precisa ser a mesma que se viu ao escrever.
 */
const COLORS = [
  { value: '', label: 'Cor do texto' },
  { value: '#1f4e79', label: 'Azul' },
  { value: '#8a6a2f', label: 'Dourado' },
  { value: '#b23a35', label: 'Vermelho' },
  { value: '#2f7a56', label: 'Verde' },
  { value: '#6b645b', label: 'Cinza' },
];

interface Props {
  blocks: SermonBlock[];
  onChange: (blocks: SermonBlock[]) => void;
}

export function SermonBlocksEditor({ blocks, onChange }: Props) {
  const { notify } = useToast();
  const { settings } = useSettings();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  /** Campo em foco — a barra de formatação age sobre ele. */
  const activeEl = useRef<HTMLDivElement | null>(null);
  /** Gravação do campo em foco, avisando-o de que o HTML mudou por nossa mão. */
  const activeEmit = useRef<(() => void) | null>(null);

  const update = (id: string, patch: Partial<SermonBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const insertAt = (index: number, type: SermonBlockType) => {
    const block = newBlock(type);
    const next = [...blocks];
    next.splice(index, 0, block);
    onChange(next);
    setPendingFocus(block.id);
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [block] = next.splice(index, 1);
    next.splice(to, 0, block);
    onChange(next);
  };

  const remove = (index: number) => {
    const next = blocks.filter((_, i) => i !== index);
    onChange(next.length ? next : [newBlock('text')]);
    const previous = next[Math.max(0, index - 1)];
    if (previous) setPendingFocus(previous.id);
  };

  const changeType = (block: SermonBlock, type: SermonBlockType) => {
    if (type === block.type) return;
    // a lista precisa da marcação de itens; saindo dela, o texto volta a correr
    let html = block.html;
    if (type === 'list' && !/<li/i.test(html)) {
      const lines = htmlToPlain(html).split('\n').filter(Boolean);
      html = `<ul>${(lines.length ? lines : ['']).map((l) => `<li>${escapeHtml(l) || '<br>'}</li>`).join('')}</ul>`;
    } else if (type !== 'list' && /<li/i.test(html)) {
      html = htmlToPlain(html).split('\n').filter(Boolean).map(escapeHtml).join('<br>');
    }
    update(block.id, { type, html, reference: type === 'scripture' ? block.reference ?? '' : undefined });
  };

  /* ---------------------------- barra de formato --------------------------- */

  const exec = (command: string, value?: string) => {
    const el = activeEl.current;
    if (!el) return;
    el.focus();
    // negrito, itálico e sublinhado saem como `<b>`, `<i>` e `<u>`; a cor não
    // tem etiqueta própria e precisa vir em CSS, senão o navegador escreve o
    // antigo `<font color>`
    document.execCommand('styleWithCSS', false, command === 'foreColor' ? 'true' : 'false');
    document.execCommand(command, false, value);
    // pelo próprio campo, e não por `update`: assim ele sabe que o HTML já é o
    // que está no DOM e não reescreve o conteúdo — o cursor fica onde estava
    activeEmit.current?.();
  };

  /* ------------------------------ texto bíblico ---------------------------- */

  const fetchScripture = async (block: SermonBlock) => {
    const parsed = parseReference(block.reference ?? '');
    if (!parsed) {
      notify('Referência não reconhecida. Ex.: João 15:1-11', 'error');
      return;
    }
    const rows = await getVerses({
      translation: settings.defaultTranslation,
      book: parsed.book,
      chapter: parsed.chapter,
      verse: parsed.verse ?? 1,
      verseEnd: parsed.verseEnd,
    });
    if (!rows.length) {
      notify('Versículo não encontrado nesta tradução.', 'error');
      return;
    }
    update(block.id, {
      html: escapeHtml(rows.map((r) => r.text).join(' ')),
      reference: formatReference(parsed),
    });
  };

  return (
    <div
      className="sermon-blocks"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveId(null);
      }}
    >
      <div className={`format-bar${activeId ? '' : ' idle'}`} role="toolbar" aria-label="Formatação">
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          aria-label="Negrito"
          title="Negrito"
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          aria-label="Itálico"
          title="Itálico"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('underline')}
          aria-label="Sublinhado"
          title="Sublinhado"
        >
          <u>S</u>
        </button>
        <span className="format-sep" aria-hidden="true" />
        {COLORS.map((color) => (
          <button
            key={color.value || 'default'}
            type="button"
            className="format-btn format-color"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(color.value ? 'foreColor' : 'removeFormat', color.value || undefined)}
            aria-label={color.value ? `Cor ${color.label}` : 'Limpar formatação'}
            title={color.value ? color.label : 'Limpar formatação'}
          >
            {color.value ? (
              <span className="color-dot" style={{ background: color.value }} />
            ) : (
              <Icon name="reset" size={16} />
            )}
          </button>
        ))}
        <span className="spacer" />
        <span className="small dim format-hint">
          {activeId ? 'Formata o trecho selecionado' : 'Toque em um bloco para escrever'}
        </span>
      </div>

      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`sermon-block sb-${block.type}${activeId === block.id ? ' active' : ''}`}
        >
          <div className="sermon-block-bar">
            <label className="sr-only" htmlFor={`tipo-${block.id}`}>
              Tipo do bloco
            </label>
            <select
              id={`tipo-${block.id}`}
              className="block-type"
              value={block.type}
              onChange={(e) => changeType(block, e.target.value as SermonBlockType)}
            >
              {BLOCK_ORDER.map((type) => (
                <option key={type} value={type}>
                  {BLOCK_LABEL[type]}
                </option>
              ))}
            </select>
            <span className="spacer" />
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label="Mover para cima"
            >
              <Icon name="arrow-up" size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => move(index, 1)}
              disabled={index === blocks.length - 1}
              aria-label="Mover para baixo"
            >
              <Icon name="arrow-down" size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAt(index + 1, block.type === 'section' ? 'text' : block.type)}
              aria-label="Inserir bloco abaixo"
            >
              <Icon name="plus" size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => remove(index)}
              aria-label="Excluir bloco"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>

          {block.type === 'scripture' && (
            <div className="row scripture-ref-row">
              <input
                className="input input-sm"
                value={block.reference ?? ''}
                onChange={(e) => update(block.id, { reference: e.target.value })}
                placeholder="João 15:1-11"
                aria-label="Referência bíblica"
              />
              <button type="button" className="btn btn-sm" onClick={() => void fetchScripture(block)}>
                Trazer texto
              </button>
            </div>
          )}

          <Editable
            block={block}
            autoFocus={pendingFocus === block.id}
            onFocused={(el, emit) => {
              activeEl.current = el;
              activeEmit.current = emit;
              setActiveId(block.id);
              if (pendingFocus === block.id) setPendingFocus(null);
            }}
            onInput={(html) => update(block.id, { html })}
            onEnter={() => insertAt(index + 1, block.type === 'section' ? 'text' : block.type)}
            onEmptyBackspace={() => remove(index)}
          />

          {block.type === 'scripture' && block.reference && (
            <p className="sb-scripture-ref">{block.reference}</p>
          )}
        </div>
      ))}

      <div className="row row-wrap block-add">
        {BLOCK_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => insertAt(blocks.length, type)}
          >
            <Icon name={BLOCK_ICON[type]} size={16} /> {BLOCK_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface EditableProps {
  block: SermonBlock;
  autoFocus: boolean;
  onFocused: (el: HTMLDivElement, emit: () => void) => void;
  onInput: (html: string) => void;
  onEnter: () => void;
  onEmptyBackspace: () => void;
}

function Editable({ block, autoFocus, onFocused, onInput, onEnter, onEmptyBackspace }: EditableProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** Último HTML que passou por aqui — evita reescrever o campo enquanto se digita. */
  const known = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (block.html === known.current) return;
    el.innerHTML = sanitizeHtml(block.html);
    known.current = block.html;
  }, [block.html]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    known.current = el.innerHTML;
    onInput(el.innerHTML);
  };

  const isEmpty = !htmlToPlain(block.html);

  return (
    <div
      ref={ref}
      className="sb-input"
      data-block-id={block.id}
      data-placeholder={PLACEHOLDER[block.type]}
      data-empty={isEmpty ? 'true' : undefined}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={BLOCK_LABEL[block.type]}
      spellCheck
      onFocus={(e) => onFocused(e.currentTarget, emit)}
      onInput={emit}
      onPaste={(e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        const clean = html
          ? sanitizeHtml(html)
          : escapeHtml(text).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, clean);
        emit();
      }}
      onBlur={() => {
        const el = ref.current;
        if (!el) return;
        // ao sair do campo o conteúdo é limpo de vez: o cursor já não está lá,
        // então reescrever o campo não atrapalha ninguém
        const clean = sanitizeHtml(el.innerHTML);
        if (clean !== el.innerHTML) {
          el.innerHTML = clean;
          known.current = clean;
          onInput(clean);
        }
      }}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === 'Enter' && !e.shiftKey && block.type !== 'list') {
          if (!caretAtEnd(el)) return; // no meio do texto, quebra de linha normal
          e.preventDefault();
          onEnter();
          return;
        }
        if (e.key === 'Backspace' && !htmlToPlain(el.innerHTML)) {
          e.preventDefault();
          onEmptyBackspace();
        }
      }}
    />
  );
}

/** O cursor está no fim do campo? Só então Enter abre um bloco novo. */
function caretAtEnd(el: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return true;
  const caret = selection.getRangeAt(0);
  if (!el.contains(caret.endContainer)) return true;
  const after = document.createRange();
  after.selectNodeContents(el);
  after.setStart(caret.endContainer, caret.endOffset);
  return after.toString().trim().length === 0;
}
