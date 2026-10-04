"""Figure 11 and the numbers of section 4.10: the arithmetic of section 4.7 in three browsers.

Lean in WebAssembly (lean-vir), the same Arith.irpkg, timed the same way in Node
(bench/out/aritmetica-2026-10-03.json) and in a module Worker of Chrome, Firefox and Safari on the same
machine (bench/out/aritmetica-<browser>.json, from bench/navegador/aritmetica.html). Drawn: how many times
faster than Node each browser runs one operation (Node's time / the browser's), from 4,096 bits, where
the cost of the call is negligible. One panel per operation; three hues as the palette validates (the
same three as figure 10), the gray line is Node.

Run: python bench/experimentos/figura_navegadores.py
"""
import json
import math
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
NAVS = [("chrome", "Chrome", "#2a78d6"), ("firefox", "Firefox", "#eb6834"), ("safari", "Safari", "#1baf7a")]
OPS = [("mul", "multiplication"), ("div", "division, 2n by n bits"), ("gcd", "gcd")]
FROM = 4096
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})


def lee(nombre):
    with open(os.path.join(RAIZ, "bench", "out", nombre), encoding="utf-8") as h:
        pts = json.load(h)["points"]
    assert all(p["checked"] for p in pts), nombre
    return {(p["engine"], p["op"], p["bits"]): p["perOpUs"] for p in pts}


def slope(pts):
    xs, ys = [math.log(b) for b, _ in pts], [math.log(t) for _, t in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)


node = lee("aritmetica-2026-10-03.json")
nav = {k: lee(f"aritmetica-{k}.json") for k, _, _ in NAVS}
BITS = [b for b in (4096, 8192, 16384, 32768, 65536)]

# the numbers for the report
print("exponents k from 4,096 bits (Lean in WebAssembly): engine mul div gcd")
for k, d in [("node", node)] + list(nav.items()):
    print(" ", k, " ".join(f"{slope([(b, d[('wasm', op, b)]) for b in BITS]):.2f}" for op, _ in OPS))
print("time per operation at 65,536 bits (µs), Lean in WebAssembly: node chrome firefox safari")
for op in ("add", "mul", "div", "mod", "gcd"):
    print(" ", op, " ".join(f"{d[('wasm', op, 65536)]:.0f}" for d in [node] + list(nav.values())))
print("Node's time / the browser's, 4,096 to 65,536 bits (min-max):")
for op in ("mul", "div", "mod", "gcd"):
    for k, name, _ in NAVS:
        r = [node[("wasm", op, b)] / nav[k][("wasm", op, b)] for b in BITS]
        print(f"  {op} {name}: {min(r):.2f}-{max(r):.2f}")
print("this browser's BigInt, Node's time / the browser's, at 16,384 and 65,536 bits:")
for op in ("mul", "div"):
    for k, name, _ in NAVS:
        print(f"  {op} {name}: " + " ".join(f"{node[('js', op, b)] / nav[k][('js', op, b)]:.2f}" for b in (16384, 65536)))
print("one call with no arithmetic ('base'), 64 bits (µs): " + " ".join(f"{k} {d[('wasm', 'base', 64)]:.2f}" for k, d in nav.items())
      + f" | node {node[('wasm', 'base', 64)]:.2f}")

fig, axs = plt.subplots(1, 3, figsize=(9.6, 3.3), sharey=True)
for ax, (op, title) in zip(axs, OPS):
    ax.axhline(1, color=TXT2, lw=1.2, ls=(0, (4, 3)))
    for k, name, color in NAVS:
        ys = [node[("wasm", op, b)] / nav[k][("wasm", op, b)] for b in BITS]
        ax.plot(BITS, ys, color=color, lw=2, marker="o", ms=5, mec=SURF, mew=1.5, label=name)
    ax.set_xscale("log", base=2)
    ax.set_xticks(BITS)
    ax.set_xticklabels(["4k", "8k", "16k", "32k", "64k"])
    ax.set_title(title, loc="left")
    ax.set_xlabel("operand size (bits)")
    ax.grid(axis="y", color=GRID, lw=0.8)
axs[0].set_ylabel("times faster than Node")
axs[0].set_ylim(0.8, 1.8)
axs[0].text(BITS[-1], 0.97, "Node", color=TXT2, fontsize=8, ha="right", va="top")
axs[2].legend(frameon=False, loc="upper left")
fig.tight_layout()
salida = os.path.join(RAIZ, "docs", "figuras", "11-navegadores.svg")
fig.savefig(salida)
print("written", os.path.relpath(salida, RAIZ))
