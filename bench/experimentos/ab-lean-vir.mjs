// A/B of two lean-vir builds on ONE machine: the same Lean sources, each side with its own runtime
// (site/lean-vir/) and its own packages (bench/pkg/) built by that lean-vir commit.
//
// Design (paired, to control drift): every round starts a fresh process for A and one for B, in ABBA
// order (round r: AB if r mod 4 is 0 or 3, else BA), so that heating and background load fall on both
// sides equally. In each process: the cold start (compile + packages), then for every case a warm-up
// call whose value is checked against the independent Python reference (SHA-256, bench/casos.mjs) and
// 5 timed calls, each checked against the warm-up outside the clock; then the cost of small calls.
// The result per metric is the median over rounds of the per-round ratio B/A, with a bootstrap 95 %
// interval (10,000 resamples, fixed seed), so the claim is about the difference, not about either side.
//
// Run: node bench/experimentos/ab-lean-vir.mjs DIR_A DIR_B [ROUNDS] [OUT.json]
//      (each DIR is a checkout with site/lean-vir/ and bench/pkg/ from its own lean-vir build)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CASES = [
  ['tunnell', 100003], ['collatzRecord', 10000], ['primeCount', 100000], ['mertens', 100000],
  ['partitions', 3000], ['fib', 100000], ['fibBits', 100000], ['partitionsBits', 3000],
  ['isPrime', 521], ['lifePopulation', 10],
];
const REPS = 5;

const texto = (w, v) => (w === 'tunnell' ? `${v.first} ${v.second} ${v.criterion}` : w === 'collatzRecord' ? `${v.fst} ${v.snd}` : String(v));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function child(dir) {
  const lee = (p) => readFileSync(join(dir, p));
  const { CASOS } = await import(pathToFileURL(join(dir, 'bench/casos.mjs')).href);
  const { createVirRuntime } = await import(pathToFileURL(join(dir, 'site/lean-vir/js/vir-runtime-node.js')).href);
  const t0 = performance.now();
  const vir = await createVirRuntime({
    wasmBytes: lee('site/lean-vir/wasm/vir-upstream.wasm'),
    irPackageSet: [lee('bench/pkg/Bench.parts/0.irpkg'), lee('bench/pkg/Bench.parts/1.irpkg'), lee('bench/pkg/Bench.irpkg')],
  });
  const out = { coldMs: performance.now() - t0, ms: {}, errors: [] };
  for (const [w, x] of CASES) {
    const c = CASOS.find((k) => k.w === w && k.x === x);
    const arg = w === 'isPrime' ? BigInt(c.arg) : c.arg;
    const f = () => vir.call(`Bench.${w}`, arg);
    const first = texto(w, f());
    if (createHash('sha256').update(first).digest('hex') !== c.esperado) { out.errors.push(`${w} ${x}: wrong value`); continue; }
    const ts = [];
    for (let i = 0; i < REPS; i++) {
      const t = performance.now(); const v = f(); ts.push(performance.now() - t);
      if (texto(w, v) !== first) out.errors.push(`${w} ${x}: repetition ${i + 1} differs`);
    }
    out.ms[`${w} ${x}`] = median(ts);
  }
  // small calls: microseconds per call, median of 5 batches
  const ascii = 'a'.repeat(10000), mixed = 'aé😀'.repeat(2500);
  const batch = (f, n) => { const r = []; for (let b = 0; b < 5; b++) { const t = performance.now(); for (let i = 0; i < n; i++) f(); r.push((performance.now() - t) * 1000 / n); } return median(r); };
  if (String(vir.call('Bench.ident', 41)) !== '41') out.errors.push('ident');   // a Nat comes back as BigInt
  if (String(vir.call('Bench.strLength', mixed)) !== '7500') out.errors.push('strLength mixed');   // Lean counts code points: 3 per 'aé😀'
  if (vir.call('Bench.echo', mixed) !== mixed) out.errors.push('echo mixed');
  out.us = {
    'ident (Nat)': batch(() => vir.call('Bench.ident', 41), 20000),
    'strLength, 10k ASCII': batch(() => vir.call('Bench.strLength', ascii), 1000),
    'echo, 10k ASCII': batch(() => vir.call('Bench.echo', ascii), 1000),
    'echo, 10k mixed': batch(() => vir.call('Bench.echo', mixed), 500),
  };
  process.stdout.write(JSON.stringify(out));
}

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

function bootstrapCI(ratios, rnd) {
  const meds = [];
  for (let k = 0; k < 10000; k++) { const s = ratios.map(() => ratios[Math.floor(rnd() * ratios.length)]); meds.push(median(s)); }
  meds.sort((a, b) => a - b);
  return [meds[249], meds[9749]];
}

async function parent(dirA, dirB, rounds, outFile) {
  const self = fileURLToPath(import.meta.url);
  const runs = { A: [], B: [] };
  for (let r = 0; r < rounds; r++) {
    const order = r % 4 === 0 || r % 4 === 3 ? ['A', 'B'] : ['B', 'A'];
    for (const side of order) {
      const json = execFileSync(process.execPath, [self, '--child', side === 'A' ? dirA : dirB], { maxBuffer: 1 << 24 }).toString();
      const res = JSON.parse(json);
      if (res.errors.length) throw new Error(`${side}, round ${r + 1}: ${res.errors.join('; ')}`);
      runs[side].push(res);
      console.error(`round ${r + 1}/${rounds} ${side} ok (cold ${res.coldMs.toFixed(0)} ms)`);
    }
  }
  const rnd = seeded(20261003);
  const metric = (get) => {
    const a = runs.A.map(get), b = runs.B.map(get), ratios = a.map((x, i) => b[i] / x);
    const [lo, hi] = bootstrapCI(ratios, rnd);
    return { A: median(a), B: median(b), ratio: median(ratios), ci95: [lo, hi], wins: ratios.filter((q) => q < 1).length };
  };
  const result = { rounds, design: 'ABBA, fresh process per side and round, ratio = B/A per round', metrics: {} };
  result.metrics['cold start (ms)'] = metric((r) => r.coldMs);
  for (const k of Object.keys(runs.A[0].ms)) result.metrics[`${k} (ms)`] = metric((r) => r.ms[k]);
  for (const k of Object.keys(runs.A[0].us)) result.metrics[`${k} (µs/call)`] = metric((r) => r.us[k]);
  if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 1));
  const f = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
  console.log(`metric | A | B | B/A (95% CI) | rounds B faster`);
  for (const [k, m] of Object.entries(result.metrics))
    console.log(`${k} | ${f(m.A)} | ${f(m.B)} | ${m.ratio.toFixed(3)} (${m.ci95[0].toFixed(3)}–${m.ci95[1].toFixed(3)}) | ${m.wins}/${rounds}`);
}

if (process.argv[2] === '--child') await child(resolve(process.argv[3]));
else await parent(resolve(process.argv[2]), resolve(process.argv[3]), Number(process.argv[4] ?? 10), process.argv[5]);
