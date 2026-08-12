import { useCallback, useEffect, useRef, useState } from 'react';

/** Estado de conectividade — o app avisa claramente quando está offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/** Carregamento assíncrono com controle de corrida e recarga manual. */
export function useAsync<T>(factory: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const run = ++latest.current;
    setLoading(true);
    setError(null);
    factory()
      .then((result) => {
        if (latest.current === run) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (latest.current === run) {
          setError(err);
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** Valor com atraso — evita buscar a cada tecla digitada. */
export function useDebounced<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Detecta layout de tablet/desktop para alternar entre painel lateral e sheet. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof matchMedia !== 'undefined' ? matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useIsTablet = () => useMediaQuery('(min-width: 900px)');
