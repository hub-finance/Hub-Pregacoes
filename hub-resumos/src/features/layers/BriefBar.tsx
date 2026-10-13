import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ui';
import { getGeminiConfig } from '../../core/ai';
import { downloadBlob, safeName } from '../../core/backup';
import { buildBriefWithAi, saveBrief } from '../../core/brief';
import { briefWordHtml } from '../../core/briefDoc';
import type { Material, StudyBrief } from '../../core/types';
import { BriefEditor } from './BriefEditor';

/**
 * Faixa no alto de cada camada: quem montou a estrutura (IA ou o texto),
 * montar/refazer com a IA, editar antes de usar ou exportar, e imprimir.
 */
export function BriefBar({ material, brief }: { material: Material; brief: StudyBrief }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const aiOn = useLiveQuery(async () => !!(await getGeminiConfig()).key, [], false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const saved = !!material.brief;

  const runAi = async () => {
    abort.current = new AbortController();
    setBusy(true);
    try {
      const b = await buildBriefWithAi(material, { signal: abort.current.signal });
      await saveBrief(material.id, b);
      notify('A IA montou a estrutura do estudo. Revise e edite o que precisar.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xr-briefbar no-print">
      <span className={`xr-brief-src${brief.source === 'ia' ? ' is-ia' : ''}`}>
        {brief.source === 'ia' ? (
          <>
            <Icon name="sparkle" size={14} /> Estrutura montada pela IA{brief.editedAt ? ' e revisada por você' : ''}
          </>
        ) : (
          <>Estrutura montada só com o texto{brief.editedAt ? ', revisada por você' : ''}</>
        )}
      </span>
      <span className="spacer" />
      {busy ? (
        <>
          <span className="small" role="status">
            A IA está lendo o material inteiro…
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
            Parar
          </button>
        </>
      ) : (
        <>
          {aiOn ? (
            <button className="btn btn-primary btn-sm" onClick={runAi}>
              <Icon name="sparkle" size={14} /> {brief.source === 'ia' ? 'Refazer com IA' : 'Montar com IA'}
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => navigate('/config#ia')} title="Com a IA, a estrutura mostra a linha de raciocínio do material">
              Ligar a IA
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button className="btn btn-sm" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              // \ufeff: o Word lê os acentos corretamente
              downloadBlob(new Blob(['\ufeff', briefWordHtml(material.title, material.author, brief)], { type: 'application/msword' }), `${safeName(material.title)} - estudo.doc`);
              notify('Documento do Word baixado.');
            }}
          >
            Word
          </button>
          {saved && (
            <button className="btn btn-ghost btn-sm" onClick={() => setResetting(true)}>
              Voltar ao automático
            </button>
          )}
        </>
      )}
      <BriefEditor open={editing} material={material} brief={brief} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={resetting}
        title="Voltar à estrutura automática?"
        message="A estrutura salva (da IA ou editada por você) é descartada, e os quadros voltam a ser montados só com o texto. O material não muda."
        confirmLabel="Voltar ao automático"
        onCancel={() => setResetting(false)}
        onConfirm={async () => {
          await saveBrief(material.id, undefined);
          setResetting(false);
          notify('Estrutura automática restaurada.');
        }}
      />
    </div>
  );
}
