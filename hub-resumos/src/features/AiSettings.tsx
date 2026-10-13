import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { TextInput } from '../components/ui';
import { DEFAULT_GEMINI_MODEL, GEMINI_KEY_SETTING, GEMINI_MODEL_SETTING, getGeminiConfig, testGeminiKey } from '../core/ai';
import { setSetting } from '../core/db';

/** Dados e ajustes › IA (opcional): a chave do Gemini, guardada só neste aparelho. */
export function AiSettings() {
  const { notify } = useToast();
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    void getGeminiConfig().then((c) => {
      setKey(c.key);
      setModel(c.model === DEFAULT_GEMINI_MODEL ? '' : c.model);
      setSaved(!!c.key);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const cfg = { key: key.trim(), model: model.trim() || DEFAULT_GEMINI_MODEL };
      if (cfg.key) await testGeminiKey(cfg);
      await setSetting(GEMINI_KEY_SETTING, cfg.key);
      await setSetting(GEMINI_MODEL_SETTING, model.trim());
      setSaved(!!cfg.key);
      notify(cfg.key ? 'Chave conferida e salva. A IA já pode ser usada.' : 'IA desligada.');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card stack" style={{ marginBottom: 'var(--sp-4)' }} id="ia">
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <strong>Inteligência artificial (opcional)</strong>
        <span className={`badge${saved ? ' xr-badge-ok' : ''}`}>{saved ? 'Ligada · Gemini' : 'Desligada'}</span>
      </div>
      <span className="small muted">
        Com a IA do Google (Gemini), o app resume cada capítulo e o livro inteiro com as próprias palavras: resumo, ideias
        principais, aplicações, perguntas e conceitos. Sem a chave, tudo continua funcionando sem IA.
      </span>
      <ol className="small muted xr-help-ol">
        <li>
          Entre em{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{' '}
          com a sua conta Google.
        </li>
        <li>Toque em “Create API key” (Criar chave) e copie a chave.</li>
        <li>Cole aqui e toque em “Conferir e salvar”.</li>
      </ol>
      <div className="row row-wrap" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 240px' }}>
          <TextInput label="Chave do Gemini" value={key} onChange={setKey} placeholder="AIza…" type={show ? 'text' : 'password'} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShow((v) => !v)} aria-pressed={show}>
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <TextInput label="Modelo (opcional)" value={model} onChange={setModel} placeholder={`${DEFAULT_GEMINI_MODEL} (padrão)`} />
      <div className="row row-wrap">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Conferindo…' : 'Conferir e salvar'}
        </button>
        {saved && (
          <button
            className="btn btn-ghost"
            onClick={async () => {
              setKey('');
              await setSetting(GEMINI_KEY_SETTING, '');
              setSaved(false);
              notify('IA desligada. A chave foi apagada deste aparelho.');
            }}
          >
            Desligar a IA
          </button>
        )}
      </div>
      <span className="small dim">
        A chave fica só neste aparelho. Quando o senhor pede um resumo, o texto daquela parte (ou do livro) vai direto
        daqui para o Google, sem passar por outro servidor. O uso pode ter custo ou limite, conforme o plano da sua conta
        Google. O que a IA escreve fica marcado como “feito pela IA” e separado do texto original.
      </span>
    </section>
  );
}
