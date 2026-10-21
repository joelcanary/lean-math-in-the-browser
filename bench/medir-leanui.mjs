// The same CLI compiled as a LeanUI app: Lean -> C (a copy of the sources without the lean-vir attribute and
// `import Lean`, whose workload functions are byte for byte the C of this repo), C -> single-threaded wasm64
// with Emscripten 6.0.5, linked against the archives that leanui's toolchain/build-archives.sh builds
// (FawadHa1der/lean4 at 53cb11e, MULTI_THREAD=OFF, USE_GMP=OFF), run by Node. Timed inside the process
// exactly as the native CLI (`--time`, IO.monoNanosNow): Node start-up and wasm compilation are not counted.
// Run (from the repository root, after bench/leanui/build.sh): node bench/medir-leanui.mjs
// Output: bench/out/leanui.json
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CASOS } from './casos.mjs';
const NODE = process.env.LEANUI_NODE || process.execPath;
const JS = process.env.LEANUI_CLI || new URL('./leanui/wasm/tunnell_cli.js', import.meta.url).pathname;   // bench/leanui/build.sh
const filas = [];
for (const c of CASOS) {
  const run = (reps) => execFileSync(NODE, [JS, '--time', c.w, String(c.arg), String(reps)], { maxBuffer: 1 << 28 }).toString().trim().split('\n');
  let lineas = run(2);                                             // first: warm-up + a probe of the cost
  const coste = Number(lineas[2]) / 1e6;
  const reps = coste > 10000 ? 3 : coste > 1000 ? 5 : 7;
  lineas = run(reps + 1);
  const valor = lineas[0];
  const iguales = lineas[lineas.length - 1] === 'mismatches 0';
  const ok = createHash('sha256').update(valor).digest('hex') === c.esperado && iguales;
  const ms = lineas.slice(2, -1).map((t) => Number(t) / 1e6);      // drop the first timed call as warm-up
  filas.push({ w: c.w, x: c.x, motor: 'leanui', ...(ok ? { ms } : { error: 'value differs' }) });
  console.log(`${c.w.padEnd(15)} x=${String(c.x).padEnd(8)} leanui ${ok ? [...ms].sort((a, b) => a - b)[ms.length >> 1].toFixed(3) + ' ms' : 'ERROR value differs'}`);
}
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/leanui.json', import.meta.url), JSON.stringify({ filas }, null, 1));
