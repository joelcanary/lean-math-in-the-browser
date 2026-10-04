// The same two versions of Lean's mpn_mul, compiled natively (report § 4.11): Lean's code (VARIANT=0)
// and the carry added last behind an empty asm (VARIANT=2). Checks that both give the same product as
// a third, independent multiplication (64-bit digit products accumulated column by column), then times
// them interleaved.
//   c++ -O3 -c -DVARIANT=0 -Dmpn_mul=mpn_mul_v0 mpn_mul.cpp -o v0.o
//   c++ -O3 -c -DVARIANT=2 -Dmpn_mul=mpn_mul_v2 mpn_mul.cpp -o v2.o
//   c++ -O3 nativo.cpp v0.o v2.o -o nativo && ./nativo
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <vector>

typedef unsigned mpn_digit;
extern "C" void mpn_mul_v0(mpn_digit const *, size_t, mpn_digit const *, size_t, mpn_digit *);
extern "C" void mpn_mul_v2(mpn_digit const *, size_t, mpn_digit const *, size_t, mpn_digit *);

static std::vector<mpn_digit> digits(size_t n, uint32_t s) {
    std::vector<mpn_digit> d(n);
    for (auto & x : d) { s = s * 1664525u + 1013904223u; x = s; }
    d[n - 1] |= 0x80000000u;
    return d;
}

// column-wise product: each column sums up to n products of 64 bits, kept in 128 bits
static std::vector<mpn_digit> reference(std::vector<mpn_digit> const & a, std::vector<mpn_digit> const & b) {
    size_t n = a.size(), m = b.size();
    std::vector<mpn_digit> c(n + m);
    unsigned __int128 acc = 0;
    for (size_t col = 0; col < n + m; col++) {
        for (size_t i = (col >= m ? col - m + 1 : 0); i < n && i <= col; i++)
            acc += (unsigned __int128)((uint64_t)a[i] * b[col - i]);
        c[col] = (mpn_digit)acc;
        acc >>= 32;
    }
    return c;
}

int main() {
    typedef void (*F)(mpn_digit const *, size_t, mpn_digit const *, size_t, mpn_digit *);
    F fs[2] = {mpn_mul_v0, mpn_mul_v2};
    const char * names[2] = {"lean", "carry_last"};
    printf("{\"points\": [\n");
    bool first = true;
    for (size_t n : {128, 256, 512, 1024, 2048}) {
        auto a = digits(n, 2 * n + 1), b = digits(n, 2 * n + 2), want = reference(a, b);
        std::vector<mpn_digit> c(2 * n);
        double one[2];
        for (int v = 0; v < 2; v++) {
            fs[v](a.data(), n, b.data(), n, c.data());
            if (c != want) { fprintf(stderr, "%s %zu digits: wrong product\n", names[v], n); return 1; }
            auto t = std::chrono::steady_clock::now();
            fs[v](a.data(), n, b.data(), n, c.data());
            one[v] = std::max(1e-6, std::chrono::duration<double>(std::chrono::steady_clock::now() - t).count());
        }
        long reps[2];
        for (int v = 0; v < 2; v++) reps[v] = std::max(1L, (long)(0.15 / one[v]));
        std::vector<double> runs[2];
        for (int r = 0; r < 7; r++)
            for (int v = 0; v < 2; v++) {
                auto t = std::chrono::steady_clock::now();
                for (long i = 0; i < reps[v]; i++) fs[v](a.data(), n, b.data(), n, c.data());
                runs[v].push_back(std::chrono::duration<double>(std::chrono::steady_clock::now() - t).count() / reps[v] * 1e6);
            }
        for (int v = 0; v < 2; v++) {
            auto s = runs[v];
            std::sort(s.begin(), s.end());
            printf("%s {\"module\": \"%s\", \"bits\": %zu, \"reps\": %ld, \"us\": %.3f, \"checked\": true}", first ? " " : ",\n ", names[v], 32 * n, reps[v], s[3]);
            first = false;
        }
    }
    printf("\n]}\n");
}
