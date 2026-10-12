/**
 * Testes do módulo "Gerar e Exportar Arquivos".
 *
 * Gera arquivos de verdade (Word, PDF e Markdown) fora do navegador, abre cada
 * um e confere o conteúdo: texto completo, acentos, tabelas, listas, citações,
 * sumário, número de páginas. Também exercita a camada de dados (rascunho,
 * aprovação, versões, arquivos, biblioteca) sobre um IndexedDB em memória.
 *
 * Uso:  npm run test:export
 * Os arquivos gerados ficam em scripts/.cache/export-test/ para inspeção.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '.cache', 'export-test');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'run.mjs');

await build({
  entryPoints: [join(here, 'export-test', 'run.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  packages: 'external',
  logLevel: 'warning',
  // o que o Vite injeta no app; aqui não há servidor, só os valores
  define: {
    'import.meta.env': JSON.stringify({ BASE_URL: './', MODE: 'test', DEV: false, PROD: true }),
    __HUB_BUILD__: JSON.stringify('test'),
  },
});

process.env.EXPORT_TEST_OUT = outDir;
process.env.EXPORT_TEST_FONTS = join(here, '..', 'public', 'fonts');
await import(pathToFileURL(outfile).href);
