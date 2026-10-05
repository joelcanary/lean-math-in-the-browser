// Freestanding stand-in for Lean's runtime/buffer.h: the members mpn.cpp uses, over a bump arena (no malloc in
// wasm32 here). The arena is reset after each exported call (exports.cpp), so a call never runs out of it.
#pragma once
#include <stddef.h>
extern "C" void * mpn_arena_alloc(size_t bytes);
extern "C" void * memcpy(void *, const void *, size_t);
namespace lean {
template <class T> inline T max(T a, T b) { return a < b ? b : a; }
template <class T> inline T min(T a, T b) { return a < b ? a : b; }
template <typename T> class buffer {
    T * m_p = nullptr; unsigned m_n = 0, m_cap = 0;
    void grow(unsigned n) {
        unsigned cap = n < 8 ? 8 : n * 2;
        T * p = static_cast<T *>(mpn_arena_alloc(cap * sizeof(T)));
        if (m_n) memcpy(p, m_p, m_n * sizeof(T));
        m_p = p; m_cap = cap;
    }
public:
    unsigned size() const { return m_n; }
    T * data() { return m_p; }
    T const * data() const { return m_p; }
    void push_back(T const & x) { if (m_n == m_cap) grow(m_n + 1); m_p[m_n++] = x; }
    void pop_back() { m_n--; }
    bool empty() const { return m_n == 0; }
    T & back() { return m_p[m_n - 1]; }
    void resize(unsigned n, T const & e = T()) { if (n > m_cap) grow(n); for (unsigned i = m_n; i < n; i++) m_p[i] = e; m_n = n; }
    T & operator[](unsigned i) { return m_p[i]; }
    T const & operator[](unsigned i) const { return m_p[i]; }
};
}
