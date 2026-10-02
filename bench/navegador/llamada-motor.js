// Creates the lean-vir runtime in this context (Worker or main thread) and runs bench/llamada-core.mjs.
// Same packages and same method as in Node (bench/medir-llamada.mjs), so the numbers are comparable;
// the only difference is that slow cases time fewer single calls (see SUELTAS_MS).
import { medirLlamadas } from '../llamada-core.mjs';

// In Node every case times 1,000 single calls; for `fill` at 10^6 characters that is minutes of work
// per browser. Here the single calls stop after ~3 s of them (and never fewer than 30).
const SUELTAS_MS = 3000;

export async function mide(progreso) {
  const { createVirRuntimeFactory } = await import('../../site/lean-vir/js/vir-runtime.js');
  const { createCommonHostBindings, createConsoleHostBindings } = await import('../../site/lean-vir/js/vir-host-bindings.js');
  const [wasm, ...pkgs] = await Promise.all(['../../site/lean-vir/wasm/vir-upstream.wasm', '../pkg/Bench.parts/0.irpkg', '../pkg/Bench.parts/1.irpkg', '../pkg/Bench.irpkg']
    .map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.arrayBuffer())));
  const vir = await createVirRuntimeFactory({
    wasmBytes: new Uint8Array(wasm),
    defaultHostBindings: () => ({ ...createCommonHostBindings(), ...createConsoleHostBindings() }),
  }).createRuntime({ irPackageSet: pkgs.map((b) => new Uint8Array(b)) });
  return medirLlamadas(vir, () => performance.now(), (fila) => progreso(fila.caso), { sueltasMs: SUELTAS_MS });
}
