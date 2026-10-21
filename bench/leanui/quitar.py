"""Copy a Lean source without `import Lean`, the lean-vir import and the `attribute [vir_export]` command
(with its indented continuation lines). Nothing else changes.

  python3 bench/leanui/quitar.py <source.lean> <copy.lean>

The workloads only need core Lean; `import Lean` is there for lean-vir's attribute. Without it the program
links against Init, Std and the runtime only, as a LeanUI app does. comparar_c.py checks that the workload
functions compile to the same C as in this repository.
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
out, skip = [], False
for line in open(src, encoding="utf-8"):
    if skip and line.startswith((" ", "\t")) and line.strip():
        continue
    skip = False
    if line.rstrip("\n") in ("public import Lean", "meta import Vir.Attributes"):
        continue
    if line.startswith("attribute [vir_export]"):
        skip = True
        continue
    out.append(line)
open(dst, "w", encoding="utf-8", newline="").write("".join(out))
