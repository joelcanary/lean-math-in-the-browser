"""The numbers of the report's LeanUI update (21 October 2026), from the raw results:

  python3 bench/leanui/resumen.py

reads bench/out/leanui-2026-10-21/: nativo.json, leanui.json, node.json (Node) and leanui-chrome.json,
navegador-normal-worker.json (Chrome), all from one session on one machine, and leanui-firefox.json,
navegador-firefox-worker.json, leanui-node-again.json (Firefox, and LeanUI in Node again) from a second (written by bench/medir-*.mjs,
bench/navegador/leanui.html, vir.html and correr.mjs, then copied there so that the files of the
earlier sections stay as published), and prints the tables as Markdown. Every time is the median of the
timed repetitions of a case; ratios are of medians.
"""
import json
import os
import statistics as st

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", "leanui-2026-10-21")
G = st.geometric_mean


def carga(nombre, motor=None):
    p = os.path.join(OUT, nombre)
    if not os.path.exists(p):
        return None
    filas = json.load(open(p, encoding="utf-8"))["filas"]
    res = {}
    for f in filas:
        if motor and f["motor"] != motor:
            continue
        if "error" in f:
            raise SystemExit(f"{nombre}: {f['w']} {f['x']} {f['motor']}: {f['error']}")
        res[(f["w"], f["x"])] = st.median(f["ms"])
    return res


nat = carga("nativo.json")
lui = carga("leanui.json")
vir = carga("node.json", "wasm")
js = carga("node.json", "js")
lui_c = carga("leanui-chrome.json")
vir_c = carga("navegador-normal-worker.json", "wasm")
js_c = carga("navegador-normal-worker.json", "js")

# loops and arrays; big numbers without printing; printed big numbers; the rest
GRUPOS = [
    ("loops and arrays (tunnell, collatzRecord, primeCount, mertens, lifePopulation)",
     ("tunnell", "collatzRecord", "primeCount", "mertens", "lifePopulation")),
    ("big-number additions (partitions, partitionsBits)", ("partitions", "partitionsBits")),
    ("big-number multiplication, not printed (fibBits)", ("fibBits",)),
    ("Miller-Rabin (isPrime)", ("isPrime",)),
    ("printed in decimal (fib), see the note", ("fib",)),
]


def fmt(x):
    return f"{x:.1f}" if x < 10 else f"{x:.0f}"


def rango(rs):
    return f"{fmt(min(rs))}–{fmt(max(rs))}"


print("### Node: every case, time relative to native Lean (lower is faster)\n")
print("| workloads | cases | LeanUI wasm64 ÷ native | lean-vir ÷ native | lean-vir ÷ LeanUI |")
print("|---|--:|--:|--:|--:|")
for nombre, ws in GRUPOS:
    ks = [k for k in nat if k[0] in ws]
    a = [lui[k] / nat[k] for k in ks]
    b = [vir[k] / nat[k] for k in ks]
    c = [vir[k] / lui[k] for k in ks]
    print(f"| {nombre} | {len(ks)} | {rango(a)} | {rango(b)} | {rango(c)} |")
ks = [k for k in nat if k[0] != "fib"]
print(f"| **geometric mean, all but fib** | {len(ks)} | **{G([lui[k] / nat[k] for k in ks]):.2f}** | "
      f"**{G([vir[k] / nat[k] for k in ks]):.1f}** | **{G([vir[k] / lui[k] for k in ks]):.1f}** |")
print(f"\nLeanUI ÷ hand-written JS, geometric mean over the same {len(ks)} cases: "
      f"{G([lui[k] / js[k] for k in ks]):.2f}")

print("\n### Every case (ms, median)\n")
cab = "| workload | x | native | LeanUI (Node) | lean-vir (Node) | JS (Node) |"
if lui_c:
    cab += " LeanUI (Chrome) | lean-vir (Chrome) | JS (Chrome) |"
print(cab)
print("|---|--:|--:|--:|--:|--:|" + ("--:|--:|--:|" if lui_c else ""))
for k in nat:
    fila = f"| `{k[0]}` | {k[1]} | {nat[k]:.3f} | {lui[k]:.3f} | {vir[k]:.2f} | {js[k]:.2f} |"
    if lui_c:
        fila += f" {lui_c[k]:.3f} | " + (f"{vir_c[k]:.2f}" if k in vir_c else "–") + " | " + \
                (f"{js_c[k]:.2f}" if k in js_c else "–") + " |"
    print(fila)

if lui_c:
    print("\n### Chrome against Node, the same build (ratio of medians)\n")
    ks = [k for k in nat if k[0] != "fib" and lui[k] > 0.5]
    print(f"LeanUI Chrome ÷ Node over the {len(ks)} cases above 0.5 ms (all but fib): "
          f"median {st.median([lui_c[k] / lui[k] for k in ks]):.2f}, range {rango([lui_c[k] / lui[k] for k in ks])}")
    comunes = [k for k in vir_c if k[0] != "fib"]
    print(f"In Chrome, on the {len(comunes)} cases both harnesses ran (all but fib): lean-vir ÷ LeanUI geometric mean "
          f"{G([vir_c[k] / lui_c[k] for k in comunes]):.1f}, LeanUI ÷ JS {G([lui_c[k] / js_c[k] for k in comunes]):.2f}")

lui_f = carga("leanui-firefox.json")
vir_f = carga("navegador-firefox-worker.json", "wasm")
lui_2 = carga("leanui-node-again.json")
if lui_f:
    ks = [k for k in nat if k[0] != "fib" and lui[k] > 0.5]
    print("\n### Firefox, the second session\n")
    print(f"LeanUI in Node, second run ÷ first, over the {len(ks)} cases above 0.5 ms: median "
          f"{st.median([lui_2[k] / lui[k] for k in ks]):.2f}, range {min(lui_2[k] / lui[k] for k in ks):.2f}–"
          f"{max(lui_2[k] / lui[k] for k in ks):.2f}")
    print(f"LeanUI Firefox ÷ Node: median {st.median([lui_f[k] / lui[k] for k in ks]):.2f}, range "
          f"{rango([lui_f[k] / lui[k] for k in ks])}; fibBits {', '.join(f'{lui_f[k] / lui[k]:.2f}' for k in ks if k[0] == 'fibBits')}")
    com = [k for k in vir_f if k[0] != "fib" and lui[k] > 0.5]
    print(f"lean-vir ÷ LeanUI on the {len(com)} cases both browser harnesses run that take > 0.5 ms in Node: "
          f"Chrome {G([vir_c[k] / lui_c[k] for k in com]):.1f}, Firefox {G([vir_f[k] / lui_f[k] for k in com]):.1f}, "
          f"Node {G([vir[k] / lui[k] for k in com]):.1f}")
