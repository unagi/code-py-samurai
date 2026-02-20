#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
from rembg import new_session, remove
from scipy import ndimage


LABEL_RE = re.compile(r"[a-z0-9][a-z0-9\-]*\.png")


@dataclass
class OcrLabel:
    text: str
    conf: float
    cx: float
    cy: float


@dataclass
class Component:
    x0: int
    y0: int
    x1: int
    y1: int
    cx: float
    cy: float
    pixels: int


def detect_labels(engine: RapidOCR, image_path: Path) -> list[OcrLabel]:
    import cv2

    arr = cv2.imread(str(image_path))
    results, _ = engine(arr)
    if not results:
        return []

    best_by_text: dict[str, OcrLabel] = {}
    for box, raw_text, conf in results:
        text = raw_text.strip().lower()
        m = LABEL_RE.search(text)
        if not m:
            continue
        label = m.group(0)
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        item = OcrLabel(label, float(conf), float(sum(xs) / 4), float(sum(ys) / 4))
        prev = best_by_text.get(label)
        if prev is None or prev.conf < item.conf:
            best_by_text[label] = item

    return sorted(best_by_text.values(), key=lambda x: (x.cy, x.cx))


def remove_background(session, src: Path, dst: Path, alpha_matting: bool) -> None:
    with Image.open(src) as im:
        if alpha_matting:
            out = remove(
                im,
                session=session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=242,
                alpha_matting_background_threshold=6,
                alpha_matting_erode_size=0,
            )
        else:
            out = remove(im, session=session)
        out.save(dst)


def detect_components(image_path: Path, alpha_threshold: int = 16) -> list[Component]:
    im = Image.open(image_path).convert("RGBA")
    alpha = np.array(im)[:, :, 3]
    mask = alpha > alpha_threshold
    labeled, _ = ndimage.label(mask)
    slices = ndimage.find_objects(labeled)

    comps: list[Component] = []
    for idx, s in enumerate(slices, start=1):
        if s is None:
            continue
        y0, y1 = s[0].start, s[0].stop
        x0, x1 = s[1].start, s[1].stop
        pixels = int((labeled[s] == idx).sum())
        if pixels < 2000:
            continue
        cy, cx = ndimage.center_of_mass(mask, labeled, idx)
        comps.append(Component(x0, y0, x1, y1, float(cx), float(cy), pixels))
    return sorted(comps, key=lambda x: (x.cy, x.cx))


def normalize_to_80(src_rgba: Image.Image, comp: Component) -> Image.Image:
    crop = src_rgba.crop((comp.x0, comp.y0, comp.x1, comp.y1))
    w, h = crop.size
    scale = min(48 / w, 48 / h)
    nw = max(1, round(w * scale))
    nh = max(1, round(h * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
    px = 16 + (48 - nw) // 2
    py = 8 + (48 - nh)
    canvas.alpha_composite(resized, (px, py))
    return canvas


def category_for_label(label: str) -> str:
    if label.startswith(("floor-", "wall-", "stairs-")) or label == "void.png":
        return "tiles"
    if label.startswith("hp-bar") or label in {"level-clear.png", "damage-numbers.png"}:
        return "ui"
    if label.startswith("projectile-") or label in {"slash.png", "heal.png"}:
        return "effects"
    return "sprites"


def safe_stem(path: Path) -> str:
    return path.stem.replace(" ", "_")


def run(
    input_dir: Path,
    output_dir: Path,
    review_dir: Path,
    providers: list[str],
    alpha_matting: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "staging").mkdir(exist_ok=True)
    (output_dir / "sprites").mkdir(exist_ok=True)
    (output_dir / "tiles").mkdir(exist_ok=True)
    (output_dir / "effects").mkdir(exist_ok=True)
    (output_dir / "ui").mkdir(exist_ok=True)

    engine = RapidOCR()
    session = new_session("isnet-general-use", providers=providers)

    rows: list[dict[str, str]] = []
    mapping_rows: list[dict[str, str]] = []
    raw_files = sorted(input_dir.glob("*.png"))
    for i, raw in enumerate(raw_files, start=1):
        print(f"[{i}/{len(raw_files)}] processing {raw.name}", flush=True)
        src_id = safe_stem(raw)
        bg_removed = review_dir / f"{src_id}-bg.png"
        remove_background(session, raw, bg_removed, alpha_matting=alpha_matting)

        labels = detect_labels(engine, raw)
        comps = detect_components(bg_removed)
        labels_by_idx = sorted(labels, key=lambda x: (x.cy, x.cx))
        mismatch = len(labels_by_idx) != len(comps)
        staging_dir = output_dir / "staging" / src_id
        staging_dir.mkdir(parents=True, exist_ok=True)

        with Image.open(bg_removed).convert("RGBA") as rgba:
            for idx, comp in enumerate(comps):
                frame_index = idx + 1
                frame_name = f"frame-{frame_index:02d}.png"
                frame_path = staging_dir / frame_name
                normalized = normalize_to_80(rgba, comp)
                normalized.save(frame_path)

                suggested_label = ""
                suggested_conf = ""
                suggested_category = ""
                status = "needs_mapping" if mismatch else "exact_auto"
                out_path = ""
                note = f"labels={len(labels_by_idx)} comps={len(comps)}" if mismatch else ""

                if idx < len(labels_by_idx):
                    label = labels_by_idx[idx].text
                    suggested_label = label
                    suggested_conf = f"{labels_by_idx[idx].conf:.3f}"
                    suggested_category = category_for_label(label)

                if not mismatch and suggested_label:
                    label_base = suggested_label[:-4]
                    mapped_dir = output_dir / suggested_category / src_id
                    mapped_dir.mkdir(parents=True, exist_ok=True)
                    used_name = mapped_dir / f"{label_base}.png"
                    out_path = str(used_name)
                    normalized.save(used_name)

                rows.append(
                    {
                        "raw_file": raw.name,
                        "frame_index": str(frame_index),
                        "frame_file": str(frame_path),
                        "suggested_label": suggested_label,
                        "suggested_category": suggested_category,
                        "status": status,
                        "output_file": out_path,
                        "ocr_confidence": suggested_conf,
                        "bbox": f"{comp.x0},{comp.y0},{comp.x1},{comp.y1}",
                        "note": note,
                    }
                )
                mapping_rows.append(
                    {
                        "raw_file": raw.name,
                        "frame_index": str(frame_index),
                        "frame_file": str(frame_path),
                        "suggested_label": suggested_label,
                        "suggested_category": suggested_category,
                        "ocr_confidence": suggested_conf,
                        "final_label": "",
                        "final_category": "",
                        "note": note,
                    }
                )

            if len(comps) < len(labels_by_idx):
                for idx in range(len(comps), len(labels_by_idx)):
                    mapping_rows.append(
                        {
                            "raw_file": raw.name,
                            "frame_index": "",
                            "frame_file": "",
                            "suggested_label": labels_by_idx[idx].text,
                            "suggested_category": category_for_label(labels_by_idx[idx].text),
                            "ocr_confidence": f"{labels_by_idx[idx].conf:.3f}",
                            "final_label": "",
                            "final_category": "",
                            "note": f"unmatched_label labels={len(labels_by_idx)} comps={len(comps)}",
                        }
                    )

    manifest = review_dir / "batch_manifest.tsv"
    with manifest.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "raw_file",
                "frame_index",
                "frame_file",
                "suggested_label",
                "suggested_category",
                "status",
                "output_file",
                "ocr_confidence",
                "bbox",
                "note",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(rows)

    mapping_template = review_dir / "mapping_template.tsv"
    with mapping_template.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "raw_file",
                "frame_index",
                "frame_file",
                "suggested_label",
                "suggested_category",
                "ocr_confidence",
                "final_label",
                "final_category",
                "note",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(mapping_rows)

    print(f"processed_raw_files={len(raw_files)}")
    print(f"manifest={manifest}")
    print(f"mapping_template={mapping_template}")


def main() -> None:
    p = argparse.ArgumentParser(description="Batch OCR label + bg removal + normalize 80x80.")
    p.add_argument("--input-dir", default="assets/incoming/raw")
    p.add_argument("--output-dir", default="assets/delivery")
    p.add_argument("--review-dir", default="assets/review/sessions/2026-02-21-batch")
    p.add_argument(
        "--providers",
        default="CUDAExecutionProvider,CPUExecutionProvider",
        help="Comma separated ONNX providers for rembg session.",
    )
    p.add_argument(
        "--alpha-matting",
        action="store_true",
        help="Enable alpha matting (better edges, much slower).",
    )
    args = p.parse_args()
    providers = [x.strip() for x in args.providers.split(",") if x.strip()]
    run(
        Path(args.input_dir),
        Path(args.output_dir),
        Path(args.review_dir),
        providers,
        alpha_matting=args.alpha_matting,
    )


if __name__ == "__main__":
    main()
