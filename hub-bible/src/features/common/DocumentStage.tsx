import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { DocumentViewer } from './DocumentViewer';
import { SplitLayout } from './SplitLayout';
import { SermonTimer } from '../preaching/SermonTimer';
import { ScripturePane } from '../preaching/ScripturePane';
import { useSettings } from '../../core/settings/SettingsContext';
import type { Attachment } from '../../core/db/types';

interface Props {
  title: string;
  attachment: Attachment;
  /** Cronômetro no alto — serve tanto para a pregação quanto para a aula. */
  timer?: boolean;
  /** Ligar a Bíblia ao lado já ao abrir. */
  splitByDefault?: boolean;
}

/**
 * Documento importado em tela cheia, com a Bíblia ao lado.
 *
 * É o palco compartilhado pelo Modo Pregação (sermão que veio pronto em
 * arquivo) e pelo Modo Aula do Rhema (apostila em PDF): Bíblia à esquerda,
 * documento à direita, e nada mais na tela.
 */
export function DocumentStage({ title, attachment, timer = true, splitByDefault = false }: Props) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [split, setSplit] = useState(splitByDefault);

  // mantém a tela ligada enquanto se prega ou se ensina, quando o aparelho deixa
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<never> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((lock) => (sentinel = lock))
      .catch(() => undefined);
    return () => {
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  return (
    <div
      className="preach"
      style={{ '--preach-scale': settings.preachingScale } as React.CSSProperties}
    >
      {timer && <SermonTimer />}
      {/* `divided` é o que coloca as duas colunas lado a lado; sem a classe, a
          Bíblia caía acima do documento mesmo em tela larga */}
      <SplitLayout divided={split} left={<ScripturePane />}>
        <div className="preach-stage split doc-stage" style={{ justifyContent: 'flex-start' }}>
          <DocumentViewer attachment={attachment} />
        </div>
      </SplitLayout>
      <div className="preach-bar">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Sair">
          <Icon name="close" />
        </button>
        <span className="small dim truncate" style={{ flex: 1, padding: '0 var(--sp-2)' }}>
          {title || attachment.name}
        </span>
        <button
          className={`icon-btn preach-split-toggle${split ? ' active' : ''}`}
          onClick={() => setSplit((v) => !v)}
          aria-label={split ? 'Fechar a Bíblia ao lado' : 'Abrir a Bíblia ao lado'}
          aria-pressed={split}
        >
          <Icon name="split" />
        </button>
      </div>
    </div>
  );
}
