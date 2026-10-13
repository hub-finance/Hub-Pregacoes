import { hubBibleLink, type FoundReference } from '../../core/bible';
import { useHubUrl } from './useHubUrl';

/** Lista de referências, com link para o Hub Bible quando configurado. */
export function RefList({ refs, limit }: { refs: Array<FoundReference & { count: number }>; limit?: number }) {
  const hubUrl = useHubUrl();
  if (!refs.length) return <span className="small dim">Nenhuma referência bíblica no texto.</span>;
  return (
    <div className="row row-wrap" style={{ gap: 6 }}>
      {refs.slice(0, limit).map((r) => {
        const href = hubBibleLink(hubUrl, r);
        const label = (
          <>
            {r.label}
            {r.count > 1 && <span className="dim"> ×{r.count}</span>}
          </>
        );
        return href ? (
          <a key={r.label} className="chip" href={href} target="_blank" rel="noopener noreferrer" title="Abrir no Hub Bible">
            {label}
          </a>
        ) : (
          <span key={r.label} className="chip">
            {label}
          </span>
        );
      })}
    </div>
  );
}
