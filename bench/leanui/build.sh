#!/bin/bash
# The benchmark's command-line program (Main.lean) built the way LeanUI builds an app
# (github.com/FawadHa1der/leanui, toolchain/build-archives.sh and tools/build-app.sh at 881930f):
# Lean -> C with the native toolchain, C -> single-threaded wasm64 with Emscripten, linked against
# libleanrt/libInit/libStd/libuv built from the QED64 fork of Lean 4.34.0 with leanui's patch.
# Run from the repository root:  EMSDK=/path/to/emsdk bash bench/leanui/build.sh
# Needs: an emsdk with 6.0.5 installed and activated, cmake, a C/C++ compiler for the native stage 0,
# libuv for that stage (found through pkg-config), git, python3 and Lean 4.34.0 (elan). No Docker: the
# options are leanui's, passed to the same cmake. Everything goes to bench/leanui/.cache (about 3 GB).
# Outputs: bench/leanui/wasm/tunnell_cli.{js,wasm} (Node) and tunnell_cli_web.{mjs,wasm} (module Worker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
C="$ROOT/bench/leanui/.cache"; OUT="$ROOT/bench/leanui/wasm"
mkdir -p "$C" "$OUT"
: "${EMSDK:?set EMSDK to an emsdk directory with 6.0.5 activated}"
. "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
EM="$(dirname "$(command -v emcc)")"
emcc --version | head -1 | grep -q " 6\.0\.5 " || { echo "emcc is not 6.0.5" >&2; exit 2; }

# 1. leanui at the commit measured, for its toolchain pin and patch
LEANUI=881930f1c6ab2bca80f19006614b7cb35690c332
if [ ! -d "$C/leanui/.git" ]; then
  git init -q "$C/leanui" && git -C "$C/leanui" remote add origin https://github.com/FawadHa1der/leanui.git
  git -C "$C/leanui" fetch -q --depth 1 origin "$LEANUI" && git -C "$C/leanui" -c advice.detachedHead=false checkout -q FETCH_HEAD
fi
. "$C/leanui/toolchain/fork.lock"      # repo, commit (53cb11e…), lean, image
SRC="$C/lean4-fork"; B="$C/build"; TC="$C/wasm64"
if [ ! -d "$SRC/.git" ]; then
  git init -q "$SRC" && git -C "$SRC" remote add origin "$repo"
  git -C "$SRC" fetch -q --depth 1 origin "$commit" && git -C "$SRC" -c advice.detachedHead=false checkout -q FETCH_HEAD
fi
[ "$(git -C "$SRC" rev-parse HEAD)" = "$commit" ] || { echo "fork is not at $commit" >&2; exit 2; }

# 2. the archives: leanui's cmake options (MULTI_THREAD=OFF, LEAN_WASM_THREADS=OFF, USE_GMP=OFF, no mimalloc)
if [ ! -f "$TC/lib/libStd.a" ]; then
  git -C "$SRC" checkout -q -- src/CMakeLists.txt
  git -C "$SRC" apply "$C/leanui/toolchain/lean-wasm-threads.patch"
  STAGE0=()
  if [ "$(uname)" = Darwin ]; then
    # the Command Line Tools ship an empty c++ include directory: point stage 0 at the SDK's
    SDK="$(xcrun --show-sdk-path)"
    STAGE0=(-DSTAGE0_CMAKE_C_COMPILER=/usr/bin/clang -DSTAGE0_CMAKE_CXX_COMPILER=/usr/bin/clang++
            "-DSTAGE0_CMAKE_C_FLAGS=-isysroot $SDK" "-DSTAGE0_CMAKE_CXX_FLAGS=-isysroot $SDK -isystem $SDK/usr/include/c++/v1"
            "-DSTAGE0_CMAKE_OSX_SYSROOT=$SDK")
  else
    STAGE0=(-DSTAGE0_CMAKE_C_COMPILER=/usr/bin/gcc -DSTAGE0_CMAKE_CXX_COMPILER=/usr/bin/g++)
  fi
  cmake "$SRC" --preset release -B "$B" -DCMAKE_C_COMPILER_WORKS=1 \
    -DCMAKE_TOOLCHAIN_FILE="$EM/cmake/Modules/Platform/Emscripten.cmake" \
    -DCMAKE_C_FLAGS=-m64 -DCMAKE_CXX_FLAGS=-m64 -DCMAKE_AR="$EM/emar" "${STAGE0[@]}" -DSTAGE0_CMAKE_EXECUTABLE_SUFFIX= \
    -DSTAGE0_USE_GMP=OFF -DSTAGE0_MMAP=OFF -DUSE_GMP=OFF -DMMAP=OFF -DUSE_MIMALLOC=OFF -DCHECK_OLEAN_VERSION=OFF \
    -DMULTI_THREAD=OFF -DLEAN_WASM_THREADS=OFF -DLEAN_INSTALL_SUFFIX=-linux_wasm64 \
    -DSTAGE1_LEAN_PLATFORM_TARGET=wasm64-unknown-emscripten \
    -DEMSCRIPTEN_INITIAL_MEMORY=134217728 -DEMSCRIPTEN_MAXIMUM_MEMORY=17179869184
  J=$( (nproc || sysctl -n hw.ncpu) 2>/dev/null | head -1 ); J=$(( J > 6 ? 6 : J ))
  make -C "$B" stage1-configure -j"$J"
  make -C "$B/stage1" libuv leanrt -j"$J"
  ( cd "$B/stage1" && make -f "$B/stage1/stdlib.make" Init LAKE_EXTRA_ARGS="Init:static Std:static" -j"$J" )
  git -C "$SRC" checkout -q -- src/CMakeLists.txt
  grep -q 'MULTI_THREAD:BOOL=OFF' "$B/stage1/CMakeCache.txt" || { echo "the runtime was configured multi-threaded" >&2; exit 4; }
  if grep -q pthread "$B/stage1/compile_commands.json"; then echo "-pthread in the compile commands" >&2; exit 4; fi
  mkdir -p "$TC/lib" "$TC/include"
  cp "$B/stage1/lib/lean/libleanrt.a" "$B/stage1/libuv/src/libuv/libuv.a" "$TC/lib/"
  # Lake archives Init and Std with the host's archiver; on macOS that is Apple's libtool, which drops the
  # wasm objects ("not a mach-o") and leaves 96-byte archives. Archive the same objects with emar instead.
  T="$B/stage1/lib/temp"
  for d in Init Std; do
    { echo "$T/$d.c.o.export"; find "$T/$d" -name '*.c.o.export' | sort; } > "$C/$d.objs"
    rm -f "$TC/lib/lib$d.a"; emar rcs "$TC/lib/lib$d.a" @"$C/$d.objs"
  done
  rm -rf "$TC/include/lean" && cp -R "$B/stage1/include/lean" "$TC/include/lean"
  ( cd "$TC/lib" && shasum -a 256 *.a ) > "$TC/SHA256SUMS"
fi

# 3. the program: a copy of the sources without lean-vir, built natively to C, checked against this repo's C
W="$C/w64"; mkdir -p "$W"
cp "$ROOT/lean-toolchain" "$W/"
for f in Tunnell Bench Arith Main; do python3 "$ROOT/bench/leanui/quitar.py" "$ROOT/$f.lean" "$W/$f.lean"; done
cat > "$W/lakefile.lean" <<'EOF'
import Lake
open Lake DSL
-- the same package name as the repository, so that the generated C names are the same
package tunnell_vir
lean_lib Tunnell
lean_lib Bench
lean_lib Arith
@[default_target] lean_exe tunnell_cli where
  root := `Main
EOF
( cd "$W" && lake build )
( cd "$ROOT" && lake build tunnell_cli )
for f in Tunnell Bench Arith; do
  python3 "$ROOT/bench/leanui/comparar_c.py" "$ROOT/.lake/build/ir/$f.c" "$W/.lake/build/ir/$f.c" --solo-inicializadores
done

# 4. C -> wasm64 with tools/build-app.sh's options; linked twice: for Node and for a module Worker
CG="-m64 -fwasm-exceptions -sWASM_LEGACY_EXCEPTIONS=1 -D LEAN_EMSCRIPTEN"
O="$C/obj"; mkdir -p "$O"
for f in Tunnell Bench Arith Main; do emcc -O3 $CG -I "$TC/include" -c "$W/.lake/build/ir/$f.c" -o "$O/$f.o"; done
LINK=(-O3 $CG "$O/Tunnell.o" "$O/Bench.o" "$O/Arith.o" "$O/Main.o"
      "$TC/lib/libStd.a" "$TC/lib/libInit.a" "$TC/lib/libleanrt.a" "$TC/lib/libuv.a"
      -sMALLOC=dlmalloc -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=16777216 -sMAXIMUM_MEMORY=4294967296 -sSTACK_SIZE=1048576)
emcc "${LINK[@]}" -sENVIRONMENT=node -sEXIT_RUNTIME=1 -o "$OUT/tunnell_cli.js"
emcc "${LINK[@]}" -sENVIRONMENT=worker -sMODULARIZE=1 -sEXPORT_ES6=1 -sINVOKE_RUN=0 \
  -sEXPORTED_RUNTIME_METHODS=callMain -o "$OUT/tunnell_cli_web.mjs"
ls -la "$OUT"
