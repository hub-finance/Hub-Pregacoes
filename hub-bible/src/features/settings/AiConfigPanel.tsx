import { useCallback, useState } from 'react';
import { SelectInput, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import {
  loadAiConfig,
  saveAiConfig,
  DEFAULT_MODELS,
  MODEL_OPTIONS,
  type AiConfig,
  type AiProviderId,
} from '../../core/ai/config';
import { registerAiProvider } from '../../core/ai/provider';
import { createProvider } from '../../core/ai/chatProvider';

const PROVIDER_OPTIONS = [
  { value: 'none', label: 'Desativado' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
];

export function AiConfigPanel() {
  const [config, setConfig] = useState<AiConfig>(loadAiConfig);
  const [testing, setTesting] = useState(false);
  const { notify } = useToast();

  const save = useCallback((next: AiConfig) => {
    setConfig(next);
    saveAiConfig(next);
    registerAiProvider(createProvider());
  }, []);

  const handleProviderChange = (id: string) => {
    const provider = id as AiProviderId;
    const model = provider !== 'none' ? DEFAULT_MODELS[provider] : '';
    save({ ...config, provider, model, apiKey: provider === config.provider ? config.apiKey : '' });
  };

  const handleKeyChange = (apiKey: string) => {
    save({ ...config, apiKey });
  };

  const handleModelChange = (model: string) => {
    save({ ...config, model });
  };

  const testConnection = async () => {
    if (!config.apiKey || config.provider === 'none') return;
    setTesting(true);
    try {
      const provider = createProvider();
      if (!provider) {
        notify('Configure a chave de API primeiro.', 'error');
        return;
      }
      await provider.run({
        task: 'contexto-historico',
        translation: 'pt_almeida',
        reference: 'João 3:16',
        passage: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito',
      });
      notify('Conexão funcionando!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao testar a conexão.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const active = config.provider !== 'none' && config.apiKey.length > 8;

  return (
    <div className="stack">
      <SelectInput
        label="Provedor"
        value={config.provider}
        onChange={handleProviderChange}
        options={PROVIDER_OPTIONS}
      />

      {config.provider !== 'none' && (
        <>
          <TextInput
            label="Chave de API"
            value={config.apiKey}
            onChange={handleKeyChange}
            placeholder={config.provider === 'openai' ? 'sk-...' : 'AIza...'}
            type="password"
          />

          <SelectInput
            label="Modelo"
            value={config.model}
            onChange={handleModelChange}
            options={MODEL_OPTIONS[config.provider]}
          />

          <div className="row">
            <span style={{ flex: 1 }}>
              Status: <strong>{active ? 'Ativa' : 'Aguardando chave'}</strong>
            </span>
            <button
              className="btn btn-sm"
              onClick={testConnection}
              disabled={!active || testing}
            >
              {testing ? 'Testando…' : 'Testar conexão'}
            </button>
          </div>

          <p className="small dim">
            {config.provider === 'gemini'
              ? 'O Gemini Flash tem plano gratuito. Crie sua chave em ai.google.dev.'
              : 'Crie sua chave em platform.openai.com. Requer créditos na conta.'}
          </p>
        </>
      )}

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
          A chave de API fica apenas neste dispositivo. Nenhum dado pessoal é
          enviado — só a passagem selecionada vai ao provedor para gerar o comentário.
        </p>
      </div>
    </div>
  );
}
