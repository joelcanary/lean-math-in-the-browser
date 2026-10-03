module

public import Lean
meta import Vir.Attributes

/-!
# Big-number arithmetic, one operation at a time

`Bench.lean` mixes arithmetic with the rest of each algorithm. This file isolates it, to see how each
operation on `Nat` grows with the size of its operands — natively (GMP) and in WebAssembly, where
lean-vir's runtime uses Lean's portable fallback instead of GMP.

`run op bits reps` builds four pairs of `bits`-bit numbers from a 64-bit linear congruential
generator, applies one operation `reps` times (cycling through the pairs) and returns the sum of the
low 64 bits of the results, mod 2⁶⁴: a small number that checks every operation without printing a
big one. The operations: `0` add, `1` multiply, `2` divide and `3` remainder (a `2·bits`-bit dividend
by a `bits`-bit divisor, as in a modular reduction), `4` gcd, `5` none (the cost of the loop alone).

The harness subtracts `run op bits 0` (building the operands) and the cost of operation `5`, so what
remains is the operation. An independent Python version is `bench/experimentos/aritmetica_ref.py`.
Every loop is structural recursion on an explicit bound; core Lean only.
-/

public section

namespace Arith

/-- One step of a 64-bit linear congruential generator (Knuth's MMIX constants). -/
def lcg (s : Nat) : Nat := (s * 6364136223846793005 + 1442695040888963407) % 18446744073709551616

/-- `k` chunks of 64 bits from the generator, most significant first. -/
def chunks : Nat → Nat → Nat → Nat
  | 0, _, acc => acc
  | k + 1, s, acc => let s' := lcg s; chunks k s' (acc * 18446744073709551616 + s')

/-- A number of exactly `bits` bits (the top one set), from seed `s`. -/
def operand (bits s : Nat) : Nat :=
  let top := 2 ^ (bits - 1)
  chunks ((bits + 63) / 64) s 0 % top + top

/-- The four operand pairs; division and remainder get a dividend twice as wide as the divisor. -/
def pairs (op bits : Nat) : Array (Nat × Nat) :=
  let w := if op == 2 || op == 3 then 2 * bits else bits
  #[(operand w 1, operand bits 2), (operand w 3, operand bits 4),
    (operand w 5, operand bits 6), (operand w 7, operand bits 8)]

def apply (op a b : Nat) : Nat :=
  match op with
  | 0 => a + b
  | 1 => a * b
  | 2 => a / b
  | 3 => a % b
  | 4 => Nat.gcd a b
  | _ => a

def mask : Nat := 18446744073709551615

/-- `k` operations, tail-recursive (the IR interpreter in WebAssembly does not grow its stack). -/
def loop (op : Nat) (ps : Array (Nat × Nat)) : Nat → Nat → Nat → Nat
  | 0, _, acc => acc
  | k + 1, i, acc =>
    let p := ps[i % 4]!
    loop op ps k (i + 1) ((acc + (apply op p.1 p.2 &&& mask)) &&& mask)

def run (op bits reps : Nat) : Nat := loop op (pairs op bits) reps 0 0

/-! ## Kernel-evaluated spot checks (values from the independent Python reference) -/

example : run 0 64 3 = 13175822430149572235 := by decide +kernel
example : run 1 64 3 = 7760526006223855822 := by decide +kernel
example : run 2 64 3 = 1491219073003049708 := by decide +kernel
example : run 3 64 3 = 2126516373256037175 := by decide +kernel
example : run 4 64 3 = 3 := by decide +kernel
example : run 1 130 5 = 11806621334715605638 := by decide +kernel
example : run 3 130 5 = 524234795059630303 := by decide +kernel

end Arith

attribute [vir_export] Arith.run
