// Experiment: does passing a string from JavaScript into Lean get cheaper if the SDK encodes it
// straight into Wasm memory with TextEncoder.encodeInto, instead of encode() + copy?
//
// lean-vir's ObjectValueRuntime.withWasmString (site/lean-vir/js/runtime/object-values.js) does
//   bytes = new TextEncoder().encode(s)   -> a fresh Uint8Array
//   ptr = allocBytes(bytes)               -> malloc in Wasm + copy
// The variant below reserves the worst case (3 bytes per UTF-16 code unit) and lets encodeInto
// write in place. The SDK file is not modified: the method is swapped at run time, and the two
// versions are measured in the same process, alternating, with every value checked.
//
// Run (from the repo root, packages in bench/pkg/): node bench/experimentos/strings-encodeinto.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ObjectValueRuntime } from '../../site/lean-vir/js/runtime/object-values.js';

const R = new URL('../../', import.meta.url);
const lee = (p) => readFileSync(new URL(p, R));
const { createVirRuntime } = await import('../../site/lean-vir/js/vir-runtime-node.js');
const vir = await createVirRuntime({
  wasmBytes: lee('site/lean-vir/wasm/vir-upstream.wasm'),
  irPackageSet: [lee('bench/pkg/Bench.parts/0.irpkg'), lee('bench/pkg/Bench.parts/1.irpkg'), lee('bench/pkg/Bench.irpkg')],
});

const original = ObjectValueRuntime.prototype.withWasmString;
const encoder = new TextEncoder();
function enLugar(value, label, callback) {
  if (typeof value !== 'string') return original.call(this, value, label, callback);
  const cap = value.length * 3;                       // UTF-8 never needs more than 3 bytes per UTF-16 unit
  const ptr = this.allocByteLength(cap, label);
  try {
    const { written } = encoder.encodeInto(value, new Uint8Array(this.exports.memory.buffer, ptr, cap));
    return callback(ptr, written);
  } finally {
    this.freeBytes(ptr);
  }
}

const casos = [];
for (const n of [100, 10000, 1000000]) {
  casos.push({ id: `strLength ascii ${n}`, f: 'Bench.strLength', arg: 'a'.repeat(n), esperado: String(n) });
  casos.push({ id: `echo ascii ${n}`, f: 'Bench.echo', arg: 'a'.repeat(n), esperado: 'a'.repeat(n) });
}
// non-ASCII: 2-byte (é) and 4-byte (emoji, a surrogate pair = 2 UTF-16 units) characters
const mixto = 'aé😀'.repeat(250000);                  // 750,000 code points, 1,000,000 UTF-16 units
casos.push({ id: 'strLength mixed 750k', f: 'Bench.strLength', arg: mixto, esperado: String([...mixto].length) });
casos.push({ id: 'echo mixed 750k', f: 'Bench.echo', arg: mixto, esperado: mixto });

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
function lote(caso, reps) {
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) {
    const v = vir.call(caso.f, caso.arg);
    if (String(v) !== caso.esperado) throw new Error(`${caso.id}: wrong value`);   // every value checked
  }
  return ((performance.now() - t0) / reps) * 1000;    // microseconds per call
}

const filas = [];
for (const caso of casos) {
  const reps = caso.arg.length >= 1e6 ? 8 : caso.arg.length >= 1e4 ? 200 : 5000;
  const t = { original: [], encodeInto: [] };
  for (let ronda = 0; ronda < 9; ronda++) {           // alternate the two versions to share drift
    for (const [nombre, impl] of ronda % 2 ? [['encodeInto', enLugar], ['original', original]] : [['original', original], ['encodeInto', enLugar]]) {
      ObjectValueRuntime.prototype.withWasmString = impl;
      if (ronda === 0) lote(caso, 1);                 // warm-up and check
      t[nombre].push(lote(caso, reps));
    }
  }
  ObjectValueRuntime.prototype.withWasmString = original;
  const a = mediana(t.original), b = mediana(t.encodeInto);
  filas.push({ caso: caso.id, originalUs: a, encodeIntoUs: b, ahorro: 1 - b / a });
  console.log(`${caso.id.padEnd(22)} original ${a.toFixed(1).padStart(9)} us | encodeInto ${b.toFixed(1).padStart(9)} us | ${((1 - b / a) * 100).toFixed(0)}% less`);
}
mkdirSync(new URL('bench/out/', R), { recursive: true });
writeFileSync(new URL('bench/out/strings-encodeinto.json', R), JSON.stringify({ filas }, null, 1));
