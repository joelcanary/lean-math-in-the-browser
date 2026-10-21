"""Compare the C that Lean generates for two builds of the same module, function by function.

  python3 bench/leanui/comparar_c.py <original.c> <copy.c> [--solo-inicializadores]

Prints the functions whose bodies differ and those present in only one file. With
--solo-inicializadores it exits with status 1 unless every differing function is a module initializer
(`initialize_*`, `meta_initialize_*`, `runtime_initialize_*`), which is what removing an import changes.
"""
import re
import sys


def funciones(path):
    s = open(path, encoding="utf-8").read()
    # a definition starts at column 0 with a return type and ends at the next column-0 "}"
    patron = r"^(LEAN_EXPORT |static )?[A-Za-z_][\w\* ]*?\b(\w+)\((?:[^;{])*\)\s*\{\n.*?^\}\n"
    return {m.group(2): m.group(0) for m in re.finditer(patron, s, re.M | re.S)}


a, b = funciones(sys.argv[1]), funciones(sys.argv[2])
solo_a, solo_b = sorted(set(a) - set(b)), sorted(set(b) - set(a))
dif = sorted(k for k in set(a) & set(b) if a[k] != b[k])
iguales = len(set(a) & set(b)) - len(dif)
print("%s: %d functions, %d identical, different %s, only in the original %s, only in the copy %s"
      % (sys.argv[1], len(a), iguales, dif, solo_a, solo_b))
if "--solo-inicializadores" in sys.argv:
    ini = re.compile(r"^(meta_|runtime_)?initialize_")
    sys.exit(0 if not solo_a and not solo_b and all(ini.match(k) for k in dif) else 1)
