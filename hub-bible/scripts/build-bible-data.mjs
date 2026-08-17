#!/usr/bin/env node
/**
 * ETL das traduções bíblicas -> formato canônico do Hub Bible.
 *
 * Uso:
 *   node scripts/build-bible-data.mjs            (usa cache em scripts/.cache)
 *   node scripts/build-bible-data.mjs --refresh  (baixa novamente as fontes)
 *
 * IMPORTANTE (licenciamento — ver docs/LICENCAS-BIBLIA.md):
 * Só entram aqui traduções em domínio público ou com licença explícita de
 * redistribuição. Traduções protegidas (ARA, NVI, NTLH, KJA, ACF...) NÃO são
 * embutidas: elas ficam registradas no catálogo e são instaladas pelo próprio
 * usuário a partir de uma cópia licenciada (Configurações > Traduções).
 *
 * Saída:
 *   public/bible/<id>/meta.json     -> metadados + índice de livros/capítulos
 *   public/bible/<id>/<OSIS>.json   -> { id, book, name, chapters: string[][] }
 *   public/bible/catalog.json       -> catálogo de traduções disponíveis
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const OUT = path.join(ROOT, 'public', 'bible');
const CANON = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'core', 'bible', 'canon.json'), 'utf8'),
);
const REFRESH = process.argv.includes('--refresh');

/** Traduções livres embutidas no aplicativo. */
const SOURCES = [
  {
    id: 'pt_almeida',
    name: 'Almeida (Domínio Público)',
    shortName: 'ALMEIDA',
    abbrev: 'AL',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1911,
    license: 'Domínio público',
    licenseUrl: 'https://github.com/seven1m/open-bibles',
    publisher: 'João Ferreira de Almeida — revisão em domínio público',
    sourceUrl:
      'https://raw.githubusercontent.com/seven1m/open-bibles/master/por-almeida.usfx.xml',
    file: 'por-almeida.usfx.xml',
    format: 'usfx',
    default: true,
  },
  {
    id: 'pt_blivre',
    name: 'Bíblia Livre',
    shortName: 'BLIVRE',
    abbrev: 'BL',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2018,
    license: 'Domínio público',
    licenseUrl: 'https://github.com/damarals/biblias',
    publisher: 'Projeto Bíblia Livre — texto dedicado ao domínio público',
    sourceUrl: 'https://github.com/damarals/biblias/releases/latest/download/BLIVRE.json',
    file: 'BLIVRE.json',
    format: 'canon-array',
    default: false,
  },
  {
    id: 'pt_tb',
    name: 'Tradução Brasileira',
    shortName: 'TB',
    abbrev: 'TB',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1917,
    license: 'Domínio público',
    licenseUrl: 'https://github.com/damarals/biblias',
    publisher: 'Tradução Brasileira (1917) — usa "Jeová" para o Nome divino',
    sourceUrl: 'https://github.com/damarals/biblias/releases/latest/download/TB.json',
    file: 'TB.json',
    format: 'canon-array',
    default: false,
  },
  {
    id: 'pt_alm1911',
    name: 'Almeida 1911',
    shortName: 'ALM1911',
    abbrev: '1911',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1911,
    license: 'Domínio público',
    licenseUrl: 'https://github.com/damarals/biblias',
    publisher: 'João Ferreira de Almeida, edição de 1911 (grafia da época)',
    sourceUrl: 'https://github.com/damarals/biblias/releases/latest/download/ALM1911.json',
    file: 'ALM1911.json',
    format: 'canon-array',
    default: false,
  },
  {
    id: 'en_kjv',
    name: 'King James Version',
    shortName: 'KJV',
    abbrev: 'KJV',
    language: 'en',
    languageLabel: 'Inglês',
    year: 1769,
    license: 'Domínio público',
    licenseUrl: 'https://github.com/bibleapi/bibleapi-bibles-json',
    publisher: 'Authorized King James Version (1611/1769)',
    sourceUrl:
      'https://raw.githubusercontent.com/bibleapi/bibleapi-bibles-json/master/kjv.json',
    file: 'kjv.json',
    format: 'bibleapi',
    default: false,
  },
];

/**
 * Traduções protegidas por direitos autorais.
 *
 * Entram no catálogo apenas como "slot": nome, editora e sigla — nunca o texto.
 * O texto vem do usuário, que importa no aparelho dele uma cópia que ele já
 * tem direito de usar. Nada aqui é distribuído junto com o aplicativo.
 *
 * `shortName` é também o nome do arquivo com que essas traduções circulam em
 * coletâneas abertas (ARA.json, NVI.json…); a importação usa isso para
 * reconhecer sozinha em qual slot o arquivo escolhido deve cair.
 */
const LICENSED_SLOTS = [
  {
    id: 'pt_acf',
    name: 'Almeida Corrigida Fiel',
    shortName: 'ACF',
    abbrev: 'ACF',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1994,
    publisher: 'Sociedade Bíblica Trinitariana do Brasil',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_ara',
    name: 'Almeida Revista e Atualizada',
    shortName: 'ARA',
    abbrev: 'ARA',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1993,
    publisher: 'Sociedade Bíblica do Brasil',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_arc',
    name: 'Almeida Revista e Corrigida',
    shortName: 'ARC',
    abbrev: 'ARC',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1995,
    publisher: 'Sociedade Bíblica do Brasil',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_as21',
    name: 'Almeida Século 21',
    shortName: 'AS21',
    abbrev: 'AS21',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2009,
    publisher: 'Editora Vida Nova',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_jfaa',
    name: 'Almeida Atualizada',
    shortName: 'JFAA',
    abbrev: 'JFAA',
    language: 'pt-BR',
    languageLabel: 'Português',
    publisher: 'João Ferreira de Almeida, edição atualizada',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_kja',
    name: 'King James Atualizada',
    shortName: 'KJA',
    abbrev: 'KJA',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1999,
    publisher: 'Abba Press / BV Books',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_kjf',
    name: 'King James Fiel',
    shortName: 'KJF',
    abbrev: 'KJF',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2007,
    publisher: 'BV Books',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_naa',
    name: 'Nova Almeida Atualizada',
    shortName: 'NAA',
    abbrev: 'NAA',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2017,
    publisher: 'Sociedade Bíblica do Brasil',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_nbv',
    name: 'Nova Bíblia Viva',
    shortName: 'NBV',
    abbrev: 'NBV',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2007,
    publisher: 'Editora Mundo Cristão',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_ntlh',
    name: 'Nova Tradução na Linguagem de Hoje',
    shortName: 'NTLH',
    abbrev: 'NTLH',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 1988,
    publisher: 'Sociedade Bíblica do Brasil',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_nvi',
    name: 'Nova Versão Internacional',
    shortName: 'NVI',
    abbrev: 'NVI',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2000,
    publisher: 'Biblica / Editora Vida',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_nvt',
    name: 'Nova Versão Transformadora',
    shortName: 'NVT',
    abbrev: 'NVT',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2016,
    publisher: 'Editora Mundo Cristão',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_ol',
    name: 'O Livro',
    shortName: 'OL',
    abbrev: 'OL',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2000,
    publisher: 'Biblica',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_mens',
    name: 'A Mensagem',
    shortName: 'MENS',
    abbrev: 'MENS',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2016,
    publisher: 'Editora Vida',
    license: 'Direitos reservados da editora',
  },
  {
    id: 'pt_vfl',
    name: 'Versão Fácil de Ler',
    shortName: 'VFL',
    abbrev: 'VFL',
    language: 'pt-BR',
    languageLabel: 'Português',
    year: 2017,
    publisher: 'Bible League International',
    license: 'Direitos reservados da editora',
  },
];

const byOsis = new Map(CANON.map((b) => [b.osis, b]));

async function download(source) {
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, source.file);
  if (fs.existsSync(dest) && !REFRESH) return dest;
  process.stdout.write(`  baixando ${source.file}... `);
  const res = await fetch(source.sourceUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${source.sourceUrl}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('ok');
  return dest;
}

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const clean = (s) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** USFX (eBible.org) -> { OSIS: string[][] } */
function parseUsfx(raw) {
  const books = {};
  const bookRe = /<book id="([A-Z0-9]{3})"[^>]*>([\s\S]*?)<\/book>/g;
  let bm;
  while ((bm = bookRe.exec(raw))) {
    const osis = bm[1];
    if (!byOsis.has(osis)) continue;
    const chapters = [];
    let current = null;
    const tokenRe = /<c id="(\d+)"\s*\/>|<v id="([\d\-a-z]+)"\s*\/>([\s\S]*?)<ve\s*\/>/g;
    let tm;
    while ((tm = tokenRe.exec(bm[2]))) {
      if (tm[1] !== undefined) {
        current = [];
        chapters[Number(tm[1]) - 1] = current;
      } else if (current) {
        const n = parseInt(tm[2], 10);
        const text = clean(tm[3]);
        // versículos combinados (ex.: id="3-4") ocupam a primeira posição
        if (Number.isFinite(n) && n >= 1) current[n - 1] = text;
        else current.push(text);
      }
    }
    books[osis] = chapters.map((c) => (c || []).map((v) => v || ''));
  }
  return books;
}

/** bibleapi ({resultset.row[].field:[id,book,chapter,verse,text]}) -> { OSIS: string[][] } */
function parseBibleApi(raw) {
  const rows = JSON.parse(raw).resultset.row;
  const books = {};
  for (const r of rows) {
    const [, bookNum, chapter, verse, text] = r.field;
    const meta = CANON[bookNum - 1];
    if (!meta) continue;
    const b = (books[meta.osis] ||= []);
    const c = (b[chapter - 1] ||= []);
    c[verse - 1] = String(text).trim();
  }
  for (const osis of Object.keys(books)) {
    books[osis] = books[osis].map((c) => (c || []).map((v) => v || ''));
  }
  return books;
}

/** Lista de livros na ordem canônica: [{ abbrev, chapters: [[...]] }] */
function parseCanonArray(raw) {
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('Esperava uma lista de livros.');
  const books = {};
  entries.forEach((entry, index) => {
    const meta = CANON[index];
    if (!meta || !Array.isArray(entry?.chapters)) return;
    books[meta.osis] = entry.chapters.map((chapter) =>
      chapter.map((verse) => String(verse ?? '').replace(/\s+/g, ' ').trim()),
    );
  });
  return books;
}

const PARSERS = {
  usfx: parseUsfx,
  bibleapi: parseBibleApi,
  'canon-array': parseCanonArray,
};

async function buildTranslation(source) {
  console.log(`\n▶ ${source.id} — ${source.name}`);
  const file = await download(source);
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const parser = PARSERS[source.format];
  if (!parser) throw new Error(`Formato desconhecido: ${source.format}`);
  const parsed = parser(raw);

  const dir = path.join(OUT, source.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const books = [];
  let totalVerses = 0;
  for (const meta of CANON) {
    const chapters = parsed[meta.osis];
    if (!chapters || !chapters.length) {
      console.warn(`  ! livro ausente: ${meta.osis}`);
      continue;
    }
    const payload = {
      translation: source.id,
      book: meta.osis,
      name: meta.name,
      chapters,
    };
    fs.writeFileSync(path.join(dir, `${meta.osis}.json`), JSON.stringify(payload));
    const verseCounts = chapters.map((c) => c.length);
    totalVerses += verseCounts.reduce((a, b) => a + b, 0);
    books.push({
      osis: meta.osis,
      order: meta.order,
      name: meta.name,
      abbrev: meta.abbrev,
      testament: meta.testament,
      chapters: chapters.length,
      verseCounts,
    });
  }

  const meta = {
    id: source.id,
    name: source.name,
    shortName: source.shortName,
    abbrev: source.abbrev,
    language: source.language,
    languageLabel: source.languageLabel,
    year: source.year,
    license: source.license,
    licenseUrl: source.licenseUrl,
    publisher: source.publisher,
    sourceUrl: source.sourceUrl,
    bundled: true,
    books,
    stats: { books: books.length, chapters: books.reduce((a, b) => a + b.chapters, 0), verses: totalVerses },
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
  console.log(
    `  ✔ ${meta.stats.books} livros · ${meta.stats.chapters} capítulos · ${meta.stats.verses} versículos`,
  );
  return meta;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const catalog = [];
  for (const source of SOURCES) {
    const meta = await buildTranslation(source);
    catalog.push({
      id: meta.id,
      name: meta.name,
      shortName: meta.shortName,
      abbrev: meta.abbrev,
      language: meta.language,
      languageLabel: meta.languageLabel,
      year: meta.year,
      license: meta.license,
      licenseUrl: meta.licenseUrl,
      publisher: meta.publisher,
      sourceUrl: meta.sourceUrl,
      bundled: true,
      default: !!source.default,
      stats: meta.stats,
    });
  }
  for (const slot of LICENSED_SLOTS) {
    catalog.push({ ...slot, bundled: false, default: false, requiresLicense: true });
  }
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));
  console.log(`\n✔ catálogo com ${catalog.length} traduções (${SOURCES.length} embutidas)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
