"""Figure 13 and the numbers of section 4.13: Lean's division as it is and with the fused multiply-and-subtract.

bench/out/acarreo-div-<platform>.json (acarreo.cpp natively, wasm/mide.mjs in Node and in browsers). Drawn: one
division of a 131,072-bit number by a 65,536-bit one, as Lean does it and fused in one pass (`sub`, no compiler
barrier). Orange is Lean's code as it is, aqua the change, as in figures 10 and 12.

Run: python bench/experimentos/kernel/acarreo/figura_division.py
"""
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
ORANGE, AQUA = "#eb6834", "#1baf7a"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})

PLATFORMS = [
    ("x86-gcc", "x86-64 native, GCC"), ("x86-leanclang", "x86-64 native, Lean's clang"), ("x86-node", "x86-64 Wasm, Node"),
    ("arm64-systemclang", "ARM64 native, system clang"), ("arm64-leanclang", "ARM64 native, Lean's clang"),
    ("arm64-node", "ARM64 Wasm, Node"), ("arm64-chrome", "ARM64 Wasm, Chrome"), ("arm64-firefox", "ARM64 Wasm, Firefox"),
    ("arm64-safari", "ARM64 Wasm, Safari"),
]


def lee(k):
    with open(os.path.join(RAIZ, "bench", "out", f"acarreo-div-{k}.json"), encoding="utf-8") as h:
        pts = json.load(h)["points"]
    assert all(p["checked"] for p in pts), k
    return pts


rows = []
print("platform | 65,536 bits: as it is, fused, fused+barrier (ms) | faster by, 4,096 -> 65,536 bits: fused; fused+barrier; § 4.11 change")
for k, name in PLATFORMS:
    p = lee(k)
    f = lambda key: [x["div_lean_us"] / x[key] for x in p]
    last = p[-1]
    print(f"  {name} | {last['div_lean_us'] / 1000:.2f}, {last['div_sub_us'] / 1000:.2f}, {last['div_subb_us'] / 1000:.2f} | "
          f"{min(f('div_sub_us')):.2f}-{max(f('div_sub_us')):.2f}; {min(f('div_subb_us')):.2f}-{max(f('div_subb_us')):.2f}; "
          f"{min(f('div_fix_us')):.2f}-{max(f('div_fix_us')):.2f}")
    rows.append((name, last["div_lean_us"] / 1000, last["div_sub_us"] / 1000))

fig, ax = plt.subplots(figsize=(7.6, 4.6))
ys = list(range(len(rows)))[::-1]
h = 0.36
for y, (name, a, b) in zip(ys, rows):
    ax.barh(y + h / 2 + 0.01, a, height=h, color=ORANGE, edgecolor=SURF, linewidth=2)
    ax.barh(y - h / 2 - 0.01, b, height=h, color=AQUA, edgecolor=SURF, linewidth=2)
    ax.text(a + 0.15, y + h / 2, f"{a:.1f} ms", va="center", fontsize=8, color=TXT2)
    ax.text(b + 0.15, y - h / 2, f"{b:.1f} ms  ({a / b:.1f}× faster)", va="center", fontsize=8, color=TXT)
ax.set_yticks(ys)
ax.set_yticklabels([r[0] for r in rows])
ax.set_xlim(0, 20)
ax.set_xlabel("one division of a 131,072-bit number by a 65,536-bit one (ms)")
ax.grid(axis="x", color=GRID, lw=0.8)
ax.tick_params(axis="y", length=0)
ax.legend(handles=[plt.Rectangle((0, 0), 1, 1, color=ORANGE), plt.Rectangle((0, 0), 1, 1, color=AQUA)],
          labels=["Lean's mpn_div as it is", "multiply-and-subtract fused in one pass"], frameon=False,
          loc="lower left", bbox_to_anchor=(0, 1.0), ncol=2, fontsize=8, borderaxespad=0.2)
ax.set_title("Lean's GMP-free division, natively and in WebAssembly", loc="left", pad=22)
fig.tight_layout()
salida = os.path.join(RAIZ, "docs", "figuras", "13-division-fusionada.svg")
fig.savefig(salida)
print("written", os.path.relpath(salida, RAIZ))
