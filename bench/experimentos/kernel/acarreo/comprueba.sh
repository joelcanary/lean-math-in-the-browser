#!/bin/sh
# Correctness only (no timing): every variant of §§ 4.11–4.13 against Lean's own mpn.cpp. Used by CI.
set -e
cd "$(dirname "$0")"
MPN=../../mpn
LEAN=293d5d0c0c3f3dded4688b3ccd6a33939ac5102b   # leanprover/lean4 v4.34.0
mkdir -p "$MPN/.cache/runtime" .cache
for f in mpn.cpp mpn.h; do
  [ -s "$MPN/.cache/runtime/$f" ] || curl -fsSL "https://raw.githubusercontent.com/leanprover/lean4/$LEAN/src/runtime/$f" -o "$MPN/.cache/runtime/$f"
done
PY=$(command -v python3 || command -v python)
for v in fix sub subb; do $PY parche.py "$MPN/.cache/runtime/mpn.cpp" .cache/mpn_$v.cpp $v; done
CC="${CXX:-c++} -O2 -std=c++17 -I$MPN/shim -I$MPN/.cache"
$CC -Dlean=lean_v0 -c "$MPN/.cache/runtime/mpn.cpp" -o .cache/k_v0.o
for v in fix sub subb; do $CC -Dlean=lean_$v -c .cache/mpn_$v.cpp -o .cache/k_$v.o; done
# a copy of the fused division that counts how often it adds back (to prove the tests reach that branch)
$PY cuenta.py .cache/mpn_sub.cpp .cache/mpn_cnt.cpp
$CC -Dlean=lean_cnt -c .cache/mpn_cnt.cpp -o .cache/k_cnt.o
$CC -o .cache/comprueba comprueba.cpp .cache/k_v0.o .cache/k_fix.o .cache/k_sub.o .cache/k_subb.o .cache/k_cnt.o
./.cache/comprueba
