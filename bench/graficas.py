"""Figures for docs/REPORT.md, from the measured data in bench/out/ and tests/out/.

Palette: the validated reference palette, first three categorical slots (native blue, WebAssembly
orange, JavaScript aqua; all-pairs CVD dE >= 9.2, normal-vision dE >= 24.0 on #fcfcfb). Aqua is below
3:1 against the surface, so every figure carries direct labels, a distinct marker per engine (circle,
square, triangle) and the report has the numbers in tables.

Run: python bench/graficas.py   -> docs/figuras/*.svg and docs/tabla.md
"""
import json
import os
import statistics as st

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
OUT = os.path.join(RAIZ, "docs", "figuras")
os.makedirs(OUT, exist_ok=True)

SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
MOTOR = {"nativo": ("native Lean", "#2a78d6", "o"), "wasm": ("Lean in WebAssembly (lean-vir)", "#eb6834", "s"),
         "js": ("hand-written JavaScript", "#1baf7a", "^")}
NOMBRE = {"tunnell": "Tunnell counts", "collatzRecord": "Collatz record", "primeCount": "prime sieve π(N)",
          "mertens": "Mertens M(N)", "partitions": "partitions p(n), printed", "partitionsBits": "partitions p(n), not printed",
          "fib": "Fibonacci F(n), printed", "fibBits": "Fibonacci F(n), not printed", "isPrime": "Miller–Rabin (bits)",
          "lifePopulation": "Life B37/S2378 (generations)"}
ORDEN = ["tunnell", "collatzRecord", "primeCount", "mertens", "lifePopulation", "partitionsBits", "partitions",
         "fibBits", "fib", "isPrime"]

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     # fixed ids: the same data gives the same SVG bytes
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})


def lee(p):
    with open(os.path.join(RAIZ, p), encoding="utf-8") as h:
        return json.load(h)


filas = [f for f in lee("bench/out/node.json")["filas"] + lee("bench/out/nativo.json")["filas"] if "ms" in f]
med = {(f["w"], f["x"], f["motor"]): st.median(f["ms"]) for f in filas}
disp = {(f["w"], f["x"], f["motor"]): (min(f["ms"]), max(f["ms"])) for f in filas}


def guarda(fig, nombre):
    fig.savefig(os.path.join(OUT, nombre), bbox_inches="tight", metadata={"Date": None})   # no timestamp inside
    plt.close(fig)
    print("wrote", nombre)


# ---- 1. what the interpreter costs: time relative to native, at the largest size all three ran ----
fig, ax = plt.subplots(figsize=(7.2, 4.4))
filas_f1 = []
for w in ORDEN:
    xs = sorted({x for (ww, x, m) in med if ww == w and all((w, x, mm) in med for mm in MOTOR)})
    if not xs:
        continue
    x = xs[-1]
    filas_f1.append((w, x, med[(w, x, "wasm")] / med[(w, x, "nativo")], med[(w, x, "js")] / med[(w, x, "nativo")]))
ys = range(len(filas_f1))
ax.axvline(1, color=MOTOR["nativo"][1], lw=2)
ax.text(1, -0.75, " native = 1", color=MOTOR["nativo"][1], va="bottom", fontsize=8)
for i, (w, x, rw, rj) in enumerate(filas_f1):
    ax.plot([min(rw, rj, 1), max(rw, rj, 1)], [i, i], color=GRID, lw=1, zorder=0)
    for r, m in ((rw, "wasm"), (rj, "js")):
        ax.plot(r, i, MOTOR[m][2], color=MOTOR[m][1], ms=8, mec=SURF, mew=1.5, zorder=3)
    ax.text(rw * 1.25, i, f"{rw:,.0f}×" if rw >= 10 else f"{rw:.1f}×", va="center", fontsize=8, color=TXT)
    if rj >= 1:   # right of the native line: label on the right, clear of the line
        ax.text(rj * 1.25, i, f"{rj:.2g}×", va="center", ha="left", fontsize=8, color=TXT2)
    else:
        ax.text(rj / 1.25, i, f"{rj:.2g}×", va="center", ha="right", fontsize=8, color=TXT2)
ax.set_yticks(list(ys), [f"{NOMBRE[w]}  (x = {x:,})" for (w, x, _, _) in filas_f1])
ax.set_xscale("log")
ax.set_xlim(3e-4, 2e3)
ax.set_ylim(len(filas_f1) - 0.4, -1.0)
ax.set_xlabel("time relative to native Lean (log scale; left of the blue line = faster than native)")
ax.grid(axis="x", color=GRID, lw=0.8)
ax.set_title("What running Lean in the browser costs, per workload (Node, one machine)", loc="left", pad=26)
h = [plt.Line2D([], [], marker=MOTOR[m][2], color=MOTOR[m][1], ls="", ms=8, label=MOTOR[m][0]) for m in ("wasm", "js")]
ax.legend(handles=h, frameon=False, loc="lower left", bbox_to_anchor=(0, 1.0), ncol=2, fontsize=8)
guarda(fig, "1-coste-por-carga.svg")

# ---- 2. scaling: time against size, one panel per workload ----
fig, axs = plt.subplots(2, 5, figsize=(11, 4.6), constrained_layout=True)
for ax, w in zip(axs.flat, ORDEN):
    for m in MOTOR:
        pts = sorted((x, med[(w, x, m)]) for (ww, x, mm) in med if ww == w and mm == m)
        if pts:
            ax.plot([p[0] for p in pts], [p[1] for p in pts], marker=MOTOR[m][2], color=MOTOR[m][1], lw=2, ms=5,
                    mec=SURF, mew=1)
            lo = [disp[(w, p[0], m)][0] for p in pts]; hi = [disp[(w, p[0], m)][1] for p in pts]
            ax.fill_between([p[0] for p in pts], lo, hi, color=MOTOR[m][1], alpha=0.12, lw=0)
    ax.set_xscale("log"); ax.set_yscale("log")
    ax.set_title(NOMBRE[w], fontsize=8.5, loc="left")
    ax.grid(color=GRID, lw=0.6)
    ax.tick_params(labelsize=7)
for ax in axs[:, 0]:
    ax.set_ylabel("ms (median; band = min–max)")
h = [plt.Line2D([], [], marker=MOTOR[m][2], color=MOTOR[m][1], lw=2, ms=6, label=MOTOR[m][0]) for m in MOTOR]
fig.legend(handles=h, loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.07), fontsize=8.5)
fig.suptitle("How each engine scales with the size of the problem (log–log)", y=1.12, fontsize=10, fontweight="bold")
guarda(fig, "2-escalado.svg")

# ---- 3. printing, not multiplying: F(10^6) with and without its decimal expansion ----
fig, ax = plt.subplots(figsize=(6.2, 3.2))
grupos = [("fibBits", "compute F(10⁶) only"), ("fib", "compute and print its 208,988 digits")]
ancho = 0.26
for j, m in enumerate(MOTOR):
    for i, (w, _) in enumerate(grupos):
        v = med.get((w, 1000000, m))
        if v is None:
            continue
        xpos = i + (j - 1) * ancho
        ax.bar(xpos, v, ancho * 0.9, color=MOTOR[m][1], label=MOTOR[m][0] if i == 0 else None, edgecolor=SURF, lw=1)
        ax.text(xpos, v * 1.15, f"{v:,.0f} ms" if v >= 10 else f"{v:.1f} ms", ha="center", fontsize=7.5)
ax.set_xticks(range(len(grupos)), [g[1] for g in grupos])
ax.set_yscale("log"); ax.set_ylabel("ms (log scale)")
ax.grid(axis="y", color=GRID, lw=0.6)
ax.set_title("F(10⁶): native Lean multiplies fast and prints slowly", loc="left")
ax.legend(frameon=False, fontsize=7.5, loc="upper left")
guarda(fig, "3-imprimir-vs-calcular.svg")

# ---- 4. the page stays responsive only with the Web Worker ----
nav = {p: lee(f"bench/out/navegador-{p}.json") for p in ("normal-worker", "normal-principal", "lenta-principal")}
fig, ax = plt.subplots(figsize=(6.4, 2.4))
etiquetas = [("normal-worker", "Web Worker, full CPU speed"), ("normal-principal", "main thread, full CPU speed"),
             ("lenta-principal", "main thread, CPU slowed 4×")]
for i, (k, et) in enumerate(etiquetas):
    v = nav[k]["hiloPrincipal"]["huecoMaxMs"]
    ax.barh(i, v, color=MOTOR["wasm"][1] if "principal" in k else MOTOR["js"][1], height=0.6, edgecolor=SURF)
    ax.text(v * 1.2, i, f"{v / 1000:.1f} s" if v > 1000 else f"{v:.1f} ms  (one frame at 60 Hz)", va="center", fontsize=8)
ax.set_yticks(range(3), [e for _, e in etiquetas]); ax.invert_yaxis()
ax.set_xscale("log"); ax.set_xlim(5, 2e6)
ax.set_xlabel("longest time the page could not draw a frame (log scale)")
ax.grid(axis="x", color=GRID, lw=0.6)
ax.set_title("Running the whole benchmark in Chrome: the page never freezes with a Worker", loc="left")
guarda(fig, "4-la-pagina-no-se-congela.svg")

# ---- 5. cold start ----
fig, ax = plt.subplots(figsize=(6.4, 2.2))
fases = [("importJs", "import the JS runtime"), ("fetch", "download .wasm + packages"), ("runtime", "compile + load packages"),
         ("primeraLlamada", "first call")]
colores = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
for i, (k, et) in enumerate([("normal-worker", "full CPU speed"), ("lenta-principal", "CPU slowed 4×")]):
    izq = 0
    for (f, fe), c in zip(fases, colores):
        v = nav[k]["frio"][f]
        ax.barh(i, v, left=izq, color=c, height=0.55, edgecolor=SURF, lw=2, label=fe if i == 0 else None)
        izq += v
    ax.text(izq + 3, i, f"{izq:.0f} ms", va="center", fontsize=8)
ax.set_yticks([0, 1], ["full CPU speed", "CPU slowed 4×"]); ax.invert_yaxis()
ax.set_xlabel("ms from starting the worker to the first answer (local server: download is near zero)")
ax.grid(axis="x", color=GRID, lw=0.6)
ax.legend(frameon=False, fontsize=7.5, ncol=2, loc="upper center", bbox_to_anchor=(0.5, -0.45))
ax.set_title("Cold start of the Lean runtime in Chrome", loc="left")
guarda(fig, "5-arranque-en-frio.svg")

# ---- 6. the mathematics: Tunnell's criterion by residue class mod 8 ----
lineas = [l.split() for l in open(os.path.join(RAIZ, "tests/out/nativo.txt"), encoding="utf-8")]
por = {}
for n, f, s, crit, sq in lineas:
    n = int(n)
    if sq == "true":
        a, b = por.get(n % 8, (0, 0))
        por[n % 8] = (a + (crit == "true"), b + 1)
fig, ax = plt.subplots(figsize=(6.4, 2.8))
clases = sorted(por)
vals = [100 * por[c][0] / por[c][1] for c in clases]
ax.bar(range(len(clases)), vals, color="#2a78d6", width=0.6, edgecolor=SURF)
for i, c in enumerate(clases):
    ax.text(i, vals[i] + 2, f"{vals[i]:.0f}%\n({por[c][0]:,} of {por[c][1]:,})", ha="center", fontsize=7.5)
ax.set_xticks(range(len(clases)), [f"n ≡ {c}" for c in clases])
ax.set_ylim(0, 125); ax.set_ylabel("% satisfying the criterion")
ax.grid(axis="y", color=GRID, lw=0.6)
ax.set_title("Squarefree n ≤ 10,000 satisfying Tunnell's criterion, by n mod 8", loc="left")
guarda(fig, "6-tunnell-por-clase.svg")

# ---- 7. what one call from JavaScript costs (Node; bench/medir-llamada.mjs) ----
ll = {r["caso"]: r for r in lee("bench/out/llamada-node.json")["filas"]}
largos = [100, 10000, 1000000]
fig, (ax, bx) = plt.subplots(1, 2, figsize=(10.4, 3.8), gridspec_kw={"width_ratios": [1.1, 1], "wspace": 0.45})
ident = ll["ident"]["lean"]["usPorLlamada"]
ax.axhline(ident, color=TXT2, lw=1, ls=(0, (4, 3)))
ax.text(1.5e6, ident * 1.3, f"Nat in, Nat out: {ident:.1f} µs", ha="right", va="bottom", fontsize=7.5, color=TXT2)
for clave, et, c, m, dy in [("strLength", "string in", "#2a78d6", "o", -6), ("echo", "string in and out", "#1baf7a", "^", 6),
                            ("fill", "string built in Lean, out", "#eb6834", "s", 0)]:
    ys = [ll[f"{clave} {n}"]["lean"]["usPorLlamada"] for n in largos]
    ax.plot(largos, ys, "-", color=c, lw=2, label=et)
    ax.plot(largos, ys, m, color=c, ms=7, mec=SURF, mew=1.5)
    ax.annotate(f"{ys[-1] / 1000:.1f} ms", (largos[-1], ys[-1]), xytext=(7, dy), textcoords="offset points", va="center", fontsize=7.5)
ax.set_xscale("log"); ax.set_yscale("log"); ax.set_xlim(60, 6e6); ax.set_ylim(0.8, 6e5)
ax.set_xticks(largos, ["100", "10,000", "1,000,000"])
ax.set_yticks([1, 10, 100, 1e3, 1e4, 1e5], ["1 µs", "10 µs", "100 µs", "1 ms", "10 ms", "100 ms"])
ax.set_xlabel("string length (characters)"); ax.set_ylabel("time per call")
ax.grid(color=GRID, lw=0.6); ax.legend(frameon=False, fontsize=7.5, loc="upper left")
ax.set_title("Time per call", loc="left")
casos = [("ident", "Nat in, Nat out"), ("strLength 10000", "string in"), ("echo 10000", "string in and out"),
         ("fill 10000", "string built in Lean, out")]
for i, (k, et) in enumerate(casos):
    izq = 0
    for (f, fe), c in zip([("marshalUs", "arguments into Wasm"), ("executeUs", "Lean runs"), ("decodeUs", "result back to JS")],
                          ["#eda100", "#e87ba4", "#008300"]):
        v = ll[k]["fases"][f]
        bx.barh(i, v, left=izq, color=c, height=0.55, edgecolor=SURF, lw=2, label=fe if i == 0 else None)
        izq += v
    bx.text(izq * 1.25, i, f"{izq:.1f} µs" if izq < 1000 else f"{izq / 1000:.1f} ms", va="center", fontsize=7.5)
bx.set_xscale("log"); bx.set_xlim(0.1, 3e4)
bx.set_yticks(range(len(casos)), [et for _, et in casos]); bx.invert_yaxis()
bx.set_xticks([0.1, 1, 10, 100, 1e3, 1e4], ["0.1 µs", "1 µs", "10 µs", "100 µs", "1 ms", "10 ms"])
bx.set_xlabel("time per call, by phase (strings of 10,000 characters)")
bx.grid(axis="x", color=GRID, lw=0.6); bx.legend(frameon=False, fontsize=7.5, loc="upper right")
bx.set_title("Where the time goes", loc="left")
guarda(fig, "7-coste-por-llamada.svg")

# ---- the numbers, as a table for the report ----
with open(os.path.join(RAIZ, "docs", "tabla.md"), "w", encoding="utf-8", newline="\n") as h:
    h.write("| workload | size | native (ms) | WebAssembly (ms) | JavaScript (ms) | WASM ÷ native | WASM ÷ JS |\n|---|--:|--:|--:|--:|--:|--:|\n")
    for w in ORDEN:
        for x in sorted({x for (ww, x, m) in med if ww == w}):
            v = [med.get((w, x, m)) for m in ("nativo", "wasm", "js")]
            f = lambda z: "–" if z is None else (f"{z:,.3f}" if z < 1 else f"{z:,.1f}")
            fr = lambda r: f"{r:,.1f}" if r < 10 else f"{r:,.0f}"   # one decimal below 10: 1.6 must not read as 2
            r1 = fr(v[1] / v[0]) if v[0] and v[1] else "–"
            r2 = fr(v[1] / v[2]) if v[2] and v[1] and v[2] > 0.001 else "–"
            h.write(f"| {NOMBRE[w]} | {x:,} | {f(v[0])} | {f(v[1])} | {f(v[2])} | {r1} | {r2} |\n")
print("wrote docs/tabla.md")
