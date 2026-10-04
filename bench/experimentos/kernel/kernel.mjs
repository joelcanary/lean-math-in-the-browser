// Lean's mpn_mul alone (report § 4.11): the function lean-vir's runtime runs for a big-Nat
// multiplication, copied byte for byte into mpn_mul.wasm (checked with cuerpos.py), and three variants:
// mpn_mul_vj.wasm, that loads the multiplier digit once per row instead of twice per iteration, and
// mpn_mul_assoc.wasm, that adds the carry last: (u·v + c) + k instead of (k + c) + u·v,
// both edited by hand; and mpn_mul_barrier.wasm, the carry-last order as Lean's own clang emits it from
// a one-line change to the C++ (fuente/mpn_mul.cpp, VARIANT=2; injerta.py).
// The same code runs in Node (kernel-node.mjs) and in a browser Worker (kernel.html).
//
// Method, as in § 4.7: per (module, size), R calls chosen for about 150 ms per run; 7 runs, the
// modules interleaved; time of one call = median of the runs ÷ R. Before timing, every size is checked
// against this engine's BigInt product, for every module.
export const DIGITS = [128, 256, 512, 1024, 2048];        // 32-bit digits: 4,096 to 65,536 bits
const RUNS = 7, TARGET_MS = 150;
const A = 1024, B = A + 4 * 4096, C = B + 4 * 4096;     // byte offsets of a, b and c in memory
const median = (xs) => { const s = [...xs].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function digits(n, seed) {                                 // n pseudo-random 32-bit digits, top digit non-zero
  const d = new Uint32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s; }
  d[n - 1] |= 0x80000000;
  return d;
}
const toBig = (d) => { let x = 0n; for (let i = d.length - 1; i >= 0; i--) x = (x << 32n) | BigInt(d[i]); return x; };

export async function mide(modulos, progreso = () => {}) {
  const inst = {};
  for (const [name, bytes] of Object.entries(modulos)) {
    const { instance } = await WebAssembly.instantiate(bytes);
    inst[name] = { f: instance.exports.mpn_mul, m: new Uint32Array(instance.exports.mem.buffer) };
  }
  const points = [];
  for (const n of DIGITS) {
    const a = digits(n, 2 * n + 1), b = digits(n, 2 * n + 2), expected = toBig(a) * toBig(b);
    const one = {};
    for (const [name, { f, m }] of Object.entries(inst)) {
      m.set(a, A / 4); m.set(b, B / 4);
      f(A, n, B, n, C);
      if (toBig(m.subarray(C / 4, C / 4 + 2 * n)) !== expected) throw new Error(`${name} ${n} digits: wrong product`);
      let t = performance.now(); f(A, n, B, n, C); one[name] = Math.max(performance.now() - t, 1e-3);
    }
    const reps = Object.fromEntries(Object.entries(one).map(([k, ms]) => [k, Math.max(1, Math.round(TARGET_MS / ms))]));
    const runs = Object.fromEntries(Object.keys(inst).map((k) => [k, []]));
    for (let r = 0; r < RUNS; r++) {
      for (const [name, { f }] of Object.entries(inst)) {
        const R = reps[name], t = performance.now();
        for (let i = 0; i < R; i++) f(A, n, B, n, C);
        runs[name].push((performance.now() - t) / R * 1000);
      }
    }
    for (const name of Object.keys(inst)) {
      const us = median(runs[name]);
      points.push({ module: name, digits: n, bits: 32 * n, reps: reps[name], runsUs: runs[name], us, checked: true });
      progreso(`${name} ${32 * n} bits: ${us.toFixed(1)} µs`);
    }
  }
  return { design: 'mpn_mul alone; R for ~150 ms; 7 runs, modules interleaved; median; checked against BigInt first', points };
}
