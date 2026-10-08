import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'favicon.svg']) await copyFile(file, `dist/${file}`);
await cp('src', 'dist/src', { recursive: true });
console.log('Built static app in dist/');
