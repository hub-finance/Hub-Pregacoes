#!/usr/bin/env node
/**
 * Gera a concordância exaustiva a partir dos JSONs bíblicos.
 *
 * Saída: public/concordance/<tradução>/<LETRA>.json
 * Cada arquivo contém um mapa: palavra → array de ocorrências.
 *
 * Uso: node scripts/build-concordance.mjs [tradução]
 *      (sem argumento, gera para todas as traduções bundled)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIBLE_DIR = path.resolve(__dirname, '..', 'public', 'bible');
const OUT_BASE = path.resolve(__dirname, '..', 'public', 'concordance');
const CANON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'core', 'bible', 'canon.json'), 'utf8'));

const MIN_WORD_LEN = 2;
const STOP_WORDS = new Set([
  'a', 'e', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
  'se', 'ou', 'ao', 'aos', 'por', 'que', 'com', 'não', 'nao',
  'me', 'te', 'lhe', 'eu', 'tu', 'ele', 'ela', 'nós', 'nos',
  'vós', 'vos', 'eles', 'elas', 'lhes',
  'é', 'há', 'à', 'às',
  'mas', 'nem', 'para', 'pois', 'como', 'mais',
  'já', 'até', 'seu', 'sua', 'seus', 'suas',
  'meu', 'minha', 'meus', 'minhas',
  'teu', 'tua', 'teus', 'tuas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas',
  'isto', 'isso', 'aquilo',
  'the', 'and', 'of', 'to', 'in', 'that', 'for', 'is', 'was',
  'his', 'he', 'it', 'with', 'all', 'shall', 'be', 'not',
]);

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function extractWords(text) {
  return text
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_WORD_LEN);
}

function firstLetter(normalized) {
  const ch = normalized.charAt(0);
  if (ch >= '0' && ch <= '9') return '#';
  return ch;
}

function buildForTranslation(translationId) {
  const bibleDir = path.join(BIBLE_DIR, translationId);
  if (!fs.existsSync(bibleDir)) {
    console.error(`  ✗ Diretório não encontrado: ${bibleDir}`);
    return;
  }

  const outDir = path.join(OUT_BASE, translationId);
  fs.mkdirSync(outDir, { recursive: true });

  // palavra normalizada → { display, total, refs: [book, ch, vs][] }
  const index = new Map();
  let totalVerses = 0;

  for (const canon of CANON) {
    const bookFile = path.join(bibleDir, `${canon.osis}.json`);
    if (!fs.existsSync(bookFile)) continue;

    const data = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
    const chapters = data.chapters;
    if (!chapters) continue;

    for (let ch = 0; ch < chapters.length; ch++) {
      const verses = chapters[ch];
      for (let vs = 0; vs < verses.length; vs++) {
        totalVerses++;
        const text = verses[vs];
        const words = extractWords(text);
        const seen = new Set();

        for (const word of words) {
          const norm = normalize(word);
          if (norm.length < MIN_WORD_LEN || STOP_WORDS.has(norm)) continue;
          if (seen.has(norm)) continue;
          seen.add(norm);

          let entry = index.get(norm);
          if (!entry) {
            entry = { display: word.toLowerCase(), total: 0, refs: [] };
            index.set(norm, entry);
          }
          entry.total++;
          entry.refs.push([canon.osis, ch + 1, vs + 1]);
        }
      }
    }
  }

  console.log(`  ${index.size} palavras únicas em ${totalVerses} versículos`);

  // Agrupar por letra
  const byLetter = new Map();
  for (const [norm, entry] of index) {
    const letter = firstLetter(norm);
    if (!byLetter.has(letter)) byLetter.set(letter, {});
    const group = byLetter.get(letter);
    group[norm] = [entry.display, entry.total, entry.refs];
  }

  // Gerar índice resumido (para a UI: lista de letras com contagem)
  const summary = {};
  let totalWords = 0;
  for (const [letter, words] of [...byLetter.entries()].sort()) {
    const count = Object.keys(words).length;
    summary[letter] = count;
    totalWords += count;

    const sorted = Object.fromEntries(
      Object.entries(words).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    );
    fs.writeFileSync(path.join(outDir, `${letter}.json`), JSON.stringify(sorted));
  }

  summary._total = totalWords;
  summary._verses = totalVerses;
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(summary));

  console.log(`  ✔ ${totalWords} palavras, ${byLetter.size} arquivos em ${outDir}`);
}

// --- Main ---
const catalog = JSON.parse(fs.readFileSync(path.join(BIBLE_DIR, 'catalog.json'), 'utf8'));
const requested = process.argv[2];

if (requested) {
  console.log(`Gerando concordância para ${requested}…`);
  buildForTranslation(requested);
} else {
  const bundled = catalog.filter(t => t.bundled);
  console.log(`Gerando concordância para ${bundled.length} tradução(ões)…`);
  for (const t of bundled) {
    console.log(`\n→ ${t.name} (${t.id})`);
    buildForTranslation(t.id);
  }
}

console.log('\nConcordância gerada com sucesso!');
