// Big-number arithmetic operation by operation (report § 4.7), in this browser: Lean through lean-vir
// (Arith.run, bench/pkg/Arith.irpkg) and this browser's own BigInt. The same method as in Node
// (bench/experimentos/aritmetica.mjs): per (engine, operation, size), R is chosen so that one run takes
// about 150 ms; 5 runs with R operations and 5 with none, interleaved; time of one operation =
// (median with R − median with 0) / R. Every engine and size is first checked at R = 8 against the
// independent Python checksums (bench/out/aritmetica-anclas.json). A size stops growing for an
// (engine, operation) once one operation takes more than 3 s.
const OPS = ['add', 'mul', 'div', 'mod', 'gcd', 'base'];
const BITS = [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
const RUNS = 5, TARGET_MS = 150, CAP_MS = 3000;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---- this browser's BigInt: the same generator, operands and loop as Arith.lean (gcd: a Euclid loop)
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

export async function mide(progreso) {
  const { createVirRuntimeFactory } = await import('../../site/lean-vir/js/vir-runtime.js');
  const { createCommonHostBindings, createConsoleHostBindings } = await import('../../site/lean-vir/js/vir-host-bindings.js');
  const [wasm, pkg, anclas] = await Promise.all([
    fetch('../../site/lean-vir/wasm/vir-upstream.wasm', { cache: 'no-store' }).then((r) => r.arrayBuffer()),
    fetch('../pkg/Arith.irpkg', { cache: 'no-store' }).then((r) => r.arrayBuffer()),
    fetch('../out/aritmetica-anclas.json', { cache: 'no-store' }).then((r) => r.json()),
  ]);
  const vir = await createVirRuntimeFactory({
    wasmBytes: new Uint8Array(wasm),
    defaultHostBindings: () => ({ ...createCommonHostBindings(), ...createConsoleHostBindings() }),
  }).createRuntime({ irPackageSet: [new Uint8Array(pkg)] });

  const timed = (f) => (op, bits, reps, times) => {
    const ms = []; let value;
    for (let i = 0; i < times; i++) {
      const t = performance.now(); const v = String(f(op, bits, reps)); ms.push(performance.now() - t);
      if (i === 0) value = v; else if (v !== value) throw new Error(`${op} ${bits}: a repetition differs`);
    }
    return { value, ms };
  };
  const ENGINES = { wasm: timed((op, bits, reps) => vir.call('Arith.run', op, bits, reps)), js: timed(jsRun) };
  const points = [];
  for (const [name, eng] of Object.entries(ENGINES)) {
    for (let op = 0; op < OPS.length; op++) {
      if (name === 'js' && OPS[op] === 'gcd') continue;   // no BigInt gcd: ours would be a JavaScript loop
      for (const bits of BITS) {
        const anchor = anclas[`${op} ${bits}`];
        const check = eng(op, bits, 8, 1).value;
        if (check !== anchor) throw new Error(`${name} ${OPS[op]} ${bits}: checksum ${check}, Python says ${anchor}`);
        const one = median(eng(op, bits, 1, 3).ms) - median(eng(op, bits, 0, 3).ms);
        const reps = Math.max(1, Math.min(200000, Math.round(TARGET_MS / Math.max(one, 1e-4))));
        const withR = [], without = [];
        for (let k = 0; k < RUNS; k++) { withR.push(...eng(op, bits, reps, 1).ms); without.push(...eng(op, bits, 0, 1).ms); }
        const perOpUs = (median(withR) - median(without)) / reps * 1000;
        points.push({ engine: name, op: OPS[op], bits, reps, withR, without, perOpUs, checked: true });
        progreso(`${name} ${OPS[op]} ${bits} bits: ${perOpUs.toFixed(3)} µs`);
        if (one > CAP_MS) break;
      }
    }
  }
  return { design: 'as bench/experimentos/aritmetica.mjs, in this browser; anchors checked at R=8', bits: BITS, ops: OPS, points };
}
