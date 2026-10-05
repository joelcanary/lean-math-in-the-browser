"""Writes a copy of a patched mpn.cpp that counts how often Algorithm D adds back (div_n's `if (borrow)` branch),
so that comprueba.cpp can prove its tests reach that branch.  python cuenta.py IN.cpp OUT.cpp"""
import sys

src = open(sys.argv[1], encoding="utf-8", newline="").read()
old = "        if (borrow) {\n            quot[j]--;\n"
if src.count(old) != 1 or src.count("namespace lean {") != 1:
    sys.exit("div_n's add-back branch not found exactly once")
src = src.replace(old, "        if (borrow) {\n            ++mpn_addback_count;\n            quot[j]--;\n")
src = src.replace("namespace lean {", "long mpn_addback_count = 0;\nnamespace lean {", 1)
open(sys.argv[2], "w", encoding="utf-8", newline="").write(src)
