import { Link } from 'react-router-dom';

/** Trilha "Biblioteca › Material › Aba": mostra onde se está e volta com um toque. */
export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Você está em" className="xr-crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.to && i < items.length - 1 ? (
              <Link to={it.to}>{it.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
