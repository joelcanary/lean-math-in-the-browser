// Runs kernel-worker.js and posts the result to bench/servir.py --aislado as bench/out/kernel-<nav>.json.
const nav = (new URLSearchParams(location.search).get('nav') || 'unknown').replace(/[^a-z0-9]/g, '');
const estado = document.getElementById('estado');
const avisa = (x) => { estado.textContent = x; };
async function envia(res) {
  const r = await fetch(`/resultado?nombre=kernel-${nav}`, { method: 'POST', body: JSON.stringify(res) });
  avisa(r.ok ? 'done: result sent' : `could not send the result (HTTP ${r.status})`);
}
const extra = { nav, aislado: self.crossOriginIsolated === true };
const w = new Worker('./kernel-worker.js', { type: 'module' });
w.onmessage = ({ data }) => { if (data.progreso) avisa(data.progreso); else envia({ ...extra, ...data }); };
w.onerror = (e) => envia({ ...extra, error: String(e.message || e) });
