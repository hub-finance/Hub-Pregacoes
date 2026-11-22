import type { WhatsNewEntry } from '../../core/whatsNew';

/** A lista de novidades, usada na tela que abre depois da atualização e na página. */
export function WhatsNewList({ entries }: { entries: WhatsNewEntry[] }) {
  return (
    <div className="whatsnew">
      {entries.map((entry) => (
        <section key={entry.id} className="whatsnew-entry">
          <h3 className="whatsnew-title">{entry.title}</h3>
          <ul className="whatsnew-items">
            {entry.items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}.</strong> {item.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
