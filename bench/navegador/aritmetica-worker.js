// The arithmetic bench inside a module Worker.
import { mide } from './aritmetica-motor.js';

mide((p) => self.postMessage({ progreso: p })).then(
  (r) => self.postMessage(r),
  (e) => self.postMessage({ error: String(e && e.stack || e) }),
);
