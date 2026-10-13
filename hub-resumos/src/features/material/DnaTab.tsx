import { useEffect, useState } from 'react';
import { SaveStatus } from '../../components/SaveStatus';
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
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => setIdea(material.centralIdea), [material.centralIdea]);

  const keyRef = reading.references[0];

  return (
    <div className="xr-dna">
      <section className="card stack xr-span-2">
        <strong>Ideia central</strong>
        <textarea
          className="textarea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onBlur={async () => {
            if (idea === material.centralIdea) return;
            await saveMaterial({ ...material, centralIdea: idea.trim() });
            setSavedAt(Date.now());
          }}
          placeholder="Em uma ou duas frases, com as suas palavras: o que este material ensina?"
          aria-label="Ideia central"
        />
        <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
          <span className="small dim">Escrita por você — o app não escreve a interpretação. Grava ao sair do campo.</span>
          <SaveStatus pending={idea !== material.centralIdea} savedAt={savedAt} />
        </div>
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

      {!reading.highlights.length && !reading.definitions.length && !reading.questions.length && (
        <div className="notice">
          <span>
            <strong>O DNA fica mais rico com marcações no texto.</strong> Na aba Editar, use “&gt; ” no começo de uma frase para
            destacar, “Termo: definição” para o glossário e termine perguntas com “?”.
          </span>
        </div>
      )}

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
