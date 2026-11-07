import { useCallback, useState } from 'react';
import { SelectInput, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import {
  loadAiSettings,
  saveAiSettings,
  DEFAULT_MODELS,
  MODEL_OPTIONS,
  PROVIDER_IDS,
  type AiProviderId,
  type AiSettings,
  type ProviderKey,
} from '../../core/ai/config';
import { registerAiProvider } from '../../core/ai/provider';
import { createProvider, testAiKey } from '../../core/ai/chatProvider';

const NAMES: Record<ProviderKey, string> = {
  openai: 'ChatGPT (OpenAI)',
  anthropic: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
};

const PLACEHOLDER: Record<ProviderKey, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  gemini: 'AIza...',
};

const WHERE: Record<ProviderKey, string> = {
  openai: 'Crie a chave em platform.openai.com (API keys). A API é cobrada à parte da assinatura do ChatGPT: precisa de créditos na conta.',
  anthropic: 'Crie a chave em console.anthropic.com (API keys). A API é cobrada à parte da assinatura do Claude: precisa de créditos na conta.',
  gemini: 'Crie a chave em aistudio.google.com (Get API key). O Gemini Flash tem plano gratuito.',
};

const hasKey = (s: AiSettings, id: ProviderKey) => (s.keys[id] ?? '').trim().length > 8;

export function AiConfigPanel() {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const { notify } = useToast();

  const save = useCallback((next: AiSettings) => {
    setSettings(next);
    saveAiSettings(next);
    registerAiProvider(createProvider());
  }, []);

  const setKey = (id: ProviderKey, key: string) => {
    const next = { ...settings, keys: { ...settings.keys, [id]: key.trim() } };
    // a primeira chave cadastrada já entra em uso, sem um passo a mais
    if (next.provider === 'none' && key.trim().length > 8) next.provider = id;
    save(next);
  };

  const setModel = (id: ProviderKey, model: string) =>
    save({ ...settings, models: { ...settings.models, [id]: model } });

  const use = (provider: AiProviderId) => save({ ...settings, provider });

  const removeKey = (id: ProviderKey) => {
    const keys = { ...settings.keys };
    delete keys[id];
    const fallback = PROVIDER_IDS.find((p) => p !== id && hasKey({ ...settings, keys }, p)) ?? 'none';
    save({ ...settings, keys, provider: settings.provider === id ? fallback : settings.provider });
    notify(`Chave do ${NAMES[id]} apagada deste aparelho.`);
  };

  const test = async (id: ProviderKey) => {
    setTesting(id);
    try {
      await testAiKey(id, settings.keys[id] ?? '', settings.models[id]);
      notify(`${NAMES[id]}: conexão funcionando!`);
    } catch (err) {
      notify(`${NAMES[id]}: ${err instanceof Error ? err.message : 'erro ao testar.'}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const inUse = settings.provider;
  const options = [
    { value: 'none', label: 'Desativada (o assistente funciona sem IA)' },
    ...PROVIDER_IDS.map((id) => ({ value: id, label: `${NAMES[id]}${hasKey(settings, id) ? '' : ' — sem chave'}` })),
  ];

  return (
    <div className="stack">
      <SelectInput label="IA em uso" value={inUse} onChange={(v) => use(v as AiProviderId)} options={options} />
      {inUse !== 'none' && !hasKey(settings, inUse) && (
        <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>
          Cole a chave do {NAMES[inUse]} abaixo para ela funcionar.
        </p>
      )}

      {PROVIDER_IDS.map((id) => {
        const saved = hasKey(settings, id);
        return (
          <section key={id} className={`card stack ai-key-card${inUse === id ? ' in-use' : ''}`} aria-label={NAMES[id]}>
            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <strong style={{ flex: 1 }}>{NAMES[id]}</strong>
              <span className="badge">{inUse === id && saved ? 'Em uso' : saved ? 'Chave salva' : 'Sem chave'}</span>
            </div>
            <TextInput
              label={`Chave de API do ${NAMES[id]}`}
              value={settings.keys[id] ?? ''}
              onChange={(v) => setKey(id, v)}
              placeholder={PLACEHOLDER[id]}
              type="password"
            />
            <SelectInput
              label="Modelo"
              value={settings.models[id] || DEFAULT_MODELS[id]}
              onChange={(v) => setModel(id, v)}
              options={MODEL_OPTIONS[id]}
            />
            <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
              <button className="btn btn-sm" disabled={!saved || testing !== null} onClick={() => test(id)}>
                {testing === id ? 'Testando…' : 'Testar'}
              </button>
              {saved && inUse !== id && (
                <button className="btn btn-sm btn-primary" onClick={() => use(id)}>Usar esta</button>
              )}
              {saved && (
                <button className="btn btn-sm btn-ghost" onClick={() => removeKey(id)}>Apagar chave</button>
              )}
            </div>
            <p className="small dim" style={{ margin: 0 }}>{WHERE[id]}</p>
          </section>
        );
      })}

      <div className="card" style={{ background: 'var(--bg-2)', padding: 'var(--sp-3)', borderLeft: '3px solid var(--accent)' }}>
        <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>
          <strong>O que o estudo guiado faz e o que não faz</strong>
        </p>
        <p className="small dim" style={{ margin: 'var(--sp-2) 0 0', lineHeight: 1.6 }}>
          Ele gera comentários sobre contexto histórico, temas, referências cruzadas
          e perguntas de estudo a partir da passagem selecionada. É uma ferramenta
          de apoio — como um comentário bíblico consultivo.
        </p>
        <p className="small dim" style={{ margin: 'var(--sp-2) 0 0', lineHeight: 1.6 }}>
          <strong>Não substitui</strong> a ação do Espírito Santo, o estudo pessoal
          do leitor nem a orientação pastoral. Toda revelação vem de Deus, não de
          um modelo de linguagem. O texto bíblico vem sempre do repositório local,
          nunca do modelo — e todo comentário gerado é identificado como tal,
          separado do texto sagrado.
        </p>
        <p className="small dim" style={{ margin: 'var(--sp-2) 0 0', lineHeight: 1.6 }}>
          As chaves ficam apenas neste dispositivo. Nenhum dado pessoal é
          enviado — só o pedido vai direto ao provedor em uso para gerar o comentário.
        </p>
      </div>
    </div>
  );
}
