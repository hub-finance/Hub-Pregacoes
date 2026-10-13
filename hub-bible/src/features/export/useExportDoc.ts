import { useCallback, useEffect, useRef, useState } from 'react';
import { getExportDoc, saveDraft, type DraftPatch } from '../../core/data/exportDocs';
import type { ExportDoc } from '../../core/db/types';

/**
 * Rascunho do documento de exportação, com gravação automática.
 *
 * Mesmo princípio dos outros editores: nada do que o autor ajusta pode se
 * perder. Grava pouco depois de cada pausa e também ao esconder o app.
 */
export function useExportDoc(id: string | undefined) {
  const [doc, setDoc] = useState<ExportDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<DraftPatch>({});
  const latest = useRef<ExportDoc | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const found = await getExportDoc(id);
    latest.current = found ?? null;
    setDoc(found ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    const current = latest.current;
    const patch = pending.current;
    if (!current || !Object.keys(patch).length) return current;
    pending.current = {};
    setSaving(true);
    try {
      const saved = await saveDraft(current.id, patch);
      // o que foi digitado enquanto gravava continua valendo
      const merged = { ...saved, ...pending.current } as ExportDoc;
      latest.current = merged;
      setDoc(merged);
      setDirty(Object.keys(pending.current).length > 0);
      setError(null);
      return merged;
    } catch (err) {
      pending.current = { ...patch, ...pending.current };
      setError((err as Error).message);
      return current;
    } finally {
      setSaving(false);
    }
  }, []);

  const set = useCallback((patch: DraftPatch) => {
    pending.current = { ...pending.current, ...patch };
    setDoc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      latest.current = next;
      return next;
    });
    setDirty(true);
  }, []);

  /** Troca o documento inteiro pelo que veio da camada de dados (aprovar, restaurar…). */
  const replace = useCallback((next: ExportDoc) => {
    pending.current = {};
    latest.current = next;
    setDoc(next);
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [dirty, doc, save]);

  useEffect(() => {
    const flush = () => {
      if (latest.current && Object.keys(pending.current).length) {
        const patch = pending.current;
        pending.current = {};
        // o documento pode ter acabado de ser excluído; aí não há o que gravar
        void saveDraft(latest.current.id, patch).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { doc, loading, dirty, saving, error, set, save, replace, reload };
}
