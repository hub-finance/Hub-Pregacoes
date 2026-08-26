/**
 * Gera `public/lexicon/` a partir do léxico de Strong da Open Scriptures.
 *
 * Por que embutir este e não outro: o texto de Strong (1890/1894) é domínio
 * público e a versão JSON da Open Scriptures é CC-BY-SA — pode viajar dentro do
 * aplicativo, ao contrário dos léxicos em português que circulam, todos
 * derivados de edições protegidas. O crédito exigido pela licença aparece na
 * própria tela do Strong; não é enfeite, é condição de uso.
 *
 * Rode com `npm run lexicon:build`. A saída é versionada, como
 * `public/bible/`: quem clona o repositório não precisa de rede para compilar.
 *
 *     node scripts/build-lexicon.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/lexicon');

const SOURCES = [
  {
    testament: 'G',
    url: 'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js',
  },
  {
    testament: 'H',
    url: 'https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js',
  },
];

/**
 * Os arquivos de origem são JavaScript: um comentário de licença, uma
 * atribuição, e o objeto. Pegar do primeiro `{` à última `}` extrai o JSON sem
 * precisar avaliar código de terceiros — que é o ponto.
 */
function parseModule(source) {
  const start = source.indexOf('{', source.indexOf('*/'));
  const end = source.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Formato inesperado no arquivo de origem.');
  return JSON.parse(source.slice(start, end + 1));
}

/**
 * Chaves curtas de propósito.
 *
 * São 14 mil verbetes; `strongs_def` repetido 14 mil vezes custa mais de 150 KB
 * de nome de campo. O arquivo é lido por uma função só, que sabe o que cada
 * letra significa — a economia vale o apelido.
 */
function compact(entry) {
  const out = {};
  if (entry.lemma) out.l = entry.lemma;
  if (entry.translit || entry.xlit) out.t = entry.translit ?? entry.xlit;
  if (entry.pron) out.p = entry.pron;
  if (entry.derivation) out.d = entry.derivation.trim();
  if (entry.strongs_def) out.s = entry.strongs_def.trim();
  if (entry.kjv_def) out.k = entry.kjv_def.trim();
  return out;
}

async function build({ testament, url }) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}`);
  const dictionary = parseModule(await response.text());

  const out = {};
  for (const [code, entry] of Object.entries(dictionary)) {
    // o código vem como `G25`/`H430`; sem zeros à esquerda, como o app consulta
    const key = code.replace(/^([HG])0*(\d+)$/, '$1$2');
    out[key] = compact(entry);
  }

  const file = resolve(OUT, `strongs-${testament === 'G' ? 'grego' : 'hebraico'}.json`);
  await writeFile(file, JSON.stringify(out));
  return { file, entries: Object.keys(out).length };
}

await mkdir(OUT, { recursive: true });
for (const source of SOURCES) {
  const { file, entries } = await build(source);
  console.log(`${file.replace(ROOT + '/', '')}: ${entries} verbetes`);
}
