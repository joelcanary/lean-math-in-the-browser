#!/bin/sh
# Lean's mpn.cpp as it is and with the one-line change of report § 4.11, in one program (acarreo.cpp).
#   CXX=<compiler> sh build.sh > out.json      (default c++; Lean's own toolchain ships clang)
set -e
cd "$(dirname "$0")"
MPN=../../mpn
LEAN=293d5d0c0c3f3dded4688b3ccd6a33939ac5102b   # leanprover/lean4 v4.34.0, as ../../mpn/build.sh
mkdir -p "$MPN/.cache/runtime"
for f in mpn.cpp mpn.h; do
  [ -s "$MPN/.cache/runtime/$f" ] || curl -fsSL "https://raw.githubusercontent.com/leanprover/lean4/$LEAN/src/runtime/$f" -o "$MPN/.cache/runtime/$f"
done
mkdir -p .cache
python3 parche.py "$MPN/.cache/runtime/mpn.cpp" .cache/mpn_fix.cpp 2>/dev/null || python parche.py "$MPN/.cache/runtime/mpn.cpp" .cache/mpn_fix.cpp
CC="${CXX:-c++} -O3 -std=c++17 -I$MPN/shim -I$MPN/.cache"
$CC -Dlean=lean_v0 -c "$MPN/.cache/runtime/mpn.cpp" -o .cache/v0.o
$CC -Dlean=lean_fix -I"$MPN/.cache" -c .cache/mpn_fix.cpp -o .cache/fix.o
$CC -o .cache/acarreo acarreo.cpp .cache/v0.o .cache/fix.o
./.cache/acarreo
