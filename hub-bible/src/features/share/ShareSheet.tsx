import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../core/settings/SettingsContext';
import { copyToClipboard, formatShareText, shareImage, shareText } from '../../core/share/share';
import {
  VERSE_BACKGROUNDS,
  VERSE_BACKGROUND_IDS,
  renderVerseImage,
  type VerseBackground,
} from '../../core/share/verseImage';

interface Props {
  open: boolean;
  onClose: () => void;
  reference: string;
  text: string;
  translationLabel?: string;
  /** Título alternativo (sermão, estudo, devocional). */
  title?: string;
}

/** Compartilhamento de texto e de imagem (seção 17). */
export function ShareSheet({ open, onClose, reference, text, translationLabel, title }: Props) {
  const { settings, update, resolvedTheme } = useSettings();
  const { notify } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  /* O fundo escolhido fica guardado: quem gosta de um não quer reescolher a
     cada versículo. Sem escolha ainda, vale o tema em que se está lendo — é o
     palpite mais provável e o menos surpreendente. */
  const background: VerseBackground =
    (settings.shareBackground as VerseBackground | undefined) ??
    (resolvedTheme in VERSE_BACKGROUNDS ? (resolvedTheme as VerseBackground) : 'dark');

  useEffect(() => {
    if (!open) {
      setPreview((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
      setBlob(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    renderVerseImage({
      text,
      reference,
      translation: translationLabel,
      background,
    })
      .then((generated) => {
        if (cancelled) return;
        setBlob(generated);
        setPreview(URL.createObjectURL(generated));
      })
      .catch(() => notify('Não foi possível gerar a imagem.', 'error'))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [open, text, reference, translationLabel, background, notify]);

  const plain = formatShareText(text, reference, translationLabel);

  return (
    <Sheet open={open} title={title ?? 'Compartilhar'} onClose={onClose}>
      <blockquote
        style={{
          fontFamily: 'var(--font-reader)',
          lineHeight: 1.65,
          borderLeft: '3px solid var(--accent)',
          paddingLeft: 'var(--sp-4)',
        }}
      >
        {text}
        <footer className="small" style={{ marginTop: 'var(--sp-2)', color: 'var(--accent-strong)', fontWeight: 600 }}>
          {reference}
          {translationLabel ? ` · ${translationLabel}` : ''}
        </footer>
      </blockquote>

      {busy && <p className="small dim center">Gerando imagem…</p>}
      {preview && <img className="share-preview" src={preview} alt={`Imagem com o texto de ${reference}`} />}

      {/* As cores vêm depois da prévia, e não antes: escolher fundo faz sentido
          olhando o resultado, não imaginando-o. */}
      <div className="share-bg-row" role="radiogroup" aria-label="Cor do fundo da imagem">
        {VERSE_BACKGROUND_IDS.map((id) => {
          const cor = VERSE_BACKGROUNDS[id];
          const escolhido = id === background;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={escolhido}
              aria-label={cor.label}
              title={cor.label}
              className={`share-bg${escolhido ? ' active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${cor.bg[0]}, ${cor.bg[1]})` }}
              onClick={() => update({ shareBackground: id })}
            >
              {/* a bolinha usa a cor de realce do próprio fundo: dá para prever
                  como a referência vai aparecer antes de escolher */}
              <span style={{ background: cor.accent }} />
            </button>
          );
        })}
      </div>

      <div className="grid grid-2">
        <button
          className="btn btn-primary"
          onClick={async () => {
            const result = await shareText({ title: reference, text: plain });
            notify(result === 'shared' ? 'Compartilhado.' : result === 'copied' ? 'Texto copiado.' : 'Não foi possível compartilhar.', result === 'failed' ? 'error' : 'default');
          }}
        >
          Compartilhar texto
        </button>
        <button
          className="btn"
          disabled={!blob}
          onClick={async () => {
            if (!blob) return;
            const result = await shareImage(blob, `${reference.replace(/[^\w]+/g, '-')}.png`, plain);
            notify(result === 'shared' ? 'Compartilhado.' : 'Imagem salva no dispositivo.');
          }}
        >
          Compartilhar imagem
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            notify((await copyToClipboard(plain)) ? 'Copiado.' : 'Não foi possível copiar.', 'default');
          }}
        >
          Copiar
        </button>
      </div>
    </Sheet>
  );
}
