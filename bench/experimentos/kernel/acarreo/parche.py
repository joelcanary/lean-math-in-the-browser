"""Writes Lean's mpn.cpp with the one-line change of report § 4.11 (the carry added last, behind an empty asm), and
checks that nothing else changes.
  python parche.py ORIGINAL.cpp PATCHED.cpp
"""
import sys

ORIGINAL = """                t = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) +
                    (mpn_double_digit) c[i+j] +
                    (mpn_double_digit) k;
"""
PATCHED = """                mpn_double_digit p = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) + (mpn_double_digit) c[i+j];
                __asm__("" : "+r"(p));   // the product does not wait for the carry (report § 4.11)
                t = p + (mpn_double_digit) k;
"""

src = open(sys.argv[1], encoding="utf-8", newline="").read()
if src.count(ORIGINAL) != 1:
    sys.exit("the line to change is not in this mpn.cpp exactly once (a different Lean version?)")
open(sys.argv[2], "w", encoding="utf-8", newline="").write(src.replace(ORIGINAL, PATCHED))
