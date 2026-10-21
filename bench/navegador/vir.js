// The lean-vir + JavaScript harness of index.html (bench-core.js in a module Worker), started by the page
// itself instead of by correr.mjs, for browsers that correr.mjs cannot drive (it speaks Chrome's CDP).
// Same sizes and repetitions as correr.mjs's "normal" profile; posts the result to bench/servir.py --aislado
// (bench/out/navegador-<browser>-worker.json).
import './pagina.js';

// the same caps as bench/navegador/correr.mjs
const MAX = { tunnell: 100003, collatzRecord: 10000, primeCount: 1000000, mertens: 100000, partitions: 1000, fib: 100000, fibBits: 1000000, partitionsBits: 3000, isPrime: 1279, lifePopulation: 30 };
const nav = (new URLSearchParams(location.search).get('nav') || 'unknown').replace(/[^a-z0-9]/g, '');
const estado = document.getElementById('estado');

const res = await window.__arranca({ max: MAX, reps: 5, hilo: 'worker' });
const r = await fetch(`/resultado?nombre=navegador-${nav}-worker`, { method: 'POST', body: JSON.stringify({ nav, aislado: self.crossOriginIsolated === true, ...res }) });
estado.textContent = r.ok ? 'done: result sent' : `could not send the result (HTTP ${r.status})`;
