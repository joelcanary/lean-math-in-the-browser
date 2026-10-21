// Runs the LeanUI wasm64 build of the benchmark (leanui-worker.js) in this browser, in a module Worker, and
// posts the result to bench/servir.py --aislado (bench/out/leanui-<browser>.json). With ?arch=32, the wasm32
// build of the same program (bench/out/leanui32-<browser>.json).
const q = new URLSearchParams(location.search);
const nav = (q.get('nav') || 'unknown').replace(/[^a-z0-9]/g, '');
const arch = q.get('arch') === '32' ? '32' : '';
const estado = document.getElementById('estado');
const avisa = (x) => { estado.textContent = x; };

async function envia(res) {
  const r = await fetch(`/resultado?nombre=leanui${arch}-${nav}`, { method: 'POST', body: JSON.stringify(res) });
  avisa(r.ok ? 'done: result sent' : `could not send the result (HTTP ${r.status})`);
}

// no browser version or machine details in the published data
const extra = { nav, arch: arch ? 'wasm32' : 'wasm64', aislado: self.crossOriginIsolated === true };
const w = new Worker('./leanui-worker.js', { type: 'module' });
w.onmessage = ({ data }) => { if (data.progreso) avisa(data.progreso); else envia({ ...extra, ...data }); };
w.onerror = (e) => envia({ ...extra, error: String(e.message || e) });
w.postMessage({ arch });
