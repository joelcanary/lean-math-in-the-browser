// The same workloads written by hand in plain JavaScript: what a web developer would write for the
// same job, with typed arrays for sieves and BigInt only where the numbers exceed 2^53. This is the
// baseline for "what does it cost to run the Lean code instead". Same algorithms as the Lean
// versions (so the ratio measures the runtime, not a better algorithm).

export function tunnell(n) {
  const isqrt = (s) => { let r = Math.floor(Math.sqrt(s)); while (r * r > s) r--; while ((r + 1) * (r + 1) <= s) r++; return r; };
  const rep = (a, c, m) => {
    let t = 0;
    for (let x = 0; a * x * x <= m; x++) {
      const rx = m - a * x * x;
      let y = isqrt(rx);
      for (let z = 0; c * z * z <= rx; z++) {
        const r = rx - c * z * z;
        while (y * y > r) y--;                       // moving pointer (z rises, r falls)
        if (y * y === r) t += (x ? 2 : 1) * (y ? 2 : 1) * (z ? 2 : 1);
      }
    }
    return t;
  };
  const [f, s] = n % 2 ? [rep(2, 32, n), rep(2, 8, n)] : [rep(4, 32, n / 2), rep(4, 8, n / 2)];
  return `${f} ${s} ${2 * f === s}`;
}

export function collatzRecord(N) {
  // one pass from N down to 1 keeping the smallest n on ties (>=), exactly like the Lean version;
  // an earlier draft walked the range twice and was unfair to JavaScript
  let best = 1, bs = 0;
  for (let n = N; n >= 1; n--) {
    let m = n, s = 0;
    while (m > 1) { m = m % 2 === 0 ? m / 2 : 3 * m + 1; s++; }
    if (s >= bs) { best = n; bs = s; }
  }
  return `${best} ${bs}`;
}

export function primeCount(N) {
  if (N < 2) return '0';
  const a = new Uint8Array(N + 1).fill(1); a[0] = a[1] = 0;
  for (let p = 2; p * p <= N; p++) if (a[p]) for (let j = p * p; j <= N; j += p) a[j] = 0;
  let c = 0; for (let i = 0; i <= N; i++) c += a[i];
  return String(c);
}

export function mertens(N) {
  const primo = new Uint8Array(N + 1).fill(1); primo[0] = primo[1] = 0;
  for (let p = 2; p * p <= N; p++) if (primo[p]) for (let j = p * p; j <= N; j += p) primo[j] = 0;
  const mu = new Int8Array(N + 1).fill(1);
  for (let p = 2; p <= N; p++) if (primo[p]) for (let j = p; j <= N; j += p) mu[j] = j % (p * p) === 0 ? 0 : -mu[j];
  let m = 0; for (let k = 1; k <= N; k++) m += mu[k];
  return String(m);
}

function partitionsNat(n) {
  const p = [1n];
  for (let m = 1; m <= n; m++) {
    let pos = 0n, neg = 0n;
    for (let k = 1; ; k++) {
      const g1 = k * (3 * k - 1) / 2; if (g1 > m) break;
      const g2 = k * (3 * k + 1) / 2;
      const t = p[m - g1] + (g2 <= m ? p[m - g2] : 0n);
      if (k % 2) pos += t; else neg += t;
    }
    p.push(pos - neg);
  }
  return p[n];
}

export function partitions(n) { return String(partitionsNat(n)); }

export function fib(n) {
  const pair = (k) => {
    if (k === 0) return [0n, 1n];
    const [a, b] = pair(Math.floor(k / 2));
    const c = a * (2n * b - a), d = a * a + b * b;
    return k % 2 === 0 ? [c, d] : [d, c + d];
  };
  return String(pair(n)[0]);
}

// bit length - 1 of a BigInt, without a decimal conversion (hex is linear in V8)
const log2Big = (b) => { const h = b.toString(16); return (h.length - 1) * 4 + Math.floor(Math.log2(parseInt(h[0], 16))); };
export function fibBits(n) { const pair = (k) => { if (k === 0) return [0n, 1n]; const [a, b] = pair(Math.floor(k / 2)); const c = a * (2n * b - a), d = a * a + b * b; return k % 2 === 0 ? [c, d] : [d, c + d]; }; return String(log2Big(pair(n)[0])); }
// keeps the BigInt: until 28-sep-2026 this went through the decimal string and back (quadratic in V8),
// which penalised JavaScript; the fix is E. J. Gallego Arias's revised baseline (see docs/REPORT.md)
export function partitionsBits(n) { return String(log2Big(partitionsNat(n))); }

export function isPrime(nIn) {
  const n = BigInt(nIn);
  if (n < 2n) return 'false';
  if (n < 4n) return 'true';
  if (n % 2n === 0n) return 'false';
  let d = n - 1n, s = 0n; while (d % 2n === 0n) { d /= 2n; s++; }
  const powMod = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n]) {
    if (a % n === 0n) continue;
    let x = powMod(a, d, n); if (x === 1n || x === n - 1n) continue;
    let ok = false; for (let i = 1n; i < s; i++) { x = x * x % n; if (x === n - 1n) { ok = true; break; } }
    if (!ok) return 'false';
  }
  return 'true';
}

export function lifePopulation(k) {
  const S = 64; let g = new Uint8Array(S * S), s = 20260926;
  // the generator in BigInt: 1103515245 * s exceeds 2^53, and a Number product silently loses the
  // low bits (the first version of this baseline did exactly that and gave 757 instead of 696)
  let sb = BigInt(s);
  for (let i = 0; i < S * S; i++) { sb = (1103515245n * sb + 12345n) % 2147483648n; g[i] = sb % 10n < 3n ? 1 : 0; }
  for (let t = 0; t < k; t++) {
    const h = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dy || dx) n += g[((y + dy + S) % S) * S + (x + dx + S) % S];
      h[y * S + x] = g[y * S + x] ? (n === 2 || n === 3 || n === 7 || n === 8 ? 1 : 0) : (n === 3 || n === 7 ? 1 : 0);
    }
    g = h;
  }
  let c = 0; for (let i = 0; i < S * S; i++) c += g[i];
  return String(c);
}
