"""How each big-number operation grows with operand size: exponents, intervals and one figure.

Input: the JSON written by bench/experimentos/aritmetica.mjs. For every (engine, operation, size) the
time of one operation is (median of the runs with R operations - median of the runs with 0) / R, minus
the same for operation `base` (the loop and the checksum, no arithmetic). If time ~ c * bits^k, then
log t = log c + k log bits: k is the least-squares slope over the sizes from 2048 bits up (below that
the fixed cost of a call and of allocation still shows). The 95 % interval comes from a bootstrap
that resamples, at every point, the 5 runs with R and the 5 with 0 (2,000 resamples, fixed seed).
The local slopes between consecutive sizes show where an implementation changes algorithm.

Run: python bench/experimentos/analizar_aritmetica.py IN.json [FIGURE.svg]
"""
import json
import math
import random
import statistics as st
import sys

ENGINES = ["native", "wasm", "js"]
OPS = ["add", "mul", "div", "mod", "gcd"]
FIT_FROM = 2048


def per_op(withR, without, reps):
    return (st.median(withR) - st.median(without)) / reps * 1000   # µs


def slope(xs, ys):
    lx, ly = [math.log(x) for x in xs], [math.log(y) for y in ys]
    mx, my = sum(lx) / len(lx), sum(ly) / len(ly)
    sxx = sum((a - mx) ** 2 for a in lx)
    return sum((a - mx) * (b - my) for a, b in zip(lx, ly)) / sxx


def main():
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    pts = {(p["engine"], p["op"], p["bits"]): p for p in data["points"]}
    rnd = random.Random(20261003)

    def net(engine, op, bits, resample=False):
        def pick(xs):
            return [rnd.choice(xs) for _ in xs] if resample else xs
        p, b = pts[(engine, op, bits)], pts.get((engine, "base", bits))
        t = per_op(pick(p["withR"]), pick(p["without"]), p["reps"])
        if b is not None:
            t -= per_op(pick(b["withR"]), pick(b["without"]), b["reps"])
        return t

    out = {"fit_from_bits": FIT_FROM, "results": {}}
    print(f"exponent k (time ~ bits^k) from {FIT_FROM} bits up, 95 % bootstrap interval; time at the largest size")
    print("engine | op | k | 95 % CI | largest bits | µs per op | local slopes")
    for e in ENGINES:
        for op in OPS:
            sizes = sorted(bits for (ee, oo, bits) in pts if ee == e and oo == op)
            fit = [s for s in sizes if s >= FIT_FROM]
            ts = {s: net(e, op, s) for s in sizes}
            usable = [s for s in fit if ts[s] > 0]
            if len(usable) < 3:
                continue
            k = slope(usable, [ts[s] for s in usable])
            boots = []
            for _ in range(2000):
                tb = [net(e, op, s, resample=True) for s in usable]
                if min(tb) > 0:
                    boots.append(slope(usable, tb))
            boots.sort()
            lo, hi = boots[int(0.025 * len(boots))], boots[int(0.975 * len(boots)) - 1]
            local = [round(math.log(ts[b] / ts[a]) / math.log(b / a), 2) for a, b in zip(sizes, sizes[1:]) if ts[a] > 0 and ts[b] > 0]
            big = sizes[-1]
            out["results"][f"{e} {op}"] = {"k": k, "ci95": [lo, hi], "sizes": sizes, "us": [ts[s] for s in sizes],
                                           "local_slopes": local, "fit_sizes": usable}
            print(f"{e} | {op} | {k:.2f} | {lo:.2f}-{hi:.2f} | {big} | {ts[big]:.3g} | {local}")
    # how much slower WebAssembly is than native, per operation and size
    print("\nwasm / native, per operation")
    for op in OPS:
        row = []
        for s in data["bits"]:
            if ("wasm", op, s) in pts and ("native", op, s) in pts:
                n, w = net("native", op, s), net("wasm", op, s)
                if n > 0 and w > 0:
                    row.append(f"{s}:{w / n:.0f}x")
        print(op, " ".join(row))
        out.setdefault("wasm_over_native", {})[op] = row
    json.dump(out, open(sys.argv[1].replace(".json", "-analysis.json"), "w", encoding="utf-8"), indent=1)
    if len(sys.argv) > 2:
        figure(out, sys.argv[2])


def figure(out, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
    STYLE = {"native": ("native Lean (GMP)", "#2a78d6", "o"), "wasm": ("Lean in WebAssembly (lean-vir)", "#eb6834", "s"),
             "js": ("JavaScript BigInt", "#1baf7a", "^")}
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                         "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                         "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                         "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})
    # addition is too cheap to fit an exponent, and the JavaScript gcd is our own Euclid loop (BigInt has
    # no gcd): both are left out of the figure and discussed in the report instead
    shown = ["mul", "div", "mod", "gcd"]
    fig, axes = plt.subplots(1, len(shown), figsize=(10, 3.6), sharey=True)
    names = {"add": "addition", "mul": "multiplication", "div": "division (2n by n bits)", "mod": "remainder (2n by n bits)", "gcd": "gcd"}
    for ax, op in zip(axes, shown):
        for e in ENGINES:
            if e == "js" and op == "gcd":
                continue
            r = out["results"].get(f"{e} {op}")
            if not r:
                continue
            xs = [s for s, t in zip(r["sizes"], r["us"]) if t > 0]
            ys = [t for t in r["us"] if t > 0]
            label, color, marker = STYLE[e]
            ax.plot(xs, ys, color=color, marker=marker, markersize=4, linewidth=2, label=label)
            ax.annotate(f"k={r['k']:.2f}", (xs[-1], ys[-1]), textcoords="offset points", xytext=(4, 0),
                        fontsize=8, color=TXT2, va="center")
        ax.set_xscale("log", base=2)
        ax.set_yscale("log")
        ax.set_title(names[op])
        ax.set_xlabel("operand size (bits)")
        ax.grid(True, color=GRID, linewidth=0.6)
    axes[0].set_ylabel("µs per operation")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, frameon=False, fontsize=8.5, loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.06))
    fig.suptitle("Big-number arithmetic: time per operation against operand size (k: fitted exponent, 2048 bits up)",
                 fontsize=10, fontweight="bold", x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    fig.savefig(path, bbox_inches="tight", metadata={"Date": None})
    print("wrote", path)


if __name__ == "__main__":
    main()
