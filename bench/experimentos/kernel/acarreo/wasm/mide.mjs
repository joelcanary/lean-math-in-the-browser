// Lean's mpn_mul and mpn_div in WebAssembly (mpn-div.wasm: Lean's mpn.cpp at v4.34.0 compiled with Lean's clang,
// as it is and with the changes of report §§ 4.11 and 4.13; its mpn_mul is byte for byte lean-vir's function 140).
// Each size is checked against BigInt first (product; q·d + r = numerator and r < d), then timed as kernel.mjs.
//   node node-run.mjs OUT.json      (or import { mide } in a browser Worker)
export const DIGITS = [128, 256, 512, 1024, 2048];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const big = (m, at, n) => { let x = 0n; for (let i = n - 1; i >= 0; i--) x = (x << 32n) | BigInt(m[at / 4 + i]); return x; };
function digits(n, seed) { const d = new Uint32Array(n); let s = seed >>> 0; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s; } d[n - 1] |= 0x80000000; return d; }
function perCall(f, target = 150) {
  let t = performance.now(); f(); const one = Math.max(performance.now() - t, 1e-3);
  const reps = Math.max(1, Math.round(target / one));
  t = performance.now(); for (let i = 0; i < reps; i++) f();
  return ((performance.now() - t) / reps) * 1000;
}

export async function mide(bytes, progreso = () => {}) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports, m = new Uint32Array(x.memory.buffer);
  const A = 16 << 20, B = A + 65536, C = B + 65536, Q = C + 65536, R = Q + 65536;   // por encima de la arena (4 MB)
  const points = [];
  for (const n of DIGITS) {
    const a = digits(n, 2 * n + 1), b = digits(n, 2 * n + 2), num = digits(2 * n, 3 * n), den = digits(n, 5 * n);
    m.set(a, A / 4); m.set(b, B / 4);
    for (const f of ["mul_v0", "mul_fix"]) {
      x[f](A, n, B, n, C);
      if (big(m, C, 2 * n) !== big(m, A, n) * big(m, B, n)) throw new Error(`${f} ${n}: producto mal`);
    }
    m.set(num, A / 4); m.set(den, B / 4);
    const N = big(m, A, 2 * n), Dv = big(m, B, n);
    for (const f of ["div_v0", "div_fix", "div_sub", "div_subb"]) {
      x[f](A, 2 * n, B, n, Q, R);
      const q = big(m, Q, n + 1), r = big(m, R, n);
      if (q * Dv + r !== N || r >= Dv) throw new Error(`${f} ${n}: división mal`);
    }
    const t = { mul_v0: [], mul_fix: [], div_v0: [], div_fix: [], div_sub: [], div_subb: [] };
    for (let round = 0; round < 7; round++) {
      m.set(a, A / 4); m.set(b, B / 4);
      t.mul_v0.push(perCall(() => x.mul_v0(A, n, B, n, C)));
      t.mul_fix.push(perCall(() => x.mul_fix(A, n, B, n, C)));
      m.set(num, A / 4); m.set(den, B / 4);
      t.div_v0.push(perCall(() => x.div_v0(A, 2 * n, B, n, Q, R)));
      t.div_fix.push(perCall(() => x.div_fix(A, 2 * n, B, n, Q, R)));
      t.div_sub.push(perCall(() => x.div_sub(A, 2 * n, B, n, Q, R)));
      t.div_subb.push(perCall(() => x.div_subb(A, 2 * n, B, n, Q, R)));
    }
    const p = { bits: 32 * n, mul_lean_us: median(t.mul_v0), mul_fix_us: median(t.mul_fix), div_lean_us: median(t.div_v0), div_fix_us: median(t.div_fix), div_sub_us: median(t.div_sub), div_subb_us: median(t.div_subb), checked: true };
    points.push(p);
    progreso(`${p.bits} bits: mul ${(p.mul_lean_us / p.mul_fix_us).toFixed(2)}x, div fix ${(p.div_lean_us / p.div_fix_us).toFixed(2)}x, fused ${(p.div_lean_us / p.div_sub_us).toFixed(2)}x / ${(p.div_lean_us / p.div_subb_us).toFixed(2)}x`);
  }
  return { design: "Lean's mpn.cpp v4.34.0 in wasm, as it is vs the one-line change; checked against BigInt; 7 interleaved rounds, median", points };
}

