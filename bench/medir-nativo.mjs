// Native Lean timings for the same cases, on the same machine: `tunnell_cli --time <w> <arg> <reps>`
// times the call inside the process (IO.monoNanosNow), so process start-up is not counted.
// The first line of its output is the value, checked like the other engines; the last line counts the
// timed repetitions whose value differs from the first (compared inside the CLI, outside the clock), so
// every timed call is checked, not only one. Output: bench/out/nativo.json
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CASOS } from './casos.mjs';
const CLI = new URL('../.lake/build/bin/tunnell_cli', import.meta.url).pathname;
const filas = [];
for (const c of CASOS) {
  const run = (reps) => execFileSync(CLI, ['--time', c.w, String(c.arg), String(reps)], { maxBuffer: 1 << 28 }).toString().trim().split('\n');
  let lineas = run(2);                                             // first: warm-up + a probe of the cost
  const coste = Number(lineas[2]) / 1e6;
  const reps = coste > 10000 ? 3 : coste > 1000 ? 5 : 7;
  lineas = run(reps + 1);
  const valor = lineas[0];
  const iguales = lineas[lineas.length - 1] === 'mismatches 0';
  const ok = createHash('sha256').update(valor).digest('hex') === c.esperado && iguales;
  const ms = lineas.slice(2, -1).map((t) => Number(t) / 1e6);      // drop the first timed call as warm-up
  filas.push({ w: c.w, x: c.x, motor: 'nativo', ...(ok ? { ms } : { error: 'value differs' }) });
  console.log(`${c.w.padEnd(15)} x=${String(c.x).padEnd(8)} nativo ${ok ? [...ms].sort((a, b) => a - b)[ms.length >> 1].toFixed(3) + ' ms' : 'ERROR value differs'}`);
}
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/nativo.json', import.meta.url), JSON.stringify({ filas }, null, 1));
