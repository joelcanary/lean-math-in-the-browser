// The mpn_mul kernel bench (bench/experimentos/kernel/kernel.mjs) inside a module Worker.
import { mide } from '../experimentos/kernel/kernel.mjs';

const carga = (f) => fetch(`../experimentos/kernel/${f}`, { cache: 'no-store' }).then((r) => r.arrayBuffer());
Promise.all([carga('mpn_mul.wasm'), carga('mpn_mul_vj.wasm'), carga('mpn_mul_assoc.wasm'), carga('mpn_mul_barrier.wasm')])
  .then(([compiled, vj_once, carry_last, barrier]) => mide({ compiled, vj_once, carry_last, barrier }, (p) => self.postMessage({ progreso: p })))
  .then((r) => self.postMessage(r), (e) => self.postMessage({ error: String(e && e.stack || e) }));
