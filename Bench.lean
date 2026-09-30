module

public import Lean
public import Tunnell
meta import Vir.Attributes

/-!
# Elementary number theory workloads for Lean in the browser

Small, classical computations chosen to stress different parts of a Lean runtime, each with an
external reference (OEIS or an exact Python computation):

| workload | what it stresses |
|---|---|
| `collatzRecord N` | recursion of unknown length (fuel-bounded), small `Nat` |
| `primeCount N` | in-place `Array Bool` updates (sieve of Eratosthenes) |
| `mertens N` | `Array Int` updates (Möbius sieve), signed arithmetic |
| `partitions n` | big `Nat` additions, dynamic programming over `Array Nat` |
| `fib n` | big `Nat` multiplication (fast doubling) |
| `isPrime n` | modular exponentiation on big `Nat` (deterministic Miller–Rabin) |
| `lifePopulation k` | a 64 × 64 torus under B37/S2378 for `k` generations, `Array Bool` |

Every loop is structural recursion on an explicit bound (`fuel`), tail-recursive where it runs long,
so that the kernel can evaluate the small cases below (`decide +kernel`) and the IR interpreter in
the browser does not grow its stack. Core Lean only, no Mathlib.
-/

public section

namespace Bench

/-! ## Collatz: the record holder of total stopping time up to `N` -/

/-- Steps for `n` to reach `1` under `n ↦ n/2 | 3n+1`, or `fuel` if it has not by then. -/
def collatzSteps : Nat → Nat → Nat → Nat
  | 0, _, acc => acc
  | fuel + 1, n, acc => if n ≤ 1 then acc else collatzSteps fuel (if n % 2 == 0 then n / 2 else 3 * n + 1) (acc + 1)

/-- Walk `n = k, k-1, …, 1` keeping the smallest `n` with the largest number of steps. -/
def collatzBest : Nat → Nat → Nat → Nat × Nat
  | 0, bn, bs => (bn, bs)
  | k + 1, bn, bs =>
    let s := collatzSteps 100000 (k + 1) 0
    if s ≥ bs then collatzBest k (k + 1) s else collatzBest k bn bs

/-- `(n, steps)`: the `n ≤ N` with the longest total stopping time (the smallest such `n`). -/
def collatzRecord (N : Nat) : Nat × Nat := collatzBest N 1 0

/-! ## Sieve of Eratosthenes: `π(N)` -/

/-- Cross out `j, j + p, …` while `j ≤ N` (at most `fuel` steps). -/
def crossOut (N p : Nat) : Nat → Nat → Array Bool → Array Bool
  | 0, _, a => a
  | fuel + 1, j, a => if j > N then a else crossOut N p fuel (j + p) (a.set! j false)

/-- For `p = 2 … r` (`r = isqrt N`), cross out the multiples of each prime from `p²`. -/
def sieveFrom (N r : Nat) : Nat → Nat → Array Bool → Array Bool
  | 0, _, a => a
  | fuel + 1, p, a =>
    if p > r then a
    else sieveFrom N r fuel (p + 1) (if a[p]! then crossOut N p (N / p + 1) (p * p) a else a)

/-- The number of `true` entries at indices `≤ k`. -/
def countTrue (a : Array Bool) : Nat → Nat → Nat
  | 0, acc => if a[0]! then acc + 1 else acc
  | k + 1, acc => countTrue a k (if a[k + 1]! then acc + 1 else acc)

/-- `π(N)`, the number of primes `≤ N`. -/
def primeCount (N : Nat) : Nat :=
  if N < 2 then 0 else
  let a := ((Array.replicate (N + 1) true).set! 0 false).set! 1 false
  countTrue (sieveFrom N (Tunnell.isqrt N) (N + 1) 2 a) N 0

/-! ## Mertens: `M(N) = ∑_{k ≤ N} μ(k)` by a Möbius sieve -/

/-- Multiply `μ` by `-1` at every multiple of `p`, and zero it at every multiple of `p²`. -/
def muPrime (N p : Nat) : Nat → Nat → Array Int → Array Int
  | 0, _, a => a
  | fuel + 1, j, a =>
    if j > N then a
    else muPrime N p fuel (j + p) (a.set! j (if j % (p * p) == 0 then 0 else -a[j]!))

/-- For `p = 2 … N`, if `p` is prime (read from `isPrimeTable`), apply `muPrime`. -/
def muSieve (N : Nat) (primes : Array Bool) : Nat → Nat → Array Int → Array Int
  | 0, _, a => a
  | fuel + 1, p, a =>
    if p > N then a else muSieve N primes fuel (p + 1) (if primes[p]! then muPrime N p (N / p + 1) p a else a)

/-- `∑_{k = 1}^{j} a[k]`. -/
def sumFrom (a : Array Int) : Nat → Int → Int
  | 0, acc => acc
  | j + 1, acc => sumFrom a j (acc + a[j + 1]!)

/-- The Mertens function `M(N)`. -/
def mertens (N : Nat) : Int :=
  let primes := sieveFrom N (Tunnell.isqrt N) (N + 1) 2 ((((Array.replicate (N + 1) true).set! 0 false).set! 1 false))
  sumFrom (muSieve N primes N 2 (Array.replicate (N + 1) 1)) N 0

/-! ## Partitions `p(n)` by Euler's pentagonal recurrence (big `Nat`) -/

/-- `∑_{k ≥ 1} (-1)^{k+1} (p(m − k(3k−1)/2) + p(m − k(3k+1)/2))`, as two non-negative sums. -/
def pentagonal (p : Array Nat) (m : Nat) : Nat → Nat → Nat → Nat → Nat
  | 0, _, pos, neg => pos - neg
  | fuel + 1, k, pos, neg =>
    let g1 := k * (3 * k - 1) / 2
    if g1 > m then pos - neg
    else
      let g2 := k * (3 * k + 1) / 2
      let t := p[m - g1]! + (if g2 ≤ m then p[m - g2]! else 0)
      if k % 2 == 1 then pentagonal p m fuel (k + 1) (pos + t) neg
      else pentagonal p m fuel (k + 1) pos (neg + t)

/-- Fill `p(0) … p(n)`. -/
def partitionsFill (n : Nat) : Nat → Nat → Array Nat → Array Nat
  | 0, _, a => a
  | fuel + 1, m, a => if m > n then a else partitionsFill n fuel (m + 1) (a.push (pentagonal a m (m + 1) 1 0 0))

/-- `p(n)`, the number of partitions of `n`. -/
def partitions (n : Nat) : Nat := (partitionsFill n (n + 1) 1 #[1])[n]!

/-! ## Fibonacci by fast doubling (big `Nat` multiplication) -/

/-- `(F(n), F(n+1))`, recursing on the binary digits of `n` (at most `fuel` levels). -/
def fibPair : Nat → Nat → Nat × Nat
  | 0, _ => (0, 1)
  | fuel + 1, n =>
    if n == 0 then (0, 1)
    else
      let (a, b) := fibPair fuel (n / 2)
      let c := a * (2 * b - a)
      let d := a * a + b * b
      if n % 2 == 0 then (c, d) else (d, c + d)

/-- The Fibonacci number `F(n)`. -/
def fib (n : Nat) : Nat := (fibPair (n.log2 + 2) n).1

/-! ## Deterministic Miller–Rabin (exact for `n < 3.3 · 10²⁴` with the first 13 prime bases) -/

/-- `b ^ e % m` by square-and-multiply, at most `fuel` bits. -/
def powMod (m : Nat) : Nat → Nat → Nat → Nat → Nat
  | 0, _, _, acc => acc
  | fuel + 1, b, e, acc =>
    if e == 0 then acc
    else powMod m fuel (b * b % m) (e / 2) (if e % 2 == 1 then acc * b % m else acc)

/-- Square `x` up to `s − 1` times looking for `n − 1`. -/
def squaresHitMinusOne (n : Nat) : Nat → Nat → Bool
  | 0, _ => false
  | k + 1, x => let x := x * x % n; if x == n - 1 then true else squaresHitMinusOne n k x

/-- One Miller–Rabin round for base `a`, with `n − 1 = d · 2^s`. -/
def mrRound (n d s a : Nat) : Bool :=
  let x := powMod n (d.log2 + 2) (a % n) d 1
  x == 1 || x == n - 1 || squaresHitMinusOne n (s - 1) x

/-- Split `n − 1 = d · 2^s`. -/
def twoAdic : Nat → Nat → Nat → Nat × Nat
  | 0, d, s => (d, s)
  | fuel + 1, d, s => if d % 2 == 0 && d > 0 then twoAdic fuel (d / 2) (s + 1) else (d, s)

/-- Primality, exact for `n < 3 317 044 064 679 887 385 961 981` (bases 2 … 41). -/
def isPrime (n : Nat) : Bool :=
  if n < 2 then false
  else if n < 4 then true
  else if n % 2 == 0 then false
  else
    let (d, s) := twoAdic (n.log2 + 1) (n - 1) 0
    [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41].all fun a => a % n == 0 || mrRound n d s a

/-! ## B37/S2378 on a 64 × 64 torus -/

def side : Nat := 64

/-- The number of live neighbours of cell `i` on the torus. -/
def neighbours (g : Array Bool) (i : Nat) : Nat :=
  let y := i / side; let x := i % side
  let c := fun (dy dx : Nat) =>
    if g[((y + dy + side - 1) % side) * side + (x + dx + side - 1) % side]! then 1 else 0
  c 0 0 + c 0 1 + c 0 2 + c 1 0 + c 1 2 + c 2 0 + c 2 1 + c 2 2

/-- One generation, writing cells `0 … k` into `out`. -/
def stepCells (g : Array Bool) : Nat → Array Bool → Array Bool
  | 0, out => out.set! 0 (let n := neighbours g 0; if g[0]! then n == 2 || n == 3 || n == 7 || n == 8 else n == 3 || n == 7)
  | k + 1, out =>
    let n := neighbours g (k + 1)
    stepCells g k (out.set! (k + 1) (if g[k + 1]! then n == 2 || n == 3 || n == 7 || n == 8 else n == 3 || n == 7))

/-- `k` generations. -/
def evolve : Nat → Array Bool → Array Bool
  | 0, g => g
  | k + 1, g => evolve k (stepCells g (side * side - 1) (Array.replicate (side * side) false))

/-- A reproducible soup: cell `i` is alive when the linear congruential generator says so (density ≈ 0.3). -/
def soup : Nat → Nat → Array Bool → Array Bool
  | 0, _, a => a
  | k + 1, s, a => let s' := (1103515245 * s + 12345) % 2147483648; soup k s' (a.push (s' % 10 < 3))

/-- The live population after `k` generations of the soup under B37/S2378. -/
def lifePopulation (k : Nat) : Nat :=
  let g := evolve k (soup (side * side) 20260926 #[])
  countTrue g (side * side - 1) 0

/-! ## The same numbers without their decimal expansion

`toString` of a big `Nat` is quadratic in its length (natively, `fib 1000000` takes 3 ms to compute and
9 s to print), so the benchmark also times `⌊log₂⌋` of the result: that isolates the arithmetic. -/

/-- `⌊log₂ F(n)⌋`: the Fibonacci computation without printing the number. -/
def fibBits (n : Nat) : Nat := (fib n).log2

/-- `⌊log₂ p(n)⌋`: the partition computation without printing the number. -/
def partitionsBits (n : Nat) : Nat := (partitions n).log2

/-! ## Tunnell, re-exported so that one package holds every workload -/

/-- `Tunnell.tunnell`, exported from this package (a dependency's declarations are not exported). -/
def tunnell (n : Nat) : Tunnell.Verdict := Tunnell.tunnell n

/-! ## What one call costs

An interactive page calls into Lean on every click or keystroke, with small arguments and small
results, so the cost of the call itself matters more there than the speed of a long computation.
These functions do (almost) nothing, so that `bench/medir-llamada.mjs` measures the boundary: a small
`Nat` in and out, and strings of growing length passed in, passed out, or both. -/

/-- The smallest call: one small `Nat` in, the same `Nat` out. -/
def ident (n : Nat) : Nat := n

/-- A `String` in, its length out: the cost of passing a string into Lean. -/
def strLength (s : String) : Nat := s.length

/-- `n` copies of `a` out: the cost of passing a string back to JavaScript. -/
def fill (n : Nat) : String := "".pushn 'a' n

/-- The same `String` in and out: both directions. -/
def echo (s : String) : String := s

/-! ## Kernel-evaluated spot checks (small cases, external values) -/

example : collatzRecord 30 = (27, 111) := by decide +kernel        -- A006877: 27 needs 111 steps
example : primeCount 100 = 25 := by decide +kernel                 -- A000720
example : mertens 10 = -1 := by decide +kernel                     -- A002321
example : partitions 10 = 42 := by decide +kernel                  -- A000041
example : fib 30 = 832040 := by decide +kernel                     -- A000045
example : isPrime 97 = true ∧ isPrime 91 = false := by decide +kernel

end Bench

attribute [vir_export] Bench.fibBits Bench.partitionsBits Bench.tunnell Bench.collatzRecord Bench.primeCount Bench.mertens Bench.partitions Bench.fib
  Bench.isPrime Bench.lifePopulation Bench.ident Bench.strLength Bench.fill Bench.echo
