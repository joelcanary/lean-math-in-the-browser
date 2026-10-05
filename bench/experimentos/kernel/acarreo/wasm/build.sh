#!/bin/sh
# Builds mpn-div.wasm: Lean's mpn.cpp (v4.34.0) for wasm32 with the clang of Lean's own toolchain, twice (as it is,
# namespace lean_v0, and with the one-line change of report § 4.11, lean_fix), freestanding (shim/: no C library),
# linked with the lld of the same toolchain. Its lean_v0 mpn_mul is byte for byte lean-vir's (check with cuerpos.py).
#   sh build.sh      (run ../build.sh once first: it fetches Lean's files and writes the patched copy)
set -e
cd "$(dirname "$0")"
BIN=${LEAN_BIN:-$(dirname "$(elan which lean)")}
CLANG="$BIN/clang"; LLD="$BIN/lld"
[ -x "$CLANG" ] || CLANG="$BIN/clang.exe"
[ -x "$LLD" ] || LLD="$BIN/lld.exe"
MPN=../../../mpn
F="--target=wasm32 -O3 -mbulk-memory -fno-exceptions -fno-rtti -nostdinc -nostdinc++ -std=c++17 -Ishim -I$MPN/.cache"
mkdir -p .cache
"$CLANG" -x c++ $F -Dlean=lean_v0 -c "$MPN/.cache/runtime/mpn.cpp" -o .cache/v0.o
"$CLANG" -x c++ $F -Dlean=lean_fix -c ../.cache/mpn_fix.cpp -o .cache/fix.o
"$CLANG" -x c++ $F -ffreestanding -c libc.cpp -o .cache/libc.o
"$CLANG" -x c++ $F -c exports.cpp -o .cache/exports.o
"$LLD" -flavor wasm --no-entry --initial-memory=33554432 --export-memory -o mpn-div.wasm .cache/v0.o .cache/fix.o .cache/libc.o .cache/exports.o
python ../../cuerpos.py mpn-div.wasm 0 2>/dev/null || python3 ../../cuerpos.py mpn-div.wasm 0
