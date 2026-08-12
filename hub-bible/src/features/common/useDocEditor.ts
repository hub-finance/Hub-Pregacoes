import { useCallback, useEffect, useRef, useState } from 'react';
import { getDoc, saveDoc, type DocKind } from '../../core/data/documents';

interface Options {
  autosaveMs?: number;
}

export interface DocEditor<T> {
  doc: T | null;
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  set: (patch: Partial<T>) => void;
  save: () => Promise<void>;
}

/**
 * Editor com rascunho local e gravação automática.
 * A regra é simples: nada do que o usuário escreve pode se perder — salvamos
 * pouco depois de cada pausa na digitação e também ao sair da tela.
 */
export function useDocEditor<T extends { id: string; updatedAt: number }>(
  kind: DocKind,
  id: string | undefined,
  options: Options = {},
): DocEditor<T> {
  const autosaveMs = options.autosaveMs ?? 900;
  const [doc, setDoc] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const latest = useRef<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!id) {
      setDoc(null);
      setLoading(false);
      return;
    }
    getDoc<T>(kind, id).then((found) => {
      if (cancelled) return;
      setDoc(found ?? null);
      latest.current = found ?? null;
      setLoading(false);
      setDirty(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const save = useCallback(async () => {
    const current = latest.current;
    if (!current) return;
    setSaving(true);
    try {
      const saved = await saveDoc(kind, current);
      latest.current = saved;
      setDoc(saved);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [kind]);

  const set = useCallback((patch: Partial<T>) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      latest.current = next;
      return next;
    });
    setDirty(true);
  }, []);

  // gravação automática após a pausa na digitação
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), autosaveMs);
    return () => clearTimeout(timer);
  }, [dirty, doc, save, autosaveMs]);

  // garante gravação ao desmontar ou ao esconder o app (Android)
  useEffect(() => {
    const flush = () => {
      if (latest.current) void saveDoc(kind, latest.current);
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [kind]);

  return { doc, loading, dirty, saving, set, save };
}
