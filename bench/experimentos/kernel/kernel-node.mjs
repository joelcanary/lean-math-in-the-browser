// Runs kernel.mjs in Node: node bench/experimentos/kernel/kernel-node.mjs OUT.json
import { readFile, writeFile } from 'node:fs/promises';
import { mide } from './kernel.mjs';

const here = new URL('.', import.meta.url);
const modulos = {
  compiled: await readFile(new URL('mpn_mul.wasm', here)),
  vj_once: await readFile(new URL('mpn_mul_vj.wasm', here)),
  carry_last: await readFile(new URL('mpn_mul_assoc.wasm', here)),
  barrier: await readFile(new URL('mpn_mul_barrier.wasm', here)),
};
const res = await mide(modulos, (p) => console.error(p));
await writeFile(process.argv[2] || 'kernel-node.json', JSON.stringify({ nav: 'node', ...res }, null, 1));
