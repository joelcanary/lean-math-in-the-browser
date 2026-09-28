import Tunnell
import Bench

/-!
Native command-line runner: the same Lean code as the browser build, compiled to machine code by
the ordinary Lean compiler. The tests compare its output with the WebAssembly build (lean-vir) and
with independent Python references; the benchmark uses its in-process timings as the native baseline.

  tunnell_cli <from> <to>             one line per n: `n first second criterion squarefree`
  tunnell_cli --ns n1 n2 …            the same for the listed n
  tunnell_cli --list <limit>          the output of `Tunnell.congruentUpTo`
  tunnell_cli --eval <workload> <arg> the value of one workload
  tunnell_cli --time <workload> <arg> <reps>   value, one line per repetition (nanoseconds), then
                                               `mismatches k`: repetitions whose value differs from the first
-/

def linea (n : Nat) : String :=
  let v := Tunnell.tunnell n
  s!"{v.n} {v.first} {v.second} {v.criterion} {v.squarefree}"

/-- Every workload as `Nat → String`, with the value printed exactly (big numbers in decimal). -/
def workload : String → Option (Nat → String)
  | "tunnell" => some fun n => let v := Tunnell.tunnell n; s!"{v.first} {v.second} {v.criterion}"
  | "collatzRecord" => some fun n => let (a, b) := Bench.collatzRecord n; s!"{a} {b}"
  | "primeCount" => some fun n => toString (Bench.primeCount n)
  | "mertens" => some fun n => toString (Bench.mertens n)
  | "partitions" => some fun n => toString (Bench.partitions n)
  | "fib" => some fun n => toString (Bench.fib n)
  -- the same number without its decimal expansion: separates multiplication from printing
  | "fibBits" => some fun n => toString (Bench.fibBits n)
  | "partitionsBits" => some fun n => toString (Bench.partitionsBits n)
  | "isPrime" => some fun n => toString (Bench.isPrime n)
  | "lifePopulation" => some fun n => toString (Bench.lifePopulation n)
  | _ => none

def main (args : List String) : IO UInt32 := do
  match args with
  | ["--list", m] =>
    IO.println (" ".intercalate ((Tunnell.congruentUpTo m.toNat!).toList.map toString)); return 0
  | "--ns" :: ns => for s in ns do IO.println (linea s.toNat!)
                    return 0
  | ["--eval", w, a] =>
    match workload w with
    | some f => IO.println (f a.toNat!); return 0
    | none => IO.eprintln s!"unknown workload {w}"; return 1
  | ["--time", w, a, reps] =>
    match workload w with
    | none => IO.eprintln s!"unknown workload {w}"; return 1
    | some f =>
      let n := a.toNat!
      let mut valor := ""
      let mut distintos := 0
      let mut tiempos : Array Nat := #[]
      for i in [0:reps.toNat!] do
        let t0 ← IO.monoNanosNow
        -- `f n` is recomputed each time: the argument comes from the command line, so the
        -- compiler cannot hoist the call out of the loop
        let v := f n
        -- force the whole string before stopping the clock
        if v.length == 0 then IO.println "" else pure ()
        let t1 ← IO.monoNanosNow
        -- every repetition is compared with the first one, outside the clock; the runner checks the
        -- first against the reference, so every timed call is checked
        if i == 0 then valor := v else if v != valor then distintos := distintos + 1
        tiempos := tiempos.push (t1 - t0)
      IO.println valor
      for t in tiempos do IO.println (toString t)
      IO.println s!"mismatches {distintos}"
      return 0
  | [a, b] => for n in [a.toNat!:b.toNat! + 1] do IO.println (linea n)
              return 0
  | _ => IO.eprintln "usage: see the header of Main.lean"; return 1
