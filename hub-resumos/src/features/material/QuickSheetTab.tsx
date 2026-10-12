import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../../components/Toast';
import { listActions, STATUS_LABEL } from '../../core/actions';
import { sentences, type MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { WithRefs } from './RichText';

/** A frase que representa cada parte: o primeiro destaque, ou a primeira frase. */
function keyLine(s: MaterialReading['sections'][number]): string {
  return s.highlights[0] ?? sentences(s.paragraphs[0] ?? s.listItems[0] ?? '')[0] ?? '';
}

/**
 * Folha de consulta rápida: o essencial numa página, para ter à mão ou
 * imprimir (no navegador, "Salvar como PDF").
 */
export function QuickSheetTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { notify } = useToast();
  const actions = useLiveQuery(() => listActions(material.id), [material.id], []);
  const open = actions.filter((a) => a.status !== 'feito');

  const asText = () =>
    [
      material.title.toUpperCase(),
      material.author && `Autor: ${material.author}`,
      material.centralIdea && `\nIDEIA CENTRAL\n${material.centralIdea}`,
      `\nESTRUTURA\n${reading.sections.map((s, i) => `${i + 1}. ${s.section.title}${keyLine(s) ? ` — ${keyLine(s)}` : ''}`).join('\n')}`,
      reading.definitions.length && `\nGLOSSÁRIO\n${reading.definitions.map((d) => `${d.term}: ${d.meaning}`).join('\n')}`,
      reading.references.length && `\nVERSÍCULOS\n${reading.references.map((r) => r.label).join(' · ')}`,
      reading.keywords.length && `\nPALAVRAS-CHAVE\n${reading.keywords.map((k) => k.word).join(', ')}`,
      reading.questions.length && `\nPERGUNTAS\n${reading.questions.map((q) => `• ${q.text}`).join('\n')}`,
      open.length && `\nAÇÕES\n${open.map((a) => `☐ ${a.text}${a.due ? ` (até ${a.due.split('-').reverse().join('/')})` : ''}`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n');

  return (
    <div className="stack">
      <div className="row row-wrap no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Imprimir / salvar em PDF
        </button>
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(asText());
              notify('Folha copiada como texto.');
            } catch {
              notify('Não foi possível copiar neste aparelho.', 'error');
            }
          }}
        >
          Copiar como texto
        </button>
      </div>

      <article className="xr-sheet xr-print">
        <header className="xr-sheet-head">
          <h2>{material.title}</h2>
          {material.author && <span>{material.author}</span>}
        </header>
        {material.centralIdea && (
          <div className="xr-sheet-idea">
            <strong>Ideia central</strong>
            <p>{material.centralIdea}</p>
          </div>
        )}
        <div className="xr-sheet-cols">
          <section>
            <h3>Estrutura</h3>
            <ol>
              {reading.sections.map((s) => (
                <li key={s.section.id}>
                  <strong>{s.section.title}</strong>
                  {keyLine(s) && (
                    <>
                      {' — '}
                      <WithRefs text={keyLine(s)} />
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
          {reading.definitions.length > 0 && (
            <section>
              <h3>Glossário</h3>
              <dl>
                {reading.definitions.map((d, i) => (
                  <div key={i}>
                    <dt>{d.term}</dt>
                    <dd>{d.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {reading.references.length > 0 && (
            <section>
              <h3>Versículos</h3>
              <p>{reading.references.map((r) => r.label).join(' · ')}</p>
            </section>
          )}
          {reading.keywords.length > 0 && (
            <section>
              <h3>Palavras-chave</h3>
              <p>{reading.keywords.map((k) => k.word).join(', ')}</p>
            </section>
          )}
          {reading.questions.length > 0 && (
            <section>
              <h3>Perguntas</h3>
              <ul>
                {reading.questions.map((q, i) => (
                  <li key={i}>{q.text}</li>
                ))}
              </ul>
            </section>
          )}
          {open.length > 0 && (
            <section>
              <h3>Ações</h3>
              <ul className="xr-sheet-actions">
                {open.map((a) => (
                  <li key={a.id}>
                    ☐ {a.text}
                    {a.owner && ` · ${a.owner}`}
                    {a.due && ` · até ${a.due.split('-').reverse().join('/')}`}
                    {a.status === 'fazendo' && ` · ${STATUS_LABEL.fazendo.toLowerCase()}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <footer>Hub Resumos</footer>
      </article>
    </div>
  );
}
