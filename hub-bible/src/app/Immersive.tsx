import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Leitura imersiva — a tela só com o texto.
 *
 * Nos leitores bíblicos que se usam para acompanhar a pregação, as barras sobem
 * e descem: enquanto se lê não há menu nenhum, e um toque traz de volta o pouco
 * que é preciso. O ganho não é estético — numa tela de tablet as três barras
 * (menu lateral, barra do alto, navegação de baixo) comem mais de um terço do
 * espaço que deveria ser texto.
 *
 * Quem decide entrar nesse modo é a tela, por `useImmersiveScreen`. O estado
 * mora aqui, e não dentro da Bíblia, porque quem obedece a ele são as barras do
 * aplicativo, que vivem na casca.
 */

interface ImmersiveApi {
  /** A tela aberta pede leitura imersiva. */
  active: boolean;
  /** As barras estão à vista? */
  chrome: boolean;
  setActive: (value: boolean) => void;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

const ImmersiveContext = createContext<ImmersiveApi | null>(null);

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  /* Começa à mostra: entrar num capítulo e ver a tela ficar vazia de controles
     sem ter tocado em nada assusta. Some quando ele começa a ler — isto é, a
     rolar — que é quando o menu deixou de servir. */
  const [chrome, setChrome] = useState(true);

  const show = useCallback(() => setChrome(true), []);
  const hide = useCallback(() => setChrome(false), []);
  const toggle = useCallback(() => setChrome((v) => !v), []);

  // sair da tela imersiva devolve as barras, sempre
  useEffect(() => {
    if (!active) setChrome(true);
  }, [active]);

  const value = useMemo(
    () => ({ active, chrome, setActive, show, hide, toggle }),
    [active, chrome, show, hide, toggle],
  );

  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

export function useImmersive(): ImmersiveApi {
  const api = useContext(ImmersiveContext);
  if (!api) throw new Error('useImmersive precisa do ImmersiveProvider');
  return api;
}

/**
 * Declara que esta tela lê em modo imersivo enquanto estiver aberta.
 *
 * `enabled` vem da preferência do usuário: quem não quiser o modo continua com
 * as barras fixas, como sempre foi.
 */
export function useImmersiveScreen(enabled: boolean) {
  const { setActive } = useImmersive();
  useEffect(() => {
    setActive(enabled);
    return () => setActive(false);
  }, [enabled, setActive]);
}
