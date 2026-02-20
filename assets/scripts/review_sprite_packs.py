#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import shutil
from pathlib import Path


def export_tsv(sprites_root: Path, out_tsv: Path) -> None:
    rows: list[dict[str, str]] = []
    for role_dir in sorted([p for p in sprites_root.iterdir() if p.is_dir()]):
        role = role_dir.name
        for pack_dir in sorted([p for p in role_dir.iterdir() if p.is_dir()]):
            pngs = sorted(pack_dir.glob("*.png"))
            sample = pngs[0].name if pngs else ""
            rows.append(
                {
                    "current_role": role,
                    "current_pack": pack_dir.name,
                    "frame_count": str(len(pngs)),
                    "sample_png": sample,
                    "target_role": role,
                    "target_pack": pack_dir.name,
                    "note": "",
                }
            )

    out_tsv.parent.mkdir(parents=True, exist_ok=True)
    with out_tsv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "current_role",
                "current_pack",
                "frame_count",
                "sample_png",
                "target_role",
                "target_pack",
                "note",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(rows)


def apply_tsv(sprites_root: Path, review_tsv: Path) -> int:
    rows = list(csv.DictReader(review_tsv.open("r", encoding="utf-8"), delimiter="\t"))
    moved = 0
    for row in rows:
        src = sprites_root / row["current_role"] / row["current_pack"]
        dst = sprites_root / row["target_role"] / row["target_pack"]
        if not src.exists():
            continue
        if src == dst:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            shutil.rmtree(dst)
        shutil.move(str(src), str(dst))
        moved += 1
    return moved


def main() -> None:
    ap = argparse.ArgumentParser(description="Export/apply manual sprite pack review TSV.")
    ap.add_argument("--delivery-root", default="assets/delivery/final/sprites")
    ap.add_argument("--public-root", default="public/assets/sprites")
    ap.add_argument("--review-tsv", default="assets/specs/sprite-pack-review.tsv")
    ap.add_argument("--mode", choices=["export", "apply"], default="export")
    args = ap.parse_args()

    delivery_root = Path(args.delivery_root)
    public_root = Path(args.public_root)
    review_tsv = Path(args.review_tsv)

    if args.mode == "export":
        export_tsv(delivery_root, review_tsv)
        print(f"exported={review_tsv}")
        return

    moved_delivery = apply_tsv(delivery_root, review_tsv)
    moved_public = apply_tsv(public_root, review_tsv)
    print(f"moved_delivery={moved_delivery}")
    print(f"moved_public={moved_public}")


if __name__ == "__main__":
    main()

