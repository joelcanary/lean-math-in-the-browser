// The cost of one call from JavaScript into Lean, in Node (see bench/llamada-core.mjs for the method).
// Run (from the repo root, after copying the packages to bench/pkg/): node bench/medir-llamada.mjs
// Output: bench/out/llamada-node.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { medirLlamadas } from './llamada-core.mjs';

const R = new URL('../', import.meta.url);
const lee = (p) => readFileSync(new URL(p, R));
const { createVirRuntime } = await import('../site/lean-vir/js/vir-runtime-node.js');
const vir = await createVirRuntime({
  wasmBytes: lee('site/lean-vir/wasm/vir-upstream.wasm'),
  irPackageSet: [lee('bench/pkg/Bench.parts/0.irpkg'), lee('bench/pkg/Bench.parts/1.irpkg'), lee('bench/pkg/Bench.irpkg')],
});

const f = (x) => (x === undefined || Number.isNaN(x) ? '-' : x < 10 ? x.toFixed(2) : x.toFixed(0));
const linea = (r) => {
  const e = r.lean.error || r.js.error || r.fases.error;
  console.log(`${r.caso.padEnd(18)} ${e ? 'ERROR ' + e : `lean ${f(r.lean.usPorLlamada)} us/call (p99 one call ${f(r.lean.unaP99)}) | js ${f(r.js.usPorLlamada)} | first ${f(r.primeraUs)} | marshal ${f(r.fases.marshalUs)} execute ${f(r.fases.executeUs)} decode ${f(r.fases.decodeUs)}`}`);
};
const out = medirLlamadas(vir, undefined, linea);   // no machine or version details in the published data
console.log(`clock resolution ${f(out.resolucionUs)} us`);
mkdirSync(new URL('bench/out/', R), { recursive: true });
writeFileSync(new URL('bench/out/llamada-node.json', R), JSON.stringify(out, null, 1));
