// 在 dist 子目录写入 package.json 的 type 标记，
// 让 Node 正确解释各自的 .js 文件格式：
//   dist/cjs -> CommonJS（供 NestJS API 通过 require 消费）
//   dist/esm -> ESM（供 Vite/Rollup 等打包器通过 import 消费）
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');

const markers = [
  ['cjs', { type: 'commonjs' }],
  ['esm', { type: 'module' }],
];

for (const [sub, content] of markers) {
  const dir = resolve(distDir, sub);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'package.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

console.log('[shared] dist 格式标记写入完成 (cjs/esm)');
