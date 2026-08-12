#!/usr/bin/env node
/**
 * Prepara um arquivo de importação a partir de outra instalação do Hub Bible.
 *
 * Junta os 66 livros servidos por um app em `/bible/<traducao>/<LIVRO>.json`
 * num único JSON, no formato que a tela de importação aceita.
 *
 * Uso:
 *   node scripts/preparar-importacao.mjs <url-base> <id-da-traducao> [saida.json]
 *
 * Exemplo:
 *   node scripts/preparar-importacao.mjs https://meu-app.vercel.app pt_ara ara.json
 *
 * ------------------------------------------------------------------------
 * ATENÇÃO — o arquivo gerado é para uso pessoal, no seu próprio dispositivo.
 *
 * Se a tradução for protegida por direitos autorais (ARA, NVI, NTLH, KJA, NAA,
 * ACF), o arquivo NÃO pode ser publicado, redistribuído nem incluído no build
 * de um aplicativo que outras pessoas instalem. Ter o app não é ter a licença
 * do texto. Veja docs/LICENCAS-BIBLIA.md.
 * ------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'bible', 'canon.json'), 'utf8'),
);

const [baseArg, translation, outArg] = process.argv.slice(2);

if (!baseArg || !translation) {
  console.error(`
Uso: node scripts/preparar-importacao.mjs <url-base> <id-da-traducao> [saida.json]

  url-base          endereço do app de origem, sem barra no fim
  id-da-traducao    a pasta em /bible/ — por exemplo pt_ara, pt_naa, pt_ntlh
  saida.json        opcional; padrão é <id-da-traducao>.json

Para descobrir os ids disponíveis, abra no navegador:
  <url-base>/bible/catalog.json
`);
  process.exit(1);
}

const base = baseArg.replace(/\/+$/, '');
const outFile = outArg ?? `${translation}.json`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`Origem:    ${base}/bible/${translation}/`);

  let meta = null;
  try {
    meta = await fetchJson(`${base}/bible/${translation}/meta.json`);
    console.log(`Tradução:  ${meta.name ?? translation}${meta.license ? ` — ${meta.license}` : ''}`);
  } catch {
    console.log('Tradução:  (meta.json não encontrado; seguindo mesmo assim)');
  }

  const books = {};
  let ok = 0;
  let verses = 0;

  for (const canon of CANON) {
    process.stdout.write(`\r  baixando ${canon.osis}…    `);
    try {
      const payload = await fetchJson(`${base}/bible/${translation}/${canon.osis}.json`);
      const chapters = payload.chapters;
      if (!Array.isArray(chapters) || !chapters.length) continue;
      books[canon.osis] = chapters;
      verses += chapters.reduce((sum, c) => sum + c.length, 0);
      ok += 1;
    } catch {
      /* livro ausente na origem — segue para o próximo */
    }
  }
  process.stdout.write('\r');

  if (!ok) {
    console.error(`
Nenhum livro encontrado. Confira:
  - o id da tradução (veja ${base}/bible/catalog.json)
  - se o endereço está correto e acessível
`);
    process.exit(1);
  }

  const payload = {
    translation: meta
      ? { name: meta.name, shortName: meta.shortName, abbrev: meta.abbrev, publisher: meta.publisher }
      : undefined,
    books,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload));
  const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);

  console.log(`✔ ${outFile} — ${ok} livros, ${verses} versículos, ${mb} MB`);
  console.log(`
Agora, no tablet:
  Configurações › Traduções › Importar › escolha ${outFile}

Lembre-se: se esta tradução tem direitos autorais, o arquivo é só seu.
Não repasse a outras pessoas nem publique em lugar nenhum.`);
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}`);
  process.exit(1);
});
