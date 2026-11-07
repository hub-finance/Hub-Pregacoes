/**
 * Configuração da IA — chave de API e provedor escolhido.
 *
 * Tudo fica em localStorage, nunca sai do aparelho. A chave é do próprio
 * usuário, fornecida por ele nas Configurações.
 */

const STORAGE_KEY = 'hub-bible:ai-config';

export type AiProviderId = 'openai' | 'gemini' | 'anthropic' | 'none';

export interface AiConfig {
  provider: AiProviderId;
  apiKey: string;
  model: string;
}

const DEFAULTS: AiConfig = {
  provider: 'none',
  apiKey: '',
  model: '',
};

export const DEFAULT_MODELS: Record<Exclude<AiProviderId, 'none'>, string> = {
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-3.8-flash',
  anthropic: 'claude-sonnet-5-5',
};

export const MODEL_OPTIONS: Record<Exclude<AiProviderId, 'none'>, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (econômico)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (mais capaz)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  gemini: [
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (gratuito)' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (mais capaz)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  anthropic: [
    { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recomendado)' },
    { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (mais capaz)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (econômico)' },
  ],
};

/**
 * O que fica guardado: uma chave e um modelo para cada provedor (o pregador
 * pode ter ChatGPT, Claude e Gemini ao mesmo tempo) e qual está em uso.
 * Antes era uma chave só, apagada ao trocar de provedor; o formato antigo
 * (`{ provider, apiKey, model }`) é lido e convertido sem perder a chave.
 */
export type ProviderKey = Exclude<AiProviderId, 'none'>;
export const PROVIDER_IDS: ProviderKey[] = ['openai', 'anthropic', 'gemini'];

export interface AiSettings {
  provider: AiProviderId;
  keys: Partial<Record<ProviderKey, string>>;
  models: Partial<Record<ProviderKey, string>>;
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { provider: 'none', keys: {}, models: {} };
    const data = JSON.parse(raw) as Partial<AiSettings> & Partial<AiConfig>;
    const keys = { ...(data.keys ?? {}) };
    const models = { ...(data.models ?? {}) };
    const provider = (data.provider ?? 'none') as AiProviderId;
    // formato antigo: a chave única pertence ao provedor que estava escolhido
    if (provider !== 'none' && data.apiKey && !keys[provider]) keys[provider] = data.apiKey;
    if (provider !== 'none' && data.model && !models[provider]) models[provider] = data.model;
    return { provider, keys, models };
  } catch {
    return { provider: 'none', keys: {}, models: {} };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* modo privado */ }
}

/** A configuração em uso: o provedor escolhido, com a chave e o modelo dele. */
export function loadAiConfig(): AiConfig {
  const s = loadAiSettings();
  if (s.provider === 'none') return DEFAULTS;
  return {
    provider: s.provider,
    apiKey: s.keys[s.provider] ?? '',
    model: s.models[s.provider] || DEFAULT_MODELS[s.provider],
  };
}

export function saveAiConfig(config: AiConfig): void {
  const s = loadAiSettings();
  if (config.provider !== 'none') {
    s.keys[config.provider] = config.apiKey;
    if (config.model) s.models[config.provider] = config.model;
  }
  saveAiSettings({ ...s, provider: config.provider });
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* modo privado */ }
}
