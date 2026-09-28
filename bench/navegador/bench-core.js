// Browser benchmark core, run inside a module Web Worker (as on the real page) or on the main thread: the lean-vir runtime and the
// hand-written JS baseline run the same cases in the same browser. The cold start of the Lean side is
// split into its phases: fetch of the .wasm, WebAssembly compile + runtime creation with the packages.
import * as JS from '../js-baseline.mjs';
import { CASOS } from '../casos.mjs';

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const texto = (w, v) => w === 'tunnell' ? `${v.first} ${v.second} ${v.criterion}` : w === 'collatzRecord' ? `${v.fst} ${v.snd}` : String(v);

export async function correr(data, progreso) {
  const frio = {};
  let t = performance.now();
  const { createVirRuntimeFactory } = await import('../../site/lean-vir/js/vir-runtime.js');
  const { createCommonHostBindings, createConsoleHostBindings } = await import('../../site/lean-vir/js/vir-host-bindings.js');
  frio.importJs = performance.now() - t;
  t = performance.now();
  const [wasm, ...pkgs] = await Promise.all(['../../site/lean-vir/wasm/vir-upstream.wasm', '../pkg/Bench.parts/0.irpkg', '../pkg/Bench.parts/1.irpkg', '../pkg/Bench.irpkg']
    .map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.arrayBuffer())));
  frio.fetch = performance.now() - t;
  t = performance.now();
  const vir = await createVirRuntimeFactory({
    wasmBytes: new Uint8Array(wasm),
    defaultHostBindings: () => ({ ...createCommonHostBindings(), ...createConsoleHostBindings() }),
  }).createRuntime({ irPackageSet: pkgs.map((b) => new Uint8Array(b)) });
  frio.runtime = performance.now() - t;
  t = performance.now();
  vir.call('Bench.primeCount', 10);
  frio.primeraLlamada = performance.now() - t;

  const LEAN = (w, a) => vir.call(w === 'tunnell' ? 'Bench.tunnell' : 'Bench.' + w, w === 'isPrime' ? BigInt(a) : a);
  const filas = [];
  for (const c of CASOS.filter((c) => c.x <= (data.max[c.w] ?? 0))) {
    for (const [motor, F] of [['wasm', LEAN], ['js', (w, a) => JS[w](a)]]) {
      const primero = motor === 'wasm' ? texto(c.w, F(c.w, c.arg)) : F(c.w, c.arg);
      if (await sha(primero) !== c.esperado) { filas.push({ w: c.w, x: c.x, motor, error: 'value differs' }); continue; }
      const ms = [];
      let reps = data.reps;
      let distinta = false;
      for (let i = 0; i < reps; i++) {
        const t0 = performance.now(); const v = F(c.w, c.arg); ms.push(performance.now() - t0);
        // every timed repetition is checked, outside the clock (until 28-sep-2026 only the warm-up was)
        if ((motor === 'wasm' ? texto(c.w, v) : v) !== primero) { distinta = true; break; }
        if (i === 0 && ms[0] > 3000) reps = 3;
      }
      if (distinta) { filas.push({ w: c.w, x: c.x, motor, error: 'a timed repetition differs' }); continue; }
      filas.push({ w: c.w, x: c.x, motor, ms });
      progreso(`${c.w} ${c.x} ${motor}`);
    }
  }
  return { frio, filas };
}
