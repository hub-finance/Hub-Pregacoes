import { useEffect, useState } from 'react';
import { saveMaterial } from '../../core/materials';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { WithRefs } from './RichText';
import { RefList } from './RefList';

/**
 * O DNA do material: a identidade dele numa página. A ideia central é
 * escrita pelo usuário (é a interpretação dele); o resto o app tira do texto.
 */
export function DnaTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const [idea, setIdea] = useState(material.centralIdea);
  useEffect(() => setIdea(material.centralIdea), [material.centralIdea]);

  const keyRef = reading.references[0];
  const maxWords = Math.max(1, ...reading.sections.map((s) => s.words));

  return (
    <div className="xr-dna">
      <section className="card stack xr-span-2">
        <strong>Ideia central</strong>
        <textarea
          className="textarea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onBlur={() => idea !== material.centralIdea && saveMaterial({ ...material, centralIdea: idea.trim() })}
          placeholder="Em uma ou duas frases, com as suas palavras: o que este material ensina?"
          aria-label="Ideia central"
        />
        <span className="small dim">Escrita por você — o app não escreve a interpretação.</span>
      </section>

      <section className="card stack">
        <strong>Identidade</strong>
        <dl className="xr-dl">
          <dt>Partes</dt>
          <dd>{material.sections.length}</dd>
          <dt>Palavras</dt>
          <dd>{reading.words.toLocaleString('pt-BR')}</dd>
          <dt>Leitura</dt>
          <dd>≈ {reading.minutes} min</dd>
          <dt>Destaques</dt>
          <dd>{reading.highlights.length}</dd>
          <dt>Termos</dt>
          <dd>{reading.definitions.length}</dd>
          <dt>Perguntas</dt>
          <dd>{reading.questions.length}</dd>
        </dl>
      </section>

      <section className="card stack">
        <strong>Texto-chave</strong>
        {keyRef ? (
          <>
            <span className="xr-big-ref">
              <WithRefs text={keyRef.label} />
            </span>
            <span className="small dim">
              A referência mais citada ({keyRef.count}×). {material.sections.find((s) => s.id === keyRef.sectionId)?.title}
            </span>
          </>
        ) : (
          <span className="small dim">Nenhuma referência bíblica no texto.</span>
        )}
      </section>

      <section className="card stack xr-span-2">
        <strong>Estrutura</strong>
        <ol className="xr-structure">
          {reading.sections.map((s, i) => (
            <li key={s.section.id}>
              <span className="truncate">{s.section.title || `Parte ${i + 1}`}</span>
              <span className="xr-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, Math.round((s.words / maxWords) * 100))}%` }} />
              </span>
              <span className="small dim">{s.words} pal.</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card stack">
        <strong>Palavras-chave</strong>
        {reading.keywords.length ? (
          <div className="row row-wrap" style={{ gap: 6 }}>
            {reading.keywords.map((k) => (
              <span key={k.word} className="chip" title={`${k.count} vezes em ${k.sections} parte(s)`}>
                {k.word} <span className="dim">{k.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="small dim">Texto curto demais para apontar palavras-chave.</span>
        )}
      </section>

      <section className="card stack">
        <strong>Versículos citados</strong>
        <RefList refs={reading.references} />
      </section>

      {reading.highlights.length > 0 && (
        <section className="card stack xr-span-2">
          <strong>Destaques</strong>
          {reading.highlights.map((h, i) => (
            <div key={i} className="xr-highlight">
              <WithRefs text={h.text} />
            </div>
          ))}
        </section>
      )}

      {reading.definitions.length > 0 && (
        <section className="card stack">
          <strong>Glossário</strong>
          <dl className="xr-glossary">
            {reading.definitions.map((d, i) => (
              <div key={i}>
                <dt>{d.term}</dt>
                <dd>{d.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {reading.questions.length > 0 && (
        <section className="card stack">
          <strong>Perguntas do material</strong>
          <ul className="xr-ul">
            {reading.questions.map((q, i) => (
              <li key={i}>{q.text}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
