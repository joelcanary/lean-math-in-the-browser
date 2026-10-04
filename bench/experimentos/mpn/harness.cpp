// What would two small changes to Lean's GMP-free big-number code buy?
//
// Compiles Lean's own src/runtime/mpn.cpp (fetched at v4.34.0 by build.sh; not copied here) and
// measures, natively and without GMP:
//   (a) multiplication: Lean's mpn_mul (Knuth's Algorithm M, quadratic) against Karatsuba's method
//       written on top of it (mpn_mul below a threshold), on two n-limb numbers;
//   (b) AND with a two-limb mask: a transcription of mpz::operator&= from src/runtime/mpz.cpp, which
//       walks and allocates the LONGER operand, against the same code walking the SHORTER one.
// Every Karatsuba product is compared limb by limb with mpn_mul's before anything is timed, at every
// size and at 300 random odd sizes; both AND variants are compared the same way.
//
// Output: JSON on stdout. Times: median of 5 runs, each repeating the operation for about 50 ms.
#include "common.h"

// ---------------------------------------------------------------- (b) AND, as in mpz::operator&=

// mpz::operator&= (src/runtime/mpz.cpp, GMP-free branch): a buffer as long as the LONGER operand, then
// set() copies it into the result. `shorter` walks only the shorter one, which gives the same value for
// non-negative numbers (digits beyond the shorter operand are ANDed with 0).
static std::vector<D> land(const std::vector<D> & a, const std::vector<D> & b, bool shorter) {
    size_t sz = shorter ? std::min(a.size(), b.size()) : std::max(a.size(), b.size());
    std::vector<D> r;
    r.reserve(sz);
    for (size_t i = 0; i < sz; i++) r.push_back((i < a.size() ? a[i] : 0) & (i < b.size() ? b[i] : 0));
    while (r.size() > 1 && r.back() == 0) r.pop_back();
    return std::vector<D>(r.begin(), r.end());   // set(sz, r.begin()) copies into the mpz
}

int main(int argc, char ** argv) {
    // correctness first: Karatsuba against mpn_mul at 300 random sizes, every threshold used below
    for (size_t t : {8, 16, 32, 64}) {
        g_threshold = t;
        for (int k = 0; k < 300; k++) {
            size_t n = 1 + rnd() % 700;
            auto a = random_number(n), b = random_number(n);
            std::vector<D> c1(2 * n), c2(2 * n);
            lean::mpn_mul(a.data(), n, b.data(), n, c1.data());
            kmul(a.data(), b.data(), n, c2.data());
            if (c1 != c2) { std::fprintf(stderr, "Karatsuba differs from mpn_mul at n = %zu (threshold %zu)\n", n, t); return 1; }
        }
    }
    std::printf("{\n \"checked\": \"Karatsuba equals mpn_mul limb by limb at 1200 random sizes; both AND variants equal at every size\",\n");

    // the threshold: where Karatsuba starts to pay, at 4096 bits (128 limbs)
    std::printf(" \"threshold_us_at_128_limbs\": {");
    {
        auto a = random_number(128), b = random_number(128);
        std::vector<D> c(256);
        const char * sep = "";
        for (size_t t : {8, 16, 24, 32, 48, 64, 129}) {
            g_threshold = t;
            double us = time_us([&] { kmul(a.data(), b.data(), 128, c.data()); g_sink = c[0]; });
            std::printf("%s\"%zu\": %.4f", sep, t, us); sep = ", ";
        }
    }
    std::printf("},\n");
    g_threshold = argc > 1 ? std::strtoul(argv[1], nullptr, 10) : 32;
    std::printf(" \"threshold\": %zu,\n \"points\": [\n", g_threshold);

    const char * sep = "";
    for (size_t bits = 64; bits <= (1u << 17); bits *= 2) {
        size_t n = bits / 32;
        auto a = random_number(n), b = random_number(n);
        std::vector<D> c(2 * n), c2(2 * n);
        lean::mpn_mul(a.data(), n, b.data(), n, c.data());
        kmul(a.data(), b.data(), n, c2.data());
        if (c != c2) { std::fprintf(stderr, "Karatsuba differs at %zu bits\n", bits); return 1; }
        double schoolbook = time_us([&] { lean::mpn_mul(a.data(), n, b.data(), n, c.data()); g_sink = c[0]; });
        double karatsuba = time_us([&] { kmul(a.data(), b.data(), n, c2.data()); g_sink = c2[0]; });

        std::vector<D> mask = {0xFFFFFFFFu, 0xFFFFFFFFu};
        if (land(a, mask, false) != land(a, mask, true)) { std::fprintf(stderr, "AND variants differ at %zu bits\n", bits); return 1; }
        double and_longer = time_us([&] { g_sink = land(a, mask, false)[0]; });
        double and_shorter = time_us([&] { g_sink = land(a, mask, true)[0]; });

        std::printf("%s  {\"bits\": %zu, \"mul_schoolbook_us\": %.5f, \"mul_karatsuba_us\": %.5f, \"and_longer_us\": %.5f, \"and_shorter_us\": %.5f}",
                    sep, bits, schoolbook, karatsuba, and_longer, and_shorter);
        sep = ",\n";
        std::fflush(stdout);
    }
    std::printf("\n ]\n}\n");
    return 0;
}
