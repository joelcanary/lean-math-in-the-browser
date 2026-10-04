// CI check for § 4.11 (no timing): every module multiplies correctly against BigInt, at several sizes
// including odd and unequal lengths, and the extract is still byte for byte lean-vir's function 140.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const here = new URL('.', import.meta.url);
const hash = (args) => execFileSync('python', [new URL('cuerpos.py', here).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ...args]).toString().trim();
const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const lean = hash([`${root}site/lean-vir/wasm/vir-upstream.wasm`, '140']);
const ours = hash([new URL('mpn_mul.wasm', here).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '0']);
if (lean !== ours) throw new Error(`mpn_mul.wasm is not lean-vir's function 140: ${ours} vs ${lean}`);

let s = 12345;
const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
const toBig = (d) => { let x = 0n; for (let i = d.length - 1; i >= 0; i--) x = (x << 32n) | BigInt(d[i]); return x; };
let checked = 0;
for (const f of ['mpn_mul', 'mpn_mul_vj', 'mpn_mul_assoc', 'mpn_mul_barrier']) {
  const { instance } = await WebAssembly.instantiate(await readFile(new URL(`${f}.wasm`, here)));
  const mul = instance.exports.mpn_mul, m = new Uint32Array(instance.exports.mem.buffer);
  for (const [n1, n2] of [[1, 1], [1, 7], [2, 3], [3, 2], [5, 5], [17, 4], [64, 63], [129, 128], [300, 301]]) {
    const a = Uint32Array.from({ length: n1 }, rnd), b = Uint32Array.from({ length: n2 }, rnd);
    if (n1 > 1) a[0] = 0xffffffff;                      // carries everywhere
    b[n2 - 1] = 0;                                      // the zero-digit branch
    m.set(a, 256); m.set(b, 8192); m.fill(0xdeadbeef, 16384, 16384 + n1 + n2);         // c (byte 65536) starts dirty
    mul(1024, n1, 32768, n2, 65536);
    if (toBig(m.subarray(16384, 16384 + n1 + n2)) !== toBig(a) * toBig(b)) throw new Error(`${f} ${n1}x${n2}: wrong product`);
    checked++;
  }
}
console.log(`mpn_mul kernels: extract identical to lean-vir's function 140; ${checked} products checked against BigInt`);
