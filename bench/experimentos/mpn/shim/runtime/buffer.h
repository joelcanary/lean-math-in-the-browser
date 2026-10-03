// Minimal stand-in for Lean's runtime/buffer.h: the members src/runtime/mpn.cpp uses, over
// std::vector. (Lean's own buffer keeps the first elements inline; that changes allocation, not the
// asymptotic cost this experiment measures.)
#pragma once
#include <algorithm>
#include <vector>
#include "runtime/debug.h"

namespace lean {
using std::max;
using std::min;

template <typename T> class buffer {
    std::vector<T> m_v;
public:
    unsigned size() const { return static_cast<unsigned>(m_v.size()); }
    T * data() { return m_v.data(); }
    T const * data() const { return m_v.data(); }
    void push_back(T const & x) { m_v.push_back(x); }
    void pop_back() { m_v.pop_back(); }
    bool empty() const { return m_v.empty(); }
    T & back() { return m_v.back(); }
    void resize(unsigned n, T const & e = T()) { m_v.resize(n, e); }
    T & operator[](unsigned i) { return m_v[i]; }
    T const & operator[](unsigned i) const { return m_v[i]; }
};
}
