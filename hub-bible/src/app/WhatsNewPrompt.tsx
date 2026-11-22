import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { markWhatsNewSeen, unseenWhatsNew } from '../core/whatsNew';
import { WhatsNewList } from '../features/whatsnew/WhatsNewList';

/**
 * Abre uma vez depois de cada atualização com o que mudou. Lido no primeiro
 * render (antes de as configurações serem gravadas), para distinguir quem já
 * usava o app de quem acabou de instalar.
 */
export function WhatsNewPrompt() {
  const [entries] = useState(unseenWhatsNew);
  const [open, setOpen] = useState(entries.length > 0);
  if (!entries.length) return null;
  const close = () => {
    markWhatsNewSeen();
    setOpen(false);
  };
  return (
    <Sheet
      open={open}
      title="Novidades desta versão"
      onClose={close}
      footer={
        <>
          <Link className="btn btn-ghost" to="/novidades" onClick={close} style={{ flex: 1, justifyContent: 'center' }}>
            Ver todas
          </Link>
          <button className="btn btn-primary" onClick={close} style={{ flex: 1 }}>
            Entendi
          </button>
        </>
      }
    >
      <WhatsNewList entries={entries} />
    </Sheet>
  );
}
