"""Builds mpn_mul_barrier.wasm: mpn_mul.wasm with its only function body replaced by the body that Lean's
clang emits for fuente/mpn_mul.cpp with VARIANT=2 (an object file, compiled with
  clang --target=wasm32 -O3 -mbulk-memory -c -DVARIANT=2 fuente/mpn_mul.cpp -o v2.o).
The function makes no calls and uses no globals, so its body needs no relocation and can be copied.

  python injerta.py v2.o
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cuerpos import body, leb  # noqa: E402


def uleb(n):
    out = bytearray()
    while True:
        x = n & 0x7f; n >>= 7
        out.append(x | (0x80 if n else 0))
        if not n:
            return bytes(out)


here = os.path.dirname(os.path.abspath(__file__))
base = open(f"{here}/mpn_mul.wasm", "rb").read()
new = body(sys.argv[1], 0)
i, out = 8, bytearray(base[:8])
while i < len(base):
    sid = base[i]; size, j = leb(base, i + 1); end = j + size
    if sid == 10:                                      # code section with one function
        n, k = leb(base, j)
        assert n == 1
        payload = uleb(1) + uleb(len(new)) + new
        out += bytes([10]) + uleb(len(payload)) + payload
    else:
        out += base[i:end]
    i = end
open(f"{here}/mpn_mul_barrier.wasm", "wb").write(out)
print(len(out), "bytes")
