"""Figure 9: what Karatsuba and a shorter AND would buy in Lean's GMP-free big-number code.

Left: multiplication. GMP (native Lean), Lean's own mpn_mul compiled natively without GMP and the same
code running in WebAssembly (lean-vir) - the two coincide from 8,192 bits up, so the gap to GMP is the
algorithm -, and Karatsuba's method on top of mpn_mul. GMP and WebAssembly are timed through Lean and
include its cost per operation, so they are drawn from 4,096 bits, where that cost is negligible.
Right: AND of a big number with a two-limb mask, as Lean does it now (walking the longer operand) and
walking the shorter one.
Three hues per panel, as the palette validates (blue, orange, aqua); the WebAssembly series shares the
orange of the code it runs and is told apart by its hollow markers and its label.

Run: python bench/experimentos/mpn/figura.py   -> docs/figuras/9-karatsuba-and.svg
"""
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})


def lee(p):
    with open(os.path.join(RAIZ, p), encoding="utf-8") as h:
        return json.load(h)


m = lee("bench/out/mpn-karatsuba-2026-10-03.json")["points"]
a = lee("bench/out/aritmetica-2026-10-03.json")["points"]
gmp = {p["bits"]: p["perOpUs"] for p in a if p["engine"] == "native" and p["op"] == "mul"}
wasm = {p["bits"]: p["perOpUs"] for p in a if p["engine"] == "wasm" and p["op"] == "mul"}

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.6, 3.8))

def line(ax, xs, ys, color, marker, label, hollow=False, dashed=False):
    ax.plot(xs, ys, color=color, marker=marker, markersize=5 if hollow else 4, linewidth=2,
            linestyle="--" if dashed else "-", markerfacecolor=SURF if hollow else color, markeredgewidth=1.4)
    ax.annotate(label, (xs[-1], ys[-1]), textcoords="offset points", xytext=(5, 0), fontsize=8, color=TXT2, va="center")

bits = [p["bits"] for p in m]
# GMP and WebAssembly are timed through Lean (Arith.run), which adds Lean's own cost per operation
# (~0.3 µs); the C++ series time the bare call. Below a few thousand bits that cost would dominate, so
# the Lean-timed series start at 4,096 bits.
FROM = 4096
gb = sorted(b for b in gmp if b >= FROM)
line(ax1, gb, [gmp[b] for b in gb], BLUE, "o", "GMP (native Lean)")
line(ax1, bits, [p["mul_schoolbook_us"] for p in m], ORANGE, "s", "Lean's mpn_mul, native")
wb = sorted(b for b in wasm if b >= FROM)
line(ax1, wb, [wasm[b] for b in wb], ORANGE, "s", "same, in WebAssembly", hollow=True, dashed=True)
line(ax1, bits, [p["mul_karatsuba_us"] for p in m], AQUA, "^", "Karatsuba on mpn_mul")
ax1.set_title("multiplication, no GMP: schoolbook or Karatsuba")
ax1.set_ylabel("µs per multiplication")

line(ax2, bits, [p["and_longer_us"] for p in m], ORANGE, "s", "walks the longer (now)")
line(ax2, bits, [p["and_shorter_us"] for p in m], AQUA, "^", "walks the shorter")
ax2.set_title("a & (2⁶⁴ − 1): AND with a small mask")
ax2.set_ylabel("µs per AND")

for ax in (ax1, ax2):
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    ax.set_xlabel("operand size (bits)")
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlim(right=ax.get_xlim()[1] * 9)   # room for the direct labels
fig.tight_layout()
out = os.path.join(RAIZ, "docs", "figuras", "9-karatsuba-and.svg")
fig.savefig(out, bbox_inches="tight", metadata={"Date": None})
if os.environ.get("PREVIEW_PNG"):   # a PNG copy to look at while editing
    fig.savefig(os.environ["PREVIEW_PNG"], bbox_inches="tight")
print("wrote", out)
