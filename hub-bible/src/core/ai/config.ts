/**
 * Configuração da IA — chave de API e provedor escolhido.
 *
 * Tudo fica em localStorage, nunca sai do aparelho. A chave é do próprio
 * usuário, fornecida por ele nas Configurações.
 */

const STORAGE_KEY = 'hub-bible:ai-config';

export type AiProviderId = 'openai' | 'gemini' | 'anthropic' | 'groq' | 'none';

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
  groq: 'openai/gpt-oss-120b',
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
  // A Groq troca os modelos com frequência: esta lista é só o ponto de
  // partida. Ao tocar em "Testar", a lista real vem da própria Groq
  // (`fetchGroqModels`) e substitui esta.
  groq: [
    { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
    { value: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
  ],
};

const GROQ_MODELS_KEY = 'hub-bible:ai-models:groq';

/** Modelos que a Groq informou da última vez, guardados no aparelho. */
export function savedGroqModels(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(GROQ_MODELS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((m) => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

export function saveGroqModels(ids: string[]): void {
  try {
    localStorage.setItem(GROQ_MODELS_KEY, JSON.stringify(ids));
  } catch {
    /* sem armazenamento: a lista fixa continua valendo */
  }
}

/** Preferência para texto em português: o maior primeiro. */
export function pickGroqModel(ids: string[]): string | undefined {
  const order = [/gpt-oss-120b/i, /qwen/i, /llama-4|llama-3\.3-70b/i, /gpt-oss/i, /llama/i];
  for (const re of order) {
    const hit = ids.find((id) => re.test(id));
    if (hit) return hit;
  }
  return ids[0];
}

export function modelOptionsFor(id: ProviderKey): Array<{ value: string; label: string }> {
  if (id !== 'groq') return MODEL_OPTIONS[id];
  const ids = savedGroqModels();
  if (!ids.length) return MODEL_OPTIONS.groq;
  const best = pickGroqModel(ids);
  return ids.map((m) => ({ value: m, label: `${m.replace(/^[^/]+\//, '')}${m === best ? ' (recomendado)' : ''}` }));
}

/**
 * O que fica guardado: uma chave e um modelo para cada provedor (o pregador
 * pode ter ChatGPT, Claude e Gemini ao mesmo tempo) e qual está em uso.
 * Antes era uma chave só, apagada ao trocar de provedor; o formato antigo
 * (`{ provider, apiKey, model }`) é lido e convertido sem perder a chave.
 */
export type ProviderKey = Exclude<AiProviderId, 'none'>;
export const PROVIDER_IDS: ProviderKey[] = ['openai', 'anthropic', 'gemini', 'groq'];

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
