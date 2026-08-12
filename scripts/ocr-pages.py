#!/usr/bin/env python3
"""Rasterize a PDF/image and OCR each page. Prints JSON to stdout.

Usage: ocr-pages.py <pdf-or-image> [--zoom 2.0]
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

try:
    import fitz
except ImportError:
    sys.stderr.write("pymupdf is required: python3 -m pip install pymupdf\n")
    sys.exit(2)

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    sys.stderr.write("rapidocr-onnxruntime is required: python3 -m pip install rapidocr-onnxruntime pillow\n")
    sys.exit(2)


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".gif"}


def rasterize(src: Path, outdir: Path, zoom: float) -> list[Path]:
    if src.suffix.lower() in IMAGE_EXTS:
        return [src]
    doc = fitz.open(src)
    mat = fitz.Matrix(zoom, zoom)
    paths: list[Path] = []
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        dest = outdir / f"page-{i:03d}.png"
        pix.save(str(dest))
        paths.append(dest)
    return paths


def box_norm(box, width: float, height: float) -> dict:
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    return {
        "x": round(x0 / width, 4) if width else 0,
        "y": round(y0 / height, 4) if height else 0,
        "w": round((x1 - x0) / width, 4) if width else 0,
        "h": round((y1 - y0) / height, 4) if height else 0,
    }


def ocr_image(engine: RapidOCR, path: Path) -> dict:
    result, elapse = engine(str(path))
    try:
        import PIL.Image

        with PIL.Image.open(path) as im:
            width, height = im.size
    except Exception:
        width, height = 0, 0
        if result:
            xs = [p[0] for row in result for p in row[0]]
            ys = [p[1] for row in result for p in row[0]]
            width = max(xs) if xs else 0
            height = max(ys) if ys else 0

    lines = []
    if result:
        for box, text, score in result:
            if not text or not str(text).strip():
                continue
            lines.append(
                {
                    "text": str(text).strip(),
                    "confidence": float(score),
                    "width_px": width,
                    "height_px": height,
                    **box_norm(box, width, height),
                }
            )

    lines.sort(key=lambda L: (round(L["y"], 3), L["x"]))
    return {
        "text": "\n".join(L["text"] for L in lines),
        "width": width,
        "height": height,
        "elapsed": elapse if isinstance(elapse, (int, float)) else None,
        "lines": lines,
    }


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: ocr-pages.py <pdf-or-image> [--zoom 2.0]\n")
        return 1
    src = Path(sys.argv[1])
    zoom = 2.0
    if "--zoom" in sys.argv:
        i = sys.argv.index("--zoom")
        zoom = float(sys.argv[i + 1])
    if not src.exists():
        sys.stderr.write(f"file not found: {src}\n")
        return 1

    engine = RapidOCR()
    pages = []
    with tempfile.TemporaryDirectory(prefix="fleet-ocr-") as tmp:
        images = rasterize(src, Path(tmp), zoom)
        for i, image in enumerate(images, 1):
            page = ocr_image(engine, image)
            page["page"] = i
            pages.append(page)

    json.dump({"pages": pages, "engine": "rapidocr"}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
