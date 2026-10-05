// Lean's own mpn.cpp (v4.34.0), compiled four times (parche.py): as it is (lean_v0), with the one-line change of
// report § 4.11 in mpn_mul (lean_fix), and with division's multiply-and-subtract fused in one pass (§ 4.13), plain
// (lean_sub) and with the product off the carry's chain (lean_subb). Times mpn_mul (n × n digits) and mpn_div (2n by
// n digits), after checking every version against the others and against an independent computation: products
// against a column-by-column product, divisions by q·d + r = numerator and r < d.
//   sh build.sh > out.json
#include <algorithm>
#include <chrono>
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

using D = unsigned int;
static uint64_t seed = 0x9E3779B97F4A7C15ull;
static D rnd() { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; return D(seed >> 16); }
static std::vector<D> number(size_t n) { std::vector<D> v(n); for (auto & d : v) d = rnd(); v[n - 1] |= 0x80000000u; return v; }

// independent product: columns accumulated in 128 bits
static std::vector<D> product(const std::vector<D> & a, const std::vector<D> & b) {
    size_t n = a.size(), m = b.size();
    std::vector<D> c(n + m);
    unsigned __int128 acc = 0;
    for (size_t col = 0; col < n + m; col++) {
        for (size_t i = (col >= m ? col - m + 1 : 0); i < n && i <= col; i++) acc += (unsigned __int128)((uint64_t)a[i] * b[col - i]);
        c[col] = D(acc); acc >>= 32;
    }
    return c;
}
static void fail(const char * what, size_t n) { fprintf(stderr, "WRONG: %s at %zu digits\n", what, n); exit(1); }

template <class F> static double per_call_us(F f, double target_s = 0.15) {
    auto t = std::chrono::steady_clock::now(); f();
    double one = std::max(1e-7, std::chrono::duration<double>(std::chrono::steady_clock::now() - t).count());
    long reps = std::max(1L, long(target_s / one));
    t = std::chrono::steady_clock::now();
    for (long i = 0; i < reps; i++) f();
    return std::chrono::duration<double>(std::chrono::steady_clock::now() - t).count() / reps * 1e6;
}

int main() {
    printf("{\"points\": [\n");
    bool first = true;
    for (size_t n : {128, 256, 512, 1024, 2048}) {
        auto a = number(n), b = number(n), num = number(2 * n), den = number(n);
        // correctness first
        std::vector<D> c0(2 * n), c1(2 * n);
        lean_v0::mpn_mul(a.data(), n, b.data(), n, c0.data());
        lean_fix::mpn_mul(a.data(), n, b.data(), n, c1.data());
        if (c0 != product(a, b) || c1 != c0) fail("mpn_mul", n);
        std::vector<D> q0(n + 1), r0(n), q1(n + 1), r1(n), q2(n + 1), r2(n), q3(n + 1), r3(n);
        lean_v0::mpn_div(num.data(), 2 * n, den.data(), n, q0.data(), r0.data());
        lean_fix::mpn_div(num.data(), 2 * n, den.data(), n, q1.data(), r1.data());
        lean_sub::mpn_div(num.data(), 2 * n, den.data(), n, q2.data(), r2.data());
        lean_subb::mpn_div(num.data(), 2 * n, den.data(), n, q3.data(), r3.data());
        if (q0 != q1 || r0 != r1 || q0 != q2 || r0 != r2 || q0 != q3 || r0 != r3) fail("mpn_div differs", n);
        {   // q·d + r == num, r < d
            auto qd = product(q0, den);
            unsigned __int128 k = 0;
            std::vector<D> s(qd.size());
            for (size_t i = 0; i < qd.size(); i++) { k += (unsigned __int128)qd[i] + (i < n ? r0[i] : 0); s[i] = D(k); k >>= 32; }
            for (size_t i = 0; i < s.size(); i++) if (s[i] != (i < 2 * n ? num[i] : 0)) fail("q*d + r != numerator", n);
            for (size_t i = n; i-- > 0;) { if (r0[i] < den[i]) break; if (r0[i] > den[i] || i == 0) fail("r >= d", n); }
        }
        // interleaved timing: 7 rounds, median
        std::vector<double> m0, m1, d0, d1, d2, d3;
        for (int round = 0; round < 7; round++) {
            m0.push_back(per_call_us([&] { lean_v0::mpn_mul(a.data(), n, b.data(), n, c0.data()); }));
            m1.push_back(per_call_us([&] { lean_fix::mpn_mul(a.data(), n, b.data(), n, c1.data()); }));
            d0.push_back(per_call_us([&] { lean_v0::mpn_div(num.data(), 2 * n, den.data(), n, q0.data(), r0.data()); }));
            d1.push_back(per_call_us([&] { lean_fix::mpn_div(num.data(), 2 * n, den.data(), n, q1.data(), r1.data()); }));
            d2.push_back(per_call_us([&] { lean_sub::mpn_div(num.data(), 2 * n, den.data(), n, q2.data(), r2.data()); }));
            d3.push_back(per_call_us([&] { lean_subb::mpn_div(num.data(), 2 * n, den.data(), n, q3.data(), r3.data()); }));
        }
        auto med = [](std::vector<double> v) { std::sort(v.begin(), v.end()); return v[v.size() / 2]; };
        printf("%s {\"bits\": %zu, \"mul_lean_us\": %.3f, \"mul_fix_us\": %.3f, \"div_lean_us\": %.3f, \"div_fix_us\": %.3f, \"div_sub_us\": %.3f, \"div_subb_us\": %.3f, \"checked\": true}",
               first ? " " : ",\n ", 32 * n, med(m0), med(m1), med(d0), med(d1), med(d2), med(d3));
        first = false;
        fflush(stdout);
    }
    printf("\n]}\n");
}
