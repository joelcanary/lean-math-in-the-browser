// Minimal stand-in for Lean's runtime/debug.h, enough to compile src/runtime/mpn.cpp on its own.
// Assertions are off, as in a release build of Lean.
#pragma once
#include <cstdio>   // Lean's debug.h brings it in through <iostream>; mpn_to_string uses snprintf
#define lean_assert(COND) ((void)0)
#define lean_unreachable() __builtin_unreachable()
