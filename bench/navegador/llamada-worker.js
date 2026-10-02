// The call-cost bench inside a module Worker.
import { mide } from './llamada-motor.js';

mide((p) => self.postMessage({ progreso: p })).then(
  (r) => self.postMessage({ ...r, aisladoWorker: self.crossOriginIsolated === true }),
  (e) => self.postMessage({ error: String(e && e.stack || e) }),
);
