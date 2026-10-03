// How each big-number operation grows with the size of its operands, in three engines on ONE machine:
// native Lean (GMP), Lean in WebAssembly (lean-vir; Lean's portable big-number fallback) and
// JavaScript BigInt. The Lean side is Arith.run (Arith.lean); the JavaScript side is the same
// generator and loop written with BigInt; the checksums are compared with an independent Python
// reference (bench/experimentos/aritmetica_ref.py), passed in as a JSON file of anchors.
//
// Per (engine, operation, size): R is chosen so that one run takes about 150 ms; then 5 runs of
// `run op bits R` and 5 of `run op bits 0` (only building the operands), interleaved. The time of one
// operation is (median with R − median with 0) / R; the analysis also subtracts operation 5, which does
// no arithmetic (the loop and the checksum). Every engine and point is first checked at R = 8 against
// the Python anchor. A size stops growing for an (engine, operation) once one operation takes > 3 s.
//
// Run (repository root, after `lake build tunnell_cli +Arith:vir`):
//   node bench/experimentos/aritmetica.mjs ANCHORS.json OUT.json
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [anchorsFile, outFile] = process.argv.slice(2);
const ANCHORS = JSON.parse(readFileSync(anchorsFile, 'utf8'));   // { "op bits": "checksum at R=8" }
const OPS = ['add', 'mul', 'div', 'mod', 'gcd', 'base'];
const BITS = [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
const RUNS = 5, TARGET_MS = 150, CAP_MS = 3000;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---- native Lean: the CLI times each run in-process (IO.monoNanosNow), so process start is excluded
const CLI = '.lake/build/bin/tunnell_cli';
function native(op, bits, reps, times) {
  const out = execFileSync(CLI, ['--arith', String(op), String(bits), String(reps), String(times)], { maxBuffer: 1 << 26 }).toString().trim().split('\n');
  if (out.at(-1) !== 'mismatches 0') throw new Error(`native ${op} ${bits}: ${out.at(-1)}`);
  return { value: out[0], ms: out.slice(1, -1).map((ns) => Number(ns) / 1e6) };
}

// ---- Lean in WebAssembly
const lee = (p) => readFileSync(p);
const { createVirRuntime } = await import(new URL('../../site/lean-vir/js/vir-runtime-node.js', import.meta.url).href);
const set = JSON.parse(readFileSync('.lake/build/vir/module-sets/Arith.irpkg-set.json', 'utf8'));
const parts = (set.packages ?? set.parts ?? []).map((p) => lee(`.lake/build/vir/module-sets/${p.path ?? p}`));
const vir = await createVirRuntime({
  wasmBytes: lee('site/lean-vir/wasm/vir-upstream.wasm'),
  irPackageSet: parts.length ? parts : [lee('.lake/build/vir/module-sets/Arith.irpkg')],
});
function wasm(op, bits, reps, times) {
  const ms = []; let value;
  for (let i = 0; i < times; i++) {
    const t = performance.now(); const v = String(vir.call('Arith.run', op, bits, reps)); ms.push(performance.now() - t);
    if (i === 0) value = v; else if (v !== value) throw new Error(`wasm ${op} ${bits}: repetition differs`);
  }
  return { value, ms };
}

// ---- JavaScript BigInt: the same generator, operands and loop
const MASK = (1n << 64n) - 1n;
const lcg = (s) => (s * 6364136223846793005n + 1442695040888963407n) & MASK;
function operand(bits, seed) {
  let x = 0n, s = BigInt(seed);
  for (let k = 0; k < Math.ceil(bits / 64); k++) { s = lcg(s); x = (x << 64n) + s; }
  const top = 1n << BigInt(bits - 1);
  return x % top + top;
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const APPLY = [(a, b) => a + b, (a, b) => a * b, (a, b) => a / b, (a, b) => a % b, gcd, (a) => a];
function jsRun(op, bits, reps) {
  const w = op === 2 || op === 3 ? 2 * bits : bits;
  const ps = [0, 1, 2, 3].map((i) => [operand(w, 2 * i + 1), operand(bits, 2 * i + 2)]);
  let acc = 0n;
  for (let i = 0; i < reps; i++) { const [a, b] = ps[i % 4]; acc = (acc + (APPLY[op](a, b) & MASK)) & MASK; }
  return acc;
}
function js(op, bits, reps, times) {
  const ms = []; let value;
  for (let i = 0; i < times; i++) {
    const t = performance.now(); const v = String(jsRun(op, bits, reps)); ms.push(performance.now() - t);
    if (i === 0) value = v; else if (v !== value) throw new Error(`js ${op} ${bits}: repetition differs`);
  }
  return { value, ms };
}

const ENGINES = { native, wasm, js };
const out = { design: 'per point: R for ~150 ms, 5 runs with R and 5 with 0 interleaved; anchors checked at R=8', bits: BITS, ops: OPS, points: [] };
for (const [name, eng] of Object.entries(ENGINES)) {
  for (let op = 0; op < OPS.length; op++) {
    for (const bits of BITS) {
      const anchor = ANCHORS[`${op} ${bits}`];
      const check = eng(op, bits, 8, 1).value;
      if (anchor !== undefined && check !== anchor) throw new Error(`${name} ${OPS[op]} ${bits}: checksum ${check}, Python says ${anchor}`);
      // one operation, to pick R and to stop before the sizes become hopeless
      const one = median(eng(op, bits, 1, 3).ms) - median(eng(op, bits, 0, 3).ms);
      const reps = Math.max(1, Math.min(200000, Math.round(TARGET_MS / Math.max(one, 1e-4))));
      const withR = [], without = [];
      for (let k = 0; k < RUNS; k++) { withR.push(...eng(op, bits, reps, 1).ms); without.push(...eng(op, bits, 0, 1).ms); }
      const perOpUs = (median(withR) - median(without)) / reps * 1000;
      out.points.push({ engine: name, op: OPS[op], bits, reps, withR, without, perOpUs, checked: anchor !== undefined });
      console.log(`${name.padEnd(6)} ${OPS[op].padEnd(4)} ${String(bits).padStart(6)} bits  R=${String(reps).padStart(6)}  ${perOpUs.toFixed(3)} µs/op`);
      writeFileSync(outFile, JSON.stringify(out));
      if (one > CAP_MS) { console.log(`${name} ${OPS[op]}: one operation took ${one.toFixed(0)} ms at ${bits} bits; larger sizes skipped`); break; }
    }
  }
}
console.log('done');
