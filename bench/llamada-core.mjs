// What one call from JavaScript into Lean costs. An interactive page calls Lean on every click or
// keystroke, with small arguments and small results, so the call itself matters more there than the
// speed of a long computation. Shared by Node (bench/medir-llamada.mjs) and the browser.
//
// The Lean side (Bench.lean) does almost nothing: `ident` (a small Nat in and out), `strLength` (a string
// in), `fill` (a string out) and `echo` (the same string in and out), at string lengths 0 to 10^6. Every
// case is also run as the same JavaScript function, as the floor. For each case:
//   * first call: the first call of that function after the runtime is created (resolves its entry);
//   * per call:   batches of B calls timed as a whole (B chosen so that a batch takes >= 20 ms, capped for
//                 long strings so that the values kept for checking fit in memory), 7
//                 batches, median of batch time / B; EVERY value is checked against the expected one,
//                 after each batch, outside the clock;
//   * one call:   1,000 calls timed one by one (in browsers, as many as fit in ~3 s, at least 30),
//                 p50 / p99 / max (limited by the clock's resolution,
//                 which the result reports: coarse in browsers that are not cross-origin isolated);
//   * phases:     the runtime's own opt-in `callTimed` split (marshal / execute / decode), median of
//                 200 calls (Lean only).

const LARGOS = [0, 100, 10000, 1000000];
const texto = (n) => 'a'.repeat(n);
/* Mixed text (added 1-oct-2026): ASCII strings hit the fast ASCII paths of TextEncoder/TextDecoder,
   and the first version of this bench used only 'a', which hid what a string with accents or emoji
   costs on the way back to JavaScript. 'aé😀' is one 1-byte, one 2-byte and one 4-byte UTF-8
   character (the emoji is two UTF-16 units). `largo` counts characters (code points). */
const mixto = (n) => 'aé😀'.repeat(n / 3);

// each case: the Lean entry and argument, the JavaScript equivalent, and the expected value as text
export const CASOS = [
  { id: 'ident', lean: 'Bench.ident', arg: () => 7, js: (n) => n, esperado: '7', largo: 0 },
  ...LARGOS.map((n) => ({ id: `strLength ${n}`, lean: 'Bench.strLength', arg: () => texto(n), js: (s) => s.length, esperado: String(n), largo: n })),
  ...LARGOS.map((n) => ({ id: `fill ${n}`, lean: 'Bench.fill', arg: () => n, js: (k) => 'a'.repeat(k), esperado: texto(n), largo: n })),
  ...LARGOS.map((n) => ({ id: `echo ${n}`, lean: 'Bench.echo', arg: () => texto(n), js: (s) => s, esperado: texto(n), largo: n })),
  ...[999, 999999].map((n) => ({ id: `strLength mixed ${n}`, lean: 'Bench.strLength', arg: () => mixto(n), js: (s) => [...s].length, esperado: String(n), largo: n, mixto: true })),
  ...[999, 999999].map((n) => ({ id: `echo mixed ${n}`, lean: 'Bench.echo', arg: () => mixto(n), js: (s) => s, esperado: mixto(n), largo: n, mixto: true })),
];

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const cuantil = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// resolution of the clock: the smallest non-zero step it reports
function resolucion(now) {
  let min = Infinity;
  for (let i = 0; i < 2000; i++) { const a = now(); let b = now(); while (b === a) b = now(); min = Math.min(min, b - a); }
  return min;
}

function mideMotor(f, arg, esperado, largo, now, sueltasMs = Infinity) {
  const r = {};
  const bien = (v) => String(v) === esperado;
  // warm-up and value check
  if (!bien(f(arg))) return { error: 'warm-up value differs' };
  // batches: calibrate B, then 7 batches with every value kept and checked outside the clock; the values
  // kept per batch are capped at ~32 million characters (a batch of 10^6-character strings holds 32)
  const maxB = largo ? Math.max(1, Math.floor(32e6 / largo)) : 1 << 20;
  let B = 1;
  for (;;) { const t0 = now(); for (let i = 0; i < B; i++) f(arg); if (now() - t0 >= 20 || B >= maxB) break; B = Math.min(2 * B, maxB); }
  const vals = new Array(B);
  const porLlamada = [];
  for (let k = 0; k < 7; k++) {
    const t0 = now();
    for (let i = 0; i < B; i++) vals[i] = f(arg);
    const t = now() - t0;
    for (let i = 0; i < B; i++) if (!bien(vals[i])) return { error: `batch ${k + 1}, call ${i + 1}: value differs` };
    porLlamada.push((t / B) * 1000);                                  // microseconds
  }
  r.lote = B; r.usPorLlamada = mediana(porLlamada); r.usMin = Math.min(...porLlamada); r.usMax = Math.max(...porLlamada);
  // one call at a time
  const sueltas = [];
  // 1,000 single calls, or fewer for slow cases when a time budget is given (never fewer than 30)
  let gastado = 0;
  for (let i = 0; i < 1000 && (i < 30 || gastado < sueltasMs); i++) { const t0 = now(); const v = f(arg); const dt = now() - t0; gastado += dt; sueltas.push(dt * 1000); if (!bien(v)) return { error: `single call ${i + 1}: value differs` }; }
  r.sueltas = sueltas.length;
  r.unaP50 = cuantil(sueltas, 0.5); r.unaP99 = cuantil(sueltas, 0.99); r.unaMax = Math.max(...sueltas);
  return r;
}

// vir: a lean-vir runtime with the Bench package loaded; now: a millisecond clock
export function medirLlamadas(vir, now = () => performance.now(), progreso = () => {}, opciones = {}) {
  const sueltasMs = opciones.sueltasMs ?? Infinity;
  const out = { resolucionUs: resolucion(now) * 1000, filas: [] };
  // first call of each Lean function, in this order, before anything else touches it
  const primera = {};
  for (const c of CASOS) {
    if (c.lean in primera) continue;
    const t0 = now(); const v = vir.call(c.lean, c.arg()); primera[c.lean] = (now() - t0) * 1000;
    if (String(v) !== c.esperado) primera[c.lean] = NaN;
  }
  for (const c of CASOS) {
    const arg = c.arg();
    const lean = mideMotor((a) => vir.call(c.lean, a), arg, c.esperado, c.largo, now, sueltasMs);
    const js = mideMotor(c.js, arg, c.esperado, c.largo, now, sueltasMs);
    // the runtime's own phase split (Lean only)
    const fases = { marshalMs: [], executeMs: [], decodeMs: [] };
    let malas = 0;
    for (let i = 0; i < 200; i++) {
      const { value, timings } = vir.callTimed(c.lean, arg);
      if (String(value) !== c.esperado) malas++;
      for (const k in fases) fases[k].push(timings[k]);
    }
    const faseUs = malas ? { error: `${malas} timed calls returned a different value` }
      : Object.fromEntries(Object.entries(fases).map(([k, xs]) => [k.replace('Ms', 'Us'), mediana(xs) * 1000]));
    out.filas.push({ caso: c.id, funcion: c.lean, largo: c.largo, mixto: !!c.mixto, primeraUs: primera[c.lean], lean, js, fases: faseUs });
    progreso(out.filas[out.filas.length - 1]);
  }
  return out;
}
