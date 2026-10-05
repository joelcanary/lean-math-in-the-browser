"""Writes Lean's mpn.cpp with one of the changes measured in the report, and checks that nothing else changes.
  python parche.py ORIGINAL.cpp OUT.cpp fix    the one-line change in mpn_mul (§ 4.11): the carry added last
  python parche.py ORIGINAL.cpp OUT.cpp sub    division: multiply-and-subtract fused in one pass (§ 4.13)
  python parche.py ORIGINAL.cpp OUT.cpp subb   the same, with the product kept off the carry's chain
Refuses an mpn.cpp where the lines to change are not there exactly once (a different Lean version).
"""
import sys

MUL_ORIGINAL = """                t = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) +
                    (mpn_double_digit) c[i+j] +
                    (mpn_double_digit) k;
"""
MUL_FIX = """                mpn_double_digit p = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) + (mpn_double_digit) c[i+j];
                __asm__("" : "+r"(p));   // the product does not wait for the carry (report § 4.11)
                t = p + (mpn_double_digit) k;
"""

DIV_ORIGINAL = """        mpn_digit q_hat_small = (mpn_digit)q_hat;
        mpn_mul(&q_hat_small, 1, denom.data(), n, ms.data());
        mpn_sub(&numer[j], n+1, ms.data(), n+1, &numer[j], &borrow);
"""
DIV_FUSED = """        mpn_digit q_hat_small = (mpn_digit)q_hat;
        {   // numer[j..j+n] -= q_hat_small * denom[0..n-1] in one pass (report § 4.13), carry and borrow in
            // registers: no buffer, no second pass, no borrow through memory
            mpn_digit k = 0, b = 0;
            mpn_digit * u = &numer[j];
            mpn_digit const * v = denom.data();
            for (size_t i = 0; i < n; i++) {
                mpn_double_digit p = (mpn_double_digit)q_hat_small * (mpn_double_digit)v[i];
%BARRIER%                p += k;
                k = (mpn_digit)(p >> DIGIT_BITS);
                mpn_double_digit s = (mpn_double_digit)u[i] - (mpn_digit)p - b;
                u[i] = (mpn_digit)s;
                b = (mpn_digit)(s >> DIGIT_BITS) & 1;
            }
            mpn_double_digit s = (mpn_double_digit)u[n] - k - b;
            u[n] = (mpn_digit)s;
            borrow = (mpn_digit)(s >> DIGIT_BITS) & 1;
        }
"""
BARRIER = """                __asm__("" : "+r"(p));   // the product does not wait for the carry
"""

src = open(sys.argv[1], encoding="utf-8", newline="").read()
variant = sys.argv[3] if len(sys.argv) > 3 else "fix"
if variant == "fix":
    old, new = MUL_ORIGINAL, MUL_FIX
elif variant in ("sub", "subb"):
    old, new = DIV_ORIGINAL, DIV_FUSED.replace("%BARRIER%", BARRIER if variant == "subb" else "")
else:
    sys.exit(f"unknown variant {variant}")
if src.count(old) != 1:
    sys.exit("the lines to change are not in this mpn.cpp exactly once (a different Lean version?)")
open(sys.argv[2], "w", encoding="utf-8", newline="").write(src.replace(old, new))
