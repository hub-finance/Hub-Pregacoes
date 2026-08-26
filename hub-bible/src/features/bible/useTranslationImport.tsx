import { useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { readJsonFile } from '../../core/backup';
import { importTranslation } from '../../core/bible/repository';
import type { BookMeta, TranslationInfo } from '../../core/db/types';

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

/** Módulo do MyBible — o nome do arquivo é o que distingue os dois caminhos. */
const isModule = (file: File) => /\.(sqlite3?|db)$/i.test(file.name);

/** O próprio arquivo diz se é Bíblia ou dicionário — basta olhar as tabelas. */
async function isDictionaryModule(buffer: ArrayBuffer): Promise<boolean> {
  const { SQLiteFile } = await import('../../core/sqlite/reader');
  const { moduleKind } = await import('../../core/bible/mybible');
  return moduleKind(SQLiteFile.open(buffer)) === 'dictionary';
}

/**
 * Dizer na hora se o módulo é a Bíblia toda ou só uma parte.
 *
 * Sem isso, importar um módulo só do Novo Testamento parece ter dado certo —
 * e o erro só aparece depois, ao abrir um livro do Antigo que não existe ali.
 */
function coverage(books: BookMeta[]): string {
  if (books.length >= 66) return 'Bíblia completa.';
  const at = books.filter((b) => b.testament === 'AT').length;
  const nt = books.length - at;
  if (!at) return 'Só o Novo Testamento.';
  if (!nt) return 'Só o Antigo Testamento.';
  return `Cânone parcial — faltam ${66 - books.length} livros.`;
}

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
  onImported?: (info: TranslationInfo | null) => void;
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
      if (isModule(file)) await importModule(file, chosen);
      else await importJson(file, chosen);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const importJson = async (file: File, chosen: TranslationInfo | null) => {
    const data = await readJsonFile(file);
    const info = chosen ?? slotForFile(file, catalog);
    const result = await importTranslation(info, data);
    notify(
      `${info.shortName}: ${result.books} livros e ${result.verses.toLocaleString('pt-BR')} versículos` +
        (result.translation.hasStrong ? ', com números Strong' : '') +
        ` neste aparelho. ${coverage(result.translation.books)}`,
    );
    onImported?.(result.translation);
  };

  /* Módulo do MyBible: um banco SQLite inteiro, lido aqui mesmo. É a forma mais
     comum de uma Bíblia com números Strong circular — mas não a única: um JSON
     que traga a marcação `<S>` no texto também entra, por `importJson`. */
  const importModule = async (file: File, chosen: TranslationInfo | null) => {
    const { importMyBibleBible } = await import('../../core/bible/mybibleImport');
    const buffer = await file.arrayBuffer();

    /* Bíblia e dicionário chegam no mesmo formato e pelo mesmo botão. Mandar o
       usuário escolher "qual tipo" antes seria pedir que ele soubesse o que
       tem no arquivo — o arquivo sabe. */
    if (await isDictionaryModule(buffer)) {
      const { importDictionaryModule } = await import('../../core/data/dictionaries');
      const dic = await importDictionaryModule(buffer, file.name);
      notify(
        `${dic.dictionary.name}: ${dic.entries.toLocaleString('pt-BR')} verbetes` +
          (dic.dictionary.isStrong ? ', ligados aos números Strong.' : '.'),
      );
      onImported?.(null);
      return;
    }

    const result = await importMyBibleBible(buffer, chosen, file.name);
    const name = result.translation.shortName;
    const extras = [
      result.strong ? 'números Strong' : '',
      result.pericopes ? `${result.pericopes.toLocaleString('pt-BR')} títulos de seção` : '',
    ].filter(Boolean);
    notify(
      `${name}: ${result.books} livros e ${result.verses.toLocaleString('pt-BR')} versículos` +
        (extras.length ? `, com ${extras.join(' e ')}` : '') +
        `. ${coverage(result.translation.books)}`,
    );
    onImported?.(result.translation);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/json,.json,.SQLite3,.sqlite3,.sqlite,application/octet-stream"
      className="sr-only"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  );

  return { input, pick, busy };
}
