# Lean's `mpn_mul` alone

The files behind [report § 4.11](../../../docs/REPORT.md#411-why-the-engines-differ-where-the-carry-is-added).

| file | what it is |
|---|---|
| `mpn_mul.wat`, `.wasm` | function 140 of `site/lean-vir/wasm/vir-upstream.wasm` (Lean's `mpn_mul`), copied verbatim with `wasm2wat` (wabt 1.0.37) |
| `mpn_mul_vj.wat`, `.wasm` | the same, with the multiplier digit `b[j]` loaded once per row (edited by hand) |
| `mpn_mul_assoc.wat`, `.wasm` | the same, with the carry added last: `(u·v + c) + k` (edited by hand) |
| `mpn_mul_barrier.wasm` | `mpn_mul.wasm` with its body replaced by what Lean's clang emits for `fuente/mpn_mul.cpp`, `VARIANT=2` (`injerta.py`) |
| `fuente/mpn_mul.cpp` | Lean's `mpn_mul` (v4.34.0) alone, in three variants: Lean's code, the carry in its own statement, the carry behind an empty `asm` |
| `fuente/nativo.cpp` | the native comparison of variants 0 and 2 |
| `kernel.mjs` | the measurement, shared by `kernel-node.mjs` (Node) and `../../navegador/kernel.html` (browsers) |
| `cuerpos.py` | SHA-256 of one function body of a module or object file |
| `figura_kernel.py` | figure 12 and the numbers of § 4.11 |

```sh
# that the extract is Lean's function, and that Lean's clang emits it from the C++ (same hash three times)
python cuerpos.py ../../../site/lean-vir/wasm/vir-upstream.wasm 140
python cuerpos.py mpn_mul.wasm 0
clang --target=wasm32 -O3 -mbulk-memory -c -DVARIANT=0 fuente/mpn_mul.cpp -o v0.o   # the clang in Lean v4.34.0's toolchain
python cuerpos.py v0.o 0
# the module built from the one-line change
clang --target=wasm32 -O3 -mbulk-memory -c -DVARIANT=2 fuente/mpn_mul.cpp -o v2.o
python injerta.py v2.o
# measure (each module and size is checked against BigInt first)
node kernel-node.mjs ../../out/kernel-node.json
# natively
c++ -O3 -c -DVARIANT=0 -Dmpn_mul=mpn_mul_v0 fuente/mpn_mul.cpp -o n0.o
c++ -O3 -c -DVARIANT=2 -Dmpn_mul=mpn_mul_v2 fuente/mpn_mul.cpp -o n2.o
c++ -O3 -std=c++17 fuente/nativo.cpp n0.o n2.o -o nativo && ./nativo > ../../out/kernel-nativo.json
python figura_kernel.py
```

The machine code in § 4.11 came from `node --no-liftoff --print-wasm-code` (V8) and from the `jsc`
shell with `--dumpOMGDisassembly=true` (JavaScriptCore), each running `mpn_mul.wasm` a few hundred
to a few thousand times so that the optimising compiler takes over.

## Lean's own `mpn.cpp`, as it is and with the change ([§ 4.12](../../../docs/REPORT.md#412-the-same-change-on-x86-and-in-division))

| file | what it is |
|---|---|
| `acarreo/parche.py` | writes `mpn.cpp` with the one-line change of § 4.11 (and refuses a different `mpn.cpp`) |
| `acarreo/acarreo.cpp`, `acarreo/build.sh` | native: both versions in one program, `mpn_mul` and `mpn_div` checked (independent product; q·d + r, r < d) and timed. `CXX=<compiler> sh build.sh > out.json` |
| `acarreo/wasm/` | the same in WebAssembly: `build.sh` (Lean's clang and lld, freestanding `shim/`), `mpn-div.wasm`, `mide.mjs` (checked against BigInt, then timed), `node-run.mjs`; in browsers `../../navegador/acarreo.html` |
