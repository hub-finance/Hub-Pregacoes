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
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
};

export const MODEL_OPTIONS: Record<Exclude<AiProviderId, 'none'>, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (econômico)' },
    { value: 'gpt-4o', label: 'GPT-4o (mais capaz)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (gratuito)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
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
