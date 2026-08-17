import { useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { readJsonFile } from '../../core/backup';
import { importTranslation } from '../../core/bible/repository';
import type { TranslationInfo } from '../../core/db/types';

/**
 * Importação de uma tradução que o usuário já tem direito de usar.
 *
 * O texto importado fica **só neste aparelho** — vai para o IndexedDB do
 * navegador, não sobe para lugar nenhum e não acompanha o aplicativo quando
 * outra pessoa o instala. É por isso que as traduções protegidas aparecem no
 * catálogo como espaço vazio: o nome e a editora são do app, o texto é da
 * cópia de quem importou.
 *
 * O mesmo gancho serve ao gerenciador em Ajustes e à troca de tradução dentro
 * da leitura, para que o caminho seja um só.
 */

/** Sem slot escolhido, o nome do arquivo decide o lugar dele. */
function slotForFile(file: File, catalog: TranslationInfo[]): TranslationInfo {
  const base = file.name.replace(/\.[^.]+$/, '').trim();
  const key = base.toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* Coletâneas abertas distribuem esses arquivos com o nome da sigla
     (ARA.json, NVI.json…), que é justamente o `shortName` do catálogo. */
  const match = catalog.find(
    (t) =>
      t.shortName.toUpperCase().replace(/[^A-Z0-9]/g, '') === key ||
      t.abbrev.toUpperCase().replace(/[^A-Z0-9]/g, '') === key,
  );
  if (match) return match;

  // sigla desconhecida: vira uma tradução do próprio usuário, com o nome do arquivo
  return {
    id: `user_${(key || Date.now().toString(36)).toLowerCase()}`,
    name: base || 'Tradução importada',
    shortName: (base || 'Importada').slice(0, 24),
    abbrev: (key || 'IMP').slice(0, 6),
    language: 'pt-BR',
    languageLabel: 'Português',
    license: 'Cópia sua, neste aparelho',
    bundled: false,
  };
}

interface Options {
  /** Catálogo atual — usado para reconhecer o slot pelo nome do arquivo. */
  catalog: TranslationInfo[];
  /** Chamado depois de importar, para recarregar as listas. */
  onImported?: (info: TranslationInfo) => void;
}

export function useTranslationImport({ catalog, onImported }: Options) {
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<TranslationInfo | null>(null);
  /** id da tradução sendo gravada — ou `'?'` quando o slot ainda é desconhecido. */
  const [busy, setBusy] = useState<string | null>(null);

  /** `null` = "importar qualquer arquivo"; o slot sai do nome dele. */
  const pick = (slot: TranslationInfo | null) => {
    slotRef.current = slot;
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const chosen = slotRef.current;
    slotRef.current = null;
    setBusy(chosen?.id ?? '?');
    try {
      const data = await readJsonFile(file);
      const info = chosen ?? slotForFile(file, catalog);
      const result = await importTranslation(info, data);
      notify(
        `${info.shortName}: ${result.books} livros e ${result.verses.toLocaleString('pt-BR')} versículos neste aparelho.`,
      );
      onImported?.(info);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/json,.json"
      className="sr-only"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  );

  return { input, pick, busy };
}
