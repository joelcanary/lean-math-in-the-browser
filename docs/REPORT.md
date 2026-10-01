# Lean math in the browser: a small benchmark

*An educational experiment, September 2026. It started from a question on the Lean Zulip (see
the [README](../README.md#where-this-comes-from)) and asks something narrow: if a mathematician
writes small pure Lean programs, can they run in a web page through lean-vir, are the answers
right, and what does it cost?*

## 1. Setup

| | engine comparison | browser |
|---|---|---|
| machine | machine A | machine B |
| engines | native Lean (compiled), Lean in WebAssembly via lean-vir in Node 25, hand-written JavaScript in Node | Lean via lean-vir and the JavaScript baseline, both in headless Chrome (September 2026), in a Web Worker and on the main thread |
| Lean | v4.34.0, core only (no Mathlib) | same packages |
| lean-vir | commit `cdba5cac11eb` (no release yet), SDK artifact of that commit | same |

**Engines are only compared on the same machine.** Native Lean was built on machine A, so native vs
WebAssembly vs JavaScript is measured there; the browser section compares WebAssembly
with JavaScript inside the same Chrome. Ratios are never taken across machines.

**Method.** Every (engine, workload, size) gets one warm-up call, then 7 timed calls (5 above 1 s,
3 above 10 s); medians are reported, and the charts shade the min–max range. Native Lean is timed
inside its own process (`IO.monoNanosNow`), so process start-up is not counted. **Every timed call is
checked before its time is kept**: the warm-up value against a SHA-256 of the value computed by an
independent Python reference, and every timed repetition against that checked value, outside the clock
(the native CLI compares each repetition with the first and reports the mismatches). A fast wrong answer
cannot enter the results. Until 28 September 2026 only the warm-up value was checked, although this
paragraph already said every value was; see [Corrections](#corrections-28-september-2026).

## 2. Workloads

| workload | what it stresses | external reference |
|---|---|---|
| Tunnell's criterion | nested loops on small `Nat` | OEIS A003273, brute force |
| Collatz record ≤ N | recursion of unknown length | OEIS A006877 |
| sieve π(N) | writes into `Array Bool` | OEIS A000720 |
| Mertens M(N) | writes into `Array Int` | OEIS A002321 |
| partitions p(n) | big-`Nat` additions, dynamic programming | OEIS A000041 |
| Fibonacci F(n) | big-`Nat` multiplication (fast doubling) | Python, two algorithms |
| Miller–Rabin | modular powers of big `Nat` | known Mersenne primes |
| Life B37/S2378, 64×64 torus | array updates, many generations | Python/numpy |

The Python references use a **different algorithm** from the Lean code wherever there is one
(coin-change DP vs Euler's pentagonal recurrence, a linear Möbius sieve vs a sieve by primes,
iterative addition and matrix powers vs fast doubling, other Miller–Rabin bases), so agreement is
evidence rather than an echo. The JavaScript baseline uses the **same algorithms** as the Lean code,
so the ratio measures the runtime, not a better algorithm.

## 3. Correctness

* **Kernel.** Each file ends with `decide +kernel` checks on small cases with known values: Tunnell
  on n = 1, 2, 3 (fail) and 5, 6, 7 (pass); Collatz 27 → 111 steps; π(100) = 25; M(10) = −1;
  p(10) = 42; F(30) = 832040; 97 prime, 91 not. The kernel evaluates the same code the browser runs.
* **Differential.** For Tunnell, the WebAssembly build equals native Lean and an independent Python
  count on **every n from 1 to 10,000** and on 40 random n up to 2·10⁶; the squarefree n that pass
  are exactly the terms of OEIS A003273 up to 9,999 (6,083 numbers); the parity theorem of the Lax
  archive entry lax-712553 (the counts are even) holds on every n it applies to.
* **Benchmark cases.** All 40 cases × 3 engines on machine A (120 timed rows) returned the expected
  value on the warm-up call and on every timed repetition (rerun on 28 September 2026 with the
  corrected harness); none was discarded. The 34 cases × 2 engines × 3 profiles in Chrome returned the
  expected value on the warm-up call; that campaign predates the correction, so its timed repetitions
  were not compared (see [Corrections](#corrections-28-september-2026)).

## 4. Results

The full numbers are in [`tabla.md`](tabla.md); the charts are drawn from `bench/out/*.json` by
`bench/graficas.py`.

### 4.1 What the interpreter costs

![time relative to native Lean, per workload](figuras/1-coste-por-carga.svg)

On loops and arrays, Lean in WebAssembly is **about 110–160× slower than native Lean** (Tunnell 110×,
sieve 134×, Mertens 140×, Collatz 158×, Life 118× at the largest sizes). Across every case with a
measurable native time the median is 108×. That is the expected order for an IR interpreter compiled
to WebAssembly, not a defect: lean-vir runs Lean's own interpreter, it does not compile Lean to
WebAssembly.

Where big integers dominate, the gap is much smaller — partitions 7×, Miller–Rabin 9× — because the
time is spent inside the runtime's arithmetic, which is compiled code in both cases.

Against **hand-written JavaScript** doing the same thing, the WebAssembly build is roughly 60–700×
slower on most workloads (Tunnell 290×, sieve 428×, Life 696×, partitions 58×) and only 5× on
Miller–Rabin, where both spend their time in big-integer arithmetic. JavaScript is also
faster than *native* Lean on most array workloads (a typed array against a boxed `Array Bool`).

In absolute terms: Tunnell for n ≈ 10⁵ answers in 67 ms, π(10⁶) in 0.9 s, p(3000) in 0.12 s. For
interactive pages that is usable up to moderate sizes, and hopeless for heavy computation.

### 4.2 Scaling

![time against size, per workload and engine](figuras/2-escalado.svg)

The three engines scale in parallel on almost every workload — the interpreter adds a constant
factor, not a worse complexity. The two visible exceptions are native Lean jumping between 31 and
61 bits in Miller–Rabin and between p(300) and p(1000): that is where Lean's `Nat` stops being an
unboxed machine integer (below 2⁶³) and becomes a heap bignum.

### 4.3 Printing, not multiplying

![F(10^6) with and without its decimal expansion](figuras/3-imprimir-vs-calcular.svg)

Native Lean computes F(10⁶) (694,241 bits) in **3 ms** and needs **9.2 s to print its 208,988 decimal
digits**: `toString` on a `Nat` grows quadratically with the length (ten times the digits,
F(10⁵) → F(10⁶), took about a hundred times longer: 92 ms → 9.2 s). Timing the printed value would
have blamed the multiplication for the conversion, so every big-number workload is also measured
without printing (`⌊log₂⌋` of the result).

With printing taken out, **big-`Nat` multiplication in WebAssembly is ~240× slower than native**
(701 ms vs 3 ms), much more than big-`Nat` addition (partitions, 7×). The binaries explain it: the
native executable links GMP statically (209 GMP symbols), while the unstripped build of lean-vir's
runtime (`vir-upstream.dev.wasm`) contains no GMP and instead Lean's own fallback for big numbers
(`lean::mpn_mul`, `lean::mpz`, on 32-bit limbs). So big-number work in the browser runs on Lean's
portable fallback, not on GMP; whether GMP could be built for WebAssembly there is a question for
lean-vir's authors.

### 4.4 In the browser

![cold start](figuras/5-arranque-en-frio.svg)

Starting the Lean runtime in Chrome takes **55 ms at full CPU speed** from creating the worker to the first
answer (29 ms importing the JavaScript runtime, 11 ms downloading, 15 ms compiling the WebAssembly
and loading the packages, 1 ms for the first call), and 169 ms with the CPU slowed 4×. The download
is from a local server, so on a real network add the transfer of 768 KB (runtime) + ~50 KB (packages).
The real page answers its first question **187 ms after navigation** (450 ms on the slowed CPU).

![the page stays responsive only with a Worker](figuras/4-la-pagina-no-se-congela.svg)

The whole benchmark (about 46 s of computation) run **in a Web Worker never cost the page a frame**:
the longest gap between two frames was 18 ms, one frame at 60 Hz. The same code **on the main thread
froze the page for 46 s** (162 s with the CPU slowed 4×). Moving the work into a Worker cost nothing
measurable (main thread ÷ worker = 0.99, median over 23 cases).

Inside Chrome the WebAssembly build is ~170× slower than the same JavaScript (median over the cases
where both take > 0.5 ms), the same order as in Node (116× on machine A; different machines, so only
the order of magnitude is comparable).

### 4.5 The mathematics

![Tunnell's criterion by residue class mod 8](figuras/6-tunnell-por-clase.svg)

Every squarefree n ≡ 5, 6, 7 (mod 8) up to 10,000 satisfies Tunnell's criterion (both counts are
zero for those classes), as expected; for n ≡ 1, 2, 3 (mod 8) only 11–17 % do. Under BSD every
squarefree n ≡ 5, 6, 7 (mod 8) is a congruent number; the unconditional statement is only that the
numbers that fail the criterion are not.

### 4.6 What one call costs

*Added on 30 September 2026, after a conversation with lean-vir's author about using Lean for
interactive pages.* A page like that calls Lean on every click or keystroke, so the cost of the call
matters more than the speed of a long computation. `Bench.lean` has four functions that do almost
nothing (`ident`, `strLength`, `fill`, `echo`), and `bench/medir-llamada.mjs` times them from Node.

![time per call and where it goes](figuras/7-coste-por-llamada.svg)

| call | time per call | of which: arguments into Wasm | Lean runs | result back to JS |
|---|--:|--:|--:|--:|
| `ident`: a `Nat` in, a `Nat` out | 1.8 µs | 0.9 µs | 0.4 µs | 0.4 µs |
| `strLength`, 10,000 characters in | 24 µs | 22 µs | 0.3 µs | 0.25 µs |
| `echo`, 10,000 characters in and out | 24 µs | 22 µs | 0.3 µs | 0.8 µs |
| `fill`, 10,000 characters out | 2.1 ms | 1.2 µs | 2.1 ms | 1.1 µs |

The first column is the median over batches of calls; the split comes from the runtime's own
`callTimed`, median of 200 calls. What it shows:

* A small call costs about 2 µs. The first call after the runtime starts took 2 to 4 ms in two runs.
* Strings cost more than numbers, in both directions, and what the text contains matters:

  | a million characters | ASCII (`a`) | mixed (`aé😀`) |
  |---|--:|--:|
  | into Lean (`strLength`) | 2.2 ms | 4.4 ms |
  | back to JavaScript (the decode phase of `echo`) | 0.10 ms | 1.35 ms |

* **Into Lean**, most of the time is spent inside Wasm building the Lean string, not in JavaScript:
  `TextEncoder` alone takes about 0.3 ms of the 2.1 ms for ASCII. Encoding straight into Wasm memory
  with `TextEncoder.encodeInto` instead of `encode` plus a copy saves only 3–8 %
  (`bench/experimentos/strings-encodeinto.mjs`).
* **Back to JavaScript**, ASCII is cheap because `TextDecoder` has a fast path for it. Text with
  accents or emoji costs 13 times as much (about 1.3 ns per character): that is the UTF-8 to UTF-16
  conversion. It is still about three times cheaper than the way in.
* `fill` is slow for a different reason: `String.pushn` runs in the interpreter one character at a
  time, about 220 ns each. The time is in Lean, not at the boundary.

So calls with small arguments are cheap enough to make on every keystroke, and strings of hundreds of
kilobytes per call start to show. This was measured in Node on machine A only; see § 6.

## 5. What we found along the way

For Lean users writing code meant to run both in the kernel and in the browser:

1. **In a module, a `for` loop over a range does not reduce in the kernel**, not even with
   `decide +kernel` (corrected on 1 October 2026; see [Corrections](#corrections-1-october-2026)).
   Checked on Lean v4.34.0 and v4.35.0-rc3: outside the module system `for i in [0:n]` reduces; in a
   `module` file it gets stuck, apparently because `Std.Legacy.Range.forIn'` is not `@[expose]`d; the
   newer ranges (`for i in 0...n`) reduce in neither; a `for` over a `List` reduces in both; `while`
   never does, since it goes through a `partial` loop. Our files are modules, so code that should also
   be *checked* by evaluation had to be written with structural recursion on an explicit bound.
2. **With the module system, a definition is exported to other modules without its body** unless it
   is `@[expose]`d, so evaluation that reaches it from another file gets stuck; the error only says
   that reduction got stuck, not why.
3. **Non-tail recursion overflows the IR interpreter's stack in WebAssembly** long before native code
   would (Tunnell overflowed near n ≈ 10⁷ at a recursion depth of a few thousand); accumulators fix it.
4. **`toString` of a big `Nat` is quadratic** (natively, 3 ms to compute F(10⁶), 9.2 s to print it).
5. **Big-`Nat` multiplication in the WebAssembly runtime is ~240× slower than native** (§ 4.3): the
   runtime uses Lean's portable fallback on 32-bit limbs, not GMP.

For people measuring things in browsers:

6. **Chrome's CPU throttling through the DevTools protocol does not reach dedicated Web Workers** —
   set on the page or on the worker's own debugging session, the worker ran at full speed (ratio
   0.98–1.05). A slowed-CPU profile of worker code measured that way runs at full speed. We measured
   the slowed CPU on the main thread instead (4.4× slower, as intended).
7. **The long-task observer misses a main thread that is blocked the whole time** (its entries arrive
   after the thread frees up); the largest gap between frames cannot be missed that way.

And one about the baseline:

8. **The first hand-written JavaScript silently gave a wrong answer** (757 instead of 696 live cells):
   a linear congruential generator whose product exceeds 2⁵³ loses low bits in a JavaScript `Number`.
   It was caught by the value check and fixed with `BigInt`; a Lean `Nat` cannot fail that way.
   A second JavaScript draft walked the Collatz range twice and was unfair to JavaScript; it was fixed
   before the final runs.

## 6. Limits of this study

* Two machines, one browser (Chrome), one lean-vir commit, one Lean version. Firefox and Safari were
  not measured, and lean-vir says its browser surface will change.
* The slowed-CPU numbers are machine B's CPU slowed 4× by Chrome on the main thread, not a measurement
  on real slower hardware.
* Memory use and download over a real network were not measured.
* The cost of one call (§ 4.6) was measured in Node only. It is still to be measured in Chrome (in a
  Worker and on the main thread), Firefox and Safari, where the clock is coarser unless the page is
  cross-origin isolated, and on a phone.
* Eight small classical workloads are not a representative sample of Lean programs; they are chosen
  to stress different parts of the runtime, and all are single-threaded.
* The kernel checks cover small cases only; on large inputs correctness rests on the differential
  tests against independent code, which is evidence, not proof. Tunnell's theorem itself is not
  formalized here.
* The JavaScript baseline is one reasonable implementation per workload, not an optimised one.

## Corrections (28 September 2026)

Emilio Jesús Gallego Arias reproduced this study and extended it with lean-vir's FIR backend and a
C/Emscripten build ([his report](https://github.com/ejgallego/lean-math-in-the-browser/blob/research/vir-fir-report/docs/REPORT.md)).
His review found two methodology errors here, both now fixed:

1. **Not every timed value was checked.** The Method paragraph said every value was checked before its
   time was kept. In fact the Node and browser harnesses checked only the warm-up value, and the
   native harness only the last value the CLI printed. Now the native CLI compares every timed
   repetition with the first and reports the mismatches, and the Node and browser harnesses compare
   every repetition with the checked warm-up value, all outside the clock.
2. **The JavaScript `partitionsBits` went through a decimal string** (`BigInt` → decimal → `BigInt`)
   before taking the bit length, a quadratic detour that the Lean version does not make. It now keeps
   the `BigInt`, as in his revised baseline. At the sizes measured here p(n) has at most about 60
   digits, so the detour cost almost nothing: 2.33 ms before, 2.03 ms after for p(3000), about the
   same as `partitions` itself in both runs.

The comparison on machine A was rerun with the corrected harnesses (and Node 25 instead of Node 22):
all 120 timed rows, every repetition included, returned the expected value, and the numbers in
§ 4 and § 5 are from that rerun. They moved by run-to-run noise, not by the corrections — for example
WebAssembly ÷ native went from a median of 117× to 108×, and big-`Nat` multiplication from ~230× to
~240×. The browser campaign on machine B was **not** rerun: its values were checked on the warm-up
call only, and § 4.4 still reports those measurements.

These corrections do not change the findings, as his report also concludes.

## Corrections (1 October 2026)

Two more statements in this report were wrong or incomplete, both found while following up on the
conversation with E. J. Gallego Arias:

1. **Strings back to JavaScript are not always cheap.** § 4.6 said getting a string back was 10–20
   times cheaper per character than passing one in. That holds for ASCII only: the bench used only
   the letter `a`, which takes `TextDecoder`'s fast path. With accents and emoji the way back costs
   13 times as much, as he had pointed out (the UTF-8 to UTF-16 conversion). The bench now has mixed
   text, and § 4.6 gives both.
2. **`for` loops and the kernel.** § 5 said core `for` loops did not reduce in the kernel. They do
   outside the module system; the claim holds for a `for` over a range inside a `module` file, and for
   the newer `0...n` ranges everywhere. § 5 now says exactly that.

## Appendix: how every number was produced

```sh
# the cases and their expected values (independent Python, different algorithms)
python bench/generar_casos.py
# on the machine with native Lean, after `lake build tunnell_cli` and copying the packages to bench/pkg/
node bench/medir-nativo.mjs      # native Lean
node bench/medir-node.mjs        # Lean in WebAssembly and JavaScript, in Node
node bench/medir-llamada.mjs     # the cost of one call (§ 4.6), in Node
# in the browser (serve the repository root with python bench/servir.py; set CHROME to a Chrome binary)
node bench/navegador/correr.mjs normal http://127.0.0.1:8125/ worker
node bench/navegador/correr.mjs normal http://127.0.0.1:8125/ principal
node bench/navegador/correr.mjs lenta http://127.0.0.1:8125/ principal
# the report's numbers and figures
python bench/resumen.py
python bench/graficas.py
```

Prepared with the help of an AI assistant (Claude, Anthropic); the author reviewed the method,
the results and this text and is responsible for them.
