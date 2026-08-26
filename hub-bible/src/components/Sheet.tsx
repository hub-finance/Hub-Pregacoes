import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Painel modal: bottom sheet no celular, diálogo centralizado em telas maiores.
 * Fecha com Esc, clique fora e devolve o foco ao elemento anterior.
 */
export function Sheet({ open, title, onClose, children, footer, size = 'md' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  /* `onClose` quase sempre é uma função criada na hora pela tela que abre a
     folha, e portanto diferente a cada desenho dela. Com ela nas dependências
     do efeito, digitar num campo aqui dentro refazia todo o efeito a cada
     tecla: o foco voltava para fora e o teclado do Android fechava. Guardada
     numa ref, o efeito depende só de `open` — que é quando ele de fato precisa
     acontecer. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    /* O primeiro campo do corpo, e não o primeiro elemento focável da folha: o
       botão de fechar vem antes no HTML, e mandar o foco para ele deixaria o
       teclado fechado justamente onde há o que digitar. O seletor de cor fica
       de fora porque abre a paleta do sistema. */
    const body = panelRef.current?.querySelector<HTMLElement>('.sheet-body');
    const focusTarget =
      /* `data-autofocus` deixa a folha dizer qual campo importa. Na anotação, o
         primeiro campo do HTML é a referência, que é opcional — quem abre ali
         quer escrever a anotação, não preencher o endereço do versículo. */
      body?.querySelector<HTMLElement>('[data-autofocus]') ??
      body?.querySelector<HTMLElement>(
        'input:not([type="color"]):not([type="hidden"]), textarea, select',
      ) ??
      body?.querySelector<HTMLElement>('button, [tabindex]') ??
      panelRef.current?.querySelector<HTMLElement>('button');
    focusTarget?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previousFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`sheet${size === 'lg' ? ' sheet-lg' : ''}`} ref={panelRef}>
        <header className="sheet-head">
          <h2 className="sheet-title truncate">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
