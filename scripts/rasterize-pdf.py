#!/usr/bin/env python3
"""Rasterize each PDF page to PNG. Usage: rasterize-pdf.py input.pdf outdir [zoom]"""
import sys
from pathlib import Path

try:
    import fitz
except ImportError:
    sys.stderr.write("pymupdf is required: python3 -m pip install pymupdf\n")
    sys.exit(2)

if len(sys.argv) < 3:
    sys.stderr.write("usage: rasterize-pdf.py input.pdf outdir [zoom]\n")
    sys.exit(1)

src = Path(sys.argv[1])
outdir = Path(sys.argv[2])
zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
outdir.mkdir(parents=True, exist_ok=True)

doc = fitz.open(src)
mat = fitz.Matrix(zoom, zoom)
paths = []
for i, page in enumerate(doc, 1):
    pix = page.get_pixmap(matrix=mat, alpha=False)
    dest = outdir / f"page-{i:03d}.png"
    pix.save(str(dest))
    paths.append(str(dest))
print("\n".join(paths))
