// Division and gcd: what faster algorithms on top of Lean's GMP-free code would buy.
//
// Compiled with Lean's own src/runtime/mpn.cpp (v4.34.0, fetched by build.sh) and common.h:
//   division of a 2n-digit number by an n-digit one
//     - Lean: mpn_div (Knuth's Algorithm D), as mpz uses it
//     - Newton: the reciprocal R = floor(B^2n / b) by Newton's iteration with doubling precision (base
//       case: mpn_div), then q = floor(a·R / B^2n) and at most a few corrections; multiplications are
//       Karatsuba over mpn_mul (common.h)
//     - Barrett: the same with R already known — dividing many times by one modulus, as modular
//       exponentiation does (Miller–Rabin, powMod)
//   gcd of two n-digit numbers
//     - Lean: Euclid with a full remainder per step, transcribed from mpz.cpp's gcd (mpn_div per step)
//     - Lehmer: Knuth's Algorithm L — steps on the leading 32 bits, applied to the full numbers as one
//       linear combination; a full remainder only when the leading bits cannot decide
// Every result is first compared with Lean's (quotient and remainder digit by digit; gcd), at every
// size timed and at random sizes. Output: JSON on stdout.
#include "common.h"

using N = std::vector<D>;   // a natural number: little-endian digits, no leading zeros (zero = empty)

static void norm(N & x) { while (!x.empty() && x.back() == 0) x.pop_back(); }
static int cmp(const N & a, const N & b) {
    if (a.size() != b.size()) return a.size() < b.size() ? -1 : 1;
    for (size_t i = a.size(); i-- > 0;) if (a[i] != b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
}
static N addN(const N & a, const N & b) {
    if (a.size() < b.size()) return addN(b, a);
    if (a.empty()) return {};
    N c(a.size() + 1); add(a.data(), a.size(), b.data(), b.size(), c.data()); norm(c); return c;
}
static N subN(const N & a, const N & b) { N c = a; if (!b.empty()) sub_in(c.data(), c.size(), b.data(), b.size()); norm(c); return c; }   // a >= b
static N shiftL(const N & x, size_t k) { if (x.empty()) return {}; N r(k, 0); r.insert(r.end(), x.begin(), x.end()); return r; }   // x·B^k
static N shiftR(const N & x, size_t k) { return k >= x.size() ? N{} : N(x.begin() + k, x.end()); }                                 // floor(x / B^k)
static N powB(size_t k) { N r(k, 0); r.push_back(1); return r; }
static const N ONE = {1};

// x·y: schoolbook (mpn_mul) when the shorter is below the threshold; else Karatsuba on equal blocks
static N mulN(const N & x, const N & y) {
    if (x.empty() || y.empty()) return {};
    const N & L = x.size() >= y.size() ? x : y;
    const N & S = x.size() >= y.size() ? y : x;
    N c(L.size() + S.size(), 0);
    if (S.size() < g_threshold) { lean::mpn_mul(L.data(), L.size(), S.data(), S.size(), c.data()); norm(c); return c; }
    size_t s = S.size();
    N chunk(s), t(2 * s);
    for (size_t off = 0; off < L.size(); off += s) {   // the longer one in blocks as long as the shorter
        size_t len = std::min(s, L.size() - off);
        std::fill(chunk.begin(), chunk.end(), 0);
        std::copy(L.begin() + off, L.begin() + off + len, chunk.begin());
        kmul(chunk.data(), S.data(), s, t.data());
        size_t room = c.size() - off, lt = std::min(t.size(), room);
        add_in(c.data() + off, room, t.data(), lt);
    }
    norm(c);
    return c;
}

// ---------------------------------------------------------------- division

static void lean_div(const N & a, const N & b, N & q, N & r) {   // mpn_div, as mpz::quot/rem call it
    if (cmp(a, b) < 0) { q = {}; r = a; return; }
    q.assign(a.size() - b.size() + 1, 0); r.assign(b.size(), 0);
    lean::mpn_div(a.data(), a.size(), b.data(), b.size(), q.data(), r.data());
    norm(q); norm(r);
}

static size_t g_rt = 32;          // below this many digits the reciprocal is computed by mpn_div
static size_t g_max_fix = 0;      // the most corrections any reciprocal or quotient needed (reported)

// R = floor(B^(2n) / b), n = digits of b
static N recip(const N & b) {
    size_t n = b.size();
    N P = powB(2 * n);
    if (n <= g_rt) { N q, r; lean_div(P, b, q, r); return q; }
    size_t h = (n + 1) / 2;
    N bh(b.end() - h, b.end());                        // the top h digits: b ≈ bh·B^(n-h)
    N X = shiftL(recip(bh), n - h);                    // ≈ B^2n / b to about h digits
    N bX = mulN(b, X);                                 // one Newton step: X += X·(B^2n − bX) / B^2n
    if (cmp(bX, P) <= 0) X = addN(X, shiftR(mulN(X, subN(P, bX)), 2 * n));
    else { N c = addN(shiftR(mulN(X, subN(bX, P)), 2 * n), ONE); X = cmp(X, c) > 0 ? subN(X, c) : N{}; }
    bX = mulN(b, X);                                   // exact: 0 <= B^2n − bX < b
    size_t fix = 0;
    while (cmp(bX, P) > 0) { X = subN(X, ONE); bX = subN(bX, b); fix++; }
    N E = subN(P, bX);
    while (cmp(E, b) >= 0) { X = addN(X, ONE); E = subN(E, b); fix++; }
    g_max_fix = std::max(g_max_fix, fix);
    return X;
}

// q, r of a / b given R = recip(b); a has at most 2n digits
static void barrett(const N & a, const N & b, const N & R, N & q, N & r) {
    size_t n = b.size();
    q = shiftR(mulN(a, R), 2 * n);
    N qb = mulN(q, b);
    size_t fix = 0;
    while (cmp(qb, a) > 0) { q = subN(q, ONE); qb = subN(qb, b); fix++; }
    r = subN(a, qb);
    while (cmp(r, b) >= 0) { q = addN(q, ONE); r = subN(r, b); fix++; }
    g_max_fix = std::max(g_max_fix, fix);
}
static void newton_div(const N & a, const N & b, N & q, N & r) { barrett(a, b, recip(b), q, r); }

// ---------------------------------------------------------------- gcd

// mpz.cpp's gcd without GMP: Euclid, a full remainder (mpn_div) per step
static N lean_gcd(N a, N b) {
    if (cmp(a, b) < 0) std::swap(a, b);
    N q, r;
    while (!b.empty()) { lean_div(a, b, q, r); a.swap(b); b.swap(r); }
    return a;
}

// |A·a + B·b| where the combination is known to be non-negative (Algorithm L guarantees it)
static N lincomb(int64_t A, const N & a, int64_t B, const N & b) {
    size_t L = std::max(a.size(), b.size());
    N r(L + 1);
    __int128 carry = 0;
    for (size_t i = 0; i < L; i++) {
        __int128 t = (__int128)A * (i < a.size() ? a[i] : 0) + (__int128)B * (i < b.size() ? b[i] : 0) + carry;
        r[i] = (D)(uint64_t)(t & 0xFFFFFFFF);
        carry = t >> 32;                                 // arithmetic shift: floor
    }
    r[L] = (D)(uint64_t)carry;
    norm(r);
    return r;
}

// Knuth's Algorithm L with 32-bit leading parts
static N lehmer_gcd(N a, N b) {
    if (cmp(a, b) < 0) std::swap(a, b);
    N q, r;
    while (b.size() > 1) {
        size_t n = a.size();
        unsigned s = __builtin_clz(a[n - 1]);
        auto top = [&](const N & x) -> int64_t {         // the 32 bits of x starting at a's leading bit
            uint64_t hi = n - 1 < x.size() ? x[n - 1] : 0, lo = n - 2 < x.size() ? x[n - 2] : 0;
            return (int64_t)(s ? ((hi << s) | (lo >> (32 - s))) & 0xFFFFFFFF : hi);
        };
        int64_t x = top(a), y = top(b), A = 1, B = 0, C = 0, D = 1;
        while (y + C > 0 && y + D > 0) {
            int64_t q1 = (x + A) / (y + C), q2 = (x + B) / (y + D);
            if (q1 != q2) break;
            int64_t t = A - q1 * C; A = C; C = t;
            t = B - q1 * D; B = D; D = t;
            t = x - q1 * y; x = y; y = t;
        }
        if (B == 0) { lean_div(a, b, q, r); a.swap(b); b.swap(r); }
        else { N na = lincomb(A, a, B, b), nb = lincomb(C, a, D, b); a.swap(na); b.swap(nb); }
    }
    if (b.empty()) return a;
    uint64_t y = b[0], x = 0;                          // one digit left: a mod y, then on machine words
    for (size_t i = a.size(); i-- > 0;) x = ((x << 32) | a[i]) % y;
    while (y) { uint64_t t = x % y; x = y; y = t; }
    N g; if (x) g.push_back((D)x); return g;
}

// ---------------------------------------------------------------- main

static N rand_n(size_t n, bool top_bit) { N v = random_number(n); if (!top_bit) v[n - 1] = 1 + rnd() % 0x7FFFFFFFu; return v; }

int main(int argc, char ** argv) {
    // --check: only the correctness checks (random sizes and every size timed), no timing
    bool check_only = argc > 1 && std::strcmp(argv[1], "--check") == 0;
    if (check_only) { argv++; argc--; }
    g_threshold = argc > 1 ? std::strtoul(argv[1], nullptr, 10) : 32;
    g_rt = g_threshold;
    // correctness first, at random sizes: quotient and remainder digit by digit; gcd value
    for (int k = 0; k < 600; k++) {
        size_t n = 1 + rnd() % 300;
        N b = rand_n(n, k % 2), a = rand_n(n + rnd() % (n + 1), k % 3 == 0), q1, r1, q2, r2;
        lean_div(a, b, q1, r1);
        newton_div(a, b, q2, r2);
        if (q1 != q2 || r1 != r2) { std::fprintf(stderr, "Newton division differs at n = %zu\n", n); return 1; }
        N x = rand_n(1 + rnd() % 120, true), y = rand_n(1 + rnd() % 120, k % 2);
        if (k % 5 == 0) { N g = rand_n(1 + rnd() % 8, true); x = mulN(x, g); y = mulN(y, g); }   // a non-trivial gcd
        if (lean_gcd(x, y) != lehmer_gcd(x, y)) { std::fprintf(stderr, "Lehmer gcd differs at %zu/%zu digits\n", x.size(), y.size()); return 1; }
    }
    std::printf("{\n \"checked\": \"Newton/Barrett quotient and remainder equal mpn_div digit by digit, and Lehmer's gcd equals Euclid's, at 600 random sizes and at every size timed\",\n");
    std::printf(" \"threshold\": %zu,\n \"points\": [\n", g_threshold);
    const char * sep = "";
    for (size_t bits = 64; bits <= (1u << 17); bits *= 2) {
        size_t n = bits / 32;
        N b = random_number(n), a = random_number(2 * n), q1, r1, q2, r2, q3, r3;
        lean_div(a, b, q1, r1);
        N R = recip(b);
        newton_div(a, b, q2, r2);
        barrett(a, b, R, q3, r3);
        if (q1 != q2 || r1 != r2 || q1 != q3 || r1 != r3) { std::fprintf(stderr, "division differs at %zu bits\n", bits); return 1; }
        if (check_only) {
            if (bits <= 65536) { N x = random_number(n), y = random_number(n); if (lean_gcd(x, y) != lehmer_gcd(x, y)) { std::fprintf(stderr, "gcd differs at %zu bits\n", bits); return 1; } }
            std::fprintf(stderr, "ok %zu bits\n", bits);
            continue;
        }
        double t_lean = time_us([&] { lean_div(a, b, q1, r1); g_sink = r1.empty() ? 0 : r1[0]; });
        double t_newton = time_us([&] { newton_div(a, b, q2, r2); g_sink = r2.empty() ? 0 : r2[0]; });
        double t_barrett = time_us([&] { barrett(a, b, R, q3, r3); g_sink = r3.empty() ? 0 : r3[0]; });
        std::printf("%s  {\"bits\": %zu, \"div_lean_us\": %.5f, \"div_newton_us\": %.5f, \"div_barrett_us\": %.5f",
                    sep, bits, t_lean, t_newton, t_barrett);
        if (bits <= 65536) {
            N x = random_number(n), y = random_number(n);
            N g1 = lean_gcd(x, y), g2 = lehmer_gcd(x, y);
            if (g1 != g2) { std::fprintf(stderr, "gcd differs at %zu bits\n", bits); return 1; }
            double t_euclid = time_us([&] { g_sink = lean_gcd(x, y)[0]; });
            double t_lehmer = time_us([&] { g_sink = lehmer_gcd(x, y)[0]; });
            std::printf(", \"gcd_lean_us\": %.5f, \"gcd_lehmer_us\": %.5f", t_euclid, t_lehmer);
        }
        std::printf("}");
        sep = ",\n";
        std::fflush(stdout);
    }
    std::printf("\n ],\n \"max_corrections\": %zu\n}\n", g_max_fix);
    return 0;
}
