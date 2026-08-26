import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * O que a lupa do alto da tela procura.
 *
 * Ela sempre levou à busca bíblica. Faz sentido na leitura; não faz em Cursos,
 * Rhema e Sermões, onde quem toca na lupa quer achar alguma coisa **ali** — o
 * curso na lista, ou uma palavra dentro da apostila aberta. Ir parar na busca
 * bíblica, nessas telas, é o aplicativo respondendo outra pergunta.
 *
 * Cada tela que sabe procurar em si mesma registra a sua busca aqui enquanto
 * está aberta. A lupa usa a que estiver registrada; não havendo nenhuma, segue
 * para a busca bíblica, como sempre fez.
 */

type Handler = () => void;

interface Scope {
  register: (handler: Handler) => () => void;
  /** A busca da tela atual, ou `null` quando não há uma. */
  current: Handler | null;
}

const SearchScopeContext = createContext<Scope | null>(null);

export function SearchScopeProvider({ children }: { children: ReactNode }) {
  /* Uma pilha, e não um valor só: ao trocar de tela, React monta a nova antes
     de desmontar a anterior. Com um valor simples, a desmontagem da tela velha
     apagaria a busca da tela nova, e a lupa voltaria calada para a Bíblia. */
  const stack = useRef<Handler[]>([]);
  const [current, setCurrent] = useState<Handler | null>(null);

  const scope: Scope = {
    register: (handler) => {
      stack.current.push(handler);
      setCurrent(() => handler);
      return () => {
        stack.current = stack.current.filter((h) => h !== handler);
        const top = stack.current[stack.current.length - 1] ?? null;
        setCurrent(() => top);
      };
    },
    current,
  };

  return <SearchScopeContext.Provider value={scope}>{children}</SearchScopeContext.Provider>;
}

/**
 * Registra a busca desta tela enquanto ela estiver aberta.
 *
 * `enabled` existe para as telas que só às vezes têm o que procurar — um
 * material aberto, por exemplo, contra um documento escrito à mão.
 */
export function useRegisterSearch(handler: Handler, enabled = true): void {
  const scope = useContext(SearchScopeContext);
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!scope || !enabled) return;
    // a função registrada é estável; quem muda é o que ela chama
    return scope.register(() => ref.current());
    // `scope` vem do provider e não muda; registrar de novo a cada desenho
    // faria a pilha crescer sem parar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** A busca da tela atual, para a lupa do alto. `null` = usar a busca bíblica. */
export function useScopedSearch(): Handler | null {
  return useContext(SearchScopeContext)?.current ?? null;
}
