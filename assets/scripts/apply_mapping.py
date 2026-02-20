#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import shutil
from collections import defaultdict
from pathlib import Path

DIR_SUFFIX_RE = re.compile(r"-(north|east|south|west|left|right)$")


def infer_category(row: dict[str, str]) -> str:
    if row.get("final_category"):
        return row["final_category"]
    if row.get("suggested_category"):
        return row["suggested_category"]
    return "sprites"


def sanitize_token(token: str) -> str:
    t = token.lower()
    t = re.sub(r"[^a-z0-9\-]+", "-", t)
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t or "sheet"


def build_pack_name(rows: list[dict[str, str]], category: str, used: set[str]) -> str:
    labels = [r.get("suggested_label", "") for r in rows if r.get("suggested_label")]
    bases: list[str] = []
    for label in labels:
        stem = label[:-4] if label.endswith(".png") else label
        stem = DIR_SUFFIX_RE.sub("", stem)
        if stem and stem not in bases:
            bases.append(stem)

    if bases:
        parts = bases[:2]
        candidate = "-".join(parts)
        if len(bases) > 2:
            candidate = f"{candidate}-etc"
    else:
        candidate = "sheet"

    base_name = sanitize_token(candidate)
    name = base_name
    i = 2
    while f"{category}/{name}" in used:
        name = f"{base_name}-{i:02d}"
        i += 1
    used.add(f"{category}/{name}")
    return name


def infer_label(row: dict[str, str], index_in_raw: int, used: set[str]) -> str:
    if row.get("final_label"):
        return row["final_label"]
    if row.get("suggested_label"):
        base = row["suggested_label"][:-4]
        candidate = f"{base}-f{index_in_raw:02d}.png"
    else:
        frame_idx = row.get("frame_index", "")
        candidate = f"frame-{int(frame_idx):02d}.png" if frame_idx else f"frame-{index_in_raw:02d}.png"

    if candidate not in used:
        return candidate
    stem = candidate[:-4]
    n = 2
    while f"{stem}-{n}.png" in used:
        n += 1
    return f"{stem}-{n}.png"


def main() -> None:
    ap = argparse.ArgumentParser(description="Apply mapping template to final asset layout.")
    ap.add_argument("--mapping", default="assets/review/sessions/2026-02-21-batch/mapping_autofilled.tsv")
    ap.add_argument("--out-root", default="assets/delivery/final")
    ap.add_argument("--public-root", default="public/assets")
    args = ap.parse_args()

    mapping = Path(args.mapping)
    out_root = Path(args.out_root)
    public_root = Path(args.public_root)

    if out_root.exists():
        shutil.rmtree(out_root)
    for cat in ("sprites", "tiles", "effects", "ui"):
        (out_root / cat).mkdir(parents=True, exist_ok=True)
        (public_root / cat).mkdir(parents=True, exist_ok=True)

    rows = list(csv.DictReader(mapping.open("r", encoding="utf-8"), delimiter="\t"))
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in rows:
        if r.get("frame_file"):
            grouped[r["raw_file"]].append(r)

    copied = 0
    used_pack_names: set[str] = set()
    for _raw_file, items in grouped.items():
        items.sort(key=lambda r: int(r["frame_index"]) if r["frame_index"] else 9999)
        used_names: set[str] = set()

        suggested = [r.get("suggested_category", "") for r in items if r.get("suggested_category")]
        default_cat = max(set(suggested), key=suggested.count) if suggested else "sprites"

        by_cat: dict[str, list[dict[str, str]]] = defaultdict(list)
        for r in items:
            c = infer_category(r)
            if not r.get("final_category") and not r.get("suggested_category"):
                c = default_cat
            by_cat[c].append(r)
        pack_name_by_cat = {
            c: build_pack_name(rs, c, used_pack_names) for c, rs in by_cat.items()
        }

        for i, r in enumerate(items, start=1):
            src = Path(r["frame_file"])
            if not src.exists():
                continue
            cat = infer_category(r)
            if not r.get("final_category") and not r.get("suggested_category"):
                cat = default_cat
            label = infer_label(r, i, used_names)
            used_names.add(label)

            dst = out_root / cat / pack_name_by_cat[cat] / label
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied += 1

    # Mirror into public/assets for runtime verification
    for cat in ("sprites", "tiles", "effects", "ui"):
        src_cat = out_root / cat
        dst_cat = public_root / cat
        if dst_cat.exists():
            for p in dst_cat.iterdir():
                if p.name == ".gitkeep":
                    continue
                if p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
        if src_cat.exists():
            for p in src_cat.iterdir():
                if p.is_dir():
                    shutil.copytree(p, dst_cat / p.name)

    print(f"copied_frames={copied}")
    print(f"out_root={out_root}")
    print(f"public_root={public_root}")


if __name__ == "__main__":
    main()
