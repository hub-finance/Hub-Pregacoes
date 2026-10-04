/**
 * Configuração da IA — chave de API e provedor escolhido.
 *
 * Tudo fica em localStorage, nunca sai do aparelho. A chave é do próprio
 * usuário, fornecida por ele nas Configurações.
 */

const STORAGE_KEY = 'hub-bible:ai-config';

export type AiProviderId = 'openai' | 'gemini' | 'none';

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
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* modo privado */ }
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* modo privado */ }
}
