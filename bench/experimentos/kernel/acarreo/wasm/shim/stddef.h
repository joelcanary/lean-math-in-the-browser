// Freestanding stand-ins: Lean's clang ships no C headers for wasm32. Only what mpn.cpp and mpn.h use.
#pragma once
typedef __SIZE_TYPE__ size_t;
typedef __PTRDIFF_TYPE__ ptrdiff_t;
#define NULL nullptr
