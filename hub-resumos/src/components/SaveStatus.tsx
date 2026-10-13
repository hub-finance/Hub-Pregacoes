import { Icon } from './Icon';

/**
 * Situação da gravação, sempre no mesmo lugar e com as mesmas palavras:
 * "Salvando…", "Alterações ainda não salvas" ou "Salvo às 10:42".
 */
export function SaveStatus({ saving, pending, savedAt }: { saving?: boolean; pending?: boolean; savedAt?: number | null }) {
  const time = savedAt ? new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <span className={`xr-save small${!saving && !pending && savedAt ? ' ok' : ''}`} role="status" aria-live="polite">
      {saving ? (
        'Salvando…'
      ) : pending ? (
        'Alterações ainda não salvas'
      ) : savedAt ? (
        <>
          <Icon name="check" size={14} /> Salvo às {time}
        </>
      ) : (
        'Tudo salvo neste aparelho'
      )}
    </span>
  );
}
