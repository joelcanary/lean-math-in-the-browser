// Correctness of the changed versions against Lean's own code (report §§ 4.11–4.13), with no timing: mpn_mul and
// mpn_div of every variant must give exactly what Lean's mpn.cpp gives, on thousands of random sizes and on the
// adversarial cases of Algorithm D (all-ones digits, divisors 0x80000000..., numerators just below a multiple of
// the divisor, which exercise the q̂ corrections and the add-back branch). Runs in CI.
//   sh comprueba.sh
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>

#define DECLARE(ns) namespace ns { typedef unsigned int mpn_digit; \
  void mpn_mul(mpn_digit const * a, size_t lnga, mpn_digit const * b, size_t lngb, mpn_digit * c); \
  void mpn_div(mpn_digit const * numer, size_t lnum, mpn_digit const * denom, size_t lden, mpn_digit * quot, mpn_digit * rem); }
DECLARE(lean_v0)
DECLARE(lean_fix)
DECLARE(lean_sub)
DECLARE(lean_subb)
extern long mpn_addback_count;   // incremented by the counting copy of the fused division (comprueba.sh)
namespace lean_cnt { void mpn_div(unsigned const * numer, size_t lnum, unsigned const * denom, size_t lden, unsigned * quot, unsigned * rem); }

using D = unsigned int;
static uint64_t seed = 12345;
static D rnd() { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; return D(seed >> 16); }
static long checks = 0;

static std::vector<D> make(size_t n, int kind) {
    std::vector<D> v(n);
    for (auto & d : v) d = kind == 1 ? 0xFFFFFFFFu : kind == 2 ? 0 : rnd();
    if (kind == 2) v[n - 1] = 0x80000000u;          // 0x80000000 00000000 ...: smallest normalized top digit
    if (v[n - 1] == 0) v[n - 1] = 1;
    return v;
}

static void check_div(const std::vector<D> & num, const std::vector<D> & den) {
    size_t ln = num.size(), ld = den.size(), lq = ln >= ld ? ln - ld + 1 : 1;
    std::vector<D> q[4], r[4];
    for (int k = 0; k < 4; k++) { q[k].assign(lq, 0xDEADBEEF); r[k].assign(ld, 0xDEADBEEF); }
    lean_v0::mpn_div(num.data(), ln, den.data(), ld, q[0].data(), r[0].data());
    lean_fix::mpn_div(num.data(), ln, den.data(), ld, q[1].data(), r[1].data());
    lean_sub::mpn_div(num.data(), ln, den.data(), ld, q[2].data(), r[2].data());
    lean_subb::mpn_div(num.data(), ln, den.data(), ld, q[3].data(), r[3].data());
    for (int k = 1; k < 4; k++)
        if (q[k] != q[0] || r[k] != r[0]) { fprintf(stderr, "division differs (variant %d, %zu by %zu digits)\n", k, ln, ld); exit(1); }
    std::vector<D> qc(lq), rc(ld);
    lean_cnt::mpn_div(num.data(), ln, den.data(), ld, qc.data(), rc.data());
    if (qc != q[0] || rc != r[0]) { fprintf(stderr, "counting copy differs\n"); exit(1); }
    checks++;
}

static void check_mul(const std::vector<D> & a, const std::vector<D> & b) {
    std::vector<D> c0(a.size() + b.size()), c1(c0.size());
    lean_v0::mpn_mul(a.data(), a.size(), b.data(), b.size(), c0.data());
    lean_fix::mpn_mul(a.data(), a.size(), b.data(), b.size(), c1.data());
    if (c0 != c1) { fprintf(stderr, "product differs (%zu x %zu digits)\n", a.size(), b.size()); exit(1); }
    checks++;
}

int main() {
    for (int it = 0; it < 4000; it++) {
        size_t ld = 1 + rnd() % 120, ln = ld + rnd() % 160;
        int kn = rnd() % 4 == 0 ? 1 : 0, kd = rnd() % 4 == 0 ? (rnd() % 2 ? 1 : 2) : 0;
        auto num = make(ln, kn), den = make(ld, kd);
        check_div(num, den);
        check_mul(make(1 + rnd() % 200, kn), make(1 + rnd() % 200, kd));
    }
    // numerators just below and at a multiple of the divisor: num = den·q − δ (δ ∈ {0, 1}), the q̂ corrections
    for (int it = 0; it < 1500; it++) {
        size_t ld = 2 + rnd() % 60, lq = 1 + rnd() % 60;
        auto den = make(ld, it % 3), q = make(lq, it % 2);
        std::vector<D> num(ld + lq);
        lean_v0::mpn_mul(den.data(), ld, q.data(), lq, num.data());
        if (it % 2) { size_t i = 0; while (i < num.size() && num[i] == 0) num[i++] = 0xFFFFFFFFu; if (i < num.size()) num[i]--; }
        while (num.size() > 1 && num.back() == 0) num.pop_back();
        if (num.size() >= den.size()) check_div(num, den);
    }
    // the cases of Hacker's Delight (divmnu tests) where Algorithm D must add back; little-endian digits
    const std::vector<D> hd[][2] = {
        {{0x00000000, 0x00000000, 0x80000000, 0x7fffffff}, {0x00000001, 0x00000000, 0x80000000}},
        {{0x00000003, 0x00000000, 0x80000000}, {0x00000001, 0x00000000, 0x20000000}},
        {{0x00000003, 0x00000000, 0x00008000}, {0x00000001, 0x00000000, 0x00002000}},
        {{0x00000000, 0x00000000, 0x00008000, 0x00007fff}, {0x00000001, 0x00000000, 0x00008000}},
        {{0x00000000, 0x0000fffe, 0x00000000, 0x00008000}, {0x0000ffff, 0x00000000, 0x00008000}},
        {{0x00000000, 0xfffffffe, 0x00000000, 0x80000000}, {0x0000ffff, 0x00000000, 0x80000000}},
        {{0x00000000, 0xfffffffe, 0x00000000, 0x80000000}, {0xffffffff, 0x00000000, 0x80000000}},
    };
    for (auto & c : hd) check_div(c[0], c[1]);
    if (mpn_addback_count == 0) { fprintf(stderr, "the add-back branch was never reached\n"); exit(1); }
    printf("%ld checks: every variant gives exactly what Lean's code gives (add-back branch reached %ld times)\n", checks, mpn_addback_count);
}
