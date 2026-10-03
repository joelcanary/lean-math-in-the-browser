#!/bin/sh
# Fetch Lean's GMP-free big-number code at a fixed commit (v4.34.0), compile it with harness.cpp and
# run the experiment. Lean's files are downloaded into .cache/, not stored in this repository.
#   sh bench/experimentos/mpn/build.sh [threshold] > out.json
set -e
cd "$(dirname "$0")"
LEAN=293d5d0c0c3f3dded4688b3ccd6a33939ac5102b   # leanprover/lean4 v4.34.0
mkdir -p .cache/runtime
for f in mpn.cpp mpn.h; do
  [ -s ".cache/runtime/$f" ] || curl -fsSL "https://raw.githubusercontent.com/leanprover/lean4/$LEAN/src/runtime/$f" -o ".cache/runtime/$f"
done
${CXX:-c++} -O2 -std=c++17 -Ishim -I.cache -o .cache/harness harness.cpp .cache/runtime/mpn.cpp
./.cache/harness "$@"
