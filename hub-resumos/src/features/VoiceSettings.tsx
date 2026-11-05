import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { TextArea, TextInput, Toggle } from '../components/ui';
import { getGeminiConfig } from '../core/ai';
import { db } from '../core/db';
import { DEFAULT_VOICE, getVoiceSettings, isMyWriting, saveVoiceSettings, writingTraits, type VoiceSettings } from '../core/voice';
import { generateVoiceProfile } from '../core/voiceAi';

/**
 * Identidade de linguagem: a IA escreve na voz do autor, pela Palavra da Fé.
 * O perfil sai dos materiais marcados como "Escrito meu" e pode ser ajustado
 * à mão — é o autor quem diz como ele escreve.
 */
export function VoiceSettingsCard() {
  const { notify } = useToast();
  const stored = useLiveQuery(() => getVoiceSettings(), []);
  const mine = useLiveQuery(async () => (await db.materials.toArray()).filter(isMyWriting).sort((a, b) => b.updatedAt - a.updatedAt), [], []);
  const aiOn = useLiveQuery(async () => !!(await getGeminiConfig()).key, [], false);
  const [v, setV] = useState<VoiceSettings>(DEFAULT_VOICE);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (stored) setV(stored);
  }, [stored]);
  useEffect(() => () => abort.current?.abort(), []);
  const traits = useMemo(() => (mine.length ? writingTraits(mine.slice(0, 12)) : null), [mine]);

  const save = async (patch: Partial<VoiceSettings>) => {
    setV((x) => ({ ...x, ...patch }));
    await saveVoiceSettings(patch);
  };

  const learn = async () => {
    abort.current = new AbortController();
    setBusy(true);
    try {
      const profile = await generateVoiceProfile(v.authorName, { signal: abort.current.signal });
      setV((x) => ({ ...x, profile }));
      notify('Perfil de linguagem pronto. Revise e ajuste o que precisar.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card stack" id="linguagem" style={{ marginBottom: 'var(--sp-4)' }}>
      <strong>Identidade de linguagem (Palavra da Fé)</strong>
      <span className="small muted">
        Tudo o que a IA escrever — estrutura do estudo, resumos e modalidades — sai na sua voz: natural, pastoral e
        formativa, pela perspectiva da Palavra da Fé, fiel ao livro e separando o que o autor escreveu, a análise da IA e
        a aplicação da fé.
      </span>
      <Toggle label="Usar a minha identidade de linguagem" description="Desligado, a IA escreve de forma neutra." checked={v.enabled} onChange={(enabled) => void save({ enabled })} />
      <TextInput label="Nome do autor" value={v.authorName} onChange={(authorName) => setV((x) => ({ ...x, authorName }))} placeholder="Ex.: Pr. Breno Calado" />
      <div className="row">
        <button className="btn btn-sm" onClick={() => void save({ authorName: v.authorName.trim() }).then(() => notify('Nome salvo.'))}>
          Salvar o nome
        </button>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <strong className="small">Os seus escritos ({mine.length})</strong>
        {mine.length ? (
          <ul className="xr-ai-list" style={{ margin: 0 }}>
            {mine.slice(0, 6).map((m) => (
              <li key={m.id}>{m.title}</li>
            ))}
            {mine.length > 6 && <li>e mais {mine.length - 6}</li>}
          </ul>
        ) : (
          <span className="small dim">
            Nenhum ainda. Abra uma mensagem, estudo ou apostila sua e, na aba Editar, marque “Este é um escrito meu”. Quanto
            mais escritos recentes, mais a IA se aproxima da sua linguagem.
          </span>
        )}
        {traits && (
          <span className="small dim">
            Palavras que o senhor mais usa: {traits.vocabulary.slice(0, 10).join(', ')}.
            {traits.verses.length > 0 && ` Versículos frequentes: ${traits.verses.slice(0, 5).join('; ')}.`}
          </span>
        )}
      </div>

      <TextArea
        label="Perfil da sua linguagem"
        hint="A IA usa este perfil em todo pedido. Pode escrever ou corrigir à mão; a IA também pode montá-lo a partir dos seus escritos."
        rows={8}
        value={v.profile}
        onChange={(profile) => setV((x) => ({ ...x, profile }))}
        placeholder="Ex.: frases diretas; parte sempre da Palavra; liga Antiga e Nova Aliança; termina com aplicação e uma pergunta…"
      />
      <div className="row row-wrap">
        <button className="btn btn-sm" onClick={() => void save({ profile: v.profile }).then(() => notify('Perfil salvo.'))}>
          Salvar o perfil
        </button>
        {busy ? (
          <>
            <span className="small" role="status">
              A IA está lendo os seus escritos…
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
              Parar
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={learn} disabled={!aiOn || !mine.length} title={!aiOn ? 'Ligue a IA acima' : !mine.length ? 'Marque um escrito seu primeiro' : undefined}>
            <Icon name="sparkle" size={14} /> Aprender a minha linguagem com IA
          </button>
        )}
      </div>
      {v.profileAt && (
        <span className="small dim">
          Perfil montado pela IA ({v.profileModel}) a partir de {v.profileFrom} escrito{v.profileFrom === 1 ? '' : 's'}, em{' '}
          {new Date(v.profileAt).toLocaleDateString('pt-BR')}.
        </span>
      )}
    </section>
  );
}
