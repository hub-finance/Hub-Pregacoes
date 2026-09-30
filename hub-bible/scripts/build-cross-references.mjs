#!/usr/bin/env node

/**
 * Gera o arquivo de referências cruzadas do Hub Bible.
 *
 * Duas fontes:
 *
 * 1. Referências curadas por tema teológico, definidas em TEMAS (bidirecionais).
 * 2. Referências da comunidade openbible.info (CC-BY), baixadas de
 *    scrollmapper/bible_databases — ~340 mil entradas com votos de qualidade.
 *    O script baixa o arquivo na primeira execução e guarda em .cache/.
 *
 * Formato de saída: { "ROM.5.1": ["GAL.2.16","EPH.2.8",...], ... }
 * Chave OSIS: LIVRO.CAPÍTULO.VERSÍCULO (1-based).
 *
 * Uso: node scripts/build-cross-references.mjs
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'reference', 'cross-references.json');
const CACHE_DIR = join(__dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'cross_references.txt');

const OPENBIBLE_URL =
  'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras/cross_references.txt';

/* ───────── Mapa: abreviação openbible.info → código OSIS do Hub Bible ───────── */

const OPENBIBLE_TO_OSIS = {
  Gen: 'GEN',   Exod: 'EXO',  Lev: 'LEV',   Num: 'NUM',   Deut: 'DEU',
  Josh: 'JOS',  Judg: 'JDG',  Ruth: 'RUT',   '1Sam': '1SA', '2Sam': '2SA',
  '1Kgs': '1KI','2Kgs': '2KI','1Chr': '1CH', '2Chr': '2CH', Ezra: 'EZR',
  Neh: 'NEH',   Esth: 'EST',  Job: 'JOB',    Ps: 'PSA',     Prov: 'PRO',
  Eccl: 'ECC',  Song: 'SNG',  Isa: 'ISA',    Jer: 'JER',    Lam: 'LAM',
  Ezek: 'EZK',  Dan: 'DAN',   Hos: 'HOS',    Joel: 'JOL',   Amos: 'AMO',
  Obad: 'OBA',  Jonah: 'JON', Mic: 'MIC',    Nah: 'NAM',    Hab: 'HAB',
  Zeph: 'ZEP',  Hag: 'HAG',   Zech: 'ZEC',   Mal: 'MAL',
  Matt: 'MAT',  Mark: 'MRK',  Luke: 'LUK',   John: 'JHN',   Acts: 'ACT',
  Rom: 'ROM',   '1Cor': '1CO','2Cor': '2CO', Gal: 'GAL',    Eph: 'EPH',
  Phil: 'PHP',  Col: 'COL',   '1Thess': '1TH','2Thess': '2TH',
  '1Tim': '1TI','2Tim': '2TI',Titus: 'TIT',  Phlm: 'PHM',   Heb: 'HEB',
  Jas: 'JAS',   '1Pet': '1PE','2Pet': '2PE', '1John': '1JN',
  '2John': '2JN','3John': '3JN',Jude: 'JUD', Rev: 'REV',
};

/* ───────── Referências curadas por tema (bidirecionais) ───────── */

const TEMAS = {
  justificacao: [
    ['ROM.1.17', 'HAB.2.4', 'GAL.3.11', 'HEB.10.38'],
    ['ROM.3.21', 'ROM.3.22', 'ROM.3.23', 'ROM.3.24', 'ROM.3.25', 'ROM.3.26'],
    ['ROM.3.28', 'GAL.2.16', 'EPH.2.8', 'EPH.2.9'],
    ['ROM.4.3', 'GEN.15.6', 'GAL.3.6', 'JAS.2.23'],
    ['ROM.4.5', 'ROM.4.6', 'ROM.4.7', 'ROM.4.8', 'PSA.32.1', 'PSA.32.2'],
    ['ROM.5.1', 'ROM.5.2', 'GAL.2.16', 'EPH.2.8'],
    ['ROM.5.9', 'ROM.5.10', 'ROM.5.11', 'COL.1.20', 'COL.1.21', 'COL.1.22'],
    ['ROM.5.17', 'ROM.5.18', 'ROM.5.19', 'ROM.5.21'],
    ['ROM.8.1', 'ROM.8.2', 'ROM.8.3', 'ROM.8.4', 'GAL.5.1'],
    ['ROM.8.30', 'ROM.8.33', 'ROM.8.34', 'ISA.50.8', 'ISA.50.9'],
    ['ROM.10.4', 'GAL.3.24', 'GAL.3.25'],
    ['GAL.2.16', 'GAL.2.20', 'GAL.2.21', 'GAL.3.11'],
    ['GAL.3.13', 'GAL.3.14', 'DEU.21.23', 'GAL.3.26'],
    ['PHP.3.8', 'PHP.3.9', 'ROM.10.3', 'ROM.10.4'],
    ['TIT.3.5', 'TIT.3.6', 'TIT.3.7', 'EPH.2.8', 'EPH.2.9'],
    ['2CO.5.21', 'ISA.53.5', 'ISA.53.6', 'ROM.5.19', '1PE.2.24'],
  ],
  graca: [
    ['EPH.2.4', 'EPH.2.5', 'EPH.2.6', 'EPH.2.7', 'EPH.2.8', 'EPH.2.9', 'EPH.2.10'],
    ['ROM.3.24', 'ROM.5.15', 'ROM.5.17', 'ROM.5.20', 'ROM.5.21', 'ROM.6.14'],
    ['ROM.11.5', 'ROM.11.6'],
    ['2CO.12.9', '2CO.12.10'],
    ['JHN.1.14', 'JHN.1.16', 'JHN.1.17'],
    ['2TI.1.9', 'TIT.2.11', 'TIT.2.12', 'TIT.3.7'],
    ['HEB.4.16', '1PE.5.10'],
  ],
  fe: [
    ['HEB.11.1', 'HEB.11.6', 'ROM.10.17'],
    ['HEB.11.8', 'HEB.11.9', 'HEB.11.10', 'GEN.12.1', 'GEN.12.4'],
    ['MRK.11.22', 'MRK.11.23', 'MRK.11.24', 'MAT.21.21', 'MAT.21.22'],
    ['ROM.10.8', 'ROM.10.9', 'ROM.10.10', 'ROM.10.11', 'ROM.10.13'],
    ['ROM.4.17', 'ROM.4.18', 'ROM.4.19', 'ROM.4.20', 'ROM.4.21'],
    ['GAL.5.6', '1JN.5.4', '1JN.5.5'],
    ['2CO.4.13', 'PSA.116.10'],
    ['2CO.5.7', 'ROM.1.17', 'HEB.10.38'],
    ['JAS.2.17', 'JAS.2.18', 'JAS.2.22', 'JAS.2.26'],
  ],
  redencao: [
    ['EPH.1.7', 'COL.1.14', 'ROM.3.24', '1PE.1.18', '1PE.1.19'],
    ['HEB.9.12', 'HEB.9.14', 'HEB.9.15', 'HEB.9.22', 'HEB.10.10', 'HEB.10.14'],
    ['GAL.3.13', 'GAL.4.4', 'GAL.4.5'],
    ['ISA.53.4', 'ISA.53.5', 'ISA.53.6', 'ISA.53.10', 'ISA.53.11', 'ISA.53.12'],
    ['JHN.19.30', 'HEB.1.3', 'COL.2.14', 'COL.2.15'],
    ['ROM.6.6', 'ROM.6.7', 'ROM.6.8', 'ROM.6.9', 'ROM.6.10', 'ROM.6.11'],
    ['1CO.6.20', '1CO.7.23', 'ACT.20.28'],
    ['REV.5.9', 'REV.5.10'],
  ],
  novaCriacao: [
    ['2CO.5.17', 'GAL.6.15', 'EPH.2.10', 'EPH.4.24', 'COL.3.10'],
    ['EPH.1.3', 'EPH.1.4', 'EPH.1.5', 'EPH.1.6', 'EPH.1.7'],
    ['EPH.2.4', 'EPH.2.5', 'EPH.2.6', 'COL.3.1', 'COL.3.3'],
    ['ROM.6.3', 'ROM.6.4', 'ROM.6.5', 'GAL.3.27', 'COL.2.12'],
    ['GAL.2.20', 'PHP.1.21', 'COL.1.27'],
    ['ROM.8.15', 'ROM.8.16', 'ROM.8.17', 'GAL.4.6', 'GAL.4.7'],
    ['JHN.15.4', 'JHN.15.5', 'JHN.15.7'],
    ['1CO.1.30', '2CO.5.21', 'COL.2.10'],
  ],
  espiritoSanto: [
    ['JHN.14.16', 'JHN.14.17', 'JHN.14.26', 'JHN.16.13'],
    ['ACT.1.8', 'ACT.2.4', 'LUK.24.49'],
    ['ROM.8.9', 'ROM.8.10', 'ROM.8.11', '1CO.6.19'],
    ['ROM.8.14', 'ROM.8.16', 'GAL.5.16', 'GAL.5.18', 'GAL.5.22', 'GAL.5.25'],
    ['1CO.12.4', '1CO.12.7', '1CO.12.8', '1CO.12.9', '1CO.12.10', '1CO.12.11'],
    ['EPH.1.13', 'EPH.1.14', 'EPH.4.30', '2CO.1.22'],
    ['EPH.5.18', 'EPH.5.19', 'ACT.2.4', 'ACT.4.31'],
    ['JHN.3.5', 'JHN.3.6', 'JHN.3.8', 'TIT.3.5'],
  ],
  autoridade: [
    ['LUK.10.19', 'MRK.16.17', 'MRK.16.18'],
    ['EPH.1.19', 'EPH.1.20', 'EPH.1.21', 'EPH.1.22', 'EPH.1.23', 'EPH.2.6'],
    ['EPH.6.10', 'EPH.6.11', 'EPH.6.12', 'EPH.6.13'],
    ['PHP.2.9', 'PHP.2.10', 'PHP.2.11', 'ACT.3.6', 'ACT.3.16'],
    ['COL.2.10', 'COL.2.15', 'COL.1.13'],
    ['JAS.4.7', '1PE.5.8', '1PE.5.9', '1JN.4.4'],
    ['2CO.10.3', '2CO.10.4', '2CO.10.5'],
    ['MAT.28.18', 'MAT.28.19', 'MAT.28.20'],
    ['JHN.14.12', 'JHN.14.13', 'JHN.14.14'],
  ],
  cura: [
    ['ISA.53.4', 'ISA.53.5', 'MAT.8.17', '1PE.2.24'],
    ['PSA.103.2', 'PSA.103.3', 'EXO.15.26', 'EXO.23.25'],
    ['PSA.107.20', 'PRO.4.20', 'PRO.4.21', 'PRO.4.22'],
    ['MAT.8.2', 'MAT.8.3', 'MAT.8.16', 'MAT.8.17'],
    ['MRK.16.17', 'MRK.16.18', 'JAS.5.14', 'JAS.5.15', 'JAS.5.16'],
    ['ACT.10.38', 'LUK.4.18', 'LUK.4.19'],
    ['3JN.1.2', 'JER.30.17'],
  ],
  palavraConfissao: [
    ['ROM.10.8', 'ROM.10.9', 'ROM.10.10', '2CO.4.13', 'PSA.116.10'],
    ['HEB.4.12', 'HEB.4.13', 'EPH.6.17', 'JER.23.29'],
    ['HEB.10.23', 'HEB.3.1', 'HEB.4.14'],
    ['PRO.18.21', 'MAT.12.37'],
    ['JHN.1.1', 'JHN.1.14', 'REV.19.13', '1JN.1.1'],
    ['ISA.55.10', 'ISA.55.11', 'JER.1.12'],
    ['JOS.1.8', 'PSA.1.2', 'PSA.1.3'],
  ],
  provisao: [
    ['PHP.4.19', '2CO.9.8', 'PSA.23.1'],
    ['2CO.8.9', '2CO.9.6', '2CO.9.7', '2CO.9.10', '2CO.9.11'],
    ['MAL.3.10', 'MAL.3.11', 'LUK.6.38'],
    ['GAL.3.13', 'GAL.3.14', 'DEU.28.1', 'DEU.28.2', 'DEU.28.8', 'DEU.28.12'],
    ['MAT.6.31', 'MAT.6.32', 'MAT.6.33', 'LUK.12.31', 'LUK.12.32'],
    ['PSA.34.9', 'PSA.34.10', 'PSA.37.25'],
    ['3JN.1.2', 'DEU.8.18'],
    ['PRO.10.22', 'PRO.3.9', 'PRO.3.10'],
  ],
  oracao: [
    ['JHN.16.23', 'JHN.16.24', 'JHN.15.7', 'JHN.14.13', 'JHN.14.14'],
    ['MRK.11.24', 'MAT.21.22', '1JN.5.14', '1JN.5.15'],
    ['PHP.4.6', 'PHP.4.7', '1PE.5.7'],
    ['JAS.1.5', 'JAS.1.6', 'JAS.1.7'],
    ['JAS.5.16', 'JAS.5.17', 'JAS.5.18'],
    ['EPH.6.18', 'JUD.1.20', 'ROM.8.26', 'ROM.8.27'],
    ['HEB.4.16', 'HEB.10.19', 'HEB.10.22'],
    ['1TI.2.1', '1TI.2.2', '1TI.2.8'],
    ['MAT.6.6', 'MAT.6.9', 'LUK.18.1'],
  ],
  tipologia: [
    ['GEN.3.15', 'GAL.4.4', 'REV.12.5'],
    ['GEN.22.8', 'GEN.22.14', 'JHN.1.29', 'HEB.11.17', 'HEB.11.19'],
    ['EXO.12.3', 'EXO.12.7', 'EXO.12.13', '1CO.5.7', 'JHN.1.29', '1PE.1.19'],
    ['LEV.16.15', 'LEV.16.16', 'HEB.9.7', 'HEB.9.12', 'HEB.9.24'],
    ['LEV.17.11', 'HEB.9.22', 'ROM.3.25'],
    ['NUM.21.8', 'NUM.21.9', 'JHN.3.14', 'JHN.3.15'],
    ['PSA.22.1', 'PSA.22.16', 'PSA.22.18', 'MAT.27.35', 'MAT.27.46', 'JHN.19.24'],
    ['PSA.110.1', 'PSA.110.4', 'HEB.5.6', 'HEB.7.17', 'HEB.7.21', 'ACT.2.34'],
    ['ISA.7.14', 'MAT.1.23'],
    ['JON.1.17', 'MAT.12.40'],
    ['ROM.5.14', 'ROM.5.15', '1CO.15.22', '1CO.15.45'],
    ['HEB.8.6', 'HEB.8.8', 'HEB.8.13', 'JER.31.31', 'JER.31.33', 'JER.31.34'],
  ],
  adaoCristo: [
    ['ROM.5.12', 'ROM.5.14', 'ROM.5.15', 'ROM.5.17', 'ROM.5.19'],
    ['1CO.15.21', '1CO.15.22', '1CO.15.45', '1CO.15.47', '1CO.15.49'],
    ['GEN.1.26', 'GEN.1.27', 'GEN.2.7', '1CO.15.45', 'ROM.8.29'],
    ['GEN.3.17', 'GEN.3.19', 'ROM.8.20', 'ROM.8.21'],
  ],
  santificacao: [
    ['1TH.4.3', '1TH.4.7', '1TH.5.23', 'HEB.12.14'],
    ['ROM.6.1', 'ROM.6.2', 'ROM.6.6', 'ROM.6.11', 'ROM.6.12', 'ROM.6.13', 'ROM.6.14'],
    ['ROM.12.1', 'ROM.12.2', '2CO.3.18'],
    ['GAL.5.16', 'GAL.5.17', 'GAL.5.24', 'GAL.5.25'],
    ['COL.3.1', 'COL.3.2', 'COL.3.3', 'COL.3.5', 'COL.3.9', 'COL.3.10'],
    ['JHN.17.17', 'EPH.5.26', '1PE.1.15', '1PE.1.16'],
    ['HEB.10.10', 'HEB.10.14', '1CO.6.11'],
  ],
  novaAlianca: [
    ['JER.31.31', 'JER.31.33', 'JER.31.34', 'HEB.8.8', 'HEB.8.10', 'HEB.8.12'],
    ['HEB.9.15', 'HEB.12.24', 'LUK.22.20', '1CO.11.25', '2CO.3.6'],
    ['HEB.7.22', 'HEB.8.6', 'HEB.8.13'],
    ['EZK.36.26', 'EZK.36.27', '2CO.3.3', '2CO.3.6'],
    ['ROM.7.6', 'ROM.8.2', '2CO.3.17'],
  ],
};

/* ───────── Funções auxiliares ───────── */

const MAX_REFS_PER_VERSE = 10;
const MIN_VOTES = 3;

function add(refs, from, to) {
  if (from === to) return;
  if (!refs[from]) refs[from] = new Set();
  refs[from].add(to);
}

/**
 * Converte uma referência openbible (Ex: "Prov.8.22") em OSIS do Hub Bible
 * ("PRO.8.22"). Retorna null se o livro não for reconhecido.
 */
function toOsis(ref) {
  const dot = ref.indexOf('.');
  if (dot < 0) return null;
  const book = ref.slice(0, dot);
  const rest = ref.slice(dot); // ".8.22"
  const osis = OPENBIBLE_TO_OSIS[book];
  if (!osis) return null;
  return osis + rest;
}

/**
 * Interpreta uma referência que pode ser um intervalo ("Prov.8.22-Prov.8.30").
 * Retorna apenas o versículo inicial para manter o JSON compacto.
 */
function parseRef(raw) {
  const dash = raw.indexOf('-');
  return toOsis(dash >= 0 ? raw.slice(0, dash) : raw);
}

/* ───────── 1) Referências curadas (bidirecionais) ───────── */

const refs = {};

for (const [, groups] of Object.entries(TEMAS)) {
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i !== j) add(refs, group[i], group[j]);
      }
    }
  }
}

const curatedCount = Object.keys(refs).length;

/* ───────── 2) Referências openbible.info (unidirecionais) ───────── */

async function downloadIfNeeded() {
  if (existsSync(CACHE_FILE)) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Baixando referências cruzadas de openbible.info…');
  const res = await fetch(OPENBIBLE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar: ${res.status}`);
  const text = await res.text();
  writeFileSync(CACHE_FILE, text);
  console.log('Baixado e salvo em cache.');
}

function loadOpenbible() {
  const text = readFileSync(CACHE_FILE, 'utf8');
  const lines = text.split('\n');

  // { "FROM_OSIS": [ { to: "TO_OSIS", votes: N }, ... ] }
  const scored = {};
  let parsed = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const votes = parseInt(parts[2], 10);
    if (isNaN(votes) || votes < MIN_VOTES) { skipped++; continue; }

    const from = parseRef(parts[0]);
    const to = parseRef(parts[1]);
    if (!from || !to || from === to) { skipped++; continue; }

    if (!scored[from]) scored[from] = [];
    scored[from].push({ to, votes });
    parsed++;
  }

  // Ordenar por votos decrescente e pegar apenas os primeiros N
  for (const [from, targets] of Object.entries(scored)) {
    targets.sort((a, b) => b.votes - a.votes);
    const top = targets.slice(0, MAX_REFS_PER_VERSE);
    for (const { to } of top) {
      add(refs, from, to);
    }
  }

  return { parsed, skipped, sources: Object.keys(scored).length };
}

/* ───────── 3) Juntar e gravar ───────── */

async function main() {
  await downloadIfNeeded();
  const ob = loadOpenbible();

  // Converte sets para arrays ordenados
  const result = {};
  const sortedKeys = Object.keys(refs).sort();
  for (const key of sortedKeys) {
    result[key] = [...refs[key]].sort();
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(result);
  writeFileSync(OUT, json);

  const verses = Object.keys(result).length;
  const connections = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(0);

  console.log(`\nReferências curadas: ${curatedCount} versículos.`);
  console.log(`openbible.info: ${ob.parsed.toLocaleString('pt-BR')} entradas aproveitadas de ${ob.sources.toLocaleString('pt-BR')} versículos-fonte (${ob.skipped.toLocaleString('pt-BR')} descartadas).`);
  console.log(`Total: ${verses.toLocaleString('pt-BR')} versículos, ${connections.toLocaleString('pt-BR')} conexões. (${sizeKB} KB)`);
  console.log(`Gravado em ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
