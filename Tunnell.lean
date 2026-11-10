module

public import Lean
meta import Vir.Attributes

/-!
# Tunnell's criterion, running in the browser

For a squarefree `n`, Tunnell (1983; Invent. Math. 72, 323–334, doi:10.1007/BF01389327) related the congruent number problem ("is `n`
the area of a right triangle with rational sides?") to four counts of lattice points:

* `n` odd:  `A = #{(x,y,z) ∈ ℤ³ : 2x² + y² + 32z² = n}`, `B = #{2x² + y² + 8z² = n}`;
* `n = 2m`: `C = #{4x² + y² + 32z² = m}`, `D = #{4x² + y² + 8z² = m}`.

If `n` is congruent then `2A = B` (resp. `2C = D`). This direction is unconditional,
so when the counts disagree `n` is **not** congruent, full stop. The converse
(`2A = B ⟹ n` congruent) holds if the Birch–Swinnerton-Dyer conjecture holds for the
curve `y² = x³ − n²x`, and is not known otherwise.

Everything below is plain Lean 4 (no Mathlib), so the same code runs in the kernel,
in the compiler and, through lean-vir, in a browser.
-/

@[expose] public section

namespace Tunnell

/-! Every helper below is plain structural recursion on a natural number, so the kernel can
evaluate it (the `decide +kernel` checks at the end) exactly as the compiler and the browser do.
(Core's `for ... in [a:b]` loops do not reduce in the kernel.) -/

/-- Binary search for `isqrt`: with `lo * lo ≤ s < hi * hi`, halve `[lo, hi)` at most `fuel` times. -/
def isqrtAux (s : Nat) : Nat → Nat → Nat → Nat
  | 0, lo, _ => lo
  | fuel + 1, lo, hi =>
    if hi - lo ≤ 1 then lo
    else
      let mid := (lo + hi) / 2
      if mid * mid ≤ s then isqrtAux s fuel mid hi else isqrtAux s fuel lo mid

/-- Integer square root: the largest `r` with `r * r ≤ s`. The search starts from `[0, s + 1)`,
    so `s + 1` halvings are more than enough; it stops after about `log₂ s` of them. -/
def isqrt (s : Nat) : Nat := isqrtAux s (s + 1) 0 (s + 1)

/-- Advance `y` while `(y + 1)² ≤ r`, at most `fuel` times. -/
def advance (r : Nat) : Nat → Nat → Nat
  | 0, y => y
  | fuel + 1, y => if (y + 1) * (y + 1) ≤ r then advance r fuel (y + 1) else y

/-- The number of integer `(±x, y, ±z)` that one `(x, z)` with `x, z ≥ 0` and `y = isqrt r` stands
    for, where `r = n − a x² − c z²`: zero unless `r` is a perfect square. -/
def weight (x y z r : Nat) : Nat :=
  if y * y == r then
    (if x == 0 then 1 else 2) * (if y == 0 then 1 else 2) * (if z == 0 then 1 else 2)
  else 0

/-- For a fixed `x`, walk `z` DOWN from `k` to `0`. As `z` falls, `r = n − a x² − c z²` rises, so
    `y = isqrt r` only moves up: it is carried along and advanced (at most `ymax` steps over the
    whole walk) instead of being recomputed by a binary search for every `z`. Tail-recursive. -/
def sumZ (a c n x ymax : Nat) : Nat → Nat → Nat → Nat
  | 0, y, acc =>
    let r := n - a * x * x
    let y' := advance r ymax y
    acc + weight x y' 0 r
  | k + 1, y, acc =>
    let r := n - a * x * x - c * (k + 1) * (k + 1)
    let y' := advance r ymax y
    sumZ a c n x ymax k y' (acc + weight x y' (k + 1) r)

/-- `acc + ∑_{x = 0}^{k} (count for that x)`, with `z` only up to its bound for that `x`:
    `c z² ≤ n − a x² ⇔ z ≤ isqrt ⌊(n − a x²) / c⌋`. Tail-recursive. -/
def sumX (a c n ymax : Nat) : Nat → Nat → Nat
  | 0, acc => sumZ a c n 0 ymax (isqrt (n / c)) 0 acc
  | k + 1, acc =>
    sumX a c n ymax k (sumZ a c n (k + 1) ymax (isqrt ((n - a * (k + 1) * (k + 1)) / c)) 0 acc)

/-- The number of integer triples `(x, y, z)` with `a x² + y² + c z² = n`, for `a, c > 0` — the
    same equation as `Lax712553.TunnellParity.solutions a c n` in the Lax archive.
    Non-negative `x, z` are enumerated (`a x² ≤ n ⇔ x ≤ isqrt ⌊n / a⌋`), `y ≥ 0` is found by the
    moving pointer, and each non-zero coordinate contributes its sign (a factor 2). -/
def rep (a c n : Nat) : Nat := sumX a c n (isqrt n) (isqrt (n / a)) 0

/-- No `p²` with `2 ≤ p ≤ k` divides `n`. -/
def noSquareUpTo (n : Nat) : Nat → Bool
  | 0 => true
  | 1 => true
  | k + 2 => if n % ((k + 2) * (k + 2)) == 0 then false else noSquareUpTo n (k + 1)

/-- `n` has no square factor `p²` with `p > 1`. -/
def squarefree (n : Nat) : Bool := n != 0 && noSquareUpTo n (isqrt n)

/-- The outcome of Tunnell's criterion for one `n`. -/
structure Verdict where
  n : Nat
  squarefree : Bool
  /-- `"odd"` (counts `A`, `B`) or `"even"` (counts `C`, `D` of `m = n / 2`) -/
  parity : String
  /-- `A` or `C` -/
  first : Nat
  /-- `B` or `D` -/
  second : Nat
  /-- `2 * first = second` -/
  criterion : Bool
  /-- what can be said, and on what grounds -/
  verdict : String

/-- Tunnell's criterion for `n`. -/
def tunnell (n : Nat) : Verdict :=
  let sq := squarefree n
  let (par, f, s) :=
    if n % 2 == 1 then ("odd", rep 2 32 n, rep 2 8 n)
    else ("even", rep 4 32 (n / 2), rep 4 8 (n / 2))
  let crit := 2 * f == s
  let v :=
    if n == 0 then "n must be positive"
    else if !sq then "not squarefree: apply the criterion to n divided by its largest square factor"
    else if !crit then "NOT congruent (unconditional, by Tunnell's theorem)"
    else "congruent if the Birch-Swinnerton-Dyer conjecture holds (Tunnell's criterion is satisfied)"
  { n, squarefree := sq, parity := par, first := f, second := s, criterion := crit, verdict := v }

/-- The squarefree `n ≤ limit` that satisfy Tunnell's criterion (congruent under BSD). -/
def congruentUpTo (limit : Nat) : Array Nat := Id.run do
  let mut out := #[]
  for n in [1:limit + 1] do
    let v := tunnell n
    if v.squarefree && v.criterion then out := out.push n
  return out

/-! Kernel-checked spot values: Fermat's theorem (1 is not congruent), and the classical
first congruent numbers 5, 6, 7. `decide` evaluates the same code the browser runs. -/

example : (tunnell 1).criterion = false := by decide +kernel
example : (tunnell 2).criterion = false := by decide +kernel
example : (tunnell 3).criterion = false := by decide +kernel
example : (tunnell 5).criterion = true := by decide +kernel
example : (tunnell 6).criterion = true := by decide +kernel
example : (tunnell 7).criterion = true := by decide +kernel

end Tunnell

attribute [vir_export] Tunnell.tunnell Tunnell.congruentUpTo
