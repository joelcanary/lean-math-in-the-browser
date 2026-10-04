# Lean's GMP-free big-number code, with two prototypes

`build.sh` downloads `src/runtime/mpn.cpp` and `mpn.h` from leanprover/lean4 at `v4.34.0` (into `.cache/`,
not stored here), compiles them with `harness.cpp` and two minimal stand-ins for Lean's `debug.h` and
`buffer.h` (`shim/`), and prints JSON: Lean's `mpn_mul` against Karatsuba's method built on it, and the
AND of `mpz::operator&=` walking the longer or the shorter operand. Every Karatsuba product is checked
against `mpn_mul`'s, limb by limb, before anything is timed. `figura.py` draws figure 9 from the result.

```sh
sh bench/experimentos/mpn/build.sh 32 > bench/out/mpn-karatsuba.json   # 32: Karatsuba threshold, in digits
python bench/experimentos/mpn/figura.py
```

`build.sh divgcd` runs `divgcd.cpp` instead: Newton's and Barrett's division and Lehmer's gcd against
Lean's `mpn_div` and Euclid (`--check` before the threshold: only the correctness checks).
`figura_divgcd.py` draws figure 10.

Results and limits: [report, § 4.8](../../../docs/REPORT.md#48-what-two-small-changes-would-buy) and
[§ 4.9](../../../docs/REPORT.md#49-division-and-gcd).
Lean's files keep their own notices (Copyright (c) Microsoft Corporation) and are under the Apache License 2.0.
