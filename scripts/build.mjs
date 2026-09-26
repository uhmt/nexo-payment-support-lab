import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
await mkdir('dist/client/assets', { recursive: true });
await mkdir('dist/server', { recursive: true });
await mkdir('.generated', { recursive: true });
await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/client/assets/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});
await copyFile('index.html', 'dist/client/index.html');
const assets = {};
for (const [url, file, type] of [
  ['/index.html', 'dist/client/index.html', 'text/html; charset=utf-8'],
  ['/assets/app.js', 'dist/client/assets/app.js', 'text/javascript; charset=utf-8'],
  ['/assets/app.css', 'dist/client/assets/app.css', 'text/css; charset=utf-8'],
])
  assets[url] = { body: await readFile(file, 'utf8'), type };
await writeFile('.generated/assets.json', JSON.stringify(assets));
await build({
  entryPoints: ['server/worker.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/server/index.js',
  legalComments: 'none',
});
console.log('Built web app and standalone Worker.');
