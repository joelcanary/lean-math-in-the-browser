"""Independent reference for Arith.lean: the same operands and the same checksum, in Python integers.

Arith.run op bits reps cycles through four operand pairs, applies one operation and adds up the low
64 bits of every result (mod 2^64). Python's integers are a different implementation (Karatsuba
multiplication, its own division), so agreement checks the arithmetic, not a copy of it.

  python aritmetica_ref.py op bits reps     -> the checksum
  python aritmetica_ref.py --kernel         -> the values used by the `decide +kernel` examples
  python aritmetica_ref.py --anchors        -> the checksums at R = 8 for every operation and size, as JSON
"""
import json
import math
import sys

MASK = (1 << 64) - 1
OPS = ["add", "mul", "div", "mod", "gcd", "base"]


def lcg(s):
    # Knuth's MMIX constants, as in Arith.lcg
    return (s * 6364136223846793005 + 1442695040888963407) & MASK


def operand(bits, seed):
    """A `bits`-bit number (top bit set): 64-bit chunks from the generator, most significant first."""
    x, s = 0, seed
    for _ in range((bits + 63) // 64):
        s = lcg(s)
        x = (x << 64) + s
    top = 1 << (bits - 1)
    return x % top + top


def pairs(op, bits):
    wide = 2 * bits if op in (2, 3) else bits   # division and remainder: a 2n-bit dividend
    return [(operand(wide, 2 * i + 1), operand(bits, 2 * i + 2)) for i in range(4)]


def apply(op, a, b):
    if op == 0: return a + b
    if op == 1: return a * b
    if op == 2: return a // b
    if op == 3: return a % b
    if op == 4: return math.gcd(a, b)   # CPython's own (Lehmer) gcd, not Lean's
    return a


def run(op, bits, reps):
    ps = pairs(op, bits)
    acc = 0
    for i in range(reps):
        a, b = ps[i % 4]
        acc = (acc + (apply(op, a, b) & MASK)) & MASK
    return acc


if __name__ == "__main__":
    if sys.argv[1:2] == ["--anchors"]:
        # the checksums at R = 8 for every operation and size the harness uses, as JSON
        bits_list = [64 << k for k in range(11)]
        print(json.dumps({f"{op} {bits}": str(run(op, bits, 8)) for op in range(6) for bits in bits_list}))
    elif sys.argv[1:] == ["--kernel"]:
        for op in range(6):
            print(OPS[op], run(op, 64, 3), run(op, 130, 5))
    else:
        op, bits, reps = map(int, sys.argv[1:4])
        print(run(op, bits, reps))
