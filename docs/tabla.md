| workload | size | native (ms) | WebAssembly (ms) | JavaScript (ms) | WASM ÷ native | WASM ÷ JS |
|---|--:|--:|--:|--:|--:|--:|
| Tunnell counts | 1,003 | 0.008 | 0.898 | 0.027 | 112 | 33 |
| Tunnell counts | 10,003 | 0.067 | 7.2 | 0.024 | 107 | 298 |
| Tunnell counts | 100,003 | 0.605 | 66.7 | 0.226 | 110 | 295 |
| Tunnell counts | 1,000,003 | 5.8 | 644.4 | 2.2 | 110 | 290 |
| Collatz record | 1,000 | 0.154 | 26.3 | 0.089 | 171 | 297 |
| Collatz record | 10,000 | 2.3 | 375.5 | 1.2 | 163 | 301 |
| Collatz record | 100,000 | 29.8 | 4,701.4 | 16.9 | 158 | 278 |
| prime sieve π(N) | 1,000 | 0.006 | 0.729 | 0.034 | 127 | 22 |
| prime sieve π(N) | 10,000 | 0.061 | 8.1 | 0.023 | 132 | 348 |
| prime sieve π(N) | 100,000 | 0.658 | 85.7 | 0.186 | 130 | 461 |
| prime sieve π(N) | 1,000,000 | 6.9 | 916.6 | 2.1 | 134 | 428 |
| Mertens M(N) | 1,000 | 0.016 | 2.2 | 0.055 | 139 | 41 |
| Mertens M(N) | 10,000 | 0.175 | 24.2 | 0.095 | 138 | 256 |
| Mertens M(N) | 100,000 | 1.9 | 262.7 | 2.9 | 139 | 89 |
| Mertens M(N) | 1,000,000 | 20.1 | 2,802.4 | 35.2 | 140 | 80 |
| Life B37/S2378 (generations) | 10 | 2.4 | 273.8 | 1.0 | 115 | 270 |
| Life B37/S2378 (generations) | 30 | 7.0 | 820.6 | 1.3 | 117 | 643 |
| Life B37/S2378 (generations) | 100 | 23.1 | 2,729.3 | 3.9 | 118 | 696 |
| partitions p(n), not printed | 100 | 0.005 | 0.779 | 0.011 | 148 | 71 |
| partitions p(n), not printed | 300 | 0.025 | 4.0 | 0.061 | 158 | 65 |
| partitions p(n), not printed | 1,000 | 2.4 | 23.0 | 0.354 | 9.6 | 65 |
| partitions p(n), not printed | 3,000 | 15.8 | 117.9 | 2.0 | 7.5 | 58 |
| partitions p(n), printed | 100 | 0.005 | 0.692 | 0.066 | 130 | 11 |
| partitions p(n), printed | 300 | 0.025 | 3.8 | 0.065 | 151 | 58 |
| partitions p(n), printed | 1,000 | 2.4 | 22.9 | 0.440 | 9.5 | 52 |
| partitions p(n), printed | 3,000 | 15.8 | 117.4 | 2.0 | 7.4 | 58 |
| Fibonacci F(n), not printed | 1,000 | 0.004 | 0.019 | 0.003 | 5.0 | 6.1 |
| Fibonacci F(n), not printed | 10,000 | 0.010 | 0.079 | 0.012 | 7.6 | 6.4 |
| Fibonacci F(n), not printed | 100,000 | 0.143 | 6.9 | 0.343 | 48 | 20 |
| Fibonacci F(n), not printed | 1,000,000 | 3.0 | 701.0 | 6.6 | 237 | 106 |
| Fibonacci F(n), printed | 1,000 | 0.100 | 0.048 | 0.003 | 0.5 | 15 |
| Fibonacci F(n), printed | 10,000 | 1.7 | 1.4 | 0.042 | 0.8 | 34 |
| Fibonacci F(n), printed | 100,000 | 91.6 | 150.3 | 1.2 | 1.6 | 127 |
| Fibonacci F(n), printed | 1,000,000 | 9,233.7 | 14,101.7 | 27.2 | 1.5 | 519 |
| Miller–Rabin (bits) | 31 | 0.003 | 0.381 | 0.025 | 139 | 15 |
| Miller–Rabin (bits) | 61 | 0.417 | 0.898 | 0.098 | 2.2 | 9.1 |
| Miller–Rabin (bits) | 89 | 0.423 | 1.4 | 0.364 | 3.4 | 3.9 |
| Miller–Rabin (bits) | 127 | 0.659 | 2.2 | 0.504 | 3.3 | 4.4 |
| Miller–Rabin (bits) | 521 | 5.4 | 25.8 | 6.0 | 4.8 | 4.3 |
| Miller–Rabin (bits) | 1,279 | 26.7 | 249.8 | 48.3 | 9.3 | 5.2 |
