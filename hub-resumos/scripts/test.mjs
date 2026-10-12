/**
 * Testes do Hub Resumos: a leitura do texto, os cartões, o resumo, o plano de
 * ação, o mapa de conceitos, a importação (Word e cópia do Hub Bible) e o
 * banco de dados (sobre um IndexedDB em memória).
 *
 * Uso: npm test
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '.cache');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'run.mjs');

await build({
  entryPoints: [join(here, 'test', 'run.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  packages: 'external',
  logLevel: 'warning',
});
process.env.TEST_OUT = outDir;
await import(pathToFileURL(outfile).href);
