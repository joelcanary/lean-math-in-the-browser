// mpn_mul and mpn_div with and without the change (bench/experimentos/kernel/acarreo/wasm/mide.mjs) in a module Worker.
import { mide } from '../experimentos/kernel/acarreo/wasm/mide.mjs';

fetch('../experimentos/kernel/acarreo/wasm/mpn-div.wasm', { cache: 'no-store' })
  .then((r) => r.arrayBuffer())
  .then((bytes) => mide(bytes, (p) => self.postMessage({ progreso: p })))
  .then((r) => self.postMessage(r), (e) => self.postMessage({ error: String(e && e.stack || e) }));
