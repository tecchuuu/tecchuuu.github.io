"""Typeset the margin formulas with real LaTeX and save each one as an SVG.

Needs `latex` and `dvisvgm` on PATH (MiKTeX or TeX Live). From the repo root:

    python tools/build_formulas.py

Glyphs are converted to paths (--no-fonts), so the SVGs need no fonts in the
browser. Each formula here comes from one of the projects on the site.
"""
import pathlib
import re
import subprocess
import tempfile

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "formulas"
SCALE = 1.9          # 10pt glyphs end up about 25px tall on the page
INK = "#1f2533"      # --graphite in assets/css/site.css

FORMULAS = {
    # neural network from scratch
    "sgd": r"\theta_{t+1} = \theta_t - \eta \, \nabla_{\theta} \mathcal{L}(\theta_t)",
    "backprop": r"\delta^{(l)} = \bigl(W^{(l+1)}\bigr)^{\!\top} \delta^{(l+1)} \odot \sigma'\bigl(z^{(l)}\bigr)",
    "gradient": r"\frac{\partial \mathcal{L}}{\partial W^{(l)}} = \delta^{(l)} \bigl(a^{(l-1)}\bigr)^{\!\top}",
    "sigmoid": r"\sigma(z) = \frac{1}{1 + e^{-z}}",
    # ASL trainer
    "softmax": r"\operatorname{softmax}(\mathbf{z})_k = \frac{e^{z_k}}{\sum_{j=1}^{K} e^{z_j}}",
    "xent": r"\mathcal{L} = -\sum_{k=1}^{K} y_k \log \hat{y}_k",
    # AI-enhanced XDR
    "recon": r"s(\mathbf{x}) = \lVert \mathbf{x} - \hat{\mathbf{x}} \rVert_2^2",
    "iforest": r"s(x, n) = 2^{-\frac{\mathbb{E}[h(x)]}{c(n)}}",
    # security and ML share this one
    "entropy": r"H(X) = -\sum_{x \in \mathcal{X}} p(x) \log_2 p(x)",
    # TriageAI
    "tfidf": r"\operatorname{tfidf}(t, d) = \operatorname{tf}(t, d) \cdot \log \frac{N}{\operatorname{df}(t)}",
    # Path to psi
    "schrodinger": r"i\hbar \, \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H} \, \Psi(\mathbf{r}, t)",
}

TEMPLATE = r"""\documentclass[border=1pt]{standalone}
\usepackage{amsmath,amssymb}
\begin{document}
$\displaystyle %s$
\end{document}
"""


def scale_size(match):
    attr, value = match.group(1), float(match.group(2))
    return f"{attr}='{value * 4 / 3 * SCALE:.2f}px'"


def build(name, tex, work):
    (work / f"{name}.tex").write_text(TEMPLATE % tex, encoding="utf-8")
    subprocess.run(["latex", "-interaction=nonstopmode", "-halt-on-error", f"{name}.tex"],
                   cwd=work, check=True, capture_output=True)
    subprocess.run(["dvisvgm", "--no-fonts", "--exact-bbox", "-o", f"{name}.svg", f"{name}.dvi"],
                   cwd=work, check=True, capture_output=True)
    svg = (work / f"{name}.svg").read_text(encoding="utf-8")
    # scale the intrinsic size (the viewBox stays), and ink the glyphs
    svg = re.sub(r"(width|height)='([\d.]+)pt'", scale_size, svg, count=2)
    svg = svg.replace("<g id='page1'>", f"<g id='page1' fill='{INK}'>", 1)
    (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, tex in FORMULAS.items():
            build(name, tex, pathlib.Path(tmp))
            print("built", name)


if __name__ == "__main__":
    main()
