// Engine comparison on ONE machine: the Lean workloads in WebAssembly (lean-vir, in Node) and the
// hand-written JavaScript baseline, over a sweep of sizes. Native Lean is timed by the CLI
// (`tunnell_cli --time`) on the same machine and merged by bench/unir.py.
//
// Method: one warm-up call per (engine, workload, size), then R timed calls (R adapts to the cost:
// 7 below 1 s, 5 below 10 s, 3 above); the warm-up value is checked against the expected one and every
// timed repetition against the warm-up value, outside the clock, before its time is kept; and the cold start of the WebAssembly runtime (compile + package load) is timed
// separately. Output: bench/out/node.json
//
// Run (from the repo root): node bench/medir-node.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as JS from './js-baseline.mjs';
import { CASOS } from './casos.mjs';

const R = new URL('../', import.meta.url);
const lee = (p) => readFileSync(new URL(p, R));

const t0 = performance.now();
const { createVirRuntime } = await import('../site/lean-vir/js/vir-runtime-node.js');
const importMs = performance.now() - t0;
const t1 = performance.now();
const vir = await createVirRuntime({
  wasmBytes: lee('site/lean-vir/wasm/vir-upstream.wasm'),
  irPackageSet: [lee('bench/pkg/Bench.parts/0.irpkg'), lee('bench/pkg/Bench.parts/1.irpkg'), lee('bench/pkg/Bench.irpkg')],
});
const coldMs = performance.now() - t1;

const texto = (w, v) => {
  if (w === 'tunnell') return `${v.first} ${v.second} ${v.criterion}`;
  if (w === 'collatzRecord') return `${v.fst} ${v.snd}`;
  return String(v);
};
const LEAN = {
  tunnell: (n) => vir.call('Bench.tunnell', n),
  collatzRecord: (n) => vir.call('Bench.collatzRecord', n),
  primeCount: (n) => vir.call('Bench.primeCount', n),
  mertens: (n) => vir.call('Bench.mertens', n),
  partitions: (n) => vir.call('Bench.partitions', n),
  fib: (n) => vir.call('Bench.fib', n),
  fibBits: (n) => vir.call('Bench.fibBits', n),
  partitionsBits: (n) => vir.call('Bench.partitionsBits', n),
  isPrime: (n) => vir.call('Bench.isPrime', n),
  lifePopulation: (n) => vir.call('Bench.lifePopulation', n),
};

function mide(f, esperado, w) {
  const primero = texto(w, f());                       // warm-up, and the value check (SHA-256, as in casos.mjs)
  if (createHash('sha256').update(primero).digest('hex') !== esperado) return { error: `got ${primero.slice(0, 60)}, which is not the expected value` };
  const ts = [];
  let reps = 7;
  for (let i = 0; i < reps; i++) {
    const t = performance.now(); const v = f(); ts.push(performance.now() - t);
    // every timed repetition is checked, outside the clock (until 28-sep-2026 only the warm-up was, while
    // the report said every repetition was: pointed out by E. J. Gallego Arias's rerun, see docs/REPORT.md)
    if (texto(w, v) !== primero) return { error: `repetition ${i + 1} returned a different value` };
    if (i === 0) reps = ts[0] > 10000 ? 3 : ts[0] > 1000 ? 5 : 7;
  }
  return { ms: ts };
}

const out = { importMs, coldMs, filas: [] };   // no machine or version details in the published data
for (const c of CASOS) {
  for (const [motor, F] of [['wasm', LEAN], ['js', JS]]) {
    const arg = c.w === 'isPrime' ? (motor === 'wasm' ? BigInt(c.arg) : c.arg) : c.arg;
    // the JS baseline already returns the printed text; only Lean's structured results need `texto`
    const r = mide(() => F[c.w](arg), c.esperado, motor === 'wasm' ? c.w : 'texto');
    out.filas.push({ w: c.w, x: c.x, motor, ...r });
    const med = r.ms ? [...r.ms].sort((a, b) => a - b)[r.ms.length >> 1] : NaN;
    console.log(`${c.w.padEnd(15)} x=${String(c.x).padEnd(8)} ${motor.padEnd(4)} ${r.error ? 'ERROR ' + r.error : med.toFixed(2) + ' ms (median of ' + r.ms.length + ')'}`);
  }
}
mkdirSync(new URL('bench/out/', R), { recursive: true });
writeFileSync(new URL('bench/out/node.json', R), JSON.stringify(out, null, 1));
console.log(`cold start: import ${importMs.toFixed(0)} ms, runtime (compile + packages) ${coldMs.toFixed(0)} ms`);
