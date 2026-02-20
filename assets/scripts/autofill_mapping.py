#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import shutil
from collections import defaultdict
from pathlib import Path


DIR_ORDER = ["north", "east", "south", "west", "left", "right"]
DIR_RE = re.compile(r"^(?P<base>.+?)-(?P<dir>north|east|south|west|left|right)\.png$")


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def save_rows(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, delimiter="\t", fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def preferred_category(label: str, fallback: str) -> str:
    if label.startswith(("floor-", "wall-", "stairs-")) or label == "void.png":
        return "tiles"
    if label.startswith("hp-bar") or label in {"level-clear.png", "damage-numbers.png"}:
        return "ui"
    if label.startswith("projectile-") or label in {"slash.png", "heal.png"}:
        return "effects"
    return fallback or "sprites"


def assign_group(rows: list[dict[str, str]]) -> None:
    frame_rows = [r for r in rows if r.get("frame_index")]
    if not frame_rows:
        return
    frame_rows.sort(key=lambda r: int(r["frame_index"]))
    labels = [r["suggested_label"] for r in rows if r.get("suggested_label")]
    unique_labels = list(dict.fromkeys(labels))
    frame_count = len(frame_rows)

    if len(unique_labels) == 1:
        label = unique_labels[0]
        base = label[:-4]
        cat = preferred_category(label, frame_rows[0].get("suggested_category", "sprites"))
        for i, r in enumerate(frame_rows, start=1):
            r["final_label"] = f"{base}-f{i:02d}.png"
            r["final_category"] = cat
        return

    if len(unique_labels) == 2 and frame_count % 2 == 0:
        half = frame_count // 2
        l1, l2 = unique_labels
        c1 = preferred_category(l1, frame_rows[0].get("suggested_category", "sprites"))
        c2 = preferred_category(l2, frame_rows[0].get("suggested_category", "sprites"))
        b1 = l1[:-4]
        b2 = l2[:-4]
        for i, r in enumerate(frame_rows[:half], start=1):
            r["final_label"] = f"{b1}-f{i:02d}.png"
            r["final_category"] = c1
        for i, r in enumerate(frame_rows[half:], start=1):
            r["final_label"] = f"{b2}-f{i:02d}.png"
            r["final_category"] = c2
        return

    parsed = []
    for label in unique_labels:
        m = DIR_RE.match(label)
        if m:
            parsed.append((label, m.group("base"), m.group("dir")))
    if parsed:
        base_names = {x[1] for x in parsed}
        dirs = [x[2] for x in parsed]
        if len(base_names) == 1 and frame_count % len(parsed) == 0:
            per = frame_count // len(parsed)
            order = sorted(parsed, key=lambda x: DIR_ORDER.index(x[2]) if x[2] in DIR_ORDER else 999)
            idx = 0
            for _, base, d in order:
                cat = preferred_category(f"{base}-{d}.png", frame_rows[0].get("suggested_category", "sprites"))
                for k in range(1, per + 1):
                    r = frame_rows[idx]
                    r["final_label"] = f"{base}-{d}-f{k:02d}.png"
                    r["final_category"] = cat
                    idx += 1
            return

    # fallback: keep blank (manual mapping needed)


def copy_finalized(rows: list[dict[str, str]], out_root: Path) -> int:
    out_root.mkdir(parents=True, exist_ok=True)
    copied = 0
    for r in rows:
        src = r.get("frame_file", "")
        label = r.get("final_label", "")
        cat = r.get("final_category", "")
        raw = r.get("raw_file", "")
        if not src or not label or not cat or not raw:
            continue
        raw_stem = Path(raw).stem
        dst_dir = out_root / cat / raw_stem
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / label
        shutil.copy2(src, dst)
        copied += 1
    return copied


def main() -> None:
    ap = argparse.ArgumentParser(description="Autofill mapping_template.tsv conservatively.")
    ap.add_argument("--mapping", default="assets/review/sessions/2026-02-21-batch/mapping_template.tsv")
    ap.add_argument("--out-mapping", default="assets/review/sessions/2026-02-21-batch/mapping_autofilled.tsv")
    ap.add_argument("--out-root", default="assets/delivery/mapped")
    args = ap.parse_args()

    rows = load_rows(Path(args.mapping))
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in rows:
        groups[r["raw_file"]].append(r)

    for raw, group in groups.items():
        assign_group(group)

    fieldnames = list(rows[0].keys())
    save_rows(Path(args.out_mapping), rows, fieldnames)
    copied = copy_finalized(rows, Path(args.out_root))
    print(f"rows={len(rows)} copied={copied} out_mapping={args.out_mapping}")


if __name__ == "__main__":
    main()
