// Runs the call-cost bench (bench/llamada-core.mjs) in this browser, in a module Worker (as a real page
// would) or on the main thread, and posts the result to bench/servir.py --aislado.
const q = new URLSearchParams(location.search);
const nav = (q.get('nav') || 'unknown').replace(/[^a-z0-9]/g, '');
const hilo = q.get('hilo') === 'principal' ? 'principal' : 'worker';
const estado = document.getElementById('estado');
const avisa = (x) => { estado.textContent = x; };

async function envia(res) {
  const r = await fetch(`/resultado?nombre=llamada-${nav}-${hilo}`, { method: 'POST', body: JSON.stringify(res) });
  avisa(r.ok ? 'done: result sent' : `could not send the result (HTTP ${r.status})`);
}

const extra = { nav, hilo, aislado: self.crossOriginIsolated === true, agente: navigator.userAgent.replace(/\(.*?\)/g, '()') };
if (hilo === 'worker') {
  const w = new Worker('./llamada-worker.js', { type: 'module' });
  w.onmessage = ({ data }) => { if (data.progreso) avisa(data.progreso); else envia({ ...extra, ...data }); };
  w.onerror = (e) => envia({ ...extra, error: String(e.message || e) });
} else {
  import('./llamada-motor.js').then(({ mide }) => mide(avisa)).then((r) => envia({ ...extra, ...r }), (e) => envia({ ...extra, error: String(e) }));
}
