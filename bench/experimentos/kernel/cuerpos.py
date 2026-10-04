"""Prints the SHA-256 of one function body of a WebAssembly binary, to check that an extracted kernel is
byte for byte the function it was copied from.

  python cuerpos.py MODULE.wasm FUNCTION_INDEX   (index as wasm2wat numbers it: imported functions first)
"""
import hashlib
import sys


def leb(b, i):
    r = s = 0
    while True:
        x = b[i]; i += 1
        r |= (x & 0x7f) << s; s += 7
        if x < 0x80:
            return r, i


def body(path, index):
    b = open(path, "rb").read()
    i, imported, bodies = 8, 0, []
    while i < len(b):
        sid = b[i]; size, i = leb(b, i + 1); end = i + size
        if sid == 2:                                   # imports: count the functions
            n, j = leb(b, i)
            for _ in range(n):
                for _ in range(2):
                    ln, j = leb(b, j); j += ln
                kind = b[j]; j += 1
                if kind == 0: _, j = leb(b, j); imported += 1
                elif kind == 1: j += 1; fl, j = leb(b, j); _, j = leb(b, j); j = leb(b, j)[1] if fl & 1 else j
                elif kind == 2: fl, j = leb(b, j); _, j = leb(b, j); j = leb(b, j)[1] if fl & 1 else j
                elif kind == 3: j += 2
                else: raise ValueError(kind)
        elif sid == 10:                                # code
            n, j = leb(b, i)
            for _ in range(n):
                ln, j = leb(b, j); bodies.append(b[j:j + ln]); j += ln
        i = end
    return bodies[index - imported]


if __name__ == "__main__":
    f = body(sys.argv[1], int(sys.argv[2]))
    print(len(f), hashlib.sha256(f).hexdigest())
