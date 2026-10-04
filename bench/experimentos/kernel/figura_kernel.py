"""Figure 12 and the numbers of section 4.11: Lean's mpn_mul as compiled, and with the carry added last.

Machine A (ARM64): Node, Chrome, Firefox and Safari run mpn_mul.wasm (Lean's code, byte for byte) and
mpn_mul_barrier.wasm (the order Lean's clang emits after the one-line change), from
bench/out/kernel-<engine>.json; native, the same two versions compiled natively (kernel-nativo.json).
Drawn: time of one multiplication at 65,536 bits. Orange is Lean's code as it is, aqua the change, as
in figure 10.

Run: python bench/experimentos/kernel/figura_kernel.py
"""
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
ORANGE, AQUA = "#eb6834", "#1baf7a"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})


def lee(nombre):
    with open(os.path.join(RAIZ, "bench", "out", nombre), encoding="utf-8") as h:
        pts = json.load(h)["points"]
    assert all(p["checked"] for p in pts), nombre
    return {(p["module"], p["bits"]): p["us"] for p in pts}


ENGINES = [("node", "Node"), ("chrome", "Chrome"), ("firefox", "Firefox"), ("safari", "Safari")]
d = {k: lee(f"kernel-{k}.json") for k, _ in ENGINES}
nat = lee("kernel-nativo.json")
x86 = lee("kernel-x86-node.json")
rows = [(name, d[k][("compiled", 65536)], d[k][("barrier", 65536)]) for k, name in ENGINES]
rows.append(("native", nat[("lean", 65536)], nat[("carry_last", 65536)]))

print("65,536 bits, machine A: engine | Lean's code | carry last (compiled) | hand-edited | v_j once | faster by")
for k, name in ENGINES:
    c, b, a, v = (d[k][(m, 65536)] for m in ("compiled", "barrier", "carry_last", "vj_once"))
    print(f"  {name} | {c / 1000:.2f} ms | {b / 1000:.2f} | {a / 1000:.2f} | {v / 1000:.2f} | {c / b:.2f}x")
print(f"  native | {nat[('lean', 65536)] / 1000:.2f} ms | {nat[('carry_last', 65536)] / 1000:.2f} | faster by {nat[('lean', 65536)] / nat[('carry_last', 65536)]:.2f}x")
print("faster by, 4,096 to 65,536 bits (min-max):")
for k, name in ENGINES:
    r = [d[k][("compiled", b)] / d[k][("barrier", b)] for b in (4096, 8192, 16384, 32768, 65536)]
    print(f"  {name}: {min(r):.2f}-{max(r):.2f}")
r = [nat[("lean", b)] / nat[("carry_last", b)] for b in (4096, 8192, 16384, 32768, 65536)]
print(f"  native: {min(r):.2f}-{max(r):.2f}")
print("x86-64 machine, Node, 65,536 bits: Lean's code {:.2f} ms, carry last (compiled) {:.2f} ms, {:.2f}x".format(
    x86[("compiled", 65536)] / 1000, x86[("barrier", 65536)] / 1000, x86[("compiled", 65536)] / x86[("barrier", 65536)]))

fig, ax = plt.subplots(figsize=(7.2, 3.5))
ys = list(range(len(rows)))[::-1]
h = 0.36
for y, (name, c, b) in zip(ys, rows):
    ax.barh(y + h / 2 + 0.01, c / 1000, height=h, color=ORANGE, edgecolor=SURF, linewidth=2)
    ax.barh(y - h / 2 - 0.01, b / 1000, height=h, color=AQUA, edgecolor=SURF, linewidth=2)
    ax.text(c / 1000 + 0.08, y + h / 2, f"{c / 1000:.2f} ms", va="center", fontsize=8, color=TXT2)
    ax.text(b / 1000 + 0.08, y - h / 2, f"{b / 1000:.2f} ms  ({c / b:.2f}× faster)", va="center", fontsize=8, color=TXT)
ax.set_yticks(ys)
ax.set_yticklabels([r[0] for r in rows])
ax.set_xlim(0, 7.6)
ax.set_xlabel("one multiplication of two 65,536-bit numbers (ms)")
ax.grid(axis="x", color=GRID, lw=0.8)
ax.tick_params(axis="y", length=0)
ax.legend(handles=[plt.Rectangle((0, 0), 1, 1, color=ORANGE), plt.Rectangle((0, 0), 1, 1, color=AQUA)],
          labels=["Lean's mpn_mul as compiled", "the carry added last (one-line change)"], frameon=False,
          loc="lower left", bbox_to_anchor=(0, 1.0), ncol=2, fontsize=8, borderaxespad=0.2)
ax.set_title("Lean's GMP-free multiplication on an ARM64 machine", loc="left", pad=22)
fig.tight_layout()
salida = os.path.join(RAIZ, "docs", "figuras", "12-acarreo.svg")
fig.savefig(salida)
print("written", os.path.relpath(salida, RAIZ))
