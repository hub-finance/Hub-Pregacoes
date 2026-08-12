import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../../components/ui';
import { useDebounced } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { formatReference, parseReference } from '../../core/bible/reference';
import { getVerses } from '../../core/bible/repository';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Recebe o texto bíblico resolvido, para gravar junto com o documento. */
  onResolve?: (text: string, reference: string) => void;
  placeholder?: string;
}

/**
 * Campo de referência bíblica: valida a digitação, mostra o texto real vindo do
 * repositório local e permite abrir a passagem no leitor.
 *
 * O texto exibido é sempre TEXTO BÍBLICO carregado do banco — nunca digitado
 * livremente pelo app.
 */
export function ScriptureField({ label, value, onChange, onResolve, placeholder }: Props) {
  const { settings } = useSettings();
  const debounced = useDebounced(value, 400);
  const [preview, setPreview] = useState<{ reference: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parsed = parseReference(debounced);
    if (!debounced.trim()) {
      setPreview(null);
      setError(null);
      return;
    }
    if (!parsed) {
      setPreview(null);
      setError('Referência não reconhecida.');
      return;
    }
    getVerses({
      translation: settings.defaultTranslation,
      book: parsed.book,
      chapter: parsed.chapter,
      verse: parsed.verse ?? 1,
      verseEnd: parsed.verseEnd,
    })
      .then((rows) => {
        if (cancelled) return;
        if (!rows.length) {
          setPreview(null);
          setError('Versículo não encontrado nesta tradução.');
          return;
        }
        const text = rows.map((r) => r.text).join(' ');
        const reference = formatReference(parsed);
        setPreview({ reference, text });
        setError(null);
        onResolve?.(text, reference);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o texto.');
      });
    return () => {
      cancelled = true;
    };
    // onResolve é intencionalmente omitido: evita recarregar a cada render do pai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, settings.defaultTranslation]);

  const parsed = parseReference(debounced);

  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <Field label={label} hint="Ex.: João 15:1-11">
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'João 15:5'}
        />
      </Field>
      {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
      {preview && (
        <blockquote
          style={{
            fontFamily: 'var(--font-reader)',
            lineHeight: 1.6,
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 'var(--sp-3)',
            color: 'var(--text-2)',
            fontSize: '0.95rem',
          }}
        >
          {preview.text}
          <footer className="small" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{preview.reference}</span>
            {parsed && (
              <>
                {' · '}
                <Link
                  to={`/biblia/${parsed.book}/${parsed.chapter}${parsed.verse ? `?v=${parsed.verse}` : ''}`}
                  style={{ color: 'var(--accent-strong)' }}
                >
                  abrir no leitor
                </Link>
              </>
            )}
          </footer>
        </blockquote>
      )}
    </div>
  );
}
