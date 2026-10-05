// Freestanding stand-in for Lean's runtime/debug.h (wasm32, no C library): checks compiled out, as in a release build.
#pragma once
#include <stddef.h>
#define lean_assert(...) ((void)0)
#define lean_unreachable() __builtin_unreachable()
extern "C" int snprintf(char *, size_t, const char *, ...);
namespace std { template <class T> inline void swap(T & a, T & b) { T t = a; a = b; b = t; } }   // mpn_to_string
