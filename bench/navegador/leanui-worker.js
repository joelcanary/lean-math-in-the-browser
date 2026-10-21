// The benchmark's CLI built as a LeanUI wasm64 app (bench/leanui/), run in a module Web Worker exactly as
// bench/medir-nativo.mjs runs the native CLI: `--time <w> <arg> <reps>` times every call inside Lean
// (IO.monoNanosNow, which Emscripten maps to performance.now()), a first run of 2 probes the cost and fixes
// the repetitions, the first timed call is dropped as warm-up, the value is checked against the independent
// reference (SHA-256 in casos.mjs) and every repetition against the first (`mismatches 0`).
// Each run is a fresh instance of the module (Lean's `main` runs once per instance); the .wasm is fetched and
// compiled once, so neither download nor compilation is in any timing.
import { CASOS } from '../casos.mjs';
import crear from '../leanui/wasm/tunnell_cli_web.mjs';

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

self.onmessage = async () => {
  const frio = {};
  let t = performance.now();
  const bytes = await (await fetch('../leanui/wasm/tunnell_cli_web.wasm', { cache: 'no-store' })).arrayBuffer();
  frio.fetch = performance.now() - t;
  t = performance.now();
  const modulo = await WebAssembly.compile(bytes);
  frio.compile = performance.now() - t;

  const run = async (args) => {
    const lineas = [];
    const m = await crear({
      noInitialRun: true,
      print: (s) => lineas.push(s),
      printErr: (s) => lineas.push('stderr: ' + s),
      instantiateWasm: (imports, ok) => { WebAssembly.instantiate(modulo, imports).then((i) => ok(i, modulo)); return {}; },
    });
    m.callMain(args);
    return lineas;
  };
  t = performance.now();
  const primera = await run(['--eval', 'primeCount', '10']);
  frio.primeraLlamada = performance.now() - t;
  if (primera[0] !== '4') { self.postMessage({ fin: true, error: `primeCount 10 gave ${primera.join(' | ')}` }); return; }

  const filas = [];
  for (const c of CASOS) {
    self.postMessage({ progreso: `${c.w} ${c.x}` });
    let lineas = await run(['--time', c.w, String(c.arg), '2']);
    const coste = Number(lineas[2]) / 1e6;
    const reps = coste > 10000 ? 3 : coste > 1000 ? 5 : 7;
    lineas = await run(['--time', c.w, String(c.arg), String(reps + 1)]);
    const valor = lineas[0];
    const ok = (await sha(valor)) === c.esperado && lineas[lineas.length - 1] === 'mismatches 0';
    const ms = lineas.slice(2, -1).map((x) => Number(x) / 1e6);
    filas.push({ w: c.w, x: c.x, motor: 'leanui', ...(ok ? { ms } : { error: `value differs: ${valor.slice(0, 60)}` }) });
  }
  self.postMessage({ fin: true, frio, filas });
};
