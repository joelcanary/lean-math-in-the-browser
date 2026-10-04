// Lean's mpn_mul (src/runtime/mpn.cpp at v4.34.0, Copyright (c) 2011 Microsoft Corporation, Apache
// License 2.0), alone, to see how a C++ compiler orders the inner sum for WebAssembly (report § 4.11).
// VARIANT 0 is Lean's code. VARIANT 1 adds the carry in a statement of its own. VARIANT 2 also keeps the
// partial sum in a separate variable that the compiler may not merge with the carry (see below).
//   clang --target=wasm32 -O3 -S -DVARIANT=0 mpn_mul.cpp -o -
typedef __SIZE_TYPE__ size_t;                // no C library for wasm32 here: the compiler's own types
typedef unsigned mpn_digit;
typedef __UINT64_TYPE__ mpn_double_digit;
#ifndef VARIANT
#define VARIANT 0
#endif

extern "C" void mpn_mul(mpn_digit const * a, size_t const lnga,
             mpn_digit const * b, size_t const lngb,
             mpn_digit * c) {
    size_t i;
    mpn_digit k;

#define DIGIT_BITS (sizeof(mpn_digit)*8)

    for (unsigned i = 0; i < lnga; i++)
        c[i] = 0;

    for (size_t j = 0; j < lngb; j++) {
        mpn_digit const & v_j = b[j];
        if (v_j == 0) {
            c[j+lnga] = 0;
        }
        else {
            k = 0;
            for (i = 0; i < lnga; i++) {
                mpn_digit const & u_i = a[i];
                mpn_double_digit t;
#if VARIANT == 0
                t = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) +
                    (mpn_double_digit) c[i+j] +
                    (mpn_double_digit) k;
#elif VARIANT == 1
                t = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) + (mpn_double_digit) c[i+j];
                t += (mpn_double_digit) k;
#else
                // the product plus the old digit cannot depend on k; an empty asm with the value as an
                // in-out operand stops the optimiser from re-associating the sum
                mpn_double_digit p = ((mpn_double_digit)u_i * (mpn_double_digit)v_j) + (mpn_double_digit) c[i+j];
                __asm__("" : "+r"(p));
                t = p + (mpn_double_digit) k;
#endif
                c[i+j] = (t << DIGIT_BITS) >> DIGIT_BITS;
                k = t >> DIGIT_BITS;
            }
            c[j+lnga] = k;
        }
    }
}
