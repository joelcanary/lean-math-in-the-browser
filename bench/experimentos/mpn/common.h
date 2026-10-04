// Shared by harness.cpp (multiplication, AND) and divgcd.cpp (division, gcd): Lean's digit type,
// a fixed random generator, Karatsuba's method over Lean's mpn_mul, and the timer.
#pragma once
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>
#include "runtime/mpn.h"

using D = lean::mpn_digit;   // 32-bit digits, as in Lean
using DD = uint64_t;

static uint64_t g_seed = 0x9E3779B97F4A7C15ull;
static D rnd() { g_seed ^= g_seed << 13; g_seed ^= g_seed >> 7; g_seed ^= g_seed << 17; return static_cast<D>(g_seed >> 16); }
static std::vector<D> random_number(size_t n) { std::vector<D> v(n); for (auto & d : v) d = rnd(); v[n - 1] |= 0x80000000u; return v; }

// ---------------------------------------------------------------- (a) Karatsuba over mpn_mul

static size_t g_threshold = 32;

// c[0..la] = a + b, with la >= lb
static void add(const D * a, size_t la, const D * b, size_t lb, D * c) {
    DD k = 0;
    for (size_t i = 0; i < la; i++) { DD s = (DD)a[i] + (i < lb ? b[i] : 0) + k; c[i] = (D)s; k = s >> 32; }
    c[la] = (D)k;
}
// a -= b in place (a >= b as numbers, la >= lb)
static void sub_in(D * a, size_t la, const D * b, size_t lb) {
    int64_t borrow = 0;
    for (size_t i = 0; i < la; i++) {
        int64_t s = (int64_t)a[i] - (i < lb ? (int64_t)b[i] : 0) - borrow;
        borrow = s < 0; a[i] = (D)(s + (borrow << 32));
        if (i >= lb && !borrow) break;
    }
}
// a += b in place (the sum fits in la limbs)
static void add_in(D * a, size_t la, const D * b, size_t lb) {
    DD k = 0;
    for (size_t i = 0; i < la; i++) {
        DD s = (DD)a[i] + (i < lb ? b[i] : 0) + k; a[i] = (D)s; k = s >> 32;
        if (i >= lb && !k) break;
    }
}

// c[0..2n) = a[0..n) * b[0..n)
static void kmul(const D * a, const D * b, size_t n, D * c) {
    if (n < g_threshold) { lean::mpn_mul(a, n, b, n, c); return; }
    size_t h = n / 2, H = n - h;                // a = a1·B^h + a0, with a0 of h limbs and a1 of H
    std::vector<D> z0(2 * h), z2(2 * H), sa(H + 1), sb(H + 1), z1(2 * (H + 1));
    kmul(a, b, h, z0.data());
    kmul(a + h, b + h, H, z2.data());
    add(a + h, H, a, h, sa.data());
    add(b + h, H, b, h, sb.data());
    kmul(sa.data(), sb.data(), H + 1, z1.data()); // (a0+a1)(b0+b1)
    sub_in(z1.data(), z1.size(), z0.data(), z0.size());
    sub_in(z1.data(), z1.size(), z2.data(), z2.size());
    std::memcpy(c, z0.data(), 2 * h * sizeof(D));
    std::memcpy(c + 2 * h, z2.data(), 2 * H * sizeof(D));
    size_t room = 2 * n - h, l1 = z1.size();
    while (l1 > room) { l1--; }                  // the top limbs of z1 are zero here (z1 < B^(2H+1))
    add_in(c + h, room, z1.data(), l1);
}

// ---------------------------------------------------------------- timing

template <typename F> static double time_us(F f) {
    using clk = std::chrono::steady_clock;
    size_t reps = 1;
    for (;;) {   // grow reps until one run takes about 50 ms
        auto t0 = clk::now(); for (size_t r = 0; r < reps; r++) f();
        double ms = std::chrono::duration<double, std::milli>(clk::now() - t0).count();
        if (ms > 50 || reps > (1u << 26)) break;
        reps *= ms < 5 ? 10 : 2;
    }
    std::vector<double> runs;
    for (int k = 0; k < 5; k++) {
        auto t0 = clk::now(); for (size_t r = 0; r < reps; r++) f();
        runs.push_back(std::chrono::duration<double, std::micro>(clk::now() - t0).count() / reps);
    }
    std::sort(runs.begin(), runs.end());
    return runs[2];
}

static volatile D g_sink;
