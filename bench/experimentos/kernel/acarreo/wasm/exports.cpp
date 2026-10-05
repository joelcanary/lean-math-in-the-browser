// What the measurement (mide.mjs) calls: Lean's mpn_mul and mpn_div as they are (lean_v0), with the one-line
// change of § 4.11 (lean_fix) and with division's fused multiply-and-subtract of § 4.13 (lean_sub, lean_subb), on
// numbers the caller writes into this module's memory.
#include <stddef.h>
#define DECLARE(ns) namespace ns { typedef unsigned int mpn_digit; \
  void mpn_mul(mpn_digit const * a, size_t lnga, mpn_digit const * b, size_t lngb, mpn_digit * c); \
  void mpn_div(mpn_digit const * numer, size_t lnum, mpn_digit const * denom, size_t lden, mpn_digit * quot, mpn_digit * rem); }
DECLARE(lean_v0)
DECLARE(lean_fix)
DECLARE(lean_sub)
DECLARE(lean_subb)
extern "C" void arena_reset();
using D = unsigned int;
extern "C" {
__attribute__((export_name("mul_v0"))) void mul_v0(const D * a, size_t la, const D * b, size_t lb, D * c) { lean_v0::mpn_mul(a, la, b, lb, c); }
__attribute__((export_name("mul_fix"))) void mul_fix(const D * a, size_t la, const D * b, size_t lb, D * c) { lean_fix::mpn_mul(a, la, b, lb, c); }
__attribute__((export_name("div_v0"))) void div_v0(const D * n, size_t ln, const D * d, size_t ld, D * q, D * r) { lean_v0::mpn_div(n, ln, d, ld, q, r); arena_reset(); }
__attribute__((export_name("div_fix"))) void div_fix(const D * n, size_t ln, const D * d, size_t ld, D * q, D * r) { lean_fix::mpn_div(n, ln, d, ld, q, r); arena_reset(); }
__attribute__((export_name("div_sub"))) void div_sub(const D * n, size_t ln, const D * d, size_t ld, D * q, D * r) { lean_sub::mpn_div(n, ln, d, ld, q, r); arena_reset(); }
__attribute__((export_name("div_subb"))) void div_subb(const D * n, size_t ln, const D * d, size_t ld, D * q, D * r) { lean_subb::mpn_div(n, ln, d, ld, q, r); arena_reset(); }
}
