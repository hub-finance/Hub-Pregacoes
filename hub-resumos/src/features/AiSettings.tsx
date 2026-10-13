import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { TextInput } from '../components/ui';
import { GEMINI_AUTO_MODEL_SETTING, GEMINI_KEY_SETTING, GEMINI_MODEL_SETTING, getGeminiConfig, testGeminiKey } from '../core/ai';
import { setSetting } from '../core/db';

/** Dados e ajustes › IA (opcional): a chave do Gemini, guardada só neste aparelho. */
export function AiSettings() {
  const { notify } = useToast();
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [inUse, setInUse] = useState('');

  useEffect(() => {
    void getGeminiConfig().then((c) => {
      // não apaga o que a pessoa já começou a digitar enquanto a tela carregava
      setKey((typed) => typed || c.key);
      setModel((typed) => typed || (c.auto ? '' : c.model));
      setSaved(!!c.key);
      setInUse(c.key ? c.model : '');
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const cfg = { key: key.trim(), model: model.trim() };
      const use = cfg.key ? await testGeminiKey(cfg) : '';
      await setSetting(GEMINI_KEY_SETTING, cfg.key);
      await setSetting(GEMINI_MODEL_SETTING, cfg.model);
      if (!cfg.model) await setSetting(GEMINI_AUTO_MODEL_SETTING, use);
      setSaved(!!cfg.key);
      setInUse(use);
      notify(cfg.key ? `Chave conferida e salva. A IA vai usar o ${use}.` : 'IA desligada.');
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
        <span className={`badge${saved ? ' xr-badge-ok' : ''}`}>{saved ? `Ligada · ${inUse || 'Gemini'}` : 'Desligada'}</span>
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
      <TextInput
        label="Modelo (opcional)"
        value={model}
        onChange={setModel}
        placeholder="Automático: Gemini 3.8 Flash"
        hint="Deixe em branco para usar o Gemini 3.8 Flash. Se a chave não tiver acesso a ele, o app escolhe o Flash mais novo disponível."
      />
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
