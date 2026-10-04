# Lean math in the browser

**An educational test bed.** Classical number-theory computations written in Lean 4, run in
the browser through [lean-vir](https://github.com/ejgallego/lean-vir) (Lean's IR interpreter
compiled to WebAssembly), checked against independent references, and timed against native
Lean and hand-written JavaScript.

> **Status: experimental, for learning and testing.** This is not a library, not a product
> and not affiliated with the Lean FRO or with lean-vir. lean-vir is pinned to one commit
> (`cdba5ca`) and its authors say its browser-binding surface will change; the numbers here
> describe that commit, plus one paired comparison against lean-vir's `main` of 3 October 2026.
> Every correction is dated in the report; nothing is changed silently.

→ **[The report](docs/REPORT.md)**: method, results, charts, what we found and the limits of it.

## Results at a glance

**What interpreting Lean in the browser costs.** Loops and arrays run about 110–160× slower through
lean-vir than compiled natively (median 108× over all measurable cases); where big-integer
arithmetic dominates, the gap falls to about 7–9×. Small inputs still answer in milliseconds.
That factor is the interpreter's: an experimental compiler from Lean to WebAssembly (FIR),
evaluated by E. J. Gallego Arias on these same workloads, brings the loops to within 1–3× of native
and makes big-integer arithmetic the bottleneck instead
([report, update of 3 October](docs/REPORT.md#update-3-october-2026-lean-vir-at-main-and-a-compiled-backend)).

![time relative to native Lean, per workload](docs/figuras/1-coste-por-carga.svg)

**Keep the page responsive: use a Web Worker.** The whole benchmark (about 46 s of computation) run
in a Worker never cost the page a frame; the same code on the main thread froze it for 46 s.

![the page stays responsive only with a Worker](docs/figuras/4-la-pagina-no-se-congela.svg)

**Big numbers: printing, not multiplying.** Natively, F(10⁶) takes 3 ms to compute and 9.2 s to print
in decimal; in the browser, multiplication itself is ~240× slower because lean-vir's runtime uses
Lean's portable big-number fallback instead of GMP.

![F(10^6) with and without its decimal expansion](docs/figuras/3-imprimir-vs-calcular.svg)

**One call is cheap, and getting cheaper.** A call from JavaScript with a small argument costs about
2 µs at the pinned commit and 1.5 µs on lean-vir's current `main` (27 % less, paired measurement);
passing a string in costs about 2 ns per character (twice that with accents or emoji, which also
make the way back cost more). Measured in Node, Chrome, Firefox and Safari; not yet on a phone
([report, § 4.6](docs/REPORT.md#46-what-one-call-costs)).

**Big numbers grow apart.** Without GMP, Lean's own multiplication, division, remainder and gcd
are quadratic: in WebAssembly their time grows as bits^2.0, natively as bits^1.4–1.5, so the gap
grows with the numbers: multiplication goes from 5× at 1,024 bits to 85× at 65,536, gcd from 45× to 374×
([report, § 4.7](docs/REPORT.md#47-big-number-arithmetic-one-operation-at-a-time)).

![time per operation against operand size](docs/figuras/8-aritmetica.svg)

**And the mathematics.** Every squarefree n ≡ 5, 6, 7 (mod 8) up to 10,000 satisfies Tunnell's
criterion (congruent if BSD holds); in the other classes only 11–17 % do.

![Tunnell's criterion by residue class mod 8](docs/figuras/6-tunnell-por-clase.svg)

## Updates

| date | what changed |
|---|---|
| 4 Oct 2026 | division and gcd: Newton's division pays from about 16,000 bits, Barrett's (divisor reused) from 1,024, and Lehmer's gcd is 11–12× faster at every size; all checked against Lean's own code ([§ 4.9](docs/REPORT.md#49-division-and-gcd)) |
| 3 Oct 2026 | what two small changes to Lean's GMP-free code would buy, prototyped against Lean's own `mpn.cpp`: Karatsuba (8.6× at 65,536 bits) and a shorter AND (constant instead of linear); the same code runs in WebAssembly at 1.00–1.05× its native speed ([§ 4.8](docs/REPORT.md#48-what-two-small-changes-would-buy)) |
| 3 Oct 2026 | big-number arithmetic operation by operation, from 64 to 65,536 bits: quadratic in WebAssembly (Lean's GMP-free code), subquadratic natively; a small `&&&` costs as much as the larger number ([§ 4.7](docs/REPORT.md#47-big-number-arithmetic-one-operation-at-a-time)) |
| 3 Oct 2026 | lean-vir `main` against the pinned commit, paired: small calls 27 % cheaper, runtime start about 18 % faster, computation unchanged; the default runtime download at `main` fails until lean-vir publishes `v0.1.0`; pointer to the FIR evaluation ([update](docs/REPORT.md#update-3-october-2026-lean-vir-at-main-and-a-compiled-backend)) |
| 2 Oct 2026 | the cost of one call measured in Chrome, Firefox and Safari ([§ 4.6](docs/REPORT.md#46-what-one-call-costs)) |
| 1 Oct 2026 | two statements corrected: strings back to JavaScript with non-ASCII text, and which `for` loops the kernel can evaluate ([corrections](docs/REPORT.md#corrections-1-october-2026)) |
| 30 Sep 2026 | what one call from JavaScript into Lean costs, with its phases ([§ 4.6](docs/REPORT.md#46-what-one-call-costs)) |
| 28 Sep 2026 | after a review by E. J. Gallego Arias: every timed repetition is now checked, not only the warm-up; Node figures re-measured ([corrections](docs/REPORT.md#corrections-28-september-2026)) |
| 26 Sep 2026 | first publication: eight workloads, the report and its figures |

## Goal

**To give the Lean FRO and the lean-vir maintainers measurements they can use**: independent,
reproducible, every value checked before it is timed, with every correction dated. The questions so
far:

* What does running Lean in the browser cost, and what changes between lean-vir versions? (§ 4.1–4.6
  and the update of 3 October)
* Where does Lean's GMP-free runtime spend its time, and what would changing it buy? Multiplication,
  division and gcd are quadratic there; Karatsuba on top of Lean's own `mpn_mul` is 8.6× faster at
  65,536 bits, and a shorter AND turns a linear cost into a constant (§ 4.7–4.8). This complements
  [lean4#15022](https://github.com/leanprover/lean4/pull/15022), which proves that code correct.

* And for division and gcd: Lehmer's gcd is 11–12× faster at every size; Newton's division pays
  for big numbers, Barrett's whenever the divisor repeats (§ 4.9).

Still open: the same measurements in a browser (only Node so far) and on a phone; a subquadratic gcd
(half-gcd) and divide-and-conquer division for medium sizes; and the compiled backend (FIR) once it
is public. Nothing here is affiliated with the
Lean FRO; it is offered as data.

## Where this comes from

In September 2026 someone asked on the Lean Zulip, in
[*DOM Manipulation in Lean*](https://leanprover.zulipchat.com/#narrow/channel/113488-general/topic/DOM.20Manipulation.20in.20Lean)
(#general), what the options were for manipulating a web page from Lean. The replies pointed
to ProofWidgets4 for an HTML model and to lean-vir, which compiles a subset of Lean to
WebAssembly; one of lean-vir's authors added that its DOM bindings are still expected to
change, but that *pure* Lean programs running in WebAssembly are a much more stable surface.

That last remark is what this repository tests, out of curiosity: take small pure Lean
programs of the kind a mathematician would write, run them in a browser, and check — as
carefully as we can — that they give the right answers, what it costs, and what breaks. It
started with one function (Tunnell's criterion for congruent numbers) and grew into a small
benchmark of eight workloads.

## What is here

| path | what it is |
|---|---|
| [`Tunnell.lean`](Tunnell.lean) | Tunnell's criterion: lattice-point counts, with an honest verdict (`2A ≠ B` ⇒ not congruent, unconditionally; `2A = B` ⇒ congruent *if* BSD holds) |
| [`Arith.lean`](Arith.lean) | one big-number operation at a time (add, multiply, divide, remainder, gcd), for § 4.7 |
| [`Bench.lean`](Bench.lean) | the other workloads: Collatz record, sieve π(N), Mertens M(N), partitions p(n), Fibonacci, Miller–Rabin, Life B37/S2378; and four near-empty functions to time a call |
| [`Main.lean`](Main.lean) | the same code as a native command-line program, for comparison and timing |
| [`site/`](site/) | a static page that decides Tunnell's criterion in the browser, in a Web Worker |
| [`bench/`](bench/) | references (Python, different algorithms), the JavaScript baseline, the timing harnesses, the charts; [`bench/experimentos/`](bench/experimentos/) holds the one-off experiments (strings, the lean-vir A/B, arithmetic, and [`mpn/`](bench/experimentos/mpn/): Lean's GMP-free code with Karatsuba) |
| [`tests/`](tests/) | the differential test suite |
| [`docs/`](docs/) | the report and its figures |

Every loop in the Lean files is structural (or tail) recursion on an explicit bound, so the
Lean kernel can evaluate the small cases (`decide +kernel`) — the report explains which `for`
loops the kernel can and cannot evaluate — and core Lean only, no Mathlib.

## Checks at a glance

* The kernel evaluates each function on small cases with known values (OEIS).
* The WebAssembly build equals native Lean and an independent Python count on every n ≤ 10,000
  for Tunnell, and on every benchmark case; the squarefree n that pass Tunnell's criterion are
  exactly OEIS A003273 up to 9,999.
* Since 28 September, every timed call in Node and in native Lean is checked against its expected
  value, outside the clock; the earlier browser campaign checked the warm-up call only (see the
  [corrections](docs/REPORT.md#corrections-28-september-2026)).
* The page works under a strict Content-Security-Policy (only `'wasm-unsafe-eval'` added).

## Run it

Lean 4 `v4.34.0` (see `lean-toolchain`); lean-vir is pinned in `lakefile.lean`.

```sh
lake build                          # compiles, and the kernel runs the checks
lake build +Tunnell:vir +Bench:vir  # the WebAssembly packages (.lake/build/vir/module-sets/)
lake build :virSdk                  # the browser runtime (needs GITHUB_TOKEN while lean-vir has no release)
python bench/servir.py              # then open http://127.0.0.1:8125/site/
```

With a newer lean-vir, until its first release is published, take the runtime that its CI built
for the commit you use: `VIR_SDK_COMMIT=<lean-vir commit> lake build :virSdk`.

The test suite (what CI runs) needs the native references first:

```sh
lake build tunnell_cli && mkdir -p tests/out
.lake/build/bin/tunnell_cli 1 10000 > tests/out/nativo.txt
.lake/build/bin/tunnell_cli --ns $(cat tests/azar.txt) > tests/out/nativo-azar.txt
python tests/referencia_rapida.py 1 10000 > tests/out/python.txt
python tests/referencia_rapida.py --ns $(cat tests/azar.txt) > tests/out/python-azar.txt
node tests/pruebas.mjs
```

The report's appendix lists the exact commands that produced every number.

## Feedback

Corrections are welcome as issues: if a number or a statement here is wrong, it gets fixed and the
fix is dated in the report, as the ones above were. Thanks to E. J. Gallego Arias (lean-vir) for
reviewing the harness and for the FIR evaluation on these workloads.

## Licences

This repository: Apache License 2.0 ([`LICENSE`](LICENSE)). `site/lean-vir/` is the lean-vir
browser SDK, © Lean FRO LLC, Apache License 2.0 ([`site/lean-vir/LICENSE`](site/lean-vir/LICENSE)).
`b003273.txt` is from the OEIS (CC BY-SA 4.0).

Prepared with the help of an AI assistant (Claude, Anthropic); the author reviewed it and is
responsible for it.
